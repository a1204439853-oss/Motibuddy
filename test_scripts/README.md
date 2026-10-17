# 验证脚本

当前桌面界面的自动回归入口为 `localization_smoke.mjs`，使用 Node.js 24、隔离浏览器、合成账户和模拟原生接口，不读取真实账户数据。设置 `WORKSPACE_V5=1` 可以运行天气、独立日历及助手交互专项检查。

业务和数据校验测试位于 `tests/`，通过项目根目录的 `npm run check` 执行；原生数据与通知测试使用 `npm run test:rust`。真实第三方服务验证脚本位于 `scripts/`，与界面测试分开运行。

目录中的 Python、绘图及历史性能测量脚本是可选开发工具，不属于桌面发行程序。运行前需准备对应 Python 依赖；批处理入口从自身目录启动，使用 PATH 中的 Python，避免依赖特定开发工作站。


## 历史性能测试工具

以下保留可选 Python 工具的使用说明。示例输出和评估区间用于说明测试方式，不代表当前版本实测结果。

## Environment Setup

### 1. Install Python Dependencies

Open PowerShell or Command Prompt and run:

```bash
pip install matplotlib numpy psutil
```

### 2. Confirm MotiBuddy Installation Path

Locate your MotiBuddy executable file path, typically:
- `src-tauri\target\release\MotiBuddy.exe`
- `src-tauri\target\release\deps\motibuddy.exe`

---

## Script Descriptions

### 1. Startup Time Test (`startup_time_test.py`)

**Function**: Measure application startup time (20 iterations)

**Outputs**:
- Console output of each startup time
- `startup_time_results.json` - Detailed data
- `startup_time_analysis.png` - Visualization chart

**Key Metrics**:
- Average startup time
- Fastest/slowest startup time
- Standard deviation (stability indicator)

---

### 2. Voice Recognition Accuracy Test (`voice_recognition_test.py`)

**Function**: Test voice command parsing accuracy

**Test Cases** (10 total):
1. "Submit report tomorrow at 3pm" - Test date + time
2. "Buy groceries this weekend" - Test relative date
3. "Call mom urgent" - Test priority
4. "Finish project by January 15th" - Test absolute date
5. "Meeting with team next Monday at 10am" - Test complete info
6. "Pay electricity bill before Friday" - Test deadline
7. "Review document important" - Test high priority
8. "Walk the dog every day" - Test recurring task
9. "Doctor appointment March 3rd at 2pm" - Test specific date
10. "Buy birthday gift for Sarah next week" - Test relative week

**Outputs**:
- `voice_recognition_accuracy.json` - Detailed results
- `voice_recognition_analysis.png` - 4-panel visualization

**Scoring Weights**:
- Title extraction: 40%
- Date parsing: 30%
- Time parsing: 20%
- Priority recognition: 10%

---

### 3. Cross-Window Communication Latency Test (`cross_window_comm_test.py`)

**Function**: Test communication latency between main window and desktop widget

**Test Event Types**:
1. `pet:state_changed` - Pet state change
2. `task:completed` - Task completion
3. `task:created` - Task creation
4. `achievement:unlocked` - Achievement unlock

**Outputs**:
- `cross_window_latency.json` - Detailed data
- `cross_window_latency.png` - Latency distribution chart

---

### 4. System Resource Monitor (`system_resource_monitor.py`)

**Function**: Monitor runtime memory and CPU usage

**Outputs**:
- `system_resources.json` - Resource usage records
- `system_resources.png` - Resource usage trend chart

---

### 5. System Report Generator (`generate_system_report.ps1`)

**Function**: Generate a professional HTML system report

**Usage**:
```powershell
# Run in PowerShell
.\generate_system_report.ps1
```

**Report Contents**:
- Package size
- System information
- Runtime resource usage
- Screenshot evidence area

---

## Detailed Operation Steps

### Step 1: Configure Test Scripts

Edit `startup_time_test.py`, modify APP_PATH on line 17:

```python
APP_PATH = r"src-tauri\target\release\MotiBuddy.exe"
```

### Step 2: Run Startup Time Test

```bash
# In PowerShell
cd test_scripts
python startup_time_test.py
```

**Expected Output**:
```
========================================
  MotiBuddy Startup Time Test
========================================
Test 1/20: 2.34s
Test 2/20: 2.18s
...

========================================
           Test Results Summary
========================================
Total Tests: 20
Average Startup Time: 2.25s
Fastest: 1.98s
Slowest: 2.67s
Std Dev: 0.18s
```

### Step 3: Run Voice Recognition Test

```bash
python voice_recognition_test.py
```

**Expected Output**:
```
========================================
  MotiBuddy Voice Recognition Accuracy Test
========================================
Testing: "Submit report tomorrow at 3pm"
  Average Accuracy: 95.0%
  Average Confidence: 88.5%

========================================
         Test Results Summary
========================================
Total Tests: 50
Overall Accuracy: 87.50%
Best Phrase: "Submit report tomorrow at 3pm" (95.0%)
Worst Phrase: "Buy birthday gift for Sarah next week" (72.0%)
```

