"""Animated word-by-word Russian subtitles (ASS) synced to the voiceover clips.

usage: python3 subs.py voice/script.txt out.ass [voice_track.wav]
script.txt: one line per clip, in order ("01| текст ..."), text exactly as spoken.
Word timings: each clip's speech regions (energy) are split proportionally to syllable
weight, then every boundary is snapped to the nearest energy dip in the voice.
"""
import sys, re, json, subprocess, glob, os
import numpy as np
from fontTools.ttLib import TTFont

HERE = os.path.dirname(os.path.abspath(__file__))
FONT = os.path.join(HERE, 'fonts', 'Montserrat-Black.ttf')
FAMILY = 'Montserrat Black'
SR = 16000
W, H = 1080, 1920
FS = 94                    # font size (ASS units, PlayRes 1080x1920)
Y_CENTER = 1180            # slightly below the middle, well above the Shorts UI
LINE_GAP = 1.12
MAX_LINE_W = 900
GOLD, RED, WHITE = '&H00D7FF&', '&H3333FF&', '&HFFFFFF&'   # ASS = BGR

# ---------- text classification ----------
GOLD_ROOTS = ('БИТКОИН', 'BITCOIN', 'BTC', 'ДОЛЛАР', 'МОНЕТ', 'МИЛЛИОН', 'МИЛЛИАРД', 'ТЫСЯЧ', 'ЛЕТ', 'ГОД', '$')
RED_ROOTS = ('ОБВАЛ', 'ПАДЕН', 'УПАЛ', 'УПАД', 'РУХН', 'КРАХ', 'ОБЕСЦЕН', 'ПОТЕР', 'МИНУС', 'УБЫТ', 'ПАНИК', 'ОБНУЛ', 'СГОРЕ', 'ПРОВАЛ', 'НОЛЬ', 'ОБРУШ')
VOWELS = set('аеёиоуыэюяaeiouy')

def has_digit(w): return any(c.isdigit() for c in w)

def classify(words):
    """returns list of (style, bounce) per word; amounts glue number + unit as gold"""
    out = []
    for i, w in enumerate(words):
        u = w.upper().strip('.,!?…:;—-«»"()')
        prev = words[i - 1].upper() if i else ''
        if any(r in u for r in RED_ROOTS): out.append(('red', False)); continue
        if has_digit(u): out.append(('gold', True)); continue
        if u.startswith(('БИТКОИН', 'BITCOIN')): out.append(('gold', False)); continue
        if has_digit(prev) and any(u.startswith(r) for r in GOLD_ROOTS): out.append(('gold', False)); continue
        out.append(('white', False))
    return out

def syllables(w):
    if has_digit(w): return max(2, len(re.sub(r'\D', '', w)))   # numbers are long to say
    return max(1, sum(c.lower() in VOWELS for c in w))

def tokenize(text):
    # keep "100 000" and "12,5" as single tokens
    text = re.sub(r'(\d)\s+(?=\d{3}\b)', '\\1\u00a0', text.strip())
    return [t for t in text.split() if t]

# ---------- audio analysis ----------
def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 's16le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768

def envelope(x, hop=0.01):
    n = int(SR * hop); k = len(x) // n
    e = np.sqrt((x[:k * n].reshape(k, n) ** 2).mean(1) + 1e-10)
    return 20 * np.log10(e)

def speech_regions(db, thr=-38, min_sil=0.12, hop=0.01):
    on = db > thr; regs = []; i = 0; n = len(on)
    while i < n:
        if on[i]:
            j = i
            while j < n and (on[j] or (j + int(min_sil / hop) < n and on[j:j + int(min_sil / hop)].any())): j += 1
            regs.append((i * hop, j * hop)); i = j
        else: i += 1
    return [(a, b) for a, b in regs if b - a > 0.08]

