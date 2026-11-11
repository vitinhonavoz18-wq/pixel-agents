"""Gera src/timeline/words.json: tempo de cada palavra da locução (Whisper local)."""
import json, re, subprocess, sys, numpy as np
from pathlib import Path
from faster_whisper import WhisperModel
ROOT = Path(__file__).resolve().parent.parent
SCRIPT = [
 "Esse funcionário não tira férias. Mas também, não é humano.",
 "Enquanto você dorme, ele recebe mensagens, e entende o que cada cliente precisa.",
 "Responde dúvidas, organiza pedidos, e prepara tudo para sua equipe.",
 "E quando necessário, conecta o cliente a uma pessoa de verdade.",
 "Seu negócio pode continuar atendendo, mesmo fora do expediente.",
 "É automação. E a sua empresa pode ter uma.",
]
OFFSETS = [0.55, 4.25, 9.6, 16.5, 21.35, 26.2]  # início de cada fala (s) — igual a timeline.ts
def load(p):
    b = subprocess.run(["ffmpeg","-v","error","-i",str(p),"-f","s16le","-ac","1","-ar","16000","-"],capture_output=True).stdout
    return np.frombuffer(b,np.int16).astype(np.float32)/32768
m = WhisperModel("small", device="cpu", compute_type="int8")
out = []
for i,(text,off) in enumerate(zip(SCRIPT,OFFSETS),1):
    wav = ROOT/f"assets/audio/voice/vo_0{i}.wav"
    segs,_ = m.transcribe(load(wav), language="pt", word_timestamps=True, initial_prompt=text)
    ww = [w for s in segs for w in s.words]
    words = text.split()
    dur = float(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",str(wav)]))
    if len(ww) == len(words):
        times = [(w.start, w.end) for w in ww]
    else:  # fallback proporcional ao nº de letras
        print(f"line {i}: whisper {len(ww)} vs script {len(words)} -> proportional", file=sys.stderr)
        tot = sum(len(w)+1 for w in words); t = 0; times = []
        for w in words:
            d = dur*(len(w)+1)/tot; times.append((t, t+d)); t += d
    for w,(a,b) in zip(words,times):
        out.append({"line": i, "word": w, "start": round(off+a,3), "end": round(off+b,3)})
json.dump({"offsets": OFFSETS, "words": out}, open(ROOT/"src/timeline/words.json","w"), ensure_ascii=False, indent=1)
print(json.dumps(out[:6], ensure_ascii=False)); print(len(out), "words")
