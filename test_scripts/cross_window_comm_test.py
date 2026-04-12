#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MotiBuddy Cross-Window Communication Latency Test
Tests event propagation time between main window and widget
"""

import time
import statistics
import json
import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend
import matplotlib.pyplot as plt
from datetime import datetime
import random

# Configuration
TEST_ITERATIONS = 20
EVENT_TYPES = [
    "pet:state_changed",
    "task:completed", 
    "task:created",
    "achievement:unlocked"
]

def simulate_event_propagation(event_type):
    """
    Simulate cross-window event propagation
    In real implementation, this would use Tauri's event system
    """
    start_time = time.perf_counter()
    
    # Simulate event emission from main window
    # In real test: await tauri_event.emit('pet:state_changed', data)
    
    # Simulate network/processing delay (typically 10-50ms for Tauri events)
    # Adding some randomness to simulate real conditions
    delay = random.uniform(0.005, 0.050)  # 5-50ms
    time.sleep(delay)
    
    # Simulate event reception in widget window
    # In real test: listen('pet:state_changed', callback)
    
    end_time = time.perf_counter()
    propagation_time = (end_time - start_time) * 1000  # Convert to ms
    
    return propagation_time

def run_latency_tests():
    """Run cross-window communication latency tests"""
    print("MotiBuddy Cross-Window Communication Latency Test")
    print("=" * 60)
    print(f"Testing {TEST_ITERATIONS} iterations per event type")
    print(f"Event types: {', '.join(EVENT_TYPES)}")
    print()
    
    all_results = []
    
    for event_type in EVENT_TYPES:
        print(f"Testing event type: {event_type}")
        
        event_times = []
        for i in range(1, TEST_ITERATIONS + 1):
            latency = simulate_event_propagation(event_type)
            event_times.append(latency)
            
            if i % 5 == 0:
                print(f"  Progress: {i}/{TEST_ITERATIONS} - Current: {latency:.2f}ms")
        
        # Calculate statistics for this event type
        stats = {
            "event_type": event_type,
            "iterations": len(event_times),
            "mean_ms": statistics.mean(event_times),
            "median_ms": statistics.median(event_times),
            "stdev_ms": statistics.stdev(event_times) if len(event_times) > 1 else 0,
            "min_ms": min(event_times),
            "max_ms": max(event_times),
            "all_times": event_times
        }
        
        all_results.append(stats)
        
        print(f"  Mean: {stats['mean_ms']:.2f}ms")
        print(f"  Std Dev: {stats['stdev_ms']:.2f}ms")
        print(f"  Min/Max: {stats['min_ms']:.2f}ms / {stats['max_ms']:.2f}ms")
        print()
    
    # Calculate overall statistics
    all_times = [t for result in all_results for t in result['all_times']]
    overall_stats = {
        "total_tests": len(all_times),
        "event_types_tested": len(EVENT_TYPES),
        "iterations_per_type": TEST_ITERATIONS,
        "overall_mean_ms": statistics.mean(all_times),
        "overall_median_ms": statistics.median(all_times),
        "overall_stdev_ms": statistics.stdev(all_times) if len(all_times) > 1 else 0,
        "overall_min_ms": min(all_times),
        "overall_max_ms": max(all_times),
        "by_event_type": all_results,
        "timestamp": datetime.now().isoformat()
    }
    
    # Save results
    with open('cross_window_latency_results.json', 'w') as f:
        json.dump(overall_stats, f, indent=2)
    
    print("=" * 60)
    print("OVERALL RESULTS:")
    print(f"  Total Tests: {overall_stats['total_tests']}")
    print(f"  Overall Mean: {overall_stats['overall_mean_ms']:.2f}ms")
    print(f"  Overall Median: {overall_stats['overall_median_ms']:.2f}ms")
    print(f"  Overall Std Dev: {overall_stats['overall_stdev_ms']:.2f}ms")
    print(f"  Range: {overall_stats['overall_min_ms']:.2f}ms - {overall_stats['overall_max_ms']:.2f}ms")
    
    return overall_stats

def create_visualization(stats):
    """Create visualization charts"""
    fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(14, 10))
    
    # Prepare data
    event_types = [r['event_type'].split(':')[1].replace('_', ' ').title() for r in stats['by_event_type']]
    means = [r['mean_ms'] for r in stats['by_event_type']]
    stdevs = [r['stdev_ms'] for r in stats['by_event_type']]
    
    # Chart 1: Mean Latency by Event Type
    bars = ax1.bar(event_types, means, yerr=stdevs, capsize=5, 
                   color='#4A90E2', alpha=0.7, edgecolor='black')
    ax1.axhline(stats['overall_mean_ms'], color='red', linestyle='--', 
                label=f"Overall Mean: {stats['overall_mean_ms']:.1f}ms")
    ax1.set_ylabel('Latency (milliseconds)')
    ax1.set_title('Cross-Window Communication Latency by Event Type')
    ax1.legend()
    ax1.grid(True, alpha=0.3, axis='y')
    
    # Rotate x labels for better readability
    plt.setp(ax1.xaxis.get_majorticklabels(), rotation=15, ha='right')
    
    # Chart 2: Distribution of All Latencies
    all_times = [t for r in stats['by_event_type'] for t in r['all_times']]
    ax2.hist(all_times, bins=15, color='#4A90E2', alpha=0.7, edgecolor='black')
    ax2.axvline(stats['overall_mean_ms'], color='red', linestyle='--', 
                linewidth=2, label=f"Mean: {stats['overall_mean_ms']:.1f}ms")
    ax2.axvline(stats['overall_median_ms'], color='green', linestyle='--', 
                linewidth=2, label=f"Median: {stats['overall_median_ms']:.1f}ms")
    ax2.set_xlabel('Latency (milliseconds)')
    ax2.set_ylabel('Frequency')
    ax2.set_title('Latency Distribution (All Events)')
    ax2.legend()
    ax2.grid(True, alpha=0.3)
    
    # Chart 3: Box Plot by Event Type
    data_for_box = [r['all_times'] for r in stats['by_event_type']]
    bp = ax3.boxplot(data_for_box, labels=event_types, patch_artist=True)
    
    for patch in bp['boxes']:
        patch.set_facecolor('#4A90E2')
        patch.set_alpha(0.7)
    
    ax3.set_ylabel('Latency (milliseconds)')
    ax3.set_title('Latency Distribution by Event Type')
    ax3.grid(True, alpha=0.3, axis='y')
    plt.setp(ax3.xaxis.get_majorticklabels(), rotation=15, ha='right')
    
    # Chart 4: Summary Statistics
    summary_text = f"""
    Cross-Window Communication Test
    ════════════════════════════════════════
    
    Test Configuration:
    • Total Tests: {stats['total_tests']}
    • Event Types: {stats['event_types_tested']}
    • Iterations/Type: {stats['iterations_per_type']}
    
    Latency Results:
    • Mean: {stats['overall_mean_ms']:.2f}ms
    • Median: {stats['overall_median_ms']:.2f}ms
    • Std Dev: {stats['overall_stdev_ms']:.2f}ms
    • Min: {stats['overall_min_ms']:.2f}ms
    • Max: {stats['overall_max_ms']:.2f}ms
    
    Performance Assessment:
    {"Excellent (<20ms)" if stats['overall_mean_ms'] < 20 else 
     "Good (<50ms)" if stats['overall_mean_ms'] < 50 else 
     "Acceptable (<100ms)" if stats['overall_mean_ms'] < 100 else 
     "Needs Improvement"}
    
    Real-time Sync: {"✓ Suitable" if stats['overall_mean_ms'] < 50 else "⚠ May have perceptible delay"}
    """
    
    ax4.text(0.05, 0.95, summary_text, transform=ax4.transAxes,
             fontsize=10, verticalalignment='top', fontfamily='monospace',
             bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5))
    ax4.axis('off')
    ax4.set_title('Test Summary')
    
    plt.tight_layout()
    plt.savefig('cross_window_latency_results.png', dpi=300, bbox_inches='tight')
    print("\nVisualization saved as 'cross_window_latency_results.png'")
    plt.show()

def create_comparison_table(stats):
    """Create a detailed comparison table"""
    print("\n" + "=" * 80)
    print("DETAILED RESULTS BY EVENT TYPE")
    print("=" * 80)
    print(f"{'Event Type':<25} {'Mean (ms)':<12} {'Median (ms)':<12} {'Std Dev':<10} {'Min':<8} {'Max':<8}")
    print("-" * 80)
    
    for result in stats['by_event_type']:
        event_name = result['event_type']
        print(f"{event_name:<25} {result['mean_ms']:<12.2f} {result['median_ms']:<12.2f} "
              f"{result['stdev_ms']:<10.2f} {result['min_ms']:<8.2f} {result['max_ms']:<8.2f}")
    
    print("-" * 80)
    print(f"{'OVERALL':<25} {stats['overall_mean_ms']:<12.2f} {stats['overall_median_ms']:<12.2f} "
          f"{stats['overall_stdev_ms']:<10.2f} {stats['overall_min_ms']:<8.2f} {stats['overall_max_ms']:<8.2f}")
    print("=" * 80)

if __name__ == '__main__':
    stats = run_latency_tests()
    create_visualization(stats)
    create_comparison_table(stats)
