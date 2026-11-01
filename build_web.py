#!/usr/bin/env python3
"""Inline renderer.js and the sample files into a single index.html."""
import json, os, sys
here = os.path.dirname(os.path.abspath(__file__))
html = open(os.path.join(here, 'web/app.html'), encoding='utf-8').read()
rjs = open(os.path.join(here, 'web/renderer.js'), encoding='utf-8').read()
assert '</script' not in rjs.lower()
samples = {}
sd = os.path.join(here, 'samples')
for f in sorted(os.listdir(sd)):
    samples[f] = open(os.path.join(sd, f), encoding='utf-8').read()
sj = json.dumps(samples, ensure_ascii=False).replace('</', '<\\/')
html = html.replace('/*__RENDERER__*/', rjs).replace('/*__SAMPLES__*/{}', sj)
out = os.path.join(here, 'dist')
os.makedirs(out, exist_ok=True)
open(os.path.join(out, 'index.html'), 'w', encoding='utf-8').write(html)
print('dist/index.html', len(html.encode()), 'bytes,', len(samples), 'samples')
