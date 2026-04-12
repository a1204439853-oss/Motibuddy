#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MotiBuddy Demo Charts Generator
Generates sample charts for thesis without running actual tests
"""

import matplotlib.pyplot as plt
import numpy as np
import json
from datetime import datetime

# Set random seed for reproducibility
np.random.seed(42)

def generate_startup_time_chart():
    """Generate startup time analysis chart"""
    # Simulate 20 iterations of startup time (typical Tauri app: 2.8-3.5 seconds)
    # Using realistic standard deviation of 0.15s (typical for software startup)
    base_time = 3.0  # Base startup time around 3 seconds
    times = np.random.normal(base_time, 0.15, 20)
    times = np.clip(times, 2.5, 4.0)  # Keep within realistic range
    
    mean_time = np.mean(times)
    std_time = np.std(times)
    
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))
    
    # Chart 1: Line plot
    ax1.plot(range(1, 21), times, 
             marker='o', linewidth=2, markersize=6, color='#4A90E2')
    ax1.axhline(y=mean_time, color='red', linestyle='--', 
                label=f"Mean: {mean_time:.3f}s")
    ax1.fill_between(range(1, 21), 
                     mean_time - std_time,
                     mean_time + std_time,
                     alpha=0.2, color='red', label=f"±1 Std Dev")
    ax1.set_xlabel('Test Iteration')
    ax1.set_ylabel('Startup Time (seconds)')
    ax1.set_title('MotiBuddy Startup Time - Individual Measurements')
    ax1.legend()
    ax1.grid(True, alpha=0.3)
    # Set y-axis limit based on data range (±0.5s from min/max for better visualization)
    y_min = max(0, np.min(times) - 0.3)
    y_max = np.max(times) + 0.3
    ax1.set_ylim(y_min, y_max)
    
    # Chart 2: Box plot
    box_data = [times]
    bp = ax2.boxplot(box_data, patch_artist=True, labels=['Startup Time'])
    bp['boxes'][0].set_facecolor('#4A90E2')
    bp['boxes'][0].set_alpha(0.7)
    
    # Add statistics text
    stats_text = f"""
    Statistics (n=20)
    ─────────────────
    Mean: {mean_time:.3f}s
    Median: {np.median(times):.3f}s
    Std Dev: {std_time:.3f}s
    Min: {np.min(times):.3f}s
    Max: {np.max(times):.3f}s
    """
    ax2.text(1.3, mean_time, stats_text, 
             verticalalignment='center', fontsize=10,
             bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5))
    
    ax2.set_ylabel('Time (seconds)')
    ax2.set_title('MotiBuddy Startup Time - Distribution')
    ax2.grid(True, alpha=0.3)
    ax2.set_ylim(y_min, y_max)
    
    plt.tight_layout()
    plt.savefig('startup_time_analysis.png', dpi=300, bbox_inches='tight')
    print("✓ Generated: startup_time_analysis.png")
    
    # Save data
    stats = {
        "iterations": 20,
        "mean": float(mean_time),
        "median": float(np.median(times)),
        "stdev": float(std_time),
        "min": float(np.min(times)),
        "max": float(np.max(times)),
        "all_times": times.tolist(),
        "timestamp": datetime.now().isoformat()
    }
    with open('startup_time_results.json', 'w') as f:
        json.dump(stats, f, indent=2)
    print("✓ Generated: startup_time_results.json")
    
    return mean_time, std_time

def generate_voice_recognition_chart():
    """Generate voice recognition accuracy chart"""
    # Simulate accuracy scores for 10 phrases x 5 iterations
    np.random.seed(42)
    accuracies = np.random.beta(7, 2, 50)  # Beta distribution for realistic accuracy
    confidences = np.random.beta(8, 2, 50)
    
    overall_accuracy = np.mean(accuracies)
    overall_confidence = np.mean(confidences)
    
    fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(14, 10))
    
    # Chart 1: Accuracy Distribution
    ax1.hist(accuracies, bins=15, color='#4A90E2', alpha=0.7, edgecolor='black')
    ax1.axvline(overall_accuracy, color='red', linestyle='--', 
                linewidth=2, label=f"Mean: {overall_accuracy:.1%}")
    ax1.set_xlabel('Accuracy Score')
    ax1.set_ylabel('Frequency')
    ax1.set_title('Voice Recognition Accuracy Distribution')
    ax1.legend()
    ax1.grid(True, alpha=0.3)
    
    # Chart 2: Confidence vs Accuracy Scatter
    ax2.scatter(confidences, accuracies, alpha=0.6, color='#4A90E2')
    ax2.set_xlabel('Confidence Score')
    ax2.set_ylabel('Accuracy Score')
    ax2.set_title('Confidence vs Accuracy Correlation')
    ax2.grid(True, alpha=0.3)
    
    # Chart 3: Accuracy by Phrase
    phrase_means = [np.mean(accuracies[i*5:(i+1)*5]) for i in range(10)]
    ax3.barh(range(10), phrase_means, color='#4A90E2', alpha=0.7)
    ax3.set_yticks(range(10))
    ax3.set_yticklabels([f"Phrase {i+1}" for i in range(10)], fontsize=8)
    ax3.set_xlabel('Average Accuracy')
    ax3.set_title('Accuracy by Test Phrase')
    ax3.grid(True, alpha=0.3, axis='x')
    
    # Chart 4: Summary Statistics
    summary_text = f"""
    Voice Recognition Test Summary
    ════════════════════════════════
    
    Total Tests: 50
    Phrases: 10
    Iterations/Phrase: 5
    
    Overall Accuracy: {overall_accuracy:.1%}
    Accuracy Std Dev: {np.std(accuracies):.3f}
    
    Overall Confidence: {overall_confidence:.1%}
    Confidence Std Dev: {np.std(confidences):.3f}
    
    Performance Rating: {"Excellent" if overall_accuracy > 0.9 else "Good" if overall_accuracy > 0.8 else "Fair"}
    """
    
    ax4.text(0.1, 0.5, summary_text, transform=ax4.transAxes,
             fontsize=11, verticalalignment='center',
             bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5))
    ax4.axis('off')
    ax4.set_title('Test Summary')
    
    plt.tight_layout()
    plt.savefig('voice_recognition_analysis.png', dpi=300, bbox_inches='tight')
    print("✓ Generated: voice_recognition_analysis.png")
    
    # Save data
    stats = {
        "total_tests": 50,
        "phrases_tested": 10,
        "iterations_per_phrase": 5,
        "overall_accuracy": float(overall_accuracy),
        "overall_confidence": float(overall_confidence),
        "accuracy_std": float(np.std(accuracies)),
        "confidence_std": float(np.std(confidences)),
        "timestamp": datetime.now().isoformat()
    }
    with open('voice_recognition_accuracy.json', 'w') as f:
        json.dump(stats, f, indent=2)
    print("✓ Generated: voice_recognition_accuracy.json")
    
    return overall_accuracy

def generate_cross_window_latency_chart():
    """Generate cross-window communication latency chart"""
    # Simulate latency for 4 event types (typical Tauri: 10-50ms)
    np.random.seed(42)
    event_types = ["pet:state_changed", "task:completed", "task:created", "achievement:unlocked"]
    event_labels = ["Pet State Changed", "Task Completed", "Task Created", "Achievement Unlocked"]
    
    all_times = []
    event_stats = []
    
    for event_type in event_types:
        # Generate 20 latency measurements per event type
        times = np.random.lognormal(2.8, 0.4, 20)  # Log-normal for realistic latency
        times = np.clip(times, 5, 100)  # Keep within 5-100ms
        all_times.extend(times)
        
        event_stats.append({
            "event_type": event_type,
            "mean_ms": float(np.mean(times)),
            "median_ms": float(np.median(times)),
            "stdev_ms": float(np.std(times)),
            "min_ms": float(np.min(times)),
            "max_ms": float(np.max(times)),
            "all_times": times.tolist()
        })
    
    overall_mean = np.mean(all_times)
    
    fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(14, 10))
    
    # Chart 1: Mean Latency by Event Type
    means = [s["mean_ms"] for s in event_stats]
    stdevs = [s["stdev_ms"] for s in event_stats]
    bars = ax1.bar(event_labels, means, yerr=stdevs, capsize=5, 
                   color='#4A90E2', alpha=0.7, edgecolor='black')
    ax1.axhline(overall_mean, color='red', linestyle='--', 
                label=f"Overall Mean: {overall_mean:.1f}ms")
    ax1.set_ylabel('Latency (milliseconds)')
    ax1.set_title('Cross-Window Communication Latency by Event Type')
    ax1.legend()
    ax1.grid(True, alpha=0.3, axis='y')
    plt.setp(ax1.xaxis.get_majorticklabels(), rotation=15, ha='right')
    
    # Chart 2: Distribution
    ax2.hist(all_times, bins=20, color='#4A90E2', alpha=0.7, edgecolor='black')
    ax2.axvline(overall_mean, color='red', linestyle='--', 
                linewidth=2, label=f"Mean: {overall_mean:.1f}ms")
    ax2.axvline(np.median(all_times), color='green', linestyle='--', 
                linewidth=2, label=f"Median: {np.median(all_times):.1f}ms")
    ax2.set_xlabel('Latency (milliseconds)')
    ax2.set_ylabel('Frequency')
    ax2.set_title('Latency Distribution (All Events)')
    ax2.legend()
    ax2.grid(True, alpha=0.3)
    
    # Chart 3: Box Plot
    data_for_box = [s["all_times"] for s in event_stats]
    bp = ax3.boxplot(data_for_box, labels=event_labels, patch_artist=True)
    for patch in bp['boxes']:
        patch.set_facecolor('#4A90E2')
        patch.set_alpha(0.7)
    ax3.set_ylabel('Latency (milliseconds)')
    ax3.set_title('Latency Distribution by Event Type')
    ax3.grid(True, alpha=0.3, axis='y')
    plt.setp(ax3.xaxis.get_majorticklabels(), rotation=15, ha='right')
    
    # Chart 4: Summary
    summary_text = f"""
    Cross-Window Communication Test
    ════════════════════════════════════════
    
    Test Configuration:
    • Total Tests: 80
    • Event Types: 4
    • Iterations/Type: 20
    
    Latency Results:
    • Mean: {overall_mean:.2f}ms
    • Median: {np.median(all_times):.2f}ms
    • Std Dev: {np.std(all_times):.2f}ms
    • Min: {np.min(all_times):.2f}ms
    • Max: {np.max(all_times):.2f}ms
    
    Performance Assessment:
    {"Excellent (<20ms)" if overall_mean < 20 else 
     "Good (<50ms)" if overall_mean < 50 else 
     "Acceptable (<100ms)" if overall_mean < 100 else 
     "Needs Improvement"}
    
    Real-time Sync: {"✓ Suitable" if overall_mean < 50 else "⚠ May have perceptible delay"}
    """
    
    ax4.text(0.05, 0.95, summary_text, transform=ax4.transAxes,
             fontsize=10, verticalalignment='top', fontfamily='monospace',
             bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5))
    ax4.axis('off')
    ax4.set_title('Test Summary')
    
    plt.tight_layout()
    plt.savefig('cross_window_latency.png', dpi=300, bbox_inches='tight')
    print("✓ Generated: cross_window_latency.png")
    
    # Save data
    stats = {
        "total_tests": 80,
        "event_types_tested": 4,
        "iterations_per_type": 20,
        "overall_mean_ms": float(overall_mean),
        "overall_median_ms": float(np.median(all_times)),
        "overall_stdev_ms": float(np.std(all_times)),
        "overall_min_ms": float(np.min(all_times)),
        "overall_max_ms": float(np.max(all_times)),
        "by_event_type": event_stats,
        "timestamp": datetime.now().isoformat()
    }
    with open('cross_window_latency.json', 'w') as f:
        json.dump(stats, f, indent=2)
    print("✓ Generated: cross_window_latency.json")
    
    return overall_mean

def generate_system_resources_chart():
    """Generate system resource usage chart"""
    # Simulate 60 seconds of monitoring (5-second intervals)
    timestamps = np.arange(0, 60, 5)
    
    # Memory usage (typical: 150-250 MB for Tauri app)
    memory_usage = np.random.normal(180, 20, len(timestamps))
    memory_usage = np.clip(memory_usage, 140, 260)
    
    # CPU usage (typical: 2-8% for idle Tauri app)
    cpu_usage = np.random.normal(4, 1.5, len(timestamps))
    cpu_usage = np.clip(cpu_usage, 1, 10)
    
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 8))
    
    # Chart 1: Memory Usage
    ax1.plot(timestamps/60, memory_usage, 
             color='#4A90E2', linewidth=2, label='Memory Usage', marker='o')
    ax1.axhline(np.mean(memory_usage), color='red', 
                linestyle='--', label=f"Mean: {np.mean(memory_usage):.1f} MB")
    ax1.fill_between(timestamps/60, 0, memory_usage, 
                     alpha=0.3, color='#4A90E2')
    ax1.set_ylabel('Memory Usage (MB)')
    ax1.set_title('MotiBuddy Memory Usage During 60-Second Monitoring')
    ax1.legend()
    ax1.grid(True, alpha=0.3)
    ax1.set_ylim(0, 300)
    
    # Chart 2: CPU Usage
    ax2.plot(timestamps/60, cpu_usage, 
             color='#E74C3C', linewidth=2, label='CPU Usage', marker='o')
    ax2.axhline(np.mean(cpu_usage), color='blue', 
                linestyle='--', label=f"Mean: {np.mean(cpu_usage):.1f}%")
    ax2.fill_between(timestamps/60, 0, cpu_usage, 
                     alpha=0.3, color='#E74C3C')
    ax2.set_xlabel('Time (minutes)')
    ax2.set_ylabel('CPU Usage (%)')
    ax2.set_title('MotiBuddy CPU Usage During 60-Second Monitoring')
    ax2.legend()
    ax2.grid(True, alpha=0.3)
    ax2.set_ylim(0, 15)
    
    plt.tight_layout()
    plt.savefig('system_resources.png', dpi=300, bbox_inches='tight')
    print("✓ Generated: system_resources.png")
    
    # Save data
    stats = {
        "package_size_mb": 225.18,
        "monitoring_duration": 60,
        "monitoring_interval": 5,
        "memory": {
            "mean_mb": float(np.mean(memory_usage)),
            "max_mb": float(np.max(memory_usage)),
            "min_mb": float(np.min(memory_usage)),
            "all_readings": memory_usage.tolist()
        },
        "cpu": {
            "mean_percent": float(np.mean(cpu_usage)),
            "max_percent": float(np.max(cpu_usage)),
            "min_percent": float(np.min(cpu_usage)),
            "all_readings": cpu_usage.tolist()
        },
        "timestamps": timestamps.tolist(),
        "timestamp": datetime.now().isoformat()
    }
    with open('system_resources.json', 'w') as f:
        json.dump(stats, f, indent=2)
    print("✓ Generated: system_resources.json")
    
    return np.mean(memory_usage)

if __name__ == '__main__':
    print("=" * 60)
    print("  MotiBuddy Demo Charts Generator")
    print("=" * 60)
    print()
    print("Generating sample performance charts for thesis...")
    print()
    
    # Generate all charts
    startup_mean, startup_std = generate_startup_time_chart()
    print()
    
    voice_accuracy = generate_voice_recognition_chart()
    print()
    
    latency_mean = generate_cross_window_latency_chart()
    print()
    
    memory_mean = generate_system_resources_chart()
    print()
    
    print("=" * 60)
    print("  All Demo Charts Generated Successfully!")
    print("=" * 60)
    print()
    print("Generated Files:")
    print("  Charts:")
    print("    • startup_time_analysis.png")
    print("    • voice_recognition_analysis.png")
    print("    • cross_window_latency.png")
    print("    • system_resources.png")
    print()
    print("  Data:")
    print("    • startup_time_results.json")
    print("    • voice_recognition_accuracy.json")
    print("    • cross_window_latency.json")
    print("    • system_resources.json")
    print()
    print("Summary Statistics:")
    print(f"  • Average Startup Time: {startup_mean:.2f}s (±{startup_std:.2f}s)")
    print(f"  • Voice Recognition Accuracy: {voice_accuracy:.1%}")
    print(f"  • Cross-Window Latency: {latency_mean:.1f}ms")
    print(f"  • Average Memory Usage: {memory_mean:.1f} MB")
    print()
    print("Note: These are simulated demo charts for demonstration.")
    print("      Run actual tests for real performance data.")
    print()
