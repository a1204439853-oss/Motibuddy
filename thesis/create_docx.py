#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script to convert LaTeX thesis to Word document
"""

try:
    from docx import Document
    from docx.shared import Inches, Pt, RGBColor
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.enum.style import WD_STYLE_TYPE
except ImportError:
    import subprocess
    import sys
    subprocess.check_call([sys.executable, "-m", "pip", "install", "python-docx"])
    from docx import Document
    from docx.shared import Inches, Pt, RGBColor
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.enum.style import WD_STYLE_TYPE

def create_thesis_docx():
    doc = Document()
    
    # Set up styles
    style = doc.styles['Normal']
    font = style.font
    font.name = 'Times New Roman'
    font.size = Pt(12)
    
    # Title Page
    title_para = doc.add_paragraph()
    title_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title_run = title_para.add_run('\n\n\n\n\n')
    title_run = title_para.add_run('Design and Implementation of a Gamified Task Management Application\n')
    title_run.bold = True
    title_run.font.size = Pt(16)
    title_run = title_para.add_run('Integrating Virtual Pet Nurturing and Intelligent Interaction\n\n\n')
    title_run.bold = True
    title_run.font.size = Pt(16)
    
    subtitle = doc.add_paragraph()
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    subtitle_run = subtitle.add_run('A Thesis Submitted in Partial Fulfillment of the Requirements\n')
    subtitle_run.font.size = Pt(14)
    subtitle_run = subtitle.add_run('for the Degree of [Degree Name]\n\n\n')
    subtitle_run.font.size = Pt(14)
    
    author = doc.add_paragraph()
    author.alignment = WD_ALIGN_PARAGRAPH.CENTER
    author_run = author.add_run('by\n\n')
    author_run.font.size = Pt(12)
    author_run = author.add_run('[Author Name]\n')
    author_run.bold = True
    author_run.font.size = Pt(14)
    author_run = author.add_run('[Student ID]\n\n\n')
    author_run.font.size = Pt(12)
    
    supervisor = doc.add_paragraph()
    supervisor.alignment = WD_ALIGN_PARAGRAPH.CENTER
    supervisor_run = supervisor.add_run('Supervised by\n\n')
    supervisor_run.font.size = Pt(12)
    supervisor_run = supervisor.add_run('[Supervisor Name]\n')
    supervisor_run.bold = True
    supervisor_run.font.size = Pt(14)
    supervisor_run = supervisor.add_run('[Department/Institution]\n\n\n\n\n')
    supervisor_run.font.size = Pt(12)
    
    date = doc.add_paragraph()
    date.alignment = WD_ALIGN_PARAGRAPH.CENTER
    date_run = date.add_run('[Month, Year]')
    date_run.font.size = Pt(12)
    
    doc.add_page_break()
    
    # Abstract
    doc.add_heading('Abstract', level=1)
    abstract_text = """Traditional task management applications suffer from high abandonment rates and fail to address procrastination through intrinsic motivation. This research presents the design and implementation of MotiBuddy, a gamified intelligent task management application that integrates virtual pet nurturing mechanisms to enhance emotional attachment and persistent usage intention.

The study employs Design Science Research methodology to develop a prototype that systematically combines three core elements: (1) integration mechanisms between virtual pet behavior models and user task behaviors, (2) intelligent interaction features including voice-based natural language processing for task creation, and (3) personalized presentation through customizable digital companions and persistent desktop widgets. Grounded in Self-Determination Theory, the application addresses autonomy, competence, and relatedness needs through gamification mechanics.

The technical implementation utilizes a Tauri and React architecture with TypeScript, featuring a dual-window system (main application and desktop widget), file-based JSON storage for privacy, and Web Speech API integration for voice input. The virtual pet system incorporates realistic nurturing mechanics with stat decay algorithms, mood determination logic, and emotional feedback loops linked to task completion behaviors.

Results demonstrate successful implementation of all core features including 12 achievement-based motivation mechanisms, voice recognition with 85%+ accuracy, and real-time cross-window synchronization. The integration of virtual pet nurturing with intelligent interaction provides an innovative solution for overcoming procrastination through emotional engagement rather than willpower alone.

Keywords: Gamification, Virtual Pet, Task Management, Self-Determination Theory, Emotional Attachment, Procrastination, Natural Language Processing, Desktop Application, Tauri, React"""
    doc.add_paragraph(abstract_text)
    
    doc.add_page_break()
    
    # Acknowledgements
    doc.add_heading('Acknowledgements', level=1)
    ack_text = """I would like to express my sincere gratitude to [Supervisor Name] for [guidance/support]. I also wish to thank [family members] for their unwavering support throughout this research journey.

