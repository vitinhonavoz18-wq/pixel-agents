"""Gera trilha original e efeitos sonoros por síntese (sem samples de terceiros).

Tudo aqui é produzido matematicamente, então não há problema de licença:
a trilha e os efeitos são 100% originais deste projeto.

Uso:  python3 scripts/generate_audio_assets.py
Saída: public/sfx/*.wav e public/audio/music.wav
"""
import os
import wave

import numpy as np

SR = 44100
ROOT = os.path.join(os.path.dirname(__file__), "..", "public")
rng = np.random.default_rng(7)  # semente fixa = resultado sempre igual


def t_axis(sec):
    return np.arange(int(SR * sec)) / SR


def env_exp(sec, decay):
    return np.exp(-t_axis(sec) / decay)


def write(path, sig, peak=0.89):
    sig = np.asarray(sig, dtype=np.float64)
    if sig.ndim == 1:
        sig = np.stack([sig, sig], axis=1)
    m = np.max(np.abs(sig)) or 1.0
    sig = sig / m * peak  # normaliza sem clipping
    data = (sig * 32767).astype(np.int16)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())


def fade_edges(sig, fin=0.003, fout=0.01):
    n_in, n_out = int(SR * fin), int(SR * fout)
    sig = sig.copy()
    sig[:n_in] *= np.linspace(0, 1, n_in)
    sig[-n_out:] *= np.linspace(1, 0, n_out)
    return sig


def sweep(f0, f1, sec, curve="exp"):
    t = t_axis(sec)
    if curve == "exp":
        f = f0 * (f1 / f0) ** (t / sec)
    else:
        f = f0 + (f1 - f0) * t / sec
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def lowpass(sig, alpha):
    out = np.zeros_like(sig)
    acc = 0.0
    for i, x in enumerate(sig):
        acc += alpha * (x - acc)
        out[i] = acc
    return out


def highpass(sig):
    return np.diff(sig, prepend=0.0)


def note(freq, sec, decay, harmonics=(1, 0.5, 0.25)):
    t = t_axis(sec)
    s = sum(a * np.sin(2 * np.pi * freq * (k + 1) * t) for k, a in enumerate(harmonics))
    return s * np.exp(-t / decay)


# ---------- EFEITOS ----------
def sfx_impact():
    sec = 0.9
    boom = sweep(140, 38, sec) * env_exp(sec, 0.22)
    noise = lowpass(rng.standard_normal(int(SR * sec)), 0.08) * env_exp(sec, 0.08) * 2.5
    crack = highpass(rng.standard_normal(int(SR * sec))) * env_exp(sec, 0.02) * 0.6
    return fade_edges(boom + noise + crack)


def sfx_pop():
    sec = 0.12
    return fade_edges(sweep(500, 1400, sec) * env_exp(sec, 0.035))


def sfx_whoosh():
    sec = 0.35
    t = t_axis(sec)
    n = rng.standard_normal(len(t))
    shape = np.sin(np.pi * t / sec) ** 2
    return fade_edges(lowpass(n, 0.25) * shape)


def sfx_tick(high=False):
    sec = 0.09
    f = 2600 if high else 1900
    s = note(f, sec, 0.012, (1, 0.3)) + highpass(rng.standard_normal(int(SR * sec))) * env_exp(sec, 0.004) * 0.5
    body = note(f / 4, sec, 0.02, (1,)) * 0.6
    return fade_edges(s + body)


def sfx_suspense():
    sec = 0.45
    t = t_axis(sec)
    rise = sweep(220, 880, sec) * (t / sec) ** 1.5
    n = lowpass(rng.standard_normal(len(t)), 0.3) * (t / sec) ** 2 * 0.6
    return fade_edges(rise + n, fout=0.02)


