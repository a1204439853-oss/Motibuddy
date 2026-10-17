param([ValidateSet('zh-CN', 'en-US')][string]$Locale = 'zh-CN', [switch]$Probe)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$engine = $null
try {
    Add-Type -AssemblyName System.Speech
    $recognizer = [System.Speech.Recognition.SpeechRecognitionEngine]::InstalledRecognizers() | Where-Object { $_.Culture.Name -eq $Locale } | Select-Object -First 1
    if ($null -eq $recognizer) { @{ error = 'SPEECH_LANGUAGE_MISSING' } | ConvertTo-Json -Compress; exit }
    $engine = New-Object System.Speech.Recognition.SpeechRecognitionEngine($recognizer)
    $engine.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar))
    if ($Probe) { @{ available = $true; locale = $Locale } | ConvertTo-Json -Compress; exit }
    $engine.SetInputToDefaultAudioDevice()
    $engine.InitialSilenceTimeout = [TimeSpan]::FromSeconds(8)
    $engine.BabbleTimeout = [TimeSpan]::FromSeconds(10)
    $engine.EndSilenceTimeout = [TimeSpan]::FromMilliseconds(900)
    $result = $engine.Recognize([TimeSpan]::FromSeconds(8))
    if ($null -eq $result -or [string]::IsNullOrWhiteSpace($result.Text)) { @{ error = 'SPEECH_NO_RESULT' } | ConvertTo-Json -Compress }
    else { @{ text = $result.Text.Substring(0, [Math]::Min(1400, $result.Text.Length)) } | ConvertTo-Json -Compress }
} catch {
    # Never log microphone audio, recognized text, machine paths or exception details.
    @{ error = 'SPEECH_MICROPHONE_UNAVAILABLE' } | ConvertTo-Json -Compress
} finally {
    if ($null -ne $engine) { $engine.Dispose() }
}
