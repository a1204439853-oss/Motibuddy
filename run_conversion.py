import subprocess
import sys

result = subprocess.run([sys.executable, r'f:\MotiBuddy1\convert_outline.py'], 
                       capture_output=True, text=True)
print("STDOUT:", result.stdout)
print("STDERR:", result.stderr)
print("Return code:", result.returncode)
