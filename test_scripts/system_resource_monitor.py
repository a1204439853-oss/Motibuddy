#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MotiBuddy System Resource Monitor
Monitors memory usage and package size
"""

import os
import psutil
import time
import json
from datetime import datetime
import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend
import matplotlib.pyplot as plt

def get_package_size():
    """Get the size of MotiBuddy installation package"""
    # Main executable paths to check
    possible_paths = [
        r"F:\MotiBuddy1\motibuddy.exe",
        r"F:\MotiBuddy1\src-tauri\target\release\MotiBuddy.exe",
        r"F:\MotiBuddy1\src-tauri\target\release\motibuddy.exe"
    ]
    
    for path in possible_paths:
        if os.path.exists(path):
            size_bytes = os.path.getsize(path)
            size_mb = size_bytes / (1024 * 1024)
            return {
                "path": path,
                "size_bytes": size_bytes,
                "size_mb": round(size_mb, 2)
            }
    
    return None

def get_directory_size(path):
    """Get total size of directory"""
    total = 0
    for dirpath, dirnames, filenames in os.walk(path):
        for f in filenames:
            fp = os.path.join(dirpath, f)
            if os.path.exists(fp):
                total += os.path.getsize(fp)
    return total

def get_memory_usage():
    """Get current system memory usage"""
    memory = psutil.virtual_memory()
    return {
        "total_gb": round(memory.total / (1024**3), 2),
        "available_gb": round(memory.available / (1024**3), 2),
        "used_gb": round(memory.used / (1024**3), 2),
        "percentage": memory.percent
    }

def monitor_resources(duration=60, interval=5):
    """Monitor system resources over time"""
    print("MotiBuddy System Resource Monitor")
    print("=" * 60)
    print(f"Monitoring for {duration} seconds (interval: {interval}s)")
    print()
    
    # Get package size
    package_info = get_package_size()
    if package_info:
        print(f"📦 Package Size: {package_info['size_mb']} MB")
        print(f"   Location: {package_info['path']}")
    else:
        print("❌ Package not found")
    
    print()
    
    # Get initial memory state
    initial_memory = get_memory_usage()
    print(f"💾 System Memory:")
    print(f"   Total: {initial_memory['total_gb']} GB")
    print(f"   Available: {initial_memory['available_gb']} GB")
    print(f"   Used: {initial_memory['used_gb']} GB ({initial_memory['percentage']}%)")
    
    print()
    print("Starting monitoring...")
    print("-" * 60)
    
    # Monitor over time
    timestamps = []
    memory_usage = []
    cpu_usage = []
    
    start_time = time.time()
    iteration = 0
    
    while time.time() - start_time < duration:
        current_time = time.time() - start_time
        
        # Get current stats
        memory = psutil.virtual_memory()
        cpu = psutil.cpu_percent(interval=1)
        
        timestamps.append(current_time)
        memory_usage.append(memory.percent)
        cpu_usage.append(cpu)
        
        iteration += 1
        print(f"[{iteration:3d}] Time: {current_time:5.1f}s | Memory: {memory.percent:5.1f}% | CPU: {cpu:5.1f}%")
        
        # Wait for next interval
        time.sleep(interval - 1)  # -1 because cpu_percent takes 1 second
    
    # Calculate statistics
    stats = {
        "package_size_mb": package_info['size_mb'] if package_info else None,
        "package_path": package_info['path'] if package_info else None,
        "monitoring_duration": duration,
        "monitoring_interval": interval,
        "memory": {
            "mean_percent": sum(memory_usage) / len(memory_usage),
            "max_percent": max(memory_usage),
            "min_percent": min(memory_usage),
            "all_readings": memory_usage
        },
        "cpu": {
            "mean_percent": sum(cpu_usage) / len(cpu_usage),
            "max_percent": max(cpu_usage),
            "min_percent": min(cpu_usage),
            "all_readings": cpu_usage
        },
        "timestamps": timestamps,
        "system_info": {
            "total_memory_gb": initial_memory['total_gb'],
            "cpu_count": psutil.cpu_count(),
            "cpu_count_logical": psutil.cpu_count(logical=True)
        },
        "timestamp": datetime.now().isoformat()
    }
    
    # Save results
    with open('system_resource_monitor.json', 'w') as f:
        json.dump(stats, f, indent=2)
    
    print("-" * 60)
    print("MONITORING COMPLETE")
    print(f"Memory Usage - Mean: {stats['memory']['mean_percent']:.1f}%, Max: {stats['memory']['max_percent']:.1f}%")
    print(f"CPU Usage    - Mean: {stats['cpu']['mean_percent']:.1f}%, Max: {stats['cpu']['max_percent']:.1f}%")
    
    return stats

def create_visualization(stats):
    """Create resource usage visualization"""
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 8))
    
    timestamps = [t/60 for t in stats['timestamps']]  # Convert to minutes
    
    # Chart 1: Memory Usage
    ax1.plot(timestamps, stats['memory']['all_readings'], 
             color='#4A90E2', linewidth=2, label='Memory Usage')
    ax1.axhline(stats['memory']['mean_percent'], color='red', 
                linestyle='--', label=f"Mean: {stats['memory']['mean_percent']:.1f}%")
    ax1.fill_between(timestamps, 0, stats['memory']['all_readings'], 
                     alpha=0.3, color='#4A90E2')
    ax1.set_ylabel('Memory Usage (%)')
    ax1.set_title('System Memory Usage During Monitoring')
    ax1.legend()
    ax1.grid(True, alpha=0.3)
    ax1.set_ylim(0, 100)
    
    # Chart 2: CPU Usage
    ax2.plot(timestamps, stats['cpu']['all_readings'], 
             color='#E74C3C', linewidth=2, label='CPU Usage')
    ax2.axhline(stats['cpu']['mean_percent'], color='blue', 
                linestyle='--', label=f"Mean: {stats['cpu']['mean_percent']:.1f}%")
    ax2.fill_between(timestamps, 0, stats['cpu']['all_readings'], 
                     alpha=0.3, color='#E74C3C')
    ax2.set_xlabel('Time (minutes)')
    ax2.set_ylabel('CPU Usage (%)')
    ax2.set_title('CPU Usage During Monitoring')
    ax2.legend()
    ax2.grid(True, alpha=0.3)
    ax2.set_ylim(0, 100)
    
    plt.tight_layout()
    plt.savefig('system_resource_usage.png', dpi=300, bbox_inches='tight')
    print("\nVisualization saved as 'system_resource_usage.png'")
    plt.show()

def print_summary(stats):
    """Print detailed summary"""
    print("\n" + "=" * 60)
    print("SYSTEM RESOURCE SUMMARY")
    print("=" * 60)
    
    if stats['package_size_mb']:
        print(f"\n📦 MotiBuddy Package:")
        print(f"   Size: {stats['package_size_mb']} MB ({stats['package_size_mb']/1024:.2f} GB)")
        print(f"   Path: {stats['package_path']}")
    
    print(f"\n💾 System Information:")
    print(f"   Total Memory: {stats['system_info']['total_memory_gb']} GB")
    print(f"   CPU Cores: {stats['system_info']['cpu_count']} physical, {stats['system_info']['cpu_count_logical']} logical")
    
    print(f"\n📊 Memory Usage Statistics:")
    print(f"   Mean: {stats['memory']['mean_percent']:.2f}%")
    print(f"   Max:  {stats['memory']['max_percent']:.2f}%")
    print(f"   Min:  {stats['memory']['min_percent']:.2f}%")
    
    print(f"\n📊 CPU Usage Statistics:")
    print(f"   Mean: {stats['cpu']['mean_percent']:.2f}%")
    print(f"   Max:  {stats['cpu']['max_percent']:.2f}%")
    print(f"   Min:  {stats['cpu']['min_percent']:.2f}%")
    
    print(f"\n⏱️  Monitoring Duration: {stats['monitoring_duration']} seconds")
    print(f"   Data Points: {len(stats['timestamps'])}")
    print("=" * 60)

if __name__ == '__main__':
    # Quick package size check
    print("Quick Package Size Check:")
    print("-" * 40)
    package = get_package_size()
    if package:
        print(f"✅ Found: {package['size_mb']} MB")
        print(f"   Path: {package['path']}")
    else:
        print("❌ Package not found in expected locations")
    
    print()
    
    # Run monitoring
    stats = monitor_resources(duration=60, interval=5)
    print_summary(stats)
    create_visualization(stats)
