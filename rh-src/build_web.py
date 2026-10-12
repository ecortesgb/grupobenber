# -*- coding: utf-8 -*-
"""Arma docs/rh/app.js a partir de rh-src/*.js (en orden) y, con --publicar, hace commit y push de docs/rh."""
import os, sys, glob, subprocess, time
SRC = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.dirname(SRC); DEST = os.path.join(REPO, 'docs', 'rh')
partes = sorted(f for f in glob.glob(os.path.join(SRC, '*.js')) if not os.path.basename(f).startswith('_') and 'respaldo' not in os.path.basename(f))
js = '\n'.join('/* >>> ' + os.path.basename(f) + ' */\n' + open(f, encoding='utf-8').read() for f in partes)
open(os.path.join(DEST, 'app.js'), 'w', encoding='utf-8').write(js)
print('app.js armado:', len(js) // 1024, 'KB de', len(partes), 'archivos')
if '--publicar' in sys.argv:
    git = lambda *a: subprocess.run(['git', '-C', REPO] + list(a), capture_output=True, text=True)
    git('pull', '--rebase', '--autostash'); git('add', '--', 'docs/rh', 'rh-src')
    if git('status', '--porcelain', '--', 'docs/rh', 'rh-src').stdout.strip():
        print(git('commit', '-m', 'RH GB ' + time.strftime('%Y-%m-%d %H:%M') + '\n\nCo-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>').stdout.strip()); r = git('push'); print('push:', r.returncode, r.stderr.strip()[-120:])
    else: print('sin cambios')
