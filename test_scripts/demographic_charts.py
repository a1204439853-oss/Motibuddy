#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MotiBuddy User Demographics and Usage Profile Visualization
Creates non-bar chart visualizations for questionnaire data
"""

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

# Data from questionnaire
# Age distribution
age_labels = ['18-24 years', '25-34 years', '35-44 years']
age_values = [68, 24, 8]
age_colors = ['#A8D5BA', '#F4D03F', '#F8B88B']  # Soft green, muted yellow, peach

# Gender distribution
gender_labels = ['Male', 'Female']
gender_values = [58, 42]
gender_colors = ['#A2C8E8', '#F4B9B2']  # Soft blue, soft pink

# Usage duration
duration_labels = ['1-2 weeks', '2-4 weeks', 'More than 1 month']
duration_values = [39, 34, 27]
duration_colors = ['#B8E0D2', '#D4B8E0', '#E0D4B8']  # Soft mint, soft purple, soft beige

# Usage frequency
frequency_labels = ['Daily', 'Several times per week', 'Weekly']
frequency_values = [46, 32, 22]
frequency_colors = ['#9BCFB8', '#B8D4E3', '#E3D4B8']  # Soft green, soft blue, soft tan

fig = plt.figure(figsize=(16, 12))

# 1. Age Distribution - Waffle Chart (100 squares)
ax1 = plt.subplot(2, 2, 1)
ax1.set_xlim(0, 10)
ax1.set_ylim(0, 10)
total_squares = 100
filled = 0
for i, (label, val, color) in enumerate(zip(age_labels, age_values, age_colors)):
    squares = int(val)
    for j in range(squares):
        row = (filled + j) // 10
        col = (filled + j) % 10
        rect = plt.Rectangle((col, 9-row), 0.9, 0.9, facecolor=color, 
                             edgecolor='white', linewidth=1)
        ax1.add_patch(rect)
    filled += squares
ax1.set_title('Age Distribution (n=41)', fontsize=14, fontweight='bold', pad=20)
ax1.set_aspect('equal')
ax1.axis('off')
legend_elements = [plt.Rectangle((0,0),1,1, facecolor=color, label=f'{label} ({val}%)') 
                   for label, val, color in zip(age_labels, age_values, age_colors)]
ax1.legend(handles=legend_elements, loc='upper center', bbox_to_anchor=(0.5, -0.05), ncol=3, frameon=False)

# 2. Gender Distribution - Donut Chart (no shadow)
ax2 = plt.subplot(2, 2, 2)
wedges2, texts2, autotexts2 = ax2.pie(gender_values, labels=gender_labels,
                                       autopct='%1.0f%%', colors=gender_colors,
                                       startangle=90,
                                       textprops={'fontsize': 10},
                                       wedgeprops={'linewidth': 2, 'edgecolor': 'white'})
centre_circle = plt.Circle((0, 0), 0.70, fc='white')
ax2.add_artist(centre_circle)
for autotext in autotexts2:
    autotext.set_color('white')
    autotext.set_fontweight('bold')
ax2.set_title('Gender Distribution (n=41)', fontsize=14, fontweight='bold', pad=20)

# 3. Usage Duration - Horizontal Bar Chart
ax3 = plt.subplot(2, 2, 3)
y_pos = np.arange(len(duration_labels))
bars = ax3.barh(y_pos, duration_values, color=duration_colors, alpha=0.8, 
                edgecolor='white', linewidth=2)
for i, (bar, val) in enumerate(zip(bars, duration_values)):
    ax3.text(val + 1, i, f'{val}%', va='center', fontsize=11, fontweight='bold')
ax3.set_yticks(y_pos)
ax3.set_yticklabels(duration_labels)
ax3.set_xlabel('Percentage (%)', fontsize=11)
ax3.set_title('Usage Duration (n=41)', fontsize=14, fontweight='bold', pad=20)
ax3.set_xlim(0, 50)
ax3.grid(axis='x', alpha=0.3)
ax3.spines['top'].set_visible(False)
ax3.spines['right'].set_visible(False)

# 4. Usage Frequency - Polar/Rose Chart
ax4 = plt.subplot(2, 2, 4, projection='polar')
theta = np.linspace(0.0, 2 * np.pi, len(frequency_labels), endpoint=False)
radii = frequency_values
width = 2 * np.pi / len(frequency_labels) * 0.8

bars = ax4.bar(theta, radii, width=width, bottom=0.0, color=frequency_colors, alpha=0.8,
               edgecolor='white', linewidth=2)

# Add percentage labels
for angle, radius, label, val in zip(theta, radii, frequency_labels, frequency_values):
    ax4.text(angle, radius + 5, f'{val}%', ha='center', va='center', 
             fontsize=10, fontweight='bold')

ax4.set_xticks(theta)
ax4.set_xticklabels(frequency_labels, fontsize=9)
ax4.set_yticks([])
ax4.set_title('Usage Frequency (n=41)', fontsize=14, fontweight='bold', pad=30)

plt.tight_layout()
plt.savefig('demographic_profile.png', dpi=300, bbox_inches='tight')
print("✓ Chart saved: demographic_profile.png")

print("\nDemographic chart generated successfully!")