def align_clip(words, x):
    db = envelope(x); hop = 0.01
    sm = np.convolve(db, np.ones(5) / 5, mode='same')
    regs = speech_regions(db)
    total = sum(b - a for a, b in regs)
    wts = np.array([syllables(w) + 0.6 for w in words], float)
    # assign words to regions by cumulative weight
    cum = np.concatenate([[0], np.cumsum(wts)]) / wts.sum() * total
    def t_at(s):  # speech-time -> clip time
        for a, b in regs:
            if s <= b - a + 1e-6: return a + s
            s -= b - a
        return regs[-1][1]
    starts = [t_at(c) for c in cum[:-1]]; ends = [t_at(c) for c in cum[1:]]
    # snap inner boundaries to energy dips (±90 ms)
    for i in range(1, len(words)):
        b = starts[i]; lo, hi = int((b - 0.09) / hop), int((b + 0.09) / hop)
        lo = max(lo, 0); hi = min(hi, len(sm) - 1)
        if hi > lo:
            j = lo + int(np.argmin(sm[lo:hi])); starts[i] = j * hop
            if ends[i - 1] > starts[i] or abs(ends[i - 1] - b) < 0.05: ends[i - 1] = starts[i]
    # a word that starts a region begins exactly at the region onset
    for a, _ in regs:
        k = int(np.argmin([abs(s - a) for s in starts]))
        if abs(starts[k] - a) < 0.15: starts[k] = a
    return [(max(0, s - 0.03), e) for s, e in zip(starts, ends)], regs

# ---------- phrase grouping ----------
def phrases_for_clip(words, times, regs, max_w=6, min_w=3):
    out, cur = [], []
    def gap_after(i):
        if i + 1 >= len(words): return 9
        return times[i + 1][0] - times[i][1]
    for i, w in enumerate(words):
        cur.append(i)
        punct = re.search(r'[.!?…:;—]$', w) is not None
        comma = w.endswith(',') and not has_digit(w[-2:-1] or 'a')
        nxt_num = i + 1 < len(words) and has_digit(words[i + 1])
        unit_follow = has_digit(w) and i + 1 < len(words) and not has_digit(words[i + 1])
        if len(cur) >= max_w or ((punct or gap_after(i) > 0.18) and len(cur) >= 2) or (comma and len(cur) >= min_w):
            if unit_follow and len(cur) < max_w: continue
            if unit_follow and len(cur) > 2: out.append(cur[:-1]); cur = [cur[-1]]; continue
            out.append(cur); cur = []
    if cur:
        if out and len(cur) < 2 and len(out[-1]) + len(cur) <= max_w + 1: out[-1] += cur
        else: out.append(cur)
    return out

# ---------- layout with real font metrics ----------
font = TTFont(FONT); cmap = font.getBestCmap(); hmtx = font['hmtx']; upem = font['head'].unitsPerEm
os2 = font['OS/2']; asc_desc = (os2.usWinAscent + os2.usWinDescent) / upem   # calibrated against libass output
def text_w(s, fs=FS):
    k = fs / asc_desc / upem
    return sum(hmtx[cmap.get(ord(c), cmap[ord('?')])][0] for c in s) * k

def layout(words, cls):
    ws = [w.upper() for w in words]; space = text_w(' ') * 1.15
    widths = [text_w(w) * (1.07 if c[0] != 'white' else 1.0) + 10 for w, c in zip(ws, cls)]
    full = sum(widths) + space * (len(ws) - 1)
    lines = [list(range(len(ws)))]
    if full > MAX_LINE_W and len(ws) > 1:   # best balanced 2-line split
        best = None
        for k in range(1, len(ws)):
            a = sum(widths[:k]) + space * (k - 1); b = sum(widths[k:]) + space * (len(ws) - k - 1)
            sc = max(a, b) + (0 if not has_digit(ws[k]) or not has_digit(ws[k - 1]) else 999)
            if best is None or sc < best[0]: best = (sc, k)
        k = best[1]; lines = [list(range(k)), list(range(k, len(ws)))]
    scale = 1.0
    lw = [sum(widths[i] for i in L) + space * (len(L) - 1) for L in lines]
    if max(lw) > MAX_LINE_W: scale = MAX_LINE_W / max(lw)
    pos = {}; lh = FS * LINE_GAP * scale
    y0 = Y_CENTER - (len(lines) - 1) * lh / 2
    for li, L in enumerate(lines):
        x = W / 2 - lw[li] * scale / 2
        for i in L:
            pos[i] = (x + widths[i] * scale / 2, y0 + li * lh); x += (widths[i] + space) * scale
    return ws, pos, scale

