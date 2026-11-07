#!/usr/bin/env python3
"""원작 기획 이미지(astra/assets/concept.webp)에서 초상화·보스 카드·키 아트를 잘라
js/data/assets.js 에 data URI 로 넣습니다.  사용법: python3 astra/tools/make_assets.py
(Pillow 필요: pip install pillow)"""
import base64, io, json, os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'concept.webp')
OUT = os.path.join(ROOT, 'js', 'data', 'assets.js')

CROPS = {
    'keyart': (560, 44, 1500, 374),
    'kai': (800, 44, 1070, 374),
    'lia': (568, 60, 792, 374),
    'zero': (1040, 115, 1250, 374),
    'astra': (1235, 44, 1500, 374),
}
BOSS_X = [(75, 245), (250, 415), (420, 585), (590, 755), (760, 925),
          (905, 1050), (1055, 1220), (1225, 1390), (1395, 1560), (1565, 1730)]
BOSS_IDS = ['scavenger', 'arka', 'observer', 'zero', 'atlas',
            'sera', 'draco', 'nemesis', 'protocol', 'astra']
for (a, b), bid in zip(BOSS_X, BOSS_IDS):
    CROPS['boss_' + bid] = (a, 612, b, 703)


def main():
    im = Image.open(SRC).convert('RGB')
    out = {}
    for key, box in CROPS.items():
        buf = io.BytesIO()
        im.crop(box).save(buf, 'WEBP', quality=84, method=6)
        out[key] = 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode('ascii')
    lines = ["'use strict';", '',
             '/* 자동 생성 파일 — astra/tools/make_assets.py 로 다시 만듭니다.',
             ' * 원작 기획 이미지에서 잘라 낸 초상화·보스 카드·키 아트 (data URI). */',
             'window.AZ = window.AZ || {};', 'AZ.data = AZ.data || {};',
             'AZ.data.assets = {']
    for key, uri in out.items():
        lines.append('  %s: %s,' % (key, json.dumps(uri)))
    lines.append('};')
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines) + '\n')
    print('%d개 이미지 → %s (%dKB)' % (len(out), os.path.relpath(OUT, ROOT), os.path.getsize(OUT) // 1024))


if __name__ == '__main__':
    main()
