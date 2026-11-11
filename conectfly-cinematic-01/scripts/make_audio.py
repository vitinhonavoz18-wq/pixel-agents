"""
Trilha original + efeitos sonoros da ConectFly Cinematic 01 (100% sintetizados aqui,
sem amostras de terceiros -> livres para uso comercial).

Saídas (48 kHz, estéreo, float WAV):
  assets/audio/music.wav   trilha
  assets/sfx/sfx.wav       todos os efeitos já posicionados na timeline
  assets/sfx/*.wav         cada efeito isolado (para reaproveitar/editar)
"""
import json
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, fftconvolve, sosfilt

ROOT = Path(__file__).resolve().parent.parent
TL = json.loads((ROOT / "src/timeline/timeline.json").read_text())
SR = 48000
DUR = TL["duration"]
N = SR * DUR
rng = np.random.default_rng(47)  # 02:47 :)

BPM = 120
BEAT = 60 / BPM
BAR = BEAT * 4


def t_axis(sec):
    return np.arange(int(sec * SR)) / SR


def lp(x, fc, order=2):
    return sosfilt(butter(order, min(fc, SR / 2 - 100), "low", fs=SR, output="sos"), x)


def hp(x, fc, order=2):
    return sosfilt(butter(order, fc, "high", fs=SR, output="sos"), x)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, min(hi, SR / 2 - 100)], "band", fs=SR, output="sos"), x)


def saw(f, t, detune=0.0):
    ph = (f * (1 + detune) * t) % 1.0
    return 2 * ph - 1


def note_hz(n):  # n = semitons a partir de A4
    return 440.0 * 2 ** (n / 12)


def place(buf, sig, at, gain=1.0, pan=0.0):
    """Mistura sig (mono ou estéreo) em buf a partir de 'at' segundos."""
    i = int(at * SR)
    if i >= len(buf):
        return
    if sig.ndim == 1:
        l = np.sqrt(0.5 * (1 - pan)) * 1.4142
        r = np.sqrt(0.5 * (1 + pan)) * 1.4142
        sig = np.stack([sig * l, sig * r], 1)
    j = min(len(buf), i + len(sig))
    if i < 0:
        sig = sig[-i:]
        i = 0
    buf[i:j] += sig[: j - i] * gain


def make_ir(sec=2.4, decay=3.2, bright=6000):
    t = t_axis(sec)
    l = rng.standard_normal(len(t)) * np.exp(-decay * t)
    r = rng.standard_normal(len(t)) * np.exp(-decay * t)
    ir = np.stack([lp(l, bright), lp(r, bright)], 1)
    ir[: int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))[:, None]
    return ir / np.abs(ir).sum(0).max() * 6


IR = make_ir()
IR_LONG = make_ir(4.0, 1.6, 4500)


def reverb(st, wet=0.3, ir=IR):
    out = np.stack([fftconvolve(st[:, c], ir[:, c])[: len(st)] for c in range(2)], 1)
    return st * (1 - wet) + out * wet


def env_lin(points, n=N):
    """Automação: lista de (seg, valor) -> curva por amostra."""
    xs, ys = zip(*points)
    return np.interp(np.arange(n) / SR, xs, ys)


# ---------------------------------------------------------------- MÚSICA
music = np.zeros((N, 2))
T = np.arange(N) / SR

# Progressão Am - F - C - G (A menor, cinematográfica)
CHORDS = [[-24, -12, -9, -5], [-28, -16, -12, -9], [-21, -9, -5, -2], [-26, -14, -10, -7]]


