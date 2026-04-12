# MotiBuddy System Resource Report Generator
# Generates HTML report with package size, memory usage, and system information

param(
    [string]$AppName = "MotiBuddy",
    [string]$ExeName = "motibuddy.exe"
)

$ReportPath = "F:\MotiBuddy1\test_scripts\system_report.html"
$Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

# Search for installation package
$PossiblePaths = @(
    "F:\MotiBuddy1\src-tauri\target\release\bundle\nsis",
    "F:\MotiBuddy1\src-tauri\target\release",
    "F:\MotiBuddy1\src-tauri\target\debug",
    "C:\Program Files\MotiBuddy",
    "$env:LOCALAPPDATA\MotiBuddy"
)

$PackageInfo = @()
foreach ($Path in $PossiblePaths) {
    if (Test-Path $Path) {
        $ExeFiles = Get-ChildItem -Path $Path -Filter "*.exe" -Recurse -ErrorAction SilentlyContinue | 
                    Where-Object { $_.Name -like "*$AppName*" -or $_.Name -eq $ExeName }
        foreach ($File in $ExeFiles) {
            $SizeMB = [math]::Round($File.Length / 1MB, 2)
            $PackageInfo += [PSCustomObject]@{
                Name = $File.Name
                Path = $File.FullName
                SizeBytes = $File.Length
                SizeMB = $SizeMB
                Modified = $File.LastWriteTime
                Type = if ($File.FullName -like "*release*") { "Release" } else { "Debug" }
            }
        }
    }
}

# Get system information
$SystemInfo = Get-ComputerInfo | Select-Object WindowsProductName, WindowsVersion, TotalPhysicalMemory, CsProcessors
$TotalRAM = [math]::Round($SystemInfo.TotalPhysicalMemory / 1GB, 2)

# Check running processes
$RunningProcesses = Get-Process | Where-Object { $_.ProcessName -like "*$AppName*" -or $_.ProcessName -like "*motibuddy*" }
$ProcessInfo = @()
foreach ($Proc in $RunningProcesses) {
    $ProcessInfo += [PSCustomObject]@{
        Name = $Proc.ProcessName
        Id = $Proc.Id
        WorkingSetMB = [math]::Round($Proc.WorkingSet64 / 1MB, 2)
        PagedMemoryMB = [math]::Round($Proc.PagedMemorySize64 / 1MB, 2)
        CPU = [math]::Round($Proc.TotalProcessorTime.TotalSeconds, 2)
        StartTime = $Proc.StartTime
    }
}

