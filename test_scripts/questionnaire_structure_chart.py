#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MotiBuddy Questionnaire Structure - Clean Circular Layout
"""

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch, Circle
import numpy as np

fig, ax = plt.subplots(figsize=(14, 10))
ax.set_xlim(-7, 7)
ax.set_ylim(-5, 5)
ax.set_aspect('equal')
ax.axis('off')

# Title at top
ax.text(0, 4.6, 'MotiBuddy Questionnaire Structure', 
        fontsize=20, fontweight='bold', ha='center')

# Colors
colors = ['#A8C8E1', '#C8A8D8', '#E1D4A8', '#A8D8C8', '#D8C8A8', '#C8D8A8']

# Data - single line titles
dimensions = [
    ('Section 1', 'Demographic Information', 'Q1-Q5', 'Age, Gender, Usage, Pet Type'),
    ('Section 2', 'Emotional Attachment', 'Q6-Q10', 'Responsibility, Enjoyment'),
    ('Section 3', 'Intrinsic Motivation (SDT)', 'Q11-Q15', 'Autonomy, Competence, Relatedness'),
    ('Section 4', 'Feature Usability', 'Q16-Q20', 'Voice, Widget, Task Functions'),
    ('Section 5', 'Procrastination Reduction', 'Q21-Q25', 'Task Initiation, Completion'),
    ('Section 6', 'Overall Satisfaction', 'Q26-Q29', 'Satisfaction, Recommendation')
]

# Layout parameters - reduced radius to decrease distance between boxes
radius = 3.5
center = (0, -0.3)
box_w, box_h = 2.8, 1.5

# Draw sections
for i, (sec, name, items, content) in enumerate(dimensions):
    angle = np.radians(i * 60)
    x = center[0] + radius * np.cos(angle)
    y = center[1] + radius * np.sin(angle)
    
    # Box
    box = FancyBboxPatch((x - box_w/2, y - box_h/2), box_w, box_h,
                         boxstyle="round,rounding_size=0.2",
                         facecolor=colors[i], edgecolor='#666666',
                         linewidth=1.5, alpha=0.85)
    ax.add_patch(box)
    
    # Text lines - further increased font sizes
    ax.text(x, y + 0.4, sec, fontsize=13, fontweight='bold', 
            ha='center', va='center', color='#333333')
    ax.text(x, y + 0.05, name, fontsize=15, fontweight='bold',
            ha='center', va='center', color='#222222')
    ax.text(x, y - 0.3, f'({items})', fontsize=12, style='italic',
            ha='center', va='center', color='#555555')
    ax.text(x, y - 0.55, content, fontsize=11,
            ha='center', va='center', color='#666666')
    
    # Connection line
    inner_r = 1.6
    x1 = center[0] + inner_r * np.cos(angle)
    y1 = center[1] + inner_r * np.sin(angle)
    x2 = center[0] + (radius - box_w/2 - 0.15) * np.cos(angle)
    y2 = center[1] + (radius - box_h/2 - 0.15) * np.sin(angle)
    ax.plot([x1, x2], [y1, y2], color='#888888', linewidth=1.5, alpha=0.7)

# Center circle
circle = Circle(center, 1.6, facecolor='#F8F8F8', edgecolor='#666666', linewidth=2)
ax.add_patch(circle)

# Center text - increased font sizes
ax.text(center[0], center[1] + 0.9, 'Likert Scale', 
        fontsize=16, fontweight='bold', ha='center', color='#333333')
ax.text(center[0], center[1] + 0.5, '5-Point', 
        fontsize=12, ha='center', style='italic', color='#666666')

# Scale items - increased font sizes
scales = [('5', 'Strongly Agree'), ('4', 'Agree'), ('3', 'Neutral'), 
          ('2', 'Disagree'), ('1', 'Strongly Disagree')]
y_offset = 0.15
for num, label in scales:
    ax.text(center[0] - 0.5, center[1] + y_offset, num, 
            fontsize=12, fontweight='bold', ha='right', color='#444444')
    ax.text(center[0] - 0.3, center[1] + y_offset, label, 
            fontsize=11, ha='left', color='#555555')
    y_offset -= 0.28

ax.text(center[0], center[1] - 1.15, 'Likert (1932)', 
        fontsize=10, ha='center', style='italic', color='#888888')

# Summary in top right corner - increased font sizes
ax.text(6.5, 4.3, 'Total: 29 Items', fontsize=13, ha='right', fontweight='bold', color='#555555')
ax.text(6.5, 4.0, 'Purpose: Evaluate user experience,', fontsize=12, ha='right', style='italic', color='#666666')
ax.text(6.5, 3.7, 'engagement, and satisfaction', fontsize=12, ha='right', style='italic', color='#666666')

plt.tight_layout()
plt.savefig('questionnaire_structure.png', dpi=300, bbox_inches='tight', 
            facecolor='white', edgecolor='none')
print("Chart saved: questionnaire_structure.png")
