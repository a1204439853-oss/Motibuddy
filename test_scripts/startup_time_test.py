#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MotiBuddy Startup Time Test
Tests application launch time over 20 iterations
"""

import subprocess
import time
import statistics
import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend
import matplotlib.pyplot as plt
import json
from datetime import datetime
import os
import sys
import traceback

# Configuration
APP_PATH = r"F:\MotiBuddy1\src-tauri\target\release\MotiBuddy.exe"
TEST_ITERATIONS = 20
RESULTS_FILE = "startup_time_results.json"

def log_error(msg):
    """Print error message with timestamp"""
    print(f"[ERROR {datetime.now().strftime('%H:%M:%S')}] {msg}")

def log_info(msg):
    """Print info message with timestamp"""
    print(f"[INFO {datetime.now().strftime('%H:%M:%S')}] {msg}")

def check_prerequisites():
    """Check if all prerequisites are met"""
    log_info("Checking prerequisites...")
    
    # Check Python version
    log_info(f"Python version: {sys.version}")
    
    # Check if matplotlib is available
    try:
        import matplotlib
        log_info(f"Matplotlib version: {matplotlib.__version__}")
    except ImportError as e:
        log_error(f"Matplotlib not installed: {e}")
        log_error("Please run: pip install matplotlib numpy")
        return False
    
    # Check if numpy is available
    try:
        import numpy
        log_info(f"NumPy version: {numpy.__version__}")
    except ImportError as e:
        log_error(f"NumPy not installed: {e}")
        log_error("Please run: pip install matplotlib numpy")
        return False
    
    # Check if app exists
    if not os.path.exists(APP_PATH):
        log_error(f"Application not found at: {APP_PATH}")
        log_error("Please check the APP_PATH variable in the script")
        return False
    
    log_info(f"Application found: {APP_PATH}")
    log_info(f"File size: {os.path.getsize(APP_PATH) / (1024*1024):.2f} MB")
    
    # Check write permissions
    test_file = "test_write_permission.tmp"
    try:
        with open(test_file, 'w') as f:
            f.write("test")
        os.remove(test_file)
        log_info("Write permission check: OK")
    except Exception as e:
        log_error(f"Cannot write to directory: {e}")
        return False
    
    return True

def measure_startup_time():
    """Measure single startup time"""
    start_time = time.time()
    process = None
    
    try:
        log_info(f"Launching application: {APP_PATH}")
        
        # Launch application
        process = subprocess.Popen(
            [APP_PATH],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            creationflags=subprocess.CREATE_NEW_CONSOLE  # Create new console window
        )
        
        log_info(f"Process started with PID: {process.pid}")
        
        # Wait for window to appear
        log_info("Waiting 3 seconds for application to initialize...")
        time.sleep(3.0)
        
        end_time = time.time()
        startup_time = end_time - start_time
        
        log_info(f"Startup time measured: {startup_time:.3f}s")
        
        # Terminate process
        log_info(f"Terminating process {process.pid}...")
        try:
            process.terminate()
            process.wait(timeout=5)
            log_info("Process terminated successfully")
        except subprocess.TimeoutExpired:
            log_error("Process did not terminate in time, forcing kill...")
            process.kill()
            process.wait()
        except Exception as e:
            log_error(f"Error terminating process: {e}")
            try:
                process.kill()
            except:
                pass
        
        return startup_time
        
    except Exception as e:
        log_error(f"Failed to measure startup time: {e}")
        log_error(traceback.format_exc())
        if process:
            try:
                process.kill()
            except:
                pass
        return None

def run_startup_tests():
    """Run startup time tests for configured iterations"""
    log_info(f"Starting {TEST_ITERATIONS} startup time tests...")
    print("=" * 60)
    
    times = []
    
    for i in range(1, TEST_ITERATIONS + 1):
        print(f"\n[Test {i}/{TEST_ITERATIONS}]")
        print("-" * 40)
        
        try:
            startup_time = measure_startup_time()
            
            if startup_time is not None:
                times.append(startup_time)
                print(f"✓ Success: {startup_time:.3f}s")
            else:
                print(f"✗ Failed: Could not measure startup time")
                times.append(None)
            
            # Small delay between tests
            if i < TEST_ITERATIONS:
                log_info("Waiting 2 seconds before next test...")
                time.sleep(2)
            
        except Exception as e:
            log_error(f"Unexpected error in test {i}: {e}")
            log_error(traceback.format_exc())
            times.append(None)
    
    # Calculate statistics
    valid_times = [t for t in times if t is not None]
    
    print("\n" + "=" * 60)
    print("TEST RESULTS")
    print("=" * 60)
    
    if valid_times:
        log_info(f"Valid measurements: {len(valid_times)}/{TEST_ITERATIONS}")
        
        stats = {
            "iterations": len(valid_times),
            "mean": statistics.mean(valid_times),
            "median": statistics.median(valid_times),
            "stdev": statistics.stdev(valid_times) if len(valid_times) > 1 else 0,
            "min": min(valid_times),
            "max": max(valid_times),
            "all_times": times,
            "timestamp": datetime.now().isoformat()
        }
        
        print(f"\nStatistics:")
        print(f"  Mean startup time: {stats['mean']:.3f}s")
        print(f"  Median: {stats['median']:.3f}s")
        print(f"  Std Dev: {stats['stdev']:.3f}s")
        print(f"  Min: {stats['min']:.3f}s")
        print(f"  Max: {stats['max']:.3f}s")
        
        # Save results
        try:
            with open(RESULTS_FILE, 'w') as f:
                json.dump(stats, f, indent=2)
            log_info(f"Results saved to: {RESULTS_FILE}")
        except Exception as e:
            log_error(f"Failed to save results: {e}")
        
        return stats
    else:
        log_error("No valid measurements obtained!")
        log_error("Please check:")
        log_error("  1. Is MotiBuddy built successfully?")
        log_error("  2. Is the APP_PATH correct?")
        log_error("  3. Can you launch MotiBuddy manually?")
        return None

def create_visualization(stats):
    """Create visualization chart"""
    if not stats:
        log_error("Cannot create visualization: no statistics available")
        return
    
    try:
        log_info("Creating visualization chart...")
        
        valid_times = [t for t in stats['all_times'] if t is not None]
        
        if not valid_times:
            log_error("No valid times to visualize")
            return
        
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))
        
        # Chart 1: Line plot of all measurements
        ax1.plot(range(1, len(valid_times) + 1), valid_times,
                 marker='o', linewidth=2, markersize=6, color='#4A90E2')
        ax1.axhline(y=stats['mean'], color='red', linestyle='--',
                    label=f"Mean: {stats['mean']:.3f}s")
        ax1.fill_between(range(1, len(valid_times) + 1),
                         stats['mean'] - stats['stdev'],
                         stats['mean'] + stats['stdev'],
                         alpha=0.2, color='red', label=f"±1 Std Dev")
        ax1.set_xlabel('Test Iteration')
        ax1.set_ylabel('Startup Time (seconds)')
        ax1.set_title('MotiBuddy Startup Time - Individual Measurements')
        ax1.legend()
        ax1.grid(True, alpha=0.3)
        
        # Chart 2: Box plot and statistics
        box_data = [valid_times]
        bp = ax2.boxplot(box_data, patch_artist=True, labels=['Startup Time'])
        bp['boxes'][0].set_facecolor('#4A90E2')
        bp['boxes'][0].set_alpha(0.7)
        
        # Add statistics text
        stats_text = f"""
