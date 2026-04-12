#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RQ3: Gamification and Motivation Impact
Stacked horizontal bar showing achievement completion rates
"""

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

fig, ax = plt.subplots(figsize=(10, 7))

# Data - achievement completion rates by SDT dimension
categories = ['Autonomy\nAchievements', 'Competence\nAchievements', 'Relatedness\nAchievements']
completed = [85, 78, 71]
incomplete = [15, 22, 29]

y_pos = np.arange(len(categories))
height = 0.5

# Create stacked horizontal bar
bars1 = ax.barh(y_pos, completed, height, label='Completed', color='#A8D5BA', alpha=0.9)
bars2 = ax.barh(y_pos, incomplete, height, left=completed, label='In Progress', color='#E8E8E8', alpha=0.6)

# Add percentage labels
for i, (comp, inc) in enumerate(zip(completed, incomplete)):
    ax.text(comp/2, i, f'{comp}%', ha='center', va='center', fontsize=11, fontweight='bold', color='white')
    ax.text(comp + inc/2, i, f'{inc}%', ha='center', va='center', fontsize=10, color='#666666')

# Add SDT scores on the right
sdt_scores = [4.0, 4.1, 4.0]
for i, score in enumerate(sdt_scores):
    ax.text(105, i, f'Score: {score:.1f}', va='center', fontsize=10, style='italic', color='#555555')

# Customize
ax.set_yticks(y_pos)
ax.set_yticklabels(categories, fontsize=11)
ax.set_xlim(0, 110)
ax.set_xlabel('Completion Rate (%)', fontsize=12)
ax.set_title('RQ3: Gamification Impact - SDT Achievement Completion\n(Mean Score: 4.0-4.1 out of 5.0)', 
             fontsize=16, fontweight='bold', pad=20)
ax.legend(loc='lower right', framealpha=0.9)
ax.grid(axis='x', alpha=0.3)
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)

plt.tight_layout()
plt.savefig('rq3_gamification_impact.png', dpi=300, bbox_inches='tight', facecolor='white')
print("✓ Chart saved: rq3_gamification_impact.png")
