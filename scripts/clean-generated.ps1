[CmdletBinding()]
param([switch]$Apply)
$ErrorActionPreference = 'Stop'
$taskRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path.TrimEnd('\')
$taskPrefix = $taskRoot + '\'
$taskCommit = (& git -C $taskRoot rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0) { throw 'A Git snapshot is required before cleanup.' }
$taskLatestExe = Join-Path $taskRoot 'MotiBuddy-Verify-onboarding.exe'
if ($Apply) {
    if (!(Test-Path -LiteralPath $taskLatestExe -PathType Leaf)) { throw 'Build and copy the latest onboarding EXE before cleanup.' }
    $taskBuildExe = Join-Path $taskRoot 'src-tauri\target\release\MotiBuddy Verify.exe'
    if (Test-Path -LiteralPath $taskBuildExe -PathType Leaf) {
        if ((Get-FileHash -LiteralPath $taskBuildExe).Hash -ne (Get-FileHash -LiteralPath $taskLatestExe).Hash) { throw 'The retained EXE does not match the current build.' }
    }
}
# Fixed generated-file allowlist. Application data, source media, documents,
# node_modules dependencies and Git history are deliberately outside this list.
$taskRelativePaths = @(
    'src-tauri\target', 'dist', 'dist-main', 'dist-widget', 'dist_videos',
    'node_modules\.vite', 'node_modules\.vite-temp',
    'node_modules\.cache\motibuddy-reliability-build',
    'node_modules\.cache\motibuddy-storage-paths-tests.exe',
    'node_modules\.cache\motibuddy-storage-paths-tests.pdb',
    'wix314-binaries.zip', 'MotiBuddy-Verify-254b597.exe',
    'MotiBuddy-Verify-zh-en.exe', 'MotiBuddy-Verify-profile-settings.exe'
)
$taskBrowserRoot = Join-Path $taskRoot 'node_modules\.cache\motibuddy-i18n'
if (Test-Path -LiteralPath $taskBrowserRoot -PathType Container) {
    $taskRelativePaths += Get-ChildItem -LiteralPath $taskBrowserRoot -Directory -Force |
        Where-Object { $_.Name -match '^browser-\d+$' } |
        ForEach-Object { 'node_modules\.cache\motibuddy-i18n\' + $_.Name }
}
$taskCandidates = @()
foreach ($taskRelative in $taskRelativePaths) {
    $taskPath = [IO.Path]::GetFullPath((Join-Path $taskRoot $taskRelative))
    if (!$taskPath.StartsWith($taskPrefix, [StringComparison]::OrdinalIgnoreCase)) { throw "Target outside workspace: $taskPath" }
    if (!(Test-Path -LiteralPath $taskPath)) { continue }
    $taskEntry = Get-Item -LiteralPath $taskPath -Force
    if ($taskEntry.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Refusing linked target: $taskPath" }
    $taskTracked = @(& git -C $taskRoot ls-files -- $taskRelative)
    if ($LASTEXITCODE -ne 0 -or $taskTracked.Count) { throw "Refusing tracked or unverified target: $taskPath" }
    if ($taskEntry.PSIsContainer) {
        $taskChildren = @(Get-ChildItem -LiteralPath $taskPath -Recurse -Force)
        if (@($taskChildren | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }).Count) { throw "Refusing nested links: $taskPath" }
        $taskFiles = @($taskChildren | Where-Object { !$_.PSIsContainer })
    } else { $taskFiles = @($taskEntry) }
    $taskBytes = [long](($taskFiles | Measure-Object -Property Length -Sum).Sum)
    $taskCandidates += [pscustomobject]@{ RelativePath=$taskRelative; Path=$taskPath; Bytes=$taskBytes; Files=$taskFiles.Count }
}
$taskCandidates | Select-Object RelativePath, @{Name='MiB';Expression={[math]::Round($_.Bytes / 1MB, 2)}}, Files | Format-Table -AutoSize
if (!$Apply) {
    Write-Output 'Dry run only. Use -Apply after verifying and copying the new EXE.'
    return
}
# Preflight every path before beginning deletion, using the same native shell.
$taskRunning = @(Get-Process | Where-Object {
    $taskProcessPath = $_.Path
    $taskProcessPath -and @($taskCandidates | Where-Object {
        $taskProcessPath -eq $_.Path -or $taskProcessPath.StartsWith($_.Path + '\', [StringComparison]::OrdinalIgnoreCase)
    }).Count
})
if ($taskRunning.Count) { throw 'A process is running from a cleanup target. Close it before applying cleanup.' }
$taskDeleted = @(); $taskFailures = @()
$taskDiskRoot = [IO.Path]::GetPathRoot($taskRoot)
$taskFreeBefore = [IO.DriveInfo]::new($taskDiskRoot).AvailableFreeSpace
foreach ($taskCandidate in $taskCandidates) {
    try {
        Remove-Item -LiteralPath $taskCandidate.Path -Recurse -Force
        if (Test-Path -LiteralPath $taskCandidate.Path) { throw 'Target remains after deletion.' }
        $taskDeleted += $taskCandidate
    } catch { $taskFailures += [pscustomobject]@{Path=$taskCandidate.Path; Error=$_.Exception.Message} }
}
$taskFreed = [long](($taskDeleted | Measure-Object -Property Bytes -Sum).Sum)
$taskFreeAfter = [IO.DriveInfo]::new($taskDiskRoot).AvailableFreeSpace
$taskReport = [ordered]@{
    CreatedAt=(Get-Date).ToUniversalTime().ToString('o'); SnapshotCommit=$taskCommit
    DeletedBytes=$taskFreed; DeletedGiB=[math]::Round($taskFreed / 1GB, 3)
    DiskFreeBytesBefore=$taskFreeBefore; DiskFreeBytesAfter=$taskFreeAfter
    DiskFreeIncreaseGiB=[math]::Round(($taskFreeAfter - $taskFreeBefore) / 1GB, 3)
    RetainedExe=$taskLatestExe; RetainedExeSha256=(Get-FileHash -LiteralPath $taskLatestExe).Hash
    Deleted=$taskDeleted; Failures=$taskFailures
}
$taskReportPath = Join-Path $taskRoot 'docs\WORKSPACE_CLEANUP_REPORT.json'
$taskReport | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $taskReportPath -Encoding utf8
Write-Output "Removed $($taskReport.DeletedGiB) GiB of generated files; disk free space increased by $($taskReport.DiskFreeIncreaseGiB) GiB. Report: $taskReportPath"
if ($taskFailures.Count) { throw 'Some cleanup targets could not be removed; see the report.' }
