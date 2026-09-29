"""Generates the Money Cells brand SVGs.

Usage: python3 assets/brand/build_logo.py path/to/Fredoka-Bold.ttf
Wordmark text is converted to outlines, so the SVGs need no installed font.
Requires: pip install fonttools
"""
import os
import sys

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

OUT = os.path.dirname(os.path.abspath(__file__))

SKY_TOP, SKY_BOT = '#7dd3fc', '#0ea5e9'
GREEN_HI, GREEN, GREEN_DK = '#bbf7d0', '#4ade80', '#16a34a'
GOLD_HI, GOLD, GOLD_DK = '#fef08a', '#facc15', '#d97706'
INK = '#0f172a'
SPLASH_BG = '#38bdf8'
BLUSH = '#fda4af'


def text_path(font, text, x, y, size):
    """Return (svg path d, advance width) for text with baseline at (x, y)."""
    gs = font.getGlyphSet()
    cmap = font.getBestCmap()
    scale = size / font['head'].unitsPerEm
    d, cx = [], x
    for ch in text:
        name = cmap[ord(ch)]
        pen = SVGPathPen(gs)
        gs[name].draw(TransformPen(pen, (scale, 0, 0, -scale, cx, y)))
        d.append(pen.getCommands())
        cx += gs[name].width * scale
    return ' '.join(d), cx - x


def sparkle(x, y, r, fill):
    k = r * 0.28
    return (f'<path d="M{x} {y-r} Q{x+k} {y-k} {x+r} {y} Q{x+k} {y+k} {x} {y+r} '
            f'Q{x-k} {y+k} {x-r} {y} Q{x-k} {y-k} {x} {y-r}Z" fill="{fill}"/>')


def defs():
    return f'''<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="{SKY_TOP}"/><stop offset="1" stop-color="{SKY_BOT}"/>
  </linearGradient>
  <radialGradient id="cell" cx="0.38" cy="0.32" r="0.75">
    <stop offset="0" stop-color="{GREEN_HI}"/><stop offset="0.55" stop-color="{GREEN}"/><stop offset="1" stop-color="{GREEN_DK}"/>
  </radialGradient>
  <radialGradient id="coin" cx="0.38" cy="0.32" r="0.75">
    <stop offset="0" stop-color="{GOLD_HI}"/><stop offset="0.55" stop-color="{GOLD}"/><stop offset="1" stop-color="{GOLD_DK}"/>
  </radialGradient>
</defs>'''