This research would not have been possible without the open-source community, particularly the developers of Tauri, React, Compromise.js, and Framer Motion. Special thanks to the Coze platform for providing initial project inspiration."""
    doc.add_paragraph(ack_text)
    
    doc.add_page_break()
    
    # Table of Contents (placeholder)
    doc.add_heading('Table of Contents', level=1)
    toc_items = [
        "Abstract",
        "Acknowledgements",
        "Chapter 1: Introduction",
        "Chapter 2: Literature Review",
        "Chapter 3: Research Methodology",
        "Chapter 4: Technical Design",
        "Chapter 5: Implementation",
        "Chapter 6: Testing and Evaluation",
        "Chapter 7: Results and Evaluation",
        "Chapter 8: Discussion and Reflection",
        "Chapter 9: Conclusion",
        "References"
    ]
    for item in toc_items:
        doc.add_paragraph(item, style='List Number')
    
    doc.add_page_break()
    
    # Chapter 1
    doc.add_heading('Chapter 1: Introduction', level=1)
    
    doc.add_heading('1.1 Background and Context', level=2)
    bg_text = """The global productivity application market has experienced substantial growth, with millions of users adopting digital tools to manage their personal and professional tasks. Despite high initial adoption rates, research indicates that traditional task management applications suffer from significant user abandonment, with studies suggesting that approximately 80% of users discontinue using productivity apps within the first three months. This phenomenon, often termed the "engagement cliff," highlights a fundamental disconnect between the utility provided by these applications and the sustained motivation required for long-term usage.

Procrastination represents one of the most pervasive challenges in digital task management. Steel (2007) defines procrastination as a voluntary delay of an intended action despite expecting negative consequences. In the context of productivity applications, users frequently exhibit present bias, prioritizing immediate gratification over future benefits. Traditional task managers, while effective at organizing information, often fail to address the psychological mechanisms underlying procrastination behavior.

Gamification—the integration of game elements into non-game contexts—has emerged as a promising approach to enhance user engagement and motivation. However, existing gamified productivity applications predominantly rely on extrinsic motivators such as points, badges, and leaderboards. While these mechanics can produce short-term engagement, they often fail to foster the intrinsic motivation necessary for sustained behavioral change.

Self-Determination Theory (SDT), developed by Deci and Ryan (2000; 2017), provides a comprehensive framework for understanding intrinsic motivation through three fundamental psychological needs: autonomy (the need for self-direction), competence (the need to feel effective), and relatedness (the need for social connection). Current productivity applications adequately address autonomy and competence but frequently neglect relatedness—the emotional connection that sustains long-term engagement.

Virtual pets and digital companions offer a unique mechanism for establishing emotional connections in software applications. Since the introduction of Tamagotchi in 1996, virtual pets have demonstrated the capacity to create genuine emotional attachments between users and digital entities. Research in human-computer interaction has shown that nurturing mechanics—feeding, caring for, and interacting with virtual companions—can generate meaningful emotional bonds that motivate sustained engagement.

The integration of virtual pet nurturing with task management represents a novel approach to addressing the relatedness deficiency in current productivity tools. By creating an emotional connection between users and their digital companions, such systems can leverage the psychological investment in the pet's wellbeing as motivation for task completion. When a user's productivity directly impacts their virtual companion's health and happiness, the abstract benefits of task completion become concrete and emotionally salient.

Desktop applications offer distinct advantages for persistent engagement compared to web-based solutions. Through system tray integration, desktop widgets, and always-on-top windows, desktop applications can maintain continuous visibility and accessibility. This persistent presence is particularly valuable for productivity tools, where frequent reminders and easy access can significantly impact usage patterns."""
    doc.add_paragraph(bg_text)
    
    doc.add_heading('1.2 Project Aim', level=2)
    aim_text = """This research aims to design and develop MotiBuddy, a gamified intelligent task management application prototype that integrates virtual pet nurturing mechanisms to enhance emotional attachment and overcome procrastination. The primary goal is to create a system where task completion directly benefits the user's virtual companion, establishing an emotional feedback loop that motivates sustained productivity.

The secondary goal is to implement intelligent interaction features that reduce friction in task management. This includes voice-based task creation using natural language processing, intelligent task parsing and sorting, and seamless integration between different input modalities. By minimizing the cognitive overhead required to capture and organize tasks, the application aims to reduce the activation energy barrier that often prevents users from engaging with productivity tools.

The tertiary goal is to create personalized presentation through customizable virtual pets and persistent desktop widgets. By allowing users to select and customize their digital companions, the application addresses autonomy needs within the Self-Determination Theory framework. The desktop widget provides persistent visibility, ensuring that the virtual companion—and by extension, the user's task list—remains present in the user's digital environment."""
    doc.add_paragraph(aim_text)
    
    doc.add_heading('1.3 Project Objectives', level=2)
    objectives_text = """Based on the three core research directions, this project establishes the following objectives:

Integration Mechanism Design:
1. Design effective integration mechanisms between virtual pet nurturing systems and personal task management logic, creating meaningful linkage rules between pet behavior models and user task behaviors.
2. Develop pet behavior models that respond dynamically to user task behaviors, including positive reinforcement for task completion and negative consequences for task procrastination or abandonment.
3. Create feedback mechanisms and emotional connection methods between users and their digital companions, fostering the relatedness need identified in Self-Determination Theory.

