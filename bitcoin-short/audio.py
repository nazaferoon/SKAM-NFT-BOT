"""Procedural cinematic soundtrack for the 45s short (no samples, pure numpy synthesis).
usage: python3 audio.py out.wav
"""
import sys, wave
import numpy as np

SR = 48000; DUR = 45.0; N = int(SR * DUR)
t = np.arange(N) / SR
rng = np.random.default_rng(2011)
L = np.zeros(N); R = np.zeros(N)

def env(a, b, attack=0.5, release=0.5):
    """0..1 envelope active between a and b seconds"""
    e = np.clip((t - a) / max(attack, 1e-3), 0, 1) * np.clip((b - t) / max(release, 1e-3), 0, 1)
    return e

def lowpass(x, cutoff):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(X / np.sqrt(1 + (f / cutoff) ** 4), len(x))

def bandpass(x, lo, hi):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(X * ((f > lo) & (f < hi)), len(x))

def add(sig, pan=0.0, gain=1.0):
    global L, R
    L += sig * gain * np.sqrt(0.5 * (1 - pan)); R += sig * gain * np.sqrt(0.5 * (1 + pan))

def impact(at, gain=1.0, f0=110, f1=28, decay=1.6, noise=0.5):
    s = np.zeros(N); i = int(at * SR); n = min(N - i, int(SR * decay * 4)); tt = np.arange(n) / SR
    freq = f1 + (f0 - f1) * np.exp(-tt * 9)
    ph = 2 * np.pi * np.cumsum(freq) / SR
    body = np.sin(ph) * np.exp(-tt / decay)
    nz = lowpass(rng.standard_normal(n), 900) * np.exp(-tt * 10) * noise
    s[i:i + n] = np.tanh((body + nz) * 1.6)
    add(s, 0, gain)

def whoosh(a, b, gain=0.4, rising=True):
    n = rng.standard_normal(N); e = env(a, b, (b - a) * 0.8, (b - a) * 0.2) if rising else env(a, b, 0.1, (b - a) * 0.8)
    add(bandpass(n, 300, 5000) * e ** 2, 0, gain)

# --- drone bed throughout ---
drone_e = np.clip(t / 2.0, 0, 1) * np.clip((45 - t) / 2.5, 0, 1)
for f, g in [(41.2, 0.32), (61.7, 0.16), (82.4, 0.1), (123.5, 0.04)]:
    lfo = 1 + 0.003 * np.sin(2 * np.pi * 0.07 * t + f)
    add(np.sin(2 * np.pi * f * t * lfo) * drone_e, -0.2, g); add(np.sin(2 * np.pi * f * 1.004 * t) * drone_e, 0.2, g)
air = lowpass(rng.standard_normal(N), 400) * 0.6
add(air * drone_e, 0, 0.12)

# --- scene 1-2: heartbeat + clock-like ticks, the key press, magical shimmer ---
for bt in np.arange(0.6, 10, 0.95):
    for off, g in [(0, 1.0), (0.17, 0.6)]:
        impact(bt + off, 0.22 * g * (0.7 + 0.3 * (bt / 10)), f0=70, f1=40, decay=0.12, noise=0.05)
tick = np.zeros(N)
for k in np.arange(0.3, 10, 0.5):
    i = int(k * SR); n = 900; tick[i:i + n] += bandpass(rng.standard_normal(n * 4), 2500, 7000)[:n] * np.exp(-np.arange(n) / 120)
add(tick, 0.3, 0.12)
click = np.zeros(N); i = int(6.2 * SR); n = 2400; click[i:i + n] = bandpass(rng.standard_normal(n), 1500, 6000) * np.exp(-np.arange(n) / 250)
add(click, 0, 0.6)
shim = np.zeros(N)
for f in [880, 1108.7, 1318.5, 1760, 2217.5]:
    shim += np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) * (0.6 + 0.4 * np.sin(2 * np.pi * 6 * t))
add(shim * env(6.4, 9.6, 0.8, 1.6) ** 2, 0, 0.05)
whoosh(6.6, 7.8, 0.15)

# --- scene 3: riser into the explosion ---
rs = env(9.8, 16.0, 5.8, 0.05)
ph = 2 * np.pi * np.cumsum(60 + 500 * np.clip((t - 10) / 6, 0, 1) ** 2.5) / SR
add(np.sin(ph) * rs ** 1.5, 0, 0.12); add(np.sin(ph * 1.5) * rs ** 2, 0, 0.06)
whoosh(10, 16.0, 0.5)
for k, bt in enumerate(np.cumsum(np.maximum(0.12, 0.6 * 0.86 ** np.arange(40))) + 10.2):
    if bt < 15.9: impact(bt, 0.35, f0=90, f1=45, decay=0.15, noise=0.2)
# golden pad on the rise
for f in [220, 277.2, 329.6, 440]:
    add(np.sin(2 * np.pi * f * t) * env(11, 16, 3, 0.05) * 0.5, rng.uniform(-0.5, 0.5), 0.05)

