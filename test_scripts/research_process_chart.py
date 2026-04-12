#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Research Process - Iterative Design and Evaluation Cycle
"""

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch, Circle
import numpy as np

fig, ax = plt.subplots(figsize=(12, 10))
ax.set_xlim(-6, 6)
ax.set_ylim(-5, 5)
ax.set_aspect('equal')
ax.axis('off')

# Title
ax.text(0, 4.5, 'Research Process: Iterative Design and Evaluation Cycle', 
        fontsize=18, fontweight='bold', ha='center')

# Colors - soft tones
colors = {
    'design': '#A8D5BA',      # Soft green
    'development': '#B8D4E3', # Soft blue
    'evaluation': '#E1D4A8'   # Soft beige
}

# Three main phases arranged in a cycle
phases = [
    {
        'name': 'Design Phase',
        'x': -3.5,
        'y': 1.5,
        'color': colors['design'],
        'activities': [
            'Literature Review',
            'Conceptual Framework',
            'System Architecture',
            'Feature Design'
        ]
    },
    {
        'name': 'Development Phase',
        'x': 0,
        'y': -2.5,
        'color': colors['development'],
        'activities': [
            'Prototype Implementation',
            'Iterative Development',
            'Continuous Refinement'
        ]
    },
    {
        'name': 'Evaluation Phase',
        'x': 3.5,
        'y': 1.5,
        'color': colors['evaluation'],
        'activities': [
            'Effectiveness Assessment',
            'Usability Testing',
            'User Questionnaires',
            'Expert Feedback'
        ]
    }
]

# Draw phase boxes
for phase in phases:
    # Main box
    box_w, box_h = 3.0, 2.2
    box = FancyBboxPatch((phase['x'] - box_w/2, phase['y'] - box_h/2), box_w, box_h,
                         boxstyle="round,rounding_size=0.2",
                         facecolor=phase['color'],
                         edgecolor='#666666',
                         linewidth=2,
                         alpha=0.9)
    ax.add_patch(box)
    
    # Phase name
    ax.text(phase['x'], phase['y'] + 0.7, phase['name'],
            fontsize=14, fontweight='bold', ha='center', va='center', color='#333333')
    
    # Activities
    y_offset = 0.3
    for activity in phase['activities']:
        ax.text(phase['x'], phase['y'] + y_offset, f'• {activity}',
                fontsize=10, ha='center', va='center', color='#555555')
        y_offset -= 0.35

# Draw cycle arrows
arrow_style = dict(arrowstyle='->', color='#888888', lw=2.5, 
                   connectionstyle='arc3,rad=0.2')

# Design -> Development
ax.annotate('', xy=(0, -1.3), xytext=(-2.5, 0.4),
            arrowprops=arrow_style)

# Development -> Evaluation  
ax.annotate('', xy=(2.5, 0.4), xytext=(0, -1.3),
            arrowprops=arrow_style)

# Evaluation -> Design (iterative cycle)
ax.annotate('', xy=(-2.5, 0.4), xytext=(2.5, 0.4),
            arrowprops=dict(arrowstyle='->', color='#888888', lw=2.5,
                          connectionstyle='arc3,rad=0.3'))

# Center - Iterative label
center_circle = Circle((0, 0.5), 0.8, facecolor='#F8F8F8', 
                       edgecolor='#666666', linewidth=2)
ax.add_patch(center_circle)
ax.text(0, 0.5, 'Iterative\nCycle', fontsize=12, fontweight='bold',
        ha='center', va='center', color='#333333')

# Bottom note
ax.text(0, -4.3, 'Three-phase iterative approach ensuring continuous improvement and user-centered design',
        fontsize=10, ha='center', style='italic', color='#555555',
        bbox=dict(boxstyle='round,pad=0.4', facecolor='#F0F0F0', 
                 edgecolor='#AAAAAA', linewidth=1, alpha=0.8))

plt.tight_layout()
plt.savefig('research_process.png', dpi=300, bbox_inches='tight', facecolor='white')
print("Chart saved: research_process.png")
