#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Measure MotiBuddy Process Memory Usage
Records actual memory usage of MotiBuddy process over time
"""

import psutil
import time
import json
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from datetime import datetime
import os

print("=" * 60)
print("MotiBuddy Process Memory Monitor")
print("=" * 60)
print()

# Configuration
PROCESS_NAME = "MotiBuddy"
DURATION = 60  # seconds
INTERVAL = 5   # seconds

# Check if MotiBuddy is running
print("Checking if MotiBuddy is running...")
motibuddy_processes = []

for proc in psutil.process_iter(['pid', 'name']):
    try:
        if PROCESS_NAME.lower() in proc.info['name'].lower():
            motibuddy_processes.append(proc)
            print(f"  Found: {proc.info['name']} (PID: {proc.info['pid']})")
    except (psutil.NoSuchProcess, psutil.AccessDenied):
        pass

if not motibuddy_processes:
    print()
    print("ERROR: MotiBuddy is not running!")
    print("Please start MotiBuddy first, then run this script.")
    print()
    input("Press Enter to exit...")
    exit(1)

# Use the first MotiBuddy process found
process = psutil.Process(motibuddy_processes[0].info['pid'])
print(f"\nMonitoring PID: {process.pid}")
print(f"Process Name: {process.name()}")
print()

# Get package size
app_path = r"F:\MotiBuddy1\src-tauri\target\release\MotiBuddy.exe"
if os.path.exists(app_path):
    package_size_mb = os.path.getsize(app_path) / (1024 * 1024)
    print(f"Package Size: {package_size_mb:.2f} MB")
else:
    package_size_mb = None
    print("Package Size: Unknown")

print()
print(f"Starting monitoring for {DURATION} seconds...")
print("-" * 60)

# Monitor
memory_readings = []
cpu_readings = []
timestamps = []

for i in range(DURATION // INTERVAL + 1):
    try:
        # Get memory info
        mem_info = process.memory_info()
        mem_mb = mem_info.rss / (1024 * 1024)  # Convert to MB
        
        # Get CPU percent
        cpu_percent = process.cpu_percent(interval=1)
        
        # Record
        memory_readings.append(mem_mb)
        cpu_readings.append(cpu_percent)
        timestamps.append(i * INTERVAL)
        
        print(f"[{i:2d}] Time: {i*INTERVAL:3d}s | Memory: {mem_mb:6.1f} MB | CPU: {cpu_percent:5.1f}%")
        
        if i < DURATION // INTERVAL:
            time.sleep(INTERVAL - 1)  # -1 because cpu_percent waits 1 second
            
    except psutil.NoSuchProcess:
        print(f"\nERROR: MotiBuddy process terminated!")
        break

print("-" * 60)
print()

# Calculate statistics
if memory_readings:
    avg_memory = sum(memory_readings) / len(memory_readings)
    max_memory = max(memory_readings)
    min_memory = min(memory_readings)
    
    avg_cpu = sum(cpu_readings) / len(cpu_readings)
    
    print("RESULTS:")
    print(f"  Memory Usage:")
    print(f"    Average: {avg_memory:.1f} MB")
    print(f"    Min: {min_memory:.1f} MB")
    print(f"    Max: {max_memory:.1f} MB")
    print(f"  CPU Usage:")
    print(f"    Average: {avg_cpu:.1f}%")
    print()
    
    # Create chart
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 8))
    
    # Memory chart
    ax1.plot([t/60 for t in timestamps], memory_readings, 
             color='#4A90E2', linewidth=2, label='Memory Usage', marker='o')
    ax1.axhline(avg_memory, color='red', linestyle='--', 
                label=f'Mean: {avg_memory:.1f} MB')
    ax1.fill_between([t/60 for t in timestamps], 0, memory_readings, 
                     alpha=0.3, color='#4A90E2')
    ax1.set_ylabel('Memory Usage (MB)')
    ax1.set_title('MotiBuddy Memory Usage During Monitoring')
    ax1.legend()
    ax1.grid(True, alpha=0.3)
    
    # CPU chart
    ax2.plot([t/60 for t in timestamps], cpu_readings, 
             color='#E74C3C', linewidth=2, label='CPU Usage', marker='o')
    ax2.axhline(avg_cpu, color='blue', linestyle='--', 
                label=f'Mean: {avg_cpu:.1f}%')
    ax2.fill_between([t/60 for t in timestamps], 0, cpu_readings, 
                     alpha=0.3, color='#E74C3C')
    ax2.set_xlabel('Time (minutes)')
    ax2.set_ylabel('CPU Usage (%)')
    ax2.set_title('MotiBuddy CPU Usage During Monitoring')
    ax2.legend()
    ax2.grid(True, alpha=0.3)
    
    plt.tight_layout()
    plt.savefig('motibuddy_memory_usage.png', dpi=300, bbox_inches='tight')
    print("✓ Chart saved: motibuddy_memory_usage.png")
    
    # Save data
    results = {
        "package_size_mb": package_size_mb,
        "monitoring_duration": DURATION,
        "monitoring_interval": INTERVAL,
        "memory": {
            "mean_mb": avg_memory,
            "min_mb": min_memory,
            "max_mb": max_memory,
            "all_readings": memory_readings
        },
        "cpu": {
            "mean_percent": avg_cpu,
            "all_readings": cpu_readings
        },
        "timestamps": timestamps,
        "timestamp": datetime.now().isoformat()
    }
    
    with open('motibuddy_memory_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    print("✓ Data saved: motibuddy_memory_results.json")
    print()

print("=" * 60)
print("Monitoring Complete!")
print("=" * 60)
print()
input("Press Enter to exit...")
