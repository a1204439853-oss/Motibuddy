#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MotiBuddy Voice Recognition Accuracy Test
Tests speech-to-text accuracy with predefined phrases
"""

import time
import json
import statistics
from datetime import datetime
import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend
import matplotlib.pyplot as plt

# Test phrases with expected outputs
TEST_PHRASES = [
    {
        "input": "Submit report tomorrow at 3pm",
        "expected_title": "Submit report",
        "expected_date": "tomorrow",
        "expected_time": "15:00"
    },
    {
        "input": "Buy groceries this weekend",
        "expected_title": "Buy groceries",
        "expected_date": "weekend",
        "expected_time": None
    },
    {
        "input": "Call mom urgent",
        "expected_title": "Call mom",
        "expected_date": None,
        "expected_priority": "high"
    },
    {
        "input": "Finish project by January 15th",
        "expected_title": "Finish project",
        "expected_date": "2024-01-15",
        "expected_time": None
    },
    {
        "input": "Meeting with team next Monday at 10am",
        "expected_title": "Meeting with team",
        "expected_date": "next Monday",
        "expected_time": "10:00"
    },
    {
        "input": "Pay electricity bill before Friday",
        "expected_title": "Pay electricity bill",
        "expected_date": "Friday",
        "expected_time": None
    },
    {
        "input": "Review document important",
        "expected_title": "Review document",
        "expected_date": None,
        "expected_priority": "high"
    },
    {
        "input": "Walk the dog every day",
        "expected_title": "Walk the dog",
        "expected_date": "daily",
        "expected_time": None
    },
    {
        "input": "Doctor appointment March 3rd at 2pm",
        "expected_title": "Doctor appointment",
        "expected_date": "2024-03-03",
        "expected_time": "14:00"
    },
    {
        "input": "Buy birthday gift for Sarah next week",
        "expected_title": "Buy birthday gift for Sarah",
        "expected_date": "next week",
        "expected_time": None
    }
]

def simulate_voice_recognition(input_text):
    """
    Simulate voice recognition and NLP parsing
    In real implementation, this would call the actual Web Speech API + NLP pipeline
    """
    # This is a simulation - replace with actual API calls
    # Returns: recognized_text, confidence_score, parsed_result
    
    # Simulate 85% accuracy
    import random
    confidence = random.uniform(0.75, 0.95)
    
    # Simulate parsing result
    parsed = {
        "title": input_text.split("tomorrow")[0].strip() if "tomorrow" in input_text else input_text.split(" ")[0] + " " + input_text.split(" ")[1],
        "date": "tomorrow" if "tomorrow" in input_text else None,
        "time": "15:00" if "3pm" in input_text else None,
        "priority": "high" if "urgent" in input_text or "important" in input_text else "medium"
    }
    
    return input_text, confidence, parsed

def calculate_accuracy(expected, actual):
    """Calculate accuracy score for a single test"""
    scores = []
    
    # Title accuracy (40% weight)
    if expected.get("expected_title"):
        title_match = similarity_score(expected["expected_title"], actual.get("title", ""))
        scores.append(("title", title_match, 0.4))
    
    # Date accuracy (30% weight)
    if expected.get("expected_date"):
        date_match = 1.0 if expected["expected_date"] == actual.get("date") else 0.0
        scores.append(("date", date_match, 0.3))
    
    # Time accuracy (20% weight)
    if expected.get("expected_time"):
        time_match = 1.0 if expected["expected_time"] == actual.get("time") else 0.0
        scores.append(("time", time_match, 0.2))
    
    # Priority accuracy (10% weight)
    if expected.get("expected_priority"):
        priority_match = 1.0 if expected["expected_priority"] == actual.get("priority") else 0.0
        scores.append(("priority", priority_match, 0.1))
    
    # Calculate weighted average
    total_weight = sum(weight for _, _, weight in scores)
    weighted_score = sum(score * weight for _, score, weight in scores) / total_weight if total_weight > 0 else 0
    
    return weighted_score, scores

def similarity_score(str1, str2):
    """Calculate string similarity (simplified)"""
    # In real implementation, use more sophisticated similarity metrics
    str1 = str1.lower().strip()
    str2 = str2.lower().strip()
    
    if str1 == str2:
        return 1.0
    
    # Check for partial match
    if str1 in str2 or str2 in str1:
        return 0.8
    
    # Word overlap
    words1 = set(str1.split())
    words2 = set(str2.split())
    overlap = len(words1.intersection(words2))
    total = len(words1.union(words2))
    
    return overlap / total if total > 0 else 0

def run_accuracy_tests(iterations=5):
    """Run voice recognition accuracy tests"""
    print("MotiBuddy Voice Recognition Accuracy Test")
    print("=" * 60)
    print(f"Testing {len(TEST_PHRASES)} phrases x {iterations} iterations each")
    print()
    
    all_results = []
    
    for phrase_data in TEST_PHRASES:
        print(f"Testing: \"{phrase_data['input']}\"")
        
        phrase_results = []
        for i in range(iterations):
            # Simulate recognition
            recognized, confidence, parsed = simulate_voice_recognition(phrase_data['input'])
            
            # Calculate accuracy
            accuracy, details = calculate_accuracy(phrase_data, parsed)
            
            result = {
                "input": phrase_data['input'],
                "iteration": i + 1,
                "confidence": confidence,
                "accuracy": accuracy,
                "details": details,
                "parsed": parsed
            }
            
            phrase_results.append(result)
            all_results.append(result)
        
        # Calculate average for this phrase
        avg_accuracy = statistics.mean([r['accuracy'] for r in phrase_results])
        avg_confidence = statistics.mean([r['confidence'] for r in phrase_results])
        
        print(f"  Average Accuracy: {avg_accuracy:.1%}")
        print(f"  Average Confidence: {avg_confidence:.1%}")
        print()
    
    # Overall statistics
    overall_accuracy = statistics.mean([r['accuracy'] for r in all_results])
    overall_confidence = statistics.mean([r['confidence'] for r in all_results])
    
    stats = {
        "total_tests": len(all_results),
        "phrases_tested": len(TEST_PHRASES),
        "iterations_per_phrase": iterations,
        "overall_accuracy": overall_accuracy,
        "overall_confidence": overall_confidence,
        "accuracy_std": statistics.stdev([r['accuracy'] for r in all_results]),
        "confidence_std": statistics.stdev([r['confidence'] for r in all_results]),
        "all_results": all_results,
        "timestamp": datetime.now().isoformat()
    }
    
    # Save results
    with open('voice_recognition_results.json', 'w') as f:
        json.dump(stats, f, indent=2)
    
    print("=" * 60)
    print("OVERALL RESULTS:")
    print(f"  Total Tests: {stats['total_tests']}")
    print(f"  Overall Accuracy: {overall_accuracy:.1%}")
    print(f"  Overall Confidence: {overall_confidence:.1%}")
    print(f"  Accuracy Std Dev: {stats['accuracy_std']:.3f}")
    
    return stats

def create_visualization(stats):
    """Create visualization charts"""
    fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(14, 10))
    
    # Extract data
    accuracies = [r['accuracy'] for r in stats['all_results']]
    confidences = [r['confidence'] for r in stats['all_results']]
    
    # Chart 1: Accuracy Distribution
    ax1.hist(accuracies, bins=20, color='#4A90E2', alpha=0.7, edgecolor='black')
    ax1.axvline(stats['overall_accuracy'], color='red', linestyle='--', 
                linewidth=2, label=f"Mean: {stats['overall_accuracy']:.1%}")
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
    
    # Add trend line
    z = [confidences[i] * accuracies[i] for i in range(len(confidences))]
    ax2.plot([min(confidences), max(confidences)], 
             [min(accuracies), max(accuracies)], 
             'r--', alpha=0.5, label='Trend')
    ax2.legend()
    
    # Chart 3: Accuracy by Phrase
    phrase_accuracies = {}
    for r in stats['all_results']:
        phrase = r['input'][:30] + "..." if len(r['input']) > 30 else r['input']
        if phrase not in phrase_accuracies:
            phrase_accuracies[phrase] = []
        phrase_accuracies[phrase].append(r['accuracy'])
    
    phrase_means = {p: statistics.mean(a) for p, a in phrase_accuracies.items()}
    phrases = list(phrase_means.keys())
    means = list(phrase_means.values())
    
    ax3.barh(range(len(phrases)), means, color='#4A90E2', alpha=0.7)
    ax3.set_yticks(range(len(phrases)))
    ax3.set_yticklabels([f"Phrase {i+1}" for i in range(len(phrases))], fontsize=8)
    ax3.set_xlabel('Average Accuracy')
    ax3.set_title('Accuracy by Test Phrase')
    ax3.grid(True, alpha=0.3, axis='x')
    
    # Chart 4: Summary Statistics
    summary_text = f"""
    Voice Recognition Test Summary
    ════════════════════════════════
    
    Total Tests: {stats['total_tests']}
    Phrases: {stats['phrases_tested']}
    Iterations/Phrase: {stats['iterations_per_phrase']}
    
    Overall Accuracy: {stats['overall_accuracy']:.1%}
    Accuracy Std Dev: {stats['accuracy_std']:.3f}
    
    Overall Confidence: {stats['overall_confidence']:.1%}
    Confidence Std Dev: {stats['confidence_std']:.3f}
    
    Performance Rating: {"Excellent" if stats['overall_accuracy'] > 0.9 else "Good" if stats['overall_accuracy'] > 0.8 else "Fair"}
    """
    
    ax4.text(0.1, 0.5, summary_text, transform=ax4.transAxes,
             fontsize=11, verticalalignment='center',
             bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5))
    ax4.axis('off')
    ax4.set_title('Test Summary')
    
    plt.tight_layout()
    plt.savefig('voice_recognition_results.png', dpi=300, bbox_inches='tight')
    print("\nVisualization saved as 'voice_recognition_results.png'")
    plt.show()

if __name__ == '__main__':
    stats = run_accuracy_tests(iterations=5)
    create_visualization(stats)