def mark(font, bg=True):
    """The mascot mark on a 1024x1024 canvas: a happy cell budding a coin cell."""
    dollar, dw = text_path(font, '$', 0, 0, 190)
    parts = []
    if bg:
        parts.append('<rect width="1024" height="1024" rx="0" fill="url(#sky)"/>')
        # soft background bubbles
        for cx, cy, r in [(150, 170, 46), (110, 820, 30), (900, 640, 38), (880, 900, 22), (560, 110, 20)]:
            parts.append(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="#ffffff" opacity="0.28"/>')
    # neck joining the two cells (mid-split)
    parts.append(f'<path d="M560 355 Q640 390 655 450 L600 500 Q585 430 520 410Z" fill="{GREEN}"/>')
    # coin cell (the "baby" splitting off)
    parts.append(f'<circle cx="720" cy="300" r="165" fill="url(#coin)" stroke="#ffffff" stroke-width="18"/>')
    parts.append(f'<circle cx="720" cy="300" r="118" fill="none" stroke="{GOLD_DK}" stroke-width="10" opacity="0.45"/>')
    parts.append(f'<path d="{dollar}" transform="translate({720 - dw/2} {300 + 68})" fill="{GOLD_DK}"/>')
    parts.append(f'<ellipse cx="660" cy="222" rx="42" ry="24" fill="#ffffff" opacity="0.7" transform="rotate(-30 660 222)"/>')
    # main cell (Cellie)
    parts.append(f'<circle cx="430" cy="600" r="300" fill="url(#cell)" stroke="#ffffff" stroke-width="22"/>')
    parts.append(f'<ellipse cx="310" cy="440" rx="80" ry="44" fill="#ffffff" opacity="0.55" transform="rotate(-35 310 440)"/>')
    # organelle dots
    for cx, cy, r in [(250, 690, 20), (600, 740, 16), (560, 450, 13), (300, 790, 11)]:
        parts.append(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{GREEN_DK}" opacity="0.35"/>')
    # face
    for ex in (350, 520):
        parts.append(f'<ellipse cx="{ex}" cy="580" rx="36" ry="48" fill="{INK}"/>')
        parts.append(f'<circle cx="{ex + 12}" cy="562" r="14" fill="#ffffff"/>')
        parts.append(f'<circle cx="{ex - 12}" cy="600" r="6" fill="#ffffff"/>')
    for bx in (290, 580):
        parts.append(f'<ellipse cx="{bx}" cy="660" rx="40" ry="24" fill="{BLUSH}" opacity="0.9"/>')
    parts.append(f'<path d="M375 668 Q435 740 495 668" fill="none" stroke="{INK}" stroke-width="20" stroke-linecap="round"/>')
    # sparkles = "growing!"
    parts.append(sparkle(900, 170, 48, '#ffffff'))
    parts.append(sparkle(850, 480, 30, GOLD_HI))
    parts.append(sparkle(560, 170, 26, '#ffffff'))
    return '\n'.join(parts)


def write(name, w, h, body):
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">\n{defs()}\n{body}\n</svg>\n'
    with open(os.path.join(OUT, name), 'w') as f:
        f.write(svg)


def wordmark(font, x, y, size, money='#0284c7', cells=GREEN_DK):
    d1, w1 = text_path(font, 'Money', x, y, size)
    d2, _ = text_path(font, 'Cells', x + w1 + size * 0.22, y, size)
    return (f'<path d="{d1}" fill="{money}" stroke="#ffffff" stroke-width="{size*0.1}" paint-order="stroke" stroke-linejoin="round"/>'
            f'<path d="{d2}" fill="{cells}" stroke="#ffffff" stroke-width="{size*0.1}" paint-order="stroke" stroke-linejoin="round"/>')


def main():
    font = TTFont(sys.argv[1])
    # 1. App icon (full-bleed square; iOS applies its own corner mask)
    write('money-cells-icon.svg', 1024, 1024, mark(font))
    # 2. Mark only, transparent background (stickers, favicon, merch)
    write('money-cells-mark.svg', 1024, 1024, mark(font, bg=False))
    # 3. Horizontal lockup, transparent background
    tag, _ = text_path(font, 'Save it. Grow it. Watch it multiply!', 470, 330, 54)
    body = (f'<g transform="translate(0 0) scale(0.42)">{mark(font, bg=False)}</g>'
            + wordmark(font, 460, 250, 150)
            + f'<path d="{tag}" fill="#f97316"/>')
    write('money-cells-logo.svg', 1640, 430, body)
    # 4. Stacked lockup (splash screen / store feature graphic)
    tag2, tw = text_path(font, 'Save it. Grow it!', 0, 0, 64)
    d1, w1 = text_path(font, 'Money Cells', 0, 0, 150)
    body = (f'<rect width="1242" height="1242" fill="#f0f9ff"/>'
            f'<g transform="translate(241 150) scale(0.74)">{mark(font, bg=False)}</g>'
            + wordmark(font, 621 - w1 / 2, 1000, 150)
            + f'<path d="{tag2}" transform="translate({621 - tw/2} 1110)" fill="#f97316"/>')
    write('money-cells-splash.svg', 1242, 1242, body)
    # 5. Blue app splash (flat SPLASH_BG so it blends with app.json backgroundColor)
    body = (f'<rect width="1242" height="1242" fill="{SPLASH_BG}"/>'
            + ''.join(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="#ffffff" opacity="0.25"/>'
                      for cx, cy, r in [(170, 200, 50), (1080, 760, 40), (140, 900, 28), (1050, 120, 22)])
            + f'<g transform="translate(241 110) scale(0.74)">{mark(font, bg=False)}</g>'
            + wordmark(font, 621 - w1 / 2, 1000, 150, money='#0369a1')
            + f'<path d="{tag2}" transform="translate({621 - tw/2} 1110)" fill="#ffffff" '
              f'stroke="#c2410c" stroke-width="12" paint-order="stroke" stroke-linejoin="round"/>')
    write('money-cells-splash-blue.svg', 1242, 1242, body)


if __name__ == '__main__':
    main()