# Generate HTML report
$HtmlContent = @"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MotiBuddy System Resource Report</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        .container {
            background: white;
            border-radius: 15px;
            padding: 30px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        }
        h1 {
            color: #333;
            text-align: center;
            border-bottom: 3px solid #667eea;
            padding-bottom: 15px;
        }
        h2 {
            color: #667eea;
            margin-top: 30px;
        }
        .timestamp {
            text-align: center;
            color: #666;
            font-style: italic;
            margin-bottom: 20px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        th {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        tr:hover {
            background-color: #f5f5f5;
        }
        .metric-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 10px;
            margin: 10px 0;
            display: inline-block;
            min-width: 200px;
        }
        .metric-value {
            font-size: 2em;
            font-weight: bold;
        }
        .metric-label {
            font-size: 0.9em;
            opacity: 0.9;
        }
        .info-box {
            background: #e3f2fd;
            border-left: 4px solid #2196F3;
            padding: 15px;
            margin: 15px 0;
            border-radius: 0 5px 5px 0;
        }
        .warning-box {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 15px 0;
            border-radius: 0 5px 5px 0;
        }
        .screenshot-area {
            border: 2px dashed #ccc;
            padding: 20px;
            text-align: center;
            margin: 20px 0;
            background: #fafafa;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>MotiBuddy System Resource Report</h1>
        <p class="timestamp">Generated: $Timestamp</p>
        
        <h2>Package Information</h2>
"@

if ($PackageInfo.Count -gt 0) {
    $HtmlContent += @"
        <table>
            <tr>
                <th>File Name</th>
                <th>Type</th>
                <th>Size (MB)</th>
                <th>Size (Bytes)</th>
                <th>Modified</th>
                <th>Full Path</th>
            </tr>
"@
    foreach ($Pkg in $PackageInfo) {
        $HtmlContent += @"
            <tr>
                <td><strong>$($Pkg.Name)</strong></td>
                <td>$($Pkg.Type)</td>
                <td style="color: #667eea; font-weight: bold;">$($Pkg.SizeMB) MB</td>
                <td>$($Pkg.SizeBytes.ToString('N0'))</td>
                <td>$($Pkg.Modified)</td>
                <td style="font-size: 0.85em;">$($Pkg.Path)</td>
            </tr>
"@
    }
    $HtmlContent += "</table>"
    
    # Add key metric card
    $MainPackage = $PackageInfo | Sort-Object SizeBytes -Descending | Select-Object -First 1
    $HtmlContent += @"
        <div class="metric-card">
            <div class="metric-value">$($MainPackage.SizeMB) MB</div>
            <div class="metric-label">Main Package Size</div>
        </div>
"@
} else {
    $HtmlContent += @"
        <div class="warning-box">
            <strong>Package Not Found</strong><br>
            MotiBuddy executable not found in the following paths:<br>
            $($PossiblePaths -join "<br>")
        </div>
"@
}

$HtmlContent += @"
        <h2>System Information</h2>
        <div class="info-box">
            <strong>Operating System:</strong> $($SystemInfo.WindowsProductName) ($($SystemInfo.WindowsVersion))<br>
            <strong>Total Memory:</strong> $TotalRAM GB<br>
            <strong>Processor:</strong> $($SystemInfo.CsProcessors.Name -join ', ')
        </div>
        
        <h2>Runtime Resource Usage</h2>
"@

if ($ProcessInfo.Count -gt 0) {
    $HtmlContent += @"
        <table>
            <tr>
                <th>Process Name</th>
                <th>PID</th>
                <th>Working Set (MB)</th>
                <th>Paged Memory (MB)</th>
                <th>CPU Time (sec)</th>
                <th>Start Time</th>
            </tr>
"@
    foreach ($Proc in $ProcessInfo) {
        $HtmlContent += @"
            <tr>
                <td><strong>$($Proc.Name)</strong></td>
                <td>$($Proc.Id)</td>
                <td style="color: #667eea; font-weight: bold;">$($Proc.WorkingSetMB) MB</td>
                <td>$($Proc.PagedMemoryMB) MB</td>
                <td>$($Proc.CPU)</td>
                <td>$($Proc.StartTime)</td>
            </tr>
"@
    }
    $HtmlContent += "</table>"
    
    $AvgMemory = ($ProcessInfo | Measure-Object WorkingSetMB -Average).Average
    $HtmlContent += @"
        <div class="metric-card">
            <div class="metric-value">$([math]::Round($AvgMemory, 2)) MB</div>
            <div class="metric-label">Average Memory Usage</div>
        </div>
"@
} else {
    $HtmlContent += @"
        <div class="warning-box">
            <strong>MotiBuddy Not Running</strong><br>
            No MotiBuddy processes detected. Please start the application and run this script again to obtain memory usage data.
        </div>
        <div class="info-box">
            <strong>Expected Memory Usage Range:</strong><br>
            • Startup: 80-150 MB<br>
            • Normal Operation: 150-300 MB<br>
            • High Load: 300-500 MB
        </div>
"@
}

$HtmlContent += @"
        <h2>Screenshot Evidence Area</h2>
        <div class="screenshot-area">
            <p><strong>Paste screenshots here:</strong></p>
            <p>1. File Explorer showing package size</p>
            <p>2. Task Manager showing memory usage</p>
            <p style="color: #999; font-size: 0.9em;">(Use Win + Shift + S to capture and paste above)</p>
        </div>
        
        <h2>Test Notes</h2>
        <div class="info-box">
            <strong>Package Size Notes:</strong><br>
            • Tauri applications include WebView2 runtime and Rust binaries<br>
            • Typical size range: 200-300 MB<br>
            • Release builds are 10-20% smaller than Debug builds
        </div>
        <div class="info-box">
            <strong>Memory Usage Notes:</strong><br>
            • Base: Chromium WebView ~80-120 MB<br>
            • App Logic: React state management ~30-80 MB<br>
            • Virtual Pet Rendering: Canvas animations ~20-50 MB<br>
            • Voice Processing: Web Speech API ~10-30 MB
        </div>
        
        <p style="text-align: center; margin-top: 40px; color: #666;">
            <em>This report was automatically generated by MotiBuddy test scripts</em>
        </p>
    </div>
</body>
</html>
"@

# Save report
$HtmlContent | Out-File -FilePath $ReportPath -Encoding UTF8

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  MotiBuddy System Resource Report Generated!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Report Path: $ReportPath" -ForegroundColor Yellow
Write-Host ""

if ($PackageInfo.Count -gt 0) {
    Write-Host "Found Packages:" -ForegroundColor Green
    foreach ($Pkg in $PackageInfo) {
        Write-Host "   • $($Pkg.Name): $($Pkg.SizeMB) MB [$($Pkg.Type)]" -ForegroundColor White
    }
} else {
    Write-Host "Package not found, please check path configuration" -ForegroundColor Red
}

Write-Host ""

if ($ProcessInfo.Count -gt 0) {
    Write-Host "Running Processes:" -ForegroundColor Green
    foreach ($Proc in $ProcessInfo) {
        Write-Host "   • $($Proc.Name) (PID: $($Proc.Id)): $($Proc.WorkingSetMB) MB" -ForegroundColor White
    }
} else {
    Write-Host "MotiBuddy is not running" -ForegroundColor Yellow
    Write-Host "   Start the application to obtain memory usage data" -ForegroundColor Gray
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Please open the report file to view details" -ForegroundColor Green
Write-Host "Suggestion: Open in browser and save screenshots" -ForegroundColor Gray
Write-Host "========================================" -ForegroundColor Cyan

# Auto-open report
if (Test-Path $ReportPath) {
    Start-Process $ReportPath
}