Statistics (n={stats['iterations']})
─────────────────
Mean: {stats['mean']:.3f}s
Median: {stats['median']:.3f}s
Std Dev: {stats['stdev']:.3f}s
Min: {stats['min']:.3f}s
Max: {stats['max']:.3f}s
        """
        ax2.text(1.3, stats['mean'], stats_text,
                 verticalalignment='center', fontsize=10,
                 bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5))
        
        ax2.set_ylabel('Time (seconds)')
        ax2.set_title('MotiBuddy Startup Time - Distribution')
        ax2.grid(True, alpha=0.3)
        
        plt.tight_layout()
        
        output_file = 'startup_time_analysis.png'
        plt.savefig(output_file, dpi=300, bbox_inches='tight')
        log_info(f"Chart saved to: {output_file}")
        
        # Verify file was created
        if os.path.exists(output_file):
            file_size = os.path.getsize(output_file) / 1024
            log_info(f"Chart file size: {file_size:.1f} KB")
        else:
            log_error("Chart file was not created!")
        
    except Exception as e:
        log_error(f"Failed to create visualization: {e}")
        log_error(traceback.format_exc())

if __name__ == '__main__':
    print("=" * 60)
    print("MotiBuddy Startup Time Test")
    print("=" * 60)
    print()
    
    # Check prerequisites
    if not check_prerequisites():
        log_error("Prerequisites check failed. Exiting.")
        sys.exit(1)
    
    print()
    log_info("Starting tests...")
    
    # Run tests
    stats = run_startup_tests()
    
    if stats:
        log_info("Tests completed successfully!")
        create_visualization(stats)
        log_info("All done!")
    else:
        log_error("Tests failed!")
        sys.exit(1)
