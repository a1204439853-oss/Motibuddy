use serde_json::Value;
use std::{collections::HashSet,sync::{Mutex,atomic::AtomicU64}};
#[derive(Default)]
pub struct NotificationAccount(pub Mutex<Option<(String,String)>>,pub AtomicU64);
#[cfg(windows)]
pub fn register(app_id:&str)->Result<(),String>{
    use winreg::{RegKey,enums::HKEY_CURRENT_USER};
    if app_id.len()>128 || !app_id.chars().all(|c|c.is_ascii_alphanumeric()||c=='.'||c=='-'){return Err("NOTIFICATION_ID_INVALID".into());}
    let user=RegKey::predef(HKEY_CURRENT_USER);
    let (key,_)=user.create_subkey(format!(r"Software\Classes\AppUserModelId\{}",app_id)).map_err(|_|"NOTIFICATION_REGISTRATION_FAILED")?;
    key.set_value("DisplayName",&"MotiBuddy").map_err(|_|"NOTIFICATION_REGISTRATION_FAILED")?;
    key.set_value("IconBackgroundColor",&"0").map_err(|_|"NOTIFICATION_REGISTRATION_FAILED")?;
    for (path,name) in [(format!(r"Software\Microsoft\Windows\CurrentVersion\Notifications\Settings\{}",app_id),"Enabled"),(r"Software\Microsoft\Windows\CurrentVersion\PushNotifications".into(),"ToastEnabled")]{
        if let Ok(key)=user.open_subkey(path){if key.get_value::<u32,_>(name).ok()==Some(0){return Err("NOTIFICATIONS_DISABLED".into());}}
    }
    Ok(())
}
#[cfg(not(windows))]
pub fn register(_app_id:&str)->Result<(),String>{Err("WINDOWS_ONLY".into())}
#[cfg(windows)]
pub fn show(app_id:&str,title:&str,body:&str)->Result<(),String>{
    if title.trim().is_empty()||title.chars().count()>100||body.chars().count()>1000{return Err("INVALID_NOTIFICATION".into());}
    register(app_id)?;
    tauri_winrt_notification::Toast::new(app_id).title(title).text1(body)
      .sound(Some(tauri_winrt_notification::Sound::Default))
      .duration(tauri_winrt_notification::Duration::Long).show().map_err(|_|"NOTIFICATION_FAILED".to_string())
}
#[cfg(not(windows))]
pub fn show(_app_id:&str,_title:&str,_body:&str)->Result<(),String>{Err("WINDOWS_ONLY".into())}
/// Only explicit reminders of the signed-in account are considered. Windows receives the
/// notification even while WebView timers are throttled or the main window is hidden.
pub fn process(data:&mut crate::business_store::BusinessData,owner:&str,locale:&str,now:chrono::DateTime<chrono::Utc>,delivered:&mut HashSet<String>,send:impl Fn(&str,&str)->Result<(),String>)->bool{
    let mut changed=false;
    if let Some(tasks)=data.tasks.as_array_mut(){for task in tasks{
        if task["status"]=="completed"{continue;}
        let Some(end)=task["dueDate"].as_str().and_then(|s|chrono::DateTime::parse_from_rfc3339(s).ok()) else{continue};
        let id=task["id"].as_str().unwrap_or("").to_string();let title=task["title"].as_str().unwrap_or("MotiBuddy").chars().take(100).collect::<String>();
        let body=format!("{} {}",if locale=="zh-CN"{"任务即将截止："}else{"Task due: "},end.with_timezone(&chrono::Local).format("%m-%d %H:%M"));
        if let Some(reminders)=task.get_mut("reminders").and_then(Value::as_array_mut){for reminder in reminders{
            if reminder["sent"]==true{continue;}let Some(at)=reminder["time"].as_str().and_then(|s|chrono::DateTime::parse_from_rfc3339(s).ok()) else{continue};
            if at>now{continue;}let key=format!("{}|{}|{}",owner,id,at.to_rfc3339());
            if end<now||now.signed_duration_since(at).num_hours()>=24{reminder["sent"]=Value::Bool(true);changed=true;continue;}
            if delivered.contains(&key)||send(&title,&body).is_ok(){delivered.insert(key);reminder["sent"]=Value::Bool(true);changed=true;}
        }}
    }}changed
}
#[cfg(test)]mod tests{
 use super::*;use serde_json::json;
 fn data()->crate::business_store::BusinessData{crate::business_store::BusinessData{tasks:json!([{"id":"a","title":"Meet","status":"pending","dueDate":"2026-10-17T12:00:00Z","reminders":[{"time":"2026-10-17T11:00:00Z","sent":false}]}]),pet:Value::Null,achievements:json!([]),settings:json!({})}}
 #[test]fn failed_native_dispatch_is_not_recorded_and_unknown_commit_is_deduplicated(){let mut d=data();let now=chrono::DateTime::parse_from_rfc3339("2026-10-17T11:01:00Z").unwrap().with_timezone(&chrono::Utc);let mut sent=HashSet::new();assert!(!process(&mut d,"A","zh-CN",now,&mut sent,|_,_|Err("denied".into())));assert_eq!(d.tasks[0]["reminders"][0]["sent"],false);assert!(process(&mut d,"A","zh-CN",now,&mut sent,|_,_|Ok(())));let mut restored=data();assert!(process(&mut restored,"A","zh-CN",now,&mut sent,|_,_|panic!("duplicate OS call")));}
 #[test]fn completed_tasks_do_not_notify(){let mut d=data();d.tasks[0]["status"]=json!("completed");let now=chrono::Utc::now();assert!(!process(&mut d,"A","zh-CN",now,&mut HashSet::new(),|_,_|panic!("completed")));}
 #[test]#[ignore]fn native_toast_with_sound_acceptance(){show("com.motibuddy.verify","MotiBuddy 验收提醒","这是一条有提示音的 Windows 桌面通知。").unwrap();std::thread::sleep(std::time::Duration::from_secs(3));}
}