# --- scene 4: crash ---
impact(16.0, 1.3, f0=140, f1=26, decay=2.2, noise=1.0)
for c in [17.3, 18.3, 19.3, 20.4]: impact(c, 0.5, f0=200, f1=40, decay=0.4, noise=0.8)
alarm = np.sign(np.sin(2 * np.pi * 2.2 * t)) * np.sin(2 * np.pi * 98 * t)
add(lowpass(alarm, 600) * env(16.3, 22.6, 0.4, 1.0), 0, 0.07)
glitch = rng.standard_normal(N) * (np.sin(2 * np.pi * 13 * t) > 0.7)
add(bandpass(glitch, 800, 6000) * env(16.2, 21, 0.1, 2) * (rng.random(N) > 0.0), 0.2, 0.05)
for k in range(70):  # coins clinking on the floor
    at = 16.8 + rng.random() * 5.5; i = int(at * SR); n = 6000; tt = np.arange(n) / SR
    f = rng.uniform(2500, 5200); s = np.zeros(N)
    s[i:i + n] = (np.sin(2 * np.pi * f * tt) + 0.5 * np.sin(2 * np.pi * f * 2.76 * tt)) * np.exp(-tt * 28)
    add(s, rng.uniform(-0.8, 0.8), 0.05 * rng.uniform(0.4, 1))
fall = 2 * np.pi * np.cumsum(400 * np.exp(-np.clip(t - 16.5, 0, None) * 0.8)) / SR
add(np.sin(fall) * env(16.5, 21.5, 0.2, 2) * 0.5, 0, 0.08)

# --- scene 5: luxury - warm swelling chord ---
impact(23.0, 0.6, f0=90, f1=30, decay=2.5, noise=0.2)
for f in [110, 164.8, 220, 277.2, 329.6, 415.3]:
    vib = 1 + 0.002 * np.sin(2 * np.pi * 4.5 * t + f)
    add(np.sin(2 * np.pi * f * t * vib) * env(23, 30.2, 3.5, 0.15), rng.uniform(-0.6, 0.6), 0.06)
add(shim * env(25, 30, 3, 0.2) ** 2, 0, 0.03)

# --- scene 6: second crash - crack, shatter ---
for k in range(12):  # cracking
    at = 30.1 + k * 0.13 + rng.random() * 0.05; i = int(at * SR); n = 3000; s = np.zeros(N)
    s[i:i + n] = bandpass(rng.standard_normal(n), 2000, 9000) * np.exp(-np.arange(n) / 300); add(s, rng.uniform(-0.5, 0.5), 0.35)
impact(30.0, 0.8, f0=160, f1=35, decay=1.0, noise=0.6)
impact(31.85, 1.3, f0=180, f1=24, decay=2.4, noise=1.2)
sh = np.zeros(N); i = int(31.85 * SR); n = int(SR * 2.5); tt = np.arange(n) / SR
sh[i:i + n] = bandpass(rng.standard_normal(n), 3000, 12000) * np.exp(-tt * 2.5); add(sh, 0, 0.3)
whoosh(31.9, 34.8, 0.35, rising=False)
add(lowpass(alarm, 400) * env(31.9, 35, 0.2, 1.5), 0, 0.05)

# --- scene 7: final fortune - triumphant ---
impact(35.0, 1.0, f0=100, f1=30, decay=3.0, noise=0.3)
for f in [73.4, 110, 146.8, 185, 220, 293.7, 370, 440]:
    add(np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) * env(35, 41.3, 1.2, 0.6), rng.uniform(-0.7, 0.7), 0.055)
shim2 = sum(np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) for f in [1174.7, 1480, 1760, 2349.3]) * (0.6 + 0.4 * np.sin(2 * np.pi * 7 * t))
add(shim2 * env(35.5, 41.5, 1.5, 1), 0, 0.04)

# --- scene 8: lone coin - single bell-like tone fading to silence ---
impact(41.0, 0.5, f0=80, f1=30, decay=3.5, noise=0.1)
i = int(41.2 * SR); n = N - i; tt = np.arange(n) / SR; bell = np.zeros(N)
bell[i:] = (np.sin(2 * np.pi * 659.3 * tt) + 0.4 * np.sin(2 * np.pi * 1318.5 * tt) + 0.2 * np.sin(2 * np.pi * 1813 * tt)) * np.exp(-tt * 0.9)
add(bell, 0, 0.12)

# --- simple stereo reverb (convolution with decaying noise) ---
def reverb(x, sec=2.6, mix=0.25, seed=1):
    r = np.random.default_rng(seed); n = int(SR * sec); ir = r.standard_normal(n) * np.exp(-np.arange(n) / SR * 3.2)
    ir = lowpass(np.concatenate([ir, np.zeros(len(x) - n)]), 5000)[:n]; ir /= np.sqrt(np.sum(ir ** 2))
    m = len(x) + n; F = 1 << (m - 1).bit_length()
    wet = np.fft.irfft(np.fft.rfft(x, F) * np.fft.rfft(ir, F), F)[:len(x)]
    return x * (1 - mix) + wet * mix
L, R = reverb(L, seed=1), reverb(R, seed=2)
fade = np.clip((45 - t) / 3.0, 0, 1) ** 1.5
L *= fade; R *= fade
peak = max(np.abs(L).max(), np.abs(R).max()); L = np.tanh(L / peak * 1.2) * 0.89; R = np.tanh(R / peak * 1.2) * 0.89
out = (np.stack([L, R], 1) * 32767).astype(np.int16)
with wave.open(sys.argv[1] if len(sys.argv) > 1 else 'soundtrack.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(out.tobytes())
print('ok')