def sfx_correct():
    sec = 1.1
    out = np.zeros(int(SR * sec))
    for i, f in enumerate([1046.5, 1318.5, 1568.0, 2093.0]):
        start = int(SR * i * 0.07)
        n = note(f, sec - i * 0.07, 0.35, (1, 0.35, 0.12))
        out[start:start + len(n)] += n[: len(out) - start]
    sparkle = highpass(rng.standard_normal(len(out))) * env_exp(sec, 0.15) * 0.08
    return fade_edges(out + sparkle, fout=0.05)


def sfx_heart():
    sec = 0.3
    a = note(180, sec, 0.06, (1, 0.4))
    b = np.zeros_like(a)
    off = int(SR * 0.12)
    b[off:] = note(160, sec - 0.12, 0.06, (1, 0.4))[: len(b) - off]
    return fade_edges(a + b * 0.8)


# ---------- TRILHA ORIGINAL ----------
def music(duration=18.0, bpm=120):
    n = int(SR * duration)
    mix = np.zeros(n)
    beat = 60 / bpm
    # progressão alegre (C - Am - F - G), um acorde por compasso (4 tempos)
    chords = [
        (130.81, [523.25, 659.25, 783.99]),
        (110.00, [440.00, 523.25, 659.25]),
        (87.31, [349.23, 440.00, 523.25]),
        (98.00, [392.00, 493.88, 587.33]),
    ]

    def add(sig, at, gain=1.0):
        i = int(at * SR)
        if i >= n:
            return
        end = min(n, i + len(sig))
        mix[i:end] += sig[: end - i] * gain

    kick = sweep(150, 45, 0.25) * env_exp(0.25, 0.07)
    clap = highpass(rng.standard_normal(int(SR * 0.15))) * env_exp(0.15, 0.03)
    hat = highpass(highpass(rng.standard_normal(int(SR * 0.05)))) * env_exp(0.05, 0.01)

    total_beats = int(duration / beat)
    for b in range(total_beats):
        t0 = b * beat
        bar = b // 4
        root, tones = chords[bar % 4]
        add(kick, t0, 0.9)
        if b % 2 == 1:
            add(clap, t0, 0.35)
        add(hat, t0 + beat / 2, 0.18)
        # tensão na contagem (3,9 s a 8,9 s): hats em semicolcheia nos 2 últimos segundos
        if 6.9 <= t0 < 8.9:
            add(hat, t0 + beat / 4, 0.14)
            add(hat, t0 + 3 * beat / 4, 0.14)
        # baixo em colcheias
        for k in range(2):
            bass = note(root, beat / 2, 0.12, (1, 0.6, 0.3, 0.15))
            add(bass, t0 + k * beat / 2, 0.5)
        # arpejo "pluck" em semicolcheias
        for k in range(4):
            f = tones[(b * 4 + k) % 3] * (2 if k == 3 else 1)
            add(note(f, beat / 4 + 0.15, 0.08, (1, 0.3)), t0 + k * beat / 4, 0.16)

    # fade final terminando exatamente no último frame
    fade = int(SR * 0.6)
    mix[-fade:] *= np.linspace(1, 0, fade) ** 1.5
    mix[: int(SR * 0.01)] *= np.linspace(0, 1, int(SR * 0.01))
    # leve estéreo: atraso de 8 ms num canal
    d = int(SR * 0.008)
    right = np.concatenate([np.zeros(d), mix[:-d]])
    return np.stack([mix, right], axis=1)


if __name__ == "__main__":
    sfx = {
        "impact": sfx_impact(),
        "pop": sfx_pop(),
        "whoosh": sfx_whoosh(),
        "tick": sfx_tick(),
        "tick-high": sfx_tick(high=True),
        "suspense": sfx_suspense(),
        "correct": sfx_correct(),
        "heart": sfx_heart(),
    }
    for name, sig in sfx.items():
        write(os.path.join(ROOT, "sfx", f"{name}.wav"), sig)
    write(os.path.join(ROOT, "audio", "music.wav"), music(), peak=0.7)
    print("ok:", ", ".join(sfx), "+ music.wav")
