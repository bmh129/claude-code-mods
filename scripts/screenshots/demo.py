"""Paints the frames a <mod>.demo.tsx captured into GIFs and MP4s (Pillow + ffmpeg).

Usage: python3 demo.py <frames.txt> <output dir> [mod]   writes <mod>-<scenario>.gif and .mp4
A frame is `FRAME <scenario>|<caption>|<tree>`, or `{"tree": <tree>, "prompt": <text>}` in place of
the tree to show text typed in the prompt. The mod defaults to plain-view.
"""
import json, os, shutil, subprocess, sys, tempfile
from PIL import Image, ImageDraw, ImageFont

here = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(here, 'render.py')).read().split('# Usage:')[0]
exec(compile(src, 'render.py', 'exec'))  # lines, trim, width, cells, COLORS and the palette

S, HOLD = 2, 2.6
CELL, ROW = 8.4 * S, 20 * S
font = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', 14 * S)
bold = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', 14 * S, index=1)
small = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', 12 * S)
MOD = sys.argv[3] if len(sys.argv) > 3 else 'plain-view'
# The rule over the prompt: plain-view labels it, other mods leave it plain.
LABEL = {'plain-view': ' plain view ─'}.get(MOD, '─')
# plain-view's card grows down from the top; other mods' frames sit on the prompt, as in a terminal.
BOTTOM = MOD != 'plain-view'
# Columns of the terminal drawn: the width the mod's demo mounts with.
COLS = {'limits-meter': 112}.get(MOD, 100)

def fill_of(st):
    if st.get('color'):
        c = COLORS.get(st['color'], st['color'])
        return DIM if st.get('dimColor') or not c.startswith('#') else c
    return DIM if st.get('dimColor') else FG

def paint(card, caption, title, typed=''):
    prompt = [plain('─' * (COLS - 1 - len(LABEL)) + LABEL, dimColor=True), plain('> ') + plain(typed)]
    rows = card + prompt
    pad, top, cap_h = 24 * S, 30 * S, 38 * S
    W, H = int(COLS * CELL + pad * 2), top + cap_h + len(rows) * ROW + pad
    im = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W, top], fill=CHROME)
    for i, c in enumerate(('#ff5f57', '#febc2e', '#28c840')):
        d.ellipse([(12 + i * 18) * S, 9.5 * S, (23 + i * 18) * S, 20.5 * S], fill=c)
    d.text((W / 2, top / 2), title, fill=DIM, font=small, anchor='mm')
    d.text((pad, top + 10 * S), caption.upper(), fill=CAP, font=small)
    y = top + cap_h
    for line in rows:
        x = pad
        for t, st in line:
            for ch in t:
                n = cells(ch)
                if ch in '│─╭╮╰╯':  # drawn as lines: the font's glyphs leave gaps between cells and rows
                    cx, cy, c = x + CELL / 2, y + ROW / 2, fill_of(st)
                    if ch in '│': d.line([cx, y, cx, y + ROW], fill=c, width=S)
                    if ch in '─╭╮╰╯': d.line([x if ch in '─╮╯' else cx, cy, x + CELL if ch in '─╭╰' else cx, cy], fill=c, width=S)
                    if ch in '╭╮': d.line([cx, cy, cx, y + ROW], fill=c, width=S)
                    if ch in '╰╯': d.line([cx, y, cx, cy], fill=c, width=S)
                elif ch.strip() and n: d.text((x, y), ch, fill=fill_of(st), font=bold if st.get('bold') else font)
                x += n * CELL
        y += ROW
    return im

frames = {}
for row in open(sys.argv[1]):
    name, caption, tree_json = row.rstrip('\n')[len('FRAME '):].split('|', 2)
    node = json.loads(tree_json)
    typed = node.get('prompt', '') if 'tree' in node else ''
    frames.setdefault(name, []).append((caption, trim(lines(node.get('tree', node))), typed))

out = sys.argv[2]
os.makedirs(out, exist_ok=True)
for name, items in frames.items():
    tmp = tempfile.mkdtemp()
    rows = max(len(card) for _, card, _ in items)
    if BOTTOM: items = [(caption, [[] for _ in range(rows - len(card))] + card, typed) for caption, card, typed in items]
    shots = [paint(card, caption, MOD, typed) for caption, card, typed in items]
    size = (max(im.width for im in shots), max(im.height for im in shots))
    for i, im in enumerate(shots):
        canvas = Image.new('RGB', size, BG)
        canvas.paste(im, (0, 0))
        canvas.save(f'{tmp}/f{i:02d}.png')
    last = len(items) - 1
    shutil.copy(f'{tmp}/f{last:02d}.png', f'{tmp}/f{last + 1:02d}.png')  # lets the last frame hold
    base = ['ffmpeg', '-y', '-loglevel', 'error', '-framerate', f'1/{HOLD}', '-i', f'{tmp}/f%02d.png']
    subprocess.run(base + ['-vf', 'fps=10,scale=iw/2:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse', '-loop', '0', f'{out}/{MOD}-{name}.gif'], check=True)
    subprocess.run(base + ['-vf', 'fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p', '-c:v', 'libx264', '-crf', '20', f'{out}/{MOD}-{name}.mp4'], check=True)
    shutil.rmtree(tmp)
    print(name, len(items), 'frames')