### Step 4: Run Cross-Window Communication Test

```bash
python cross_window_comm_test.py
```

**Expected Output**:
```
========================================
  MotiBuddy Cross-Window Communication Latency Test
========================================
Testing event type: pet:state_changed
  Progress: 5/20 - Current: 12.5ms
  ...

========================================
           Test Results Summary
========================================
Event Type: pet:state_changed
  Average: 15.2ms
  Std Dev: 3.4ms
  Min/Max: 8.1ms / 28.4ms
```

### Step 5: Run System Resource Monitor

**Start MotiBuddy application first**, then:

```bash
python system_resource_monitor.py
```

**Expected Output**:
```
========================================
  MotiBuddy System Resource Monitor
========================================
Package Size: 225.18 MB
Running Processes:
   • MotiBuddy (PID: 12345): 156.32 MB

Starting monitoring (60 seconds)...
[  1] Time:   0.0s | Memory:  45.2% | CPU:   2.1%
...
```

### Step 6: Generate System Report

```powershell
.\generate_system_report.ps1
```

The report will automatically open in your browser.

---

## Screenshot Evidence Capture Methods

### Method 1: Using System Report Generator
1. Run `generate_system_report.ps1`
2. Report opens in browser
3. Scroll to "Screenshot Evidence Area"
4. Use `Win + Shift + S` to capture
5. Paste into your thesis document

### Method 2: Manual Screenshots

**Package Size Screenshot**:
1. Open `src-tauri\target\release\`
2. Right-click `MotiBuddy.exe` → Properties
3. View "Size" field (~225 MB)
4. Use `Win + Shift + S` to capture

**Memory Usage Screenshot**:
1. Start MotiBuddy
2. Press `Ctrl + Shift + Esc` to open Task Manager
3. Click "Details" tab
4. Find `MotiBuddy.exe`
5. View "Memory" column (~150-200 MB)
6. Use `Win + Shift + S` to capture

---

## FAQ

### Q1: "ModuleNotFoundError: No module named 'matplotlib'"
**Solution**:
```bash
pip install matplotlib numpy psutil
```

### Q2: "MotiBuddy executable not found"
**Solution**:
1. Confirm `APP_PATH` is correct
2. Check if file exists:
   ```powershell
   Test-Path "src-tauri\target\release\MotiBuddy.exe"
   ```

### Q3: PowerShell execution policy restriction
**Solution**:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Q4: No images generated after running test scripts
**Solution**:
1. Ensure matplotlib is installed
2. Check write permissions
3. View console error messages

### Q5: Startup time test shows "Simulation Mode"
**Note**:
- This is normal as GUI apps cannot be launched directly in sandbox environment
- Real measurements will occur in local environment
- Simulation data is for reference only

---

## Data Interpretation Guide

### Startup Time Evaluation Criteria
| Time Range | Evaluation |
|-----------|------------|
| < 2 sec | Excellent |
| 2-3 sec | Good |
| 3-5 sec | Fair |
| > 5 sec | Needs Optimization |

### Voice Recognition Accuracy Evaluation Criteria
| Accuracy | Evaluation |
|----------|------------|
| > 90% | Excellent |
| 80-90% | Good |
| 70-80% | Fair |
| < 70% | Needs Optimization |

### Cross-Window Latency Evaluation Criteria
| Latency | Evaluation |
|---------|------------|
| < 20ms | Excellent (imperceptible to users) |
| 20-50ms | Good (slight delay) |
| 50-100ms | Fair (noticeable) |
| > 100ms | Needs Optimization (obvious delay) |

---

## Support

For issues, please check:
1. Python version >= 3.8
2. All dependencies correctly installed
3. File paths configured correctly
4. MotiBuddy application can start normally

---

## File Structure

```
test_scripts/
├── startup_time_test.py              # Startup time test
├── voice_recognition_test.py         # Voice recognition accuracy test
├── cross_window_comm_test.py         # Cross-window communication latency test
├── system_resource_monitor.py        # System resource monitor
├── generate_system_report.ps1        # System report generator (PowerShell)
├── README.md                         # This documentation
├── startup_time_results.json         # Generated: Startup time data
├── startup_time_analysis.png         # Generated: Startup time chart
├── voice_recognition_accuracy.json   # Generated: Voice recognition data
├── voice_recognition_analysis.png    # Generated: Voice recognition chart
├── cross_window_latency.json         # Generated: Latency data
├── cross_window_latency.png          # Generated: Latency chart
├── system_resources.json             # Generated: Resource data
├── system_resources.png              # Generated: Resource chart
└── system_report.html                # Generated: HTML report
```
