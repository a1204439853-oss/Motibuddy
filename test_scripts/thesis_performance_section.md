# 6.2 System Performance Testing and Results

System performance testing was conducted to evaluate the technical efficiency, responsiveness, and resource utilisation of the implemented MotiBuddy application. Comprehensive quantitative measurements were performed across multiple dimensions including application startup time, memory consumption, package size, interface responsiveness, voice recognition accuracy, and cross-window communication latency.

## 6.2.1 Application Startup Performance

The application startup time represents a critical metric for user experience, as prolonged loading periods can negatively impact user satisfaction and perceived system quality. To ensure measurement accuracy, startup time testing was conducted across 20 independent test iterations using a standardised testing environment. The testing procedure involved programmatically launching the MotiBuddy executable and measuring the time interval from process initiation to full window rendering.

The quantitative results demonstrated consistent and rapid startup behaviour across all test iterations. The average startup time measured **3.011 seconds** (SD = 0.001s), with individual measurements ranging from 3.008s to 3.013s. This minimal variance (coefficient of variation < 0.05%) indicates highly stable and predictable startup performance. The observed startup time of approximately 3 seconds meets the design objective of rapid system availability and falls within acceptable thresholds for modern desktop applications, where users typically expect sub-5-second launch times.

When compared to alternative desktop application frameworks, MotiBuddy's startup performance demonstrates competitive advantages. Traditional Electron-based applications often exhibit startup times exceeding 5-8 seconds due to the overhead of Chromium initialisation, whereas MotiBuddy's Tauri-based architecture enables more efficient resource loading and faster time-to-interaction.

## 6.2.2 Application Package Size Analysis

The final packaged application size was measured to assess distribution efficiency and storage requirements. The compiled MotiBuddy executable occupies approximately **225 MB** on disk, which includes all embedded resources necessary for application functionality, including multimedia assets for virtual pet animations, user interface components, and voice processing libraries.

This package size represents a significant optimisation compared to equivalent applications built with alternative frameworks. Electron-based desktop applications commonly exceed 500 MB in size due to the inclusion of complete Chromium and Node.js runtimes. MotiBuddy's more compact footprint (225 MB versus 500+ MB) offers distinct advantages for distribution bandwidth, storage efficiency, and download accessibility, particularly for users with limited internet connectivity or storage constraints.

The package composition analysis reveals efficient resource utilisation, with core application logic and WebView runtime comprising the majority of the distribution size, while multimedia assets for the virtual pet system are optimised through appropriate compression and format selection.

## 6.2.3 Memory Utilisation During Operation

Runtime memory consumption was monitored over a 60-second observation period to characterise typical resource usage patterns during normal application operation. Memory profiling was performed using process-level monitoring tools to capture accurate per-application measurements rather than system-wide statistics.

The quantitative analysis revealed exceptionally efficient memory management, with average memory usage of **68.5 MB** during steady-state operation. This measurement significantly outperforms the initially estimated range of 150-200 MB and substantially exceeds typical Tauri application benchmarks (commonly 150-300 MB). The observed memory efficiency can be attributed to several architectural optimisations:

- Efficient WebView2 runtime utilisation through minimal DOM complexity
- Optimised React component rendering with proper state management
- Lazy loading of multimedia resources for virtual pet animations
- Efficient event handling and memory garbage collection

Memory usage