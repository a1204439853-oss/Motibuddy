use std::sync::{Arc, Mutex, atomic::{AtomicBool, Ordering}};

#[derive(Clone, Default)]
pub struct VoiceState(Arc<Mutex<VoiceData>>);
#[derive(Default)]
struct VoiceData { active: Option<(String, Arc<AtomicBool>)>, cancelled: std::collections::VecDeque<String> }
pub struct VoiceGuard { state: VoiceState, id: String }
impl Drop for VoiceGuard {
    fn drop(&mut self) {
        if let Ok(mut active) = self.state.0.lock() {
            if active.active.as_ref().map(|(id, _)| id) == Some(&self.id) { active.active = None; }
        }
    }
}
impl VoiceState {
    pub fn begin(&self, id: &str) -> Result<(Arc<AtomicBool>, VoiceGuard), String> {
        if id.is_empty() || id.len() > 80 || !id.bytes().all(|c| c.is_ascii_alphanumeric() || c == b'-') { return Err("SPEECH_INVALID_REQUEST".into()); }
        let mut active = self.0.lock().map_err(|_| "SPEECH_UNAVAILABLE")?;
        if let Some(index) = active.cancelled.iter().position(|cancelled| cancelled == id) { active.cancelled.remove(index); return Err("SPEECH_CANCELLED".into()); }
        if active.active.is_some() { return Err("SPEECH_BUSY".into()); }
        let cancel = Arc::new(AtomicBool::new(false));
        active.active = Some((id.to_owned(), cancel.clone()));
        Ok((cancel, VoiceGuard { state: self.clone(), id: id.to_owned() }))
    }
    pub fn cancel(&self, id: &str) {
        if let Ok(mut data) = self.0.lock() {
            if let Some((current, cancel)) = data.active.as_ref() { if current == id { cancel.store(true, Ordering::SeqCst); return; } }
            // A cancel IPC can arrive before its asynchronous start command is first polled.
            if data.cancelled.len() >= 64 { data.cancelled.pop_front(); }
            data.cancelled.push_back(id.to_owned());
        }
    }
    pub fn cancel_all(&self) { if let Ok(data) = self.0.lock() { if let Some((_, cancel)) = data.active.as_ref() { cancel.store(true, Ordering::SeqCst); } } }
}

pub fn parse_result(output: &[u8]) -> Result<String, String> {
    let value: serde_json::Value = serde_json::from_slice(output).map_err(|_| "SPEECH_UNAVAILABLE")?;
    if let Some(text) = value["text"].as_str().filter(|text| !text.trim().is_empty() && text.chars().count() <= 1400) { return Ok(text.trim().to_owned()); }
    match value["error"].as_str().unwrap_or("") {
        "SPEECH_LANGUAGE_MISSING" => Err("SPEECH_LANGUAGE_MISSING".into()),
        "SPEECH_NO_RESULT" => Err("SPEECH_NO_RESULT".into()),
        "SPEECH_MICROPHONE_UNAVAILABLE" => Err("SPEECH_MICROPHONE_UNAVAILABLE".into()),
        _ => Err("SPEECH_UNAVAILABLE".into()),
    }
}

#[cfg(windows)]
pub fn recognize(locale: &str, cancel: Arc<AtomicBool>) -> Result<String, String> {
    use base64::Engine;
    use std::{process::{Command, Stdio}, os::windows::process::CommandExt, time::{Instant, Duration}, io::Read};
    if !["zh-CN", "en-US"].contains(&locale) { return Err("SPEECH_LANGUAGE_MISSING".into()); }
    if cancel.load(Ordering::SeqCst) { return Err("SPEECH_CANCELLED".into()); }
    // Fixed program and script, validated locale only; no task content or credential enters a shell command.
    let script = format!("& {{ {} }} -Locale '{}'", include_str!("speech_input.ps1"), locale);
    let encoded: Vec<u8> = script.encode_utf16().flat_map(|unit| unit.to_le_bytes()).collect();
    let executable = std::path::PathBuf::from(std::env::var_os("SystemRoot").unwrap_or_else(|| "C:\\Windows".into())).join("System32/WindowsPowerShell/v1.0/powershell.exe");
    let mut child = Command::new(executable).args(["-NoProfile", "-NonInteractive", "-EncodedCommand", &base64::engine::general_purpose::STANDARD.encode(encoded)])
        .creation_flags(0x08000000).stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::null())
        .spawn().map_err(|_| "SPEECH_UNAVAILABLE")?;
    let started = Instant::now();
    loop {
        if cancel.load(Ordering::SeqCst) || started.elapsed() > Duration::from_secs(25) {
            let _ = child.kill(); let _ = child.wait();
            return Err(if cancel.load(Ordering::SeqCst) { "SPEECH_CANCELLED" } else { "SPEECH_NO_RESULT" }.into());
        }
        match child.try_wait() {
            Ok(Some(_)) => break,
            Ok(None) => std::thread::sleep(Duration::from_millis(100)),
            Err(_) => { let _ = child.kill(); let _ = child.wait(); return Err("SPEECH_UNAVAILABLE".into()); }
        }
    }
    let mut bytes = Vec::new();
    child.stdout.take().ok_or("SPEECH_UNAVAILABLE")?.take(16000).read_to_end(&mut bytes).map_err(|_| "SPEECH_UNAVAILABLE")?;
    parse_result(&bytes)
}
#[cfg(not(windows))]
pub fn recognize(_locale: &str, _cancel: Arc<AtomicBool>) -> Result<String, String> { Err("SPEECH_UNAVAILABLE".into()) }

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn speech_results_are_bounded_and_errors_sanitized() {
        assert_eq!(parse_result("{\"text\":\"明天读书\"}".as_bytes()).unwrap(), "明天读书");
        assert_eq!(parse_result(b"{\"error\":\"SPEECH_LANGUAGE_MISSING\"}").unwrap_err(), "SPEECH_LANGUAGE_MISSING");
        assert_eq!(parse_result(b"private process error").unwrap_err(), "SPEECH_UNAVAILABLE");
        assert!(parse_result(serde_json::json!({"text":"x".repeat(1401)}).to_string().as_bytes()).is_err());
    }
    #[test]
    fn cancellation_is_scoped_and_microphone_access_is_exclusive() {
        let state = VoiceState::default();
        let (cancel, guard) = state.begin("one").unwrap();
        assert!(state.begin("two").is_err()); state.cancel("other"); assert!(!cancel.load(Ordering::SeqCst));
        state.cancel("one"); assert!(cancel.load(Ordering::SeqCst)); drop(guard);
        assert!(state.begin("two").is_ok()); assert!(state.begin("bad;command").is_err());
        state.cancel("before-start"); assert!(state.begin("before-start").is_err());
    }
}
