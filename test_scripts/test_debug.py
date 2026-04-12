#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MotiBuddy Test Debug Script
Quick diagnostic to check if testing environment is working
"""

import sys
import os
import subprocess
import time
from datetime import datetime

def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

def main():
    print("=" * 60)
    print("MotiBuddy Test Environment Diagnostic")
    print("=" * 60)
    print()
    
    # Check Python
    log(f"Python version: {sys.version}")
    log(f"Python executable: {sys.executable}")
    print()
    
    # Check matplotlib
    try:
        import matplotlib
        log(f"✓ Matplotlib version: {matplotlib.__version__}")
        log(f"  Matplotlib backend: {matplotlib.get_backend()}")
    except ImportError as e:
        log(f"✗ Matplotlib not found: {e}")
        log("  Run: pip install matplotlib")
        return False
    print()
    
    # Check numpy
    try:
        import numpy
        log(f"✓ NumPy version: {numpy.__version__}")
    except ImportError as e:
        log(f"✗ NumPy not found: {e}")
        log("  Run: pip install numpy")
        return False
    print()
    
    # Check psutil
    try:
        import psutil
        log(f"✓ psutil version: {psutil.__version__}")
    except ImportError as e:
        log(f"✗ psutil not found: {e}")
        log("  Run: pip install psutil")
    print()
    
    # Check MotiBuddy executable
    app_path = r"F:\MotiBuddy1\src-tauri\target\release\MotiBuddy.exe"
    log(f"Checking application path: {app_path}")
    
    if os.path.exists(app_path):
        size_mb = os.path.getsize(app_path) / (1024 * 1024)
        log(f"✓ Application found: {size_mb:.2f} MB")
    else:
        log(f"✗ Application NOT found!")
        log("  Please build MotiBuddy first:")
        log("  cd F:\\MotiBuddy1 && pnpm tauri build")
        return False
    print()
    
    # Test write permission
    log("Testing write permission...")
    try:
        test_file = "test_write.tmp"
        with open(test_file, 'w') as f:
            f.write("test")
        os.remove(test_file)
        log("✓ Write permission OK")
    except Exception as e:
        log(f"✗ Write permission failed: {e}")
        return False
    print()
    
    # Test launching application (single test)
    log("Testing application launch (single test)...")
    log("  Launching MotiBuddy...")
    
    try:
        process = subprocess.Popen(
            [app_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            creationflags=subprocess.CREATE_NEW_CONSOLE
        )
        
        log(f"  ✓ Process started with PID: {process.pid}")
        log("  Waiting 3 seconds...")
        time.sleep(3)
        
        # Check if process is still running
        if process.poll() is None:
            log("  ✓ Process is still running")
        else:
            log(f"  ⚠ Process exited with code: {process.returncode}")
        
        # Terminate
        log("  Terminating process...")
        process.terminate()
        try:
            process.wait(timeout=5)
            log("  ✓ Process terminated")
        except:
            process.kill()
            log("  ✓ Process killed")
            
    except Exception as e:
        log(f"  ✗ Failed to launch: {e}")
        import traceback
        log(traceback.format_exc())
        return False
    print()
    
    # Test matplotlib chart generation
    log("Testing matplotlib chart generation...")
    try:
        import matplotlib
        matplotlib.use('Agg')  # Non-interactive backend
        import matplotlib.pyplot as plt
        
        # Create simple test chart
        fig, ax = plt.subplots(figsize=(6, 4))
        ax.plot([1, 2, 3, 4, 5], [1, 4, 2, 5, 3], marker='o')
        ax.set_title('Test Chart')
        ax.set_xlabel('X Axis')
        ax.set_ylabel('Y Axis')
        
        output_file = 'test_chart.png'
        plt.savefig(output_file, dpi=150)
        
        if os.path.exists(output_file):
            size_kb = os.path.getsize(output_file) / 1024
            log(f"  ✓ Test chart created: {output_file} ({size_kb:.1f} KB)")
            os.remove(output_file)
            log("  ✓ Test chart cleaned up")
        else:
            log("  ✗ Chart file not created")
            return False
            
    except Exception as e:
        log(f"  ✗ Chart generation failed: {e}")
        import traceback
        log(traceback.format_exc())
        return False
    print()
    
    # Summary
    print("=" * 60)
    log("✓ All checks passed!")
    log("You can now run the actual test scripts:")
    log("  python startup_time_test.py")
    log("  python voice_recognition_test.py")
    log("  python cross_window_comm_test.py")
    log("  python system_resource_monitor.py")
    print("=" * 60)
    
    return True

if __name__ == '__main__':
    success = main()
    sys.exit(0 if success else 1)
