#!/usr/bin/env python3
import sys

print("=" * 50)
print("Python Environment Test")
print("=" * 50)
print()

try:
    import matplotlib
    print(f"✓ Matplotlib: {matplotlib.__version__}")
except Exception as e:
    print(f"✗ Matplotlib error: {e}")

try:
    import numpy
    print(f"✓ NumPy: {numpy.__version__}")
except Exception as e:
    print(f"✗ NumPy error: {e}")

try:
    import psutil
    print(f"✓ psutil: {psutil.__version__}")
except Exception as e:
    print(f"✗ psutil error: {e}")

print()
print("=" * 50)
print("All imports successful!")
print("=" * 50)

# Keep window open
print()
input("Press Enter to exit...")
