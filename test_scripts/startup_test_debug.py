#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Simplified startup time test with maximum debug output
"""

import sys
import os
import subprocess
import time
import json
from datetime import datetime

print("=" * 60)
print("MotiBuddy Startup Time Test - DEBUG MODE")
print("=" * 60)
print(f"Timestamp: {datetime.now()}")
print(f"Python: {sys.executable}")
print(f"Working directory: {os.getcwd()}")
print()

APP_PATH = r"F:\MotiBuddy1\src-tauri\target\release\MotiBuddy.exe"

# Check if app exists
print(f"[1] Checking application...")
print(f"    Path: {APP_PATH}")
if os.path.exists(APP_PATH):
    size_mb = os.path.getsize(APP_PATH) / (1024*1024)
    print(f"    ✓ Found: {size_mb:.2f} MB")
else:
    print(f"    ✗ NOT FOUND!")
    print(f"    Please build MotiBuddy first:")
    print(f"    cd F:\\MotiBuddy1 && pnpm tauri build")
    input("\nPress Enter to exit...")
    sys.exit(1)

print()
print(f"[2] Testing single launch...")
print(f"    Launching application...")

try:
    process = subprocess.Popen(
        [APP_PATH],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        creationflags=subprocess.CREATE_NEW_CONSOLE
    )
    print(f"    ✓ Process started: PID {process.pid}")
    print(f"    Waiting 3 seconds...")
    time.sleep(3)
    
    # Check if still running
    if process.poll() is None:
        print(f"    ✓ Process is running")
    else:
        print(f"    ⚠ Process exited with code: {process.returncode}")
    
    # Terminate
    print(f"    Terminating...")
    process.terminate()
    try:
        process.wait(timeout=5)
        print(f"    ✓ Terminated successfully")
    except:
        process.kill()
        print(f"    ✓ Killed")
    
except Exception as e:
    print(f"    ✗ ERROR: {e}")
    import traceback
    traceback.print_exc()
    input("\nPress Enter to exit...")
    sys.exit(1)

print()
print(f"[3] Running 20 iterations...")
times = []

for i in range(1, 21):
    print(f"\n    Iteration {i}/20:")
    try:
        start = time.time()
        process = subprocess.Popen(
            [APP_PATH],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            creationflags=subprocess.CREATE_NEW_CONSOLE
        )
        time.sleep(3)
        elapsed = time.time() - start
        times.append(elapsed)
        print(f"      Time: {elapsed:.3f}s")
        
        process.terminate()
        try:
            process.wait(timeout=5)
        except:
            process.kill()
        
        if i < 20:
            time.sleep(1)
            
    except Exception as e:
        print(f"      ✗ Error: {e}")

print()
print("=" * 60)
print("RESULTS")
print("=" * 60)

if times:
    import statistics
    mean_time = statistics.mean(times)
    print(f"Valid measurements: {len(times)}/20")
    print(f"Mean: {mean_time:.3f}s")
    print(f"Min: {min(times):.3f}s")
    print(f"Max: {max(times):.3f}s")
    
    # Save results
    results = {
        "iterations": len(times),
        "mean": mean_time,
        "min": min(times),
        "max": max(times),
        "all_times": times,
        "timestamp": datetime.now().isoformat()
    }
    
    with open("startup_time_results.json", "w") as f:
        json.dump(results, f, indent=2)
    print(f"\n✓ Results saved to: startup_time_results.json")
    
    # Create simple chart
    try:
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt
        
        fig, ax = plt.subplots(figsize=(10, 5))
        ax.plot(range(1, len(times)+1), times, marker='o')
        ax.axhline(mean_time, color='red', linestyle='--', label=f'Mean: {mean_time:.3f}s')
        ax.set_xlabel('Iteration')
        ax.set_ylabel('Startup Time (s)')
        ax.set_title('MotiBuddy Startup Time')
        ax.legend()
        ax.grid(True, alpha=0.3)
        
        plt.savefig('startup_time_analysis.png', dpi=300, bbox_inches='tight')
        print(f"✓ Chart saved to: startup_time_analysis.png")
        
    except Exception as e:
        print(f"✗ Chart creation failed: {e}")
        import traceback
        traceback.print_exc()
else:
    print("✗ No valid measurements!")

print()
input("Press Enter to exit...")
