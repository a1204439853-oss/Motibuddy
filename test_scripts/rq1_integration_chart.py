#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RQ1: Integration Mechanism Effectiveness
Radar chart with smaller circle and larger font
"""

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

fig, ax = plt.subplots(figsize=(10, 10), subplot_kw=dict(projection='polar'))

# Data for radar chart
categories = ['Emotional\nAttachment', 'User-Pet\nBond', 'Integration\nCoherence', 
              'Behavioral\nEngagement', 'Expert\nEvaluation']
values = [4.0, 3.75, 4.5, 3.8, 4.5]
values += values[:1]  # Complete the circle

# Number of variables
N = len(categories)
angles = [n / float(N) * 2 * np.pi for n in range(N)]
angles += angles[:1]

# Plot
ax.plot(angles, values, 'o-', linewidth=2, color='#A8D5BA', label='MotiBuddy')
ax.fill(angles, values, alpha=0.25, color='#A8D5BA')

# Add benchmark circle
benchmark = [3.5] * (N + 1)
ax.plot(angles, benchmark, '--', linewidth=1.5, color='gray', alpha=0.7, label='Benchmark')

# Customize - smaller circle, larger font
ax.set_xticks(angles[:-1])
ax.set_xticklabels(categories, fontsize=13)  # Increased font size
ax.set_ylim(0, 5)
ax.set_yticks([1, 2, 3, 4, 5])
ax.set_yticklabels(['1', '2', '3', '4', '5'], fontsize=10, color='gray')
ax.grid(True, alpha=0.3)

# Make the plot area smaller by adjusting the axes
ax.set_rlabel_position(0)

plt.title('RQ1: Integration Mechanism Effectiveness\n(r=0.65, p<0.01)', 
          fontsize=16, fontweight='bold', pad=30)
plt.legend(loc='upper right', bbox_to_anchor=(1.3, 1.1), framealpha=0.9)

plt.tight_layout()
plt.savefig('rq1_integration_effectiveness.png', dpi=300, bbox_inches='tight', facecolor='white')
print("✓ Chart saved: rq1_integration_effectiveness.png")