def chord_at(sec):
    return CHORDS[int(sec // BAR) % 4]


# 1) Sub + tensão (0-30): grave de cinema
sub = np.sin(2 * np.pi * 41.2 * T) * 0.6 + np.sin(2 * np.pi * 82.4 * T) * 0.15
sub *= env_lin([(0, 0), (0.4, 0.35), (3.6, 0.9), (4.2, 0.45), (9, 0.3), (16, 0.25), (21, 0.3), (25.8, 0.5), (26.0, 0), (30, 0)])
tension = lp(saw(55, T, 0) + saw(55, T, 0.007) + saw(110.3, T) * 0.4, 380) * 0.18
tension *= env_lin([(0, 0), (1, 0.4), (3.8, 1.0), (4.3, 0.25), (9, 0.0), (30, 0)])
room = lp(hp(rng.standard_normal(N), 60), 900) * env_lin([(0, 0.02), (4, 0.03), (4.5, 0.0), (21, 0), (21.5, 0.015), (26, 0)])
mono = sub + tension + room
music += np.stack([mono, mono], 1)

# Pulso de "coração" baixo no suspense
for at in [0.9, 1.75, 2.6, 3.35]:
    t = t_axis(0.5)
    k = np.sin(2 * np.pi * (48 + 30 * np.exp(-t * 30)) * t) * np.exp(-t * 9)
    place(music, k, at, 0.35)

# 2) Pad (4-30)
pad = np.zeros(N)
for b in range(int(DUR / BAR) + 1):
    t0 = b * BAR
    seg = t_axis(BAR + 1.0)
    s = np.zeros(len(seg))
    for n in chord_at(t0 + 0.01):
        f = note_hz(n + 12)
        s += saw(f, seg, -0.004) + saw(f, seg, 0.005)
    a = np.minimum(1, seg / 0.6) * np.minimum(1, np.maximum(0, (BAR + 1.0 - seg) / 1.0))
    i = int(t0 * SR)
    j = min(N, i + len(seg))
    pad[i:j] += (s * a)[: j - i]
pad = lp(pad, 1400) * 0.05
pad_env = env_lin([(0, 0), (4, 0), (5, 0.6), (9, 0.7), (16, 0.9), (17, 1.1), (21, 1.0), (25.5, 1.3), (26.0, 0.0), (26.6, 0.0), (27.4, 1.0), (30, 0.5)])
pad *= pad_env
pad_st = np.stack([pad, np.roll(pad, 300)], 1)
music += reverb(pad_st, 0.45, IR_LONG)

# 3) Arpejo pluck em 16 avos (4-16 e 21-26)
arp = np.zeros((N, 2))
step = BEAT / 4
pattern = [0, 2, 1, 3, 2, 1, 3, 2]
k = 0
for at in np.arange(4.0, 26.0, step):
    if 16.0 <= at < 21.0:
        k += 1
        continue
    ch = chord_at(at)
    n = ch[1:][pattern[k % 8] % 3] + 12 * (1 + (pattern[k % 8] // 3))
    t = t_axis(0.35)
    prog = np.clip((at - 4) / 12, 0, 1)
    cut = 900 + 2600 * prog if at < 16 else 1800 + 1800 * (at - 21) / 5
    s = lp(saw(note_hz(n), t) + 0.5 * saw(note_hz(n), t, 0.01), cut) * np.exp(-t * 14)
    vel = 0.55 if k % 4 else 0.8
    place(arp, s, at, 0.09 * vel, pan=0.35 if k % 2 else -0.35)
    k += 1
arp *= env_lin([(0, 0), (4, 0), (5.5, 0.8), (9, 1), (16, 1), (21, 0.7), (26, 1.1)])[:, None]
music += reverb(arp, 0.3)

# 4) Bateria: kick, hat, clap (9-16) e (21.5-26)
drums = np.zeros((N, 2))


def kick():
    t = t_axis(0.45)
    f = 42 + 110 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.tanh(1.6 * np.sin(ph) * np.exp(-t * 7)) + lp(rng.standard_normal(len(t)), 4000) * np.exp(-t * 200) * 0.3


def hat():
    t = t_axis(0.08)
    return hp(rng.standard_normal(len(t)), 7000) * np.exp(-t * 60)


def clap():
    t = t_axis(0.35)
    n = bp(rng.standard_normal(len(t)), 900, 5000)
    e = sum(np.exp(-np.maximum(0, t - d) * 40) * (t >= d) for d in (0, 0.012, 0.024)) * np.exp(-t * 9)
    return n * e


K, H, C = kick(), hat(), clap()
for at in np.arange(9.0, 16.0, BEAT):
    place(drums, K, at, 0.55)
    place(drums, H, at + BEAT / 2, 0.10, pan=0.25)
    if int(round((at - 9.0) / BEAT)) % 2 == 1:
        place(drums, C, at, 0.16)
for at in np.arange(9.0, 16.0, BEAT / 4):
    if int(round(at / (BEAT / 4))) % 2:
        place(drums, H, at, 0.035, pan=-0.3)
# break (16-21): só um kick abafado a cada 2 tempos
for at in np.arange(16.0, 21.0, BEAT * 2):
    place(drums, lp(K, 300), at, 0.25)
for at in np.arange(21.5, 26.0, BEAT):
    place(drums, K, at, 0.5 * min(1, (at - 21) / 2.5 + 0.3))
    place(drums, H, at + BEAT / 2, 0.09)
    if int(round((at - 21.5) / BEAT)) % 2 == 1:
        place(drums, C, at, 0.14)
# fill de caixa acelerando antes do impacto
for i, at in enumerate(np.arange(25.0, 26.0, BEAT / 4)):
    place(drums, C, at, 0.05 + 0.02 * i)
music += reverb(drums, 0.12)

# 5) Baixo (9-16, 21.5-26)
bass = np.zeros(N)
for at in np.arange(9.0, 26.0, BEAT / 2):
    if 16.0 <= at < 21.5:
        continue
    t = t_axis(BEAT / 2 * 0.9)
    f = note_hz(chord_at(at)[0])
    s = lp(saw(f, t) + np.sin(2 * np.pi * f / 2 * t), 520) * np.minimum(1, t / 0.005) * np.exp(-t * 4)
    i = int(at * SR)
    bass[i : i + len(s)] += s[: max(0, min(len(s), N - i))] * 0.3
music += np.stack([bass, bass], 1)

# 6) Tail final (26-30): acorde de resolução sustentado, A maior suspenso
t = t_axis(4.0)
res = np.zeros(len(t))
for n in [-24, -12, -5, 2, 7]:
    res += np.sin(2 * np.pi * note_hz(n) * t) + 0.3 * np.sin(2 * np.pi * note_hz(n) * 2.001 * t)
res = res * np.minimum(1, t / 0.9) * np.minimum(1, (4.0 - t) / 1.2) * 0.045
place(music, reverb(np.stack([res, res], 1), 0.5, IR_LONG), 26.5)

# ---------------------------------------------------------------- SFX
sfx = np.zeros((N, 2))
SFX_DIR = ROOT / "assets/sfx"
SFX_DIR.mkdir(parents=True, exist_ok=True)
lib = {}


def vibrate():
    t = t_axis(0.62)
    s = np.zeros(len(t))
    for d in (0.0, 0.22, 0.44):
        m = (t >= d) & (t < d + 0.15)
        tt = t - d
        buzz = np.sign(np.sin(2 * np.pi * 168 * tt)) * 0.5 + np.sin(2 * np.pi * 168 * tt)
        rattle = bp(rng.standard_normal(len(t)), 1500, 4000) * 0.25
        e = np.minimum(1, tt / 0.01) * np.minimum(1, (d + 0.15 - t) / 0.02)
        s += np.where(m, (lp(buzz, 900) + rattle) * e, 0)
    return lp(s, 2500) * 0.6


def notify():
    t = t_axis(0.7)
    a = np.sin(2 * np.pi * 1318.5 * t) * np.exp(-t * 9)
    b = np.sin(2 * np.pi * 1975.5 * (t - 0.075)) * np.exp(-np.maximum(0, t - 0.075) * 8) * (t > 0.075)
    return (a * 0.6 + b * 0.5 + 0.15 * np.sin(2 * np.pi * 3951 * t) * np.exp(-t * 30)) * 0.5


def reply():
    t = t_axis(0.4)
    f = 900 + 500 * np.exp(-t * 25)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 14) * 0.35


def tick():
    t = t_axis(0.05)
    return (bp(rng.standard_normal(len(t)), 2500, 9000) * np.exp(-t * 160) + np.sin(2 * np.pi * 2400 * t) * np.exp(-t * 90) * 0.4) * 0.5


def whoosh(sec=0.9):
    t = t_axis(sec)
    n = rng.standard_normal(len(t))
    out = np.zeros(len(t))
    chunks = 24
    edges = np.linspace(0, len(t), chunks + 1).astype(int)
    for c in range(chunks):
        x = c / chunks
        fc = 300 + 5000 * np.sin(np.pi * x) ** 2
        out[edges[c] : edges[c + 1]] = bp(n, fc * 0.6, fc * 1.6)[edges[c] : edges[c + 1]]
    e = np.sin(np.pi * t / sec) ** 2
    return out * e * 0.9


def handoff_chime():
    t = t_axis(1.2)
    s = 0
    for d, n in ((0, 7), (0.11, 14), (0.22, 19)):
        tt = np.maximum(0, t - d)
        s = s + np.sin(2 * np.pi * note_hz(n) * tt + 1.2 * np.sin(2 * np.pi * note_hz(n) * 2 * tt) * np.exp(-tt * 6)) * np.exp(-tt * 4) * (t >= d)
    return s * 0.22


def riser(sec):
    t = t_axis(sec)
    f = 200 * (20 ** (t / sec))
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.25
    noise = hp(rng.standard_normal(len(t)), 1500) * 0.5
    e = (t / sec) ** 2.4
    return (tone + noise) * e * 0.5


def impact():
    t = t_axis(3.0)
    f = 30 + 55 * np.exp(-t * 6)
    boom = np.tanh(2 * np.sin(2 * np.pi * np.cumsum(f) / SR)) * np.exp(-t * 1.6)
    crack = lp(rng.standard_normal(len(t)), 6000) * np.exp(-t * 18) * 0.5
    return boom * 0.9 + crack


def signature():
    """Assinatura sonora ConectFly: 3 sinos FM (E5-B5-E6) + brilho."""
    t = t_axis(3.2)
    s = 0
    for d, n in ((0.0, 7), (0.16, 14), (0.32, 19)):
        tt = np.maximum(0, t - d)
        f = note_hz(n)
        s = s + np.sin(2 * np.pi * f * tt + 2.0 * np.exp(-tt * 3) * np.sin(2 * np.pi * f * 3.5 * tt)) * np.exp(-tt * 1.8) * (t >= d)
    shimmer = hp(rng.standard_normal(len(t)), 9000) * np.exp(-t * 3) * 0.05
    return (s + shimmer) * 0.2


lib["vibrate"] = vibrate()
lib["notify"] = notify()
lib["reply"] = reply()
lib["tick"] = tick()
lib["whoosh"] = whoosh()
lib["handoff"] = handoff_chime()
lib["impact"] = impact()
lib["signature"] = signature()

for at in TL["sfx"]["vibrate"]:
    place(sfx, lib["vibrate"], at, 0.9)
for i, at in enumerate(TL["sfx"]["notify"]):
    place(sfx, lib["notify"], at, 0.55, pan=[-0.2, 0.2, 0][i % 3])
for at in TL["sfx"]["reply"]:
    place(sfx, lib["reply"], at, 0.5, pan=0.15)
for at in TL["sfx"]["tick"]:
    place(sfx, lib["tick"], at, 0.35, pan=0.3)
for i, at in enumerate(TL["sfx"]["whoosh"]):
    place(sfx, lib["whoosh"], at - 0.45, 0.32, pan=-0.4 if i % 2 else 0.4)
for at in TL["sfx"]["handoff"]:
    place(sfx, lib["handoff"], at, 0.8)
r0, r1 = TL["sfx"]["riser"]
lib["riser"] = riser(r1 - r0)
place(sfx, lib["riser"], r0, 0.5)
for at in TL["sfx"]["impact"]:
    place(sfx, lib["impact"], at, 0.8)
for at in TL["sfx"]["signature"]:
    place(sfx, lib["signature"], at, 1.0)
sfx = reverb(sfx, 0.18)


def save(path, x, peak=0.89):
    x = x / max(1e-9, np.abs(x).max()) * peak
    wavfile.write(path, SR, x.astype(np.float32))


for name, s in lib.items():
    save(SFX_DIR / f"{name}.wav", np.stack([s, s], 1) if s.ndim == 1 else s, 0.8)
save(ROOT / "assets/audio/music.wav", music, 0.7)
save(SFX_DIR / "sfx.wav", sfx, 0.8)
print("ok", music.shape, sfx.shape)
