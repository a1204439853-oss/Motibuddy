# MotiBuddy Real Performance Test Guide

## ⚠️ Important Notice

**You must run these tests on your local Windows machine.**
I cannot run these tests for you because:
- I run in a sandboxed environment
- I cannot launch GUI applications
- I cannot access your local system

---

## 📋 Pre-Test Checklist

Before starting tests, ensure:
- [ ] MotiBuddy is built: `F:\MotiBuddy1\src-tauri\target\release\MotiBuddy.exe` exists
- [ ] Python 3.8+ is installed
- [ ] Required packages installed: `pip install matplotlib numpy psutil`
- [ ] Close all running MotiBuddy instances
- [ ] Close unnecessary applications to reduce system load

---

## 🚀 Running Real Tests

### Step 1: Open PowerShell

Press `Win + X`, then select **Windows PowerShell** or **Terminal**

### Step 2: Navigate to Test Scripts

```powershell
cd F:\MotiBuddy1\test_scripts
```

### Step 3: Run Tests One by One

#### Test 1: Startup Time (20 iterations, ~5 minutes)

```powershell
python startup_time_test.py
```

**What it does:**
- Launches MotiBuddy 20 times
- Measures time from launch to window appearance
- Generates `startup_time_analysis.png`

**Expected output:**
```
Running 20 startup time tests...
==================================================
Test 1/20... 2.341s
Test 2/20... 2.185s
...

==================================================
RESULTS:
  Mean startup time: 2.253s
  Median: 2.198s
  Std Dev: 0.182s
  Min: 1.987s
  Max: 2.673s
```

---

#### Test 2: Voice Recognition Accuracy (~2 minutes)

```powershell
python voice_recognition_test.py
```

**What it does:**
- Tests 10 voice commands
- Each command tested 5 times
- Simulates NLP parsing accuracy
- Generates `voice_recognition_analysis.png`

**Note:** This test uses simulation since actual voice recognition requires Web Speech API in browser.

---

#### Test 3: Cross-Window Communication Latency (~3 minutes)

```powershell
python cross_window_comm_test.py
```

**What it does:**
- Tests 4 event types
- 20 iterations per event type
- Measures event propagation time
- Generates `cross_window_latency.png`

**Note:** This test uses simulation. For real latency testing, you need to:
1. Start MotiBuddy
2. Manually trigger events (complete tasks, feed pet)
3. Measure time until widget updates

---

#### Test 4: System Resource Monitor (~2 minutes)

**First, start MotiBuddy manually**, then run:

```powershell
python system_resource_monitor.py
```

**What it does:**
- Monitors memory and CPU usage for 60 seconds
- Records data every 5 seconds
- Generates `system_resources.png`

**Expected output:**
```
MotiBuddy System Resource Monitor
==================================================
📦 Package Size: 225.18 MB
⚙️ Running Processes:
   • MotiBuddy (PID: 12345): 156.32 MB

Starting monitoring (60 seconds)...
[  1] Time:   0.0s | Memory: 156.3 MB | CPU: 2.1%
[  2] Time:   5.0s | Memory: 158.7 MB | CPU: 3.2%
...
```

---

#### Test 5: Generate System Report

```powershell
powershell -ExecutionPolicy Bypass -File generate_system_report.ps1
```

This generates `system_report.html` with all information.

---

## 📊 Collecting Real Data Manually

### For Startup Time (Most Accurate Method)

If the automated script doesn't work, measure manually:

1. **Close** MotiBuddy completely
2. Open **Task Manager** (Ctrl + Shift + Esc)
3. Click "Performance" tab
4. Open **Stopwatch** on your phone
5. Double-click `MotiBuddy.exe`
6. Start timer immediately
7. Stop timer when window appears
8. Record the time
9. Close MotiBuddy
10. Repeat 20 times

**Record your data here:**

| Iteration | Time (seconds) |
|-----------|----------------|
| 1 | |
| 2 | |
| 3 | |
| ... | |
| 20 | |

**Calculate:**
- Mean: __________ seconds
- Min: __________ seconds
- Max: __________ seconds

---

### For Memory Usage

1. Start MotiBuddy
2. Open **Task Manager** (Ctrl + Shift + Esc)
3. Go to "Details" tab
4. Find `MotiBuddy.exe`
5. Record "Memory (active private working set)" column

**Record at different times:**

| Time | Memory (MB) |
|------|-------------|
| Startup (0s) | |
| 30 seconds | |
| 1 minute | |
| 2 minutes | |
| 5 minutes | |

**Average Memory Usage:** __________ MB

---

### For Package Size

1. Open File Explorer
2. Navigate to: `F:\MotiBuddy1\src-tauri\target\release\`
3. Right-click `MotiBuddy.exe`
4. Select "Properties"
5. Record "Size" field

**Package Size:** __________ MB (__________ bytes)

---

## 🖼️ Taking Screenshots for Proof

### Screenshot 1: Package Size
1. Right-click `MotiBuddy.exe` → Properties
2. Press `Win + Shift + S`
3. Select the area showing file size
4. Save as `package_size_proof.png`

### Screenshot 2: Memory Usage
1. Start MotiBuddy
2. Open Task Manager → Details
3. Find `MotiBuddy.exe`
4. Press `Win + Shift + S`
5. Select the area showing memory usage
6. Save as `memory_usage_proof.png`

---

## 📁 Generated Files Location

After running tests, files will be in:
```
F:\MotiBuddy1\test_scripts\
├── startup_time_analysis.png      ← Chart for thesis
├── startup_time_results.json      ← Raw data
├── voice_recognition_analysis.png ← Chart for thesis
├── voice_recognition_accuracy.json
├── cross_window_latency.png       ← Chart for thesis
├── cross_window_latency.json
├── system_resources.png           ← Chart for thesis
├── system_resources.json
└── system_report.html             ← Full report
```

---

## 🎯 Expected Results (Reference)

Based on Tauri desktop applications:

| Metric | Expected Range | Good Value |
|--------|----------------|------------|
| Startup Time | 2-4 seconds | ~2.5s |
| Memory Usage | 150-300 MB | ~180 MB |
| Package Size | 200-300 MB | ~225 MB |
| Voice Recognition | 80-95% | ~87% |
| Cross-Window Latency | 10-50ms | ~25ms |

---

## 🆘 Troubleshooting

### "ModuleNotFoundError: No module named 'matplotlib'"
```powershell
pip install matplotlib numpy psutil
```

### "Application not found"
Check if path is correct in script:
```python
APP_PATH = r"F:\MotiBuddy1\src-tauri\target\release\MotiBuddy.exe"
```

### "Permission denied" when running PowerShell script
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Charts not showing
Add this to the end of Python scripts:
```python
import matplotlib
matplotlib.use('TkAgg')  # Or 'Qt5Agg' if you have PyQt installed
```

---

## ✅ Post-Test Checklist

After completing tests:
- [ ] All 4 PNG charts generated
- [ ] All 4 JSON data files generated
- [ ] Screenshots taken for proof
- [ ] Data recorded in thesis document
- [ ] Charts inserted into thesis

---

## 📞 Need Help?

If tests don't work:
1. Check Python installation: `python --version`
2. Check packages: `pip list | findstr matplotlib`
3. Verify MotiBuddy exists: `Test-Path "F:\MotiBuddy1\src-tauri\target\release\MotiBuddy.exe"`
4. Try running scripts one at a time to identify which fails

---

**Remember: You must run these tests on your local machine. I cannot run them for you.**