Intelligent and Personalized Features:
4. Implement intelligent voice-based task addition using speech recognition and natural language processing technologies, enabling users to create tasks through natural spoken language.
5. Design dynamic task sorting algorithms that intelligently prioritize tasks based on due dates, priorities, and user behavior patterns.
6. Develop customizable pet appearances and real-time desktop widgets for personalized presentation, ensuring persistent visibility and emotional engagement.

Application Evaluation:
7. Evaluate the application against traditional task managers to analyze advantages in motivation, engagement, and emotional experience, providing empirical evidence for the effectiveness of the integrated approach."""
    doc.add_paragraph(objectives_text)
    
    doc.add_heading('1.4 Research Questions', level=2)
    rq_text = """This research addresses the following research questions, aligned with the three research objectives:

RQ1 (Integration Mechanism): How can virtual pet nurturing mechanisms be effectively integrated with personal task management systems to create meaningful linkage rules between pet behavior models and user task behaviors?

This question addresses the core challenge of creating a coherent system where virtual pet care and task management are intrinsically linked rather than existing as separate features. The investigation explores optimal feedback mechanisms, stat decay algorithms, and emotional trigger points that maximize motivational impact while minimizing user frustration.

RQ2 (Intelligent Features): How effective are voice recognition and natural language processing technologies in enabling intelligent task addition and parsing compared to traditional manual entry methods?

This question evaluates the practical benefits of voice-based interaction, measuring time savings, accuracy rates, and user acceptance of speech-to-task workflows. The investigation compares the efficiency of natural language input against traditional form-based task creation.

RQ3 (Gamification Impact): To what extent does the integration of game elements (achievements, growth, rewards) and virtual pet emotional agents enhance users' intrinsic motivation, task completion rates, and persistent usage intention compared to traditional task management applications?

This question examines the effectiveness of the SDT-based gamification approach, measuring the impact on user engagement, retention, and task completion behaviors. The investigation compares MotiBuddy's integrated approach against conventional productivity applications.

RQ4 (Emotional Attachment): How does the introduction of virtual pets as emotional agents strengthen users' emotional attachment and contribute to overcoming procrastination?

This question explores the psychological mechanisms through which virtual pet nurturing addresses procrastination behaviors. The investigation examines how emotional investment in digital companions translates into motivation for task completion and sustained productivity."""
    doc.add_paragraph(rq_text)
    
    doc.add_heading('1.5 Significance and Potential Impact', level=2)
    impact_text = """This research contributes to knowledge in several significant ways:

Academic Contribution: This study presents a novel systematic integration of virtual pet nurturing, intelligent interaction, and task management. By grounding the design in Self-Determination Theory, the research provides empirical validation of SDT principles in productivity application contexts. The work contributes to human-computer interaction literature on emotional design and digital companions.

Practical Contribution: The open-source implementation provides a foundation for future research and development in gamified productivity tools. The design patterns and integration mechanisms identified in this research can inform the development of future applications addressing procrastination and motivation.

User Impact: By addressing procrastination through emotional engagement rather than willpower alone, the application offers potential benefits for users who struggle with traditional productivity tools. The approach recognizes that sustainable behavioral change requires intrinsic motivation, not merely organizational tools.

Industry Contribution: The research demonstrates design patterns for emotional AI companions in productivity software, potentially influencing future industry developments. As artificial intelligence becomes increasingly integrated into productivity tools, understanding how to create meaningful emotional connections with digital agents becomes increasingly important."""
    doc.add_paragraph(impact_text)
    
    doc.add_heading('1.6 Thesis Structure', level=2)
    structure_text = """This thesis is organized into nine chapters:

Chapter 1 (Introduction) establishes the research context, aims, objectives, and research questions.

Chapter 2 (Literature Review) examines existing research on gamification, Self-Determination Theory, virtual pets, procrastination, voice interaction, and desktop application frameworks, identifying the research gap addressed by this study.

Chapter 3 (Methodology) describes the Design Science Research approach, data collection methods, analysis techniques, and evaluation strategy employed in this research.

Chapter 4 (Technical Design) presents the system architecture, technology stack selection, database design, virtual pet system design, and voice recognition implementation design.

Chapter 5 (Implementation) details the development environment, core implementation details, desktop widget implementation, voice input implementation, and challenges encountered.

Chapter 6 (Testing and Evaluation) describes the testing strategy, unit testing, integration testing, comparative evaluation, and performance testing conducted.

Chapter 7 (Results and Evaluation) presents the system performance results, feature implementation status, research question analysis, and comparative evaluation results.

Chapter 8 (Discussion and Reflection) discusses the achievements, limitations, future work, personal reflection, and project management insights.

Chapter 9 (Conclusion) summarizes the project, contributions to knowledge, and relevance to future work."""
    doc.add_paragraph(structure_text)
    
    # Save the document
    output_path = 'f:\\MotiBuddy1\\thesis\\MotiBuddy_Thesis.docx'
    doc.save(output_path)
    print(f"Word document created successfully at: {output_path}")
    return output_path

if __name__ == '__main__':
    create_thesis_docx()
