@echo off
chcp 65001 >nul
echo ========================================
echo   Research Questions Charts (4 Separate)
echo ========================================
echo.

cd /d "%~dp0"

set PYTHON=python

echo [1/4] Generating RQ1: Integration Mechanism Effectiveness (Radar Chart)...
"%PYTHON%" rq1_integration_chart.py
echo.

echo [2/4] Generating RQ2: Intelligent Feature Performance (Lollipop Chart)...
"%PYTHON%" rq2_intelligent_features_chart.py
echo.

echo [3/4] Generating RQ3: Gamification Impact (Stacked Bar Chart)...
"%PYTHON%" rq3_gamification_chart.py
echo.

echo [4/4] Generating RQ4: Correlation Analysis (Bubble Scatter Plot)...
"%PYTHON%" rq4_correlation_chart.py
echo.

echo ========================================
echo   Checking Generated Files
echo ========================================
echo.
if exist "rq1_integration_effectiveness.png" (
    echo [OK] rq1_integration_effectiveness.png (Radar Chart)
) else (
    echo [MISSING] rq1_integration_effectiveness.png
)

if exist "rq2_intelligent_features.png" (
    echo [OK] rq2_intelligent_features.png (Lollipop Chart)
) else (
    echo [MISSING] rq2_intelligent_features.png
)

if exist "rq3_gamification_impact.png" (
    echo [OK] rq3_gamification_impact.png (Stacked Bar Chart)
) else (
    echo [MISSING] rq3_gamification_impact.png
)

if exist "rq4_correlation_analysis.png" (
    echo [OK] rq4_correlation_analysis.png (Bubble Scatter Plot)
) else (
    echo [MISSING] rq4_correlation_analysis.png
)

echo.
echo ========================================
echo   All Charts Generated!
echo ========================================
pause