def ts(t):
    t = max(0, t); h = int(t // 3600); m = int(t % 3600 // 60); s = t % 60
    return f'{h}:{m:02d}:{s:05.2f}'

def word_event(w, style, bounce, start, end, x, y, scale):
    col = {'gold': GOLD, 'red': RED, 'white': WHITE}[style]
    s = 100 * scale; fin = s * (1.07 if style != 'white' else 1.0)
    if bounce:
        anim = (f'\\fscx{s*0.55:.0f}\\fscy{s*0.55:.0f}\\alpha&HFF&\\t(0,90,\\alpha&H00&\\fscx{fin*1.22:.0f}\\fscy{fin*1.22:.0f})'
                f'\\t(90,170,\\fscx{fin*0.93:.0f}\\fscy{fin*0.93:.0f})\\t(170,240,\\fscx{fin*1.04:.0f}\\fscy{fin*1.04:.0f})\\t(240,300,\\fscx{fin:.0f}\\fscy{fin:.0f})')
    else:
        anim = (f'\\fscx{s*0.7:.0f}\\fscy{s*0.7:.0f}\\alpha&HFF&\\t(0,80,\\alpha&H00&\\fscx{fin*1.1:.0f}\\fscy{fin*1.1:.0f})'
                f'\\t(80,160,\\fscx{fin:.0f}\\fscy{fin:.0f})')
    shadow_alpha = '\\4a&H70&'
    return f'Dialogue: 1,{ts(start)},{ts(end)},Word,,0,0,0,,{{\\an5\\pos({x:.1f},{y:.1f})\\1c{col}{shadow_alpha}\\fad(0,90){anim}}}{w}'

HEADER = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 2
ScaledBorderAndShadow: yes
Kerning: no
YCbCr Matrix: TV.709

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Word,{FAMILY},{FS},&H00FFFFFF,&H00FFFFFF,&H00000000,&H90000000,0,0,0,0,100,100,0,0,1,4.5,5,5,0,0,0,204

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

def main():
    script, out = sys.argv[1], sys.argv[2]
    clips = sorted(glob.glob(os.path.join(HERE, 'voice', '[0-9][0-9].mp3')))
    lines = {}
    for ln in open(script, encoding='utf-8'):
        if '|' in ln: k, v = ln.split('|', 1); lines[int(k)] = v.strip()
    events, report, off = [], [], 0.0
    for ci, path in enumerate(clips, 1):
        x = load(path); dur = len(x) / SR
        words = tokenize(lines.get(ci, ''))
        if words:
            times, regs = align_clip(words, x)
            cls = classify(words)
            groups = phrases_for_clip(words, times, regs)
            for gi, g in enumerate(groups):
                p_start = off + times[g[0]][0]
                nxt = off + times[groups[gi + 1][0]][0] if gi + 1 < len(groups) else None
                p_end = nxt if nxt is not None else off + min(dur, times[g[-1]][1] + 0.45)
                ws, pos, scale = layout([words[i] for i in g], [cls[i] for i in g])
                for j, i in enumerate(g):
                    events.append(word_event(ws[j], *cls[i], off + times[i][0], p_end, *pos[j], scale))
                report.append(f'{p_start:6.2f}-{p_end:6.2f}  ' + ' '.join(f'{words[i]}@{off + times[i][0]:.2f}' for i in g))
        off += dur
    # a phrase from one clip must end before the next clip's first phrase
    open(out, 'w', encoding='utf-8').write(HEADER + '\n'.join(events) + '\n')
    print('\n'.join(report))

if __name__ == '__main__':
    main()
