#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RQ2: Intelligent Feature Performance
Simple vertical bar chart
"""

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

fig, ax = plt.subplots(figsize=(10, 7))

# Data
categories = ['Voice Input\nConvenience', 'Voice\nAccuracy', 'Widget\nConvenience', 'Expert\nEvaluation']
values = [4.2, 3.9, 4.1, 4.4]
colors = ['#A8D5BA', '#B8D4E3', '#D4B8E0', '#E1D4A8']

# Create simple vertical bar chart
bars = ax.bar(categories, values, color=colors, alpha=0.8, width=0.6, edgecolor='gray', linewidth=1)

# Add value labels on top of bars
for bar, val in zip(bars, values):
    ax.text(bar.get_x() + bar.get_width()/2, val + 0.1, f'{val:.1f}', 
            ha='center', fontsize=12, fontweight='bold')

# Customize
ax.set_ylim(0, 5)
ax.set_ylabel('Score (out of 5.0)', fontsize=12)
ax.set_title('RQ2: Intelligent Feature Performance\n(85% voice recognition accuracy)', 
             fontsize=16, fontweight='bold', pad=20)
ax.grid(axis='y', alpha=0.3)
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)

plt.tight_layout()
plt.savefig('rq2_intelligent_features.png', dpi=300, bbox_inches='tight', facecolor='white')
print("✓ Chart saved: rq2_intelligent_features.png")
