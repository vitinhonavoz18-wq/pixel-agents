#!/usr/bin/env bash
# Corta silêncio das pontas, nivela volume e (cenas 4 e 5) acelera 12% sem mudar o tom,
# para caber na linha do tempo sem cortar palavras. Depois mede a duração real.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p public/audio/voice
trim="silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.02,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.06,areverse"
for name in 01-gancho 02-pergunta 04-revelacao 05-dica 06-cta; do
  tempo=""
  case "$name" in 04-revelacao|05-dica) tempo=",atempo=1.12" ;; esac
  ffmpeg -y -v error -i "public/audio/raw/$name.mp3" -af "$trim$tempo,loudnorm=I=-12:TP=-1.5:LRA=7" -ar 44100 -ac 2 "public/audio/voice/$name.wav"
  echo "$name $(ffprobe -v error -show_entries format=duration -of csv=p=0 public/audio/voice/$name.wav)s"
done
echo "Atualize as durações em src/config/timing.ts (VOICE) se mudarem."
