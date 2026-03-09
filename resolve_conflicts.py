#!/usr/bin/env python3
import re, subprocess, sys

def resolve_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    pattern = r'<<<<<<< HEAD\n(.*?)\n=======\n(.*?)\n>>>>>>> [^\n]+\n'
    def resolve(m):
        h = m.group(1)
        t = m.group(2)
        if not h.rstrip().endswith('});') and not h.rstrip().endswith('}'):
            return h + '\n});\n\n' + t + '\n'
        return h + '\n' + t + '\n'
    content = re.sub(pattern, resolve, content, flags=re.DOTALL)
    with open(filepath, 'w') as f:
        f.write(content)
    print(f"  Resolved: {filepath}")

# Get list of conflicted files
result = subprocess.run(['git', 'diff', '--name-only', '--diff-filter=U'], capture_output=True, text=True)
files = [f.strip() for f in result.stdout.strip().split('\n') if f.strip()]
print(f"Conflicted files: {files}")
for f in files:
    resolve_file(f)
    subprocess.run(['git', 'add', f])
