#!/usr/bin/env bash
# Mixagem final: voz + trilha (com ducking sob a voz) + efeitos -> public/mix.wav
# Normalização para -14 LUFS / true peak -1.5 dBTP (padrão Reels/TikTok/Shorts).
set -euo pipefail
cd "$(dirname "$0")/.."
OFF=($(python3 -c "import json;print(' '.join(str(int(x*1000)) for x in json.load(open('src/timeline/timeline.json'))['voice']))"))
V=assets/audio/voice
FILTER=""
for i in 0 1 2 3 4 5; do
  FILTER+="[$((i+2)):a]adelay=${OFF[$i]}|${OFF[$i]},volume=1.0[v$i];"
done
FILTER+="[v0][v1][v2][v3][v4][v5]amix=inputs=6:normalize=0,apad=whole_dur=30[vo];"
FILTER+="[vo]asplit=2[vo1][vokey];"
FILTER+="[0:a]volume=0.62[mus];"
FILTER+="[mus][vokey]sidechaincompress=threshold=0.03:ratio=6:attack=25:release=420:makeup=1[musd];"
FILTER+="[1:a]volume=0.55[fx];"
FILTER+="[vo1]volume=1.25[vof];"
FILTER+="[musd][fx][vof]amix=inputs=3:normalize=0,atrim=0:30,afade=t=out:st=29.55:d=0.45[pre]"

ffmpeg -v error -y -i assets/audio/music.wav -i assets/sfx/sfx.wav \
  -i $V/vo_01.wav -i $V/vo_02.wav -i $V/vo_03.wav -i $V/vo_04.wav -i $V/vo_05.wav -i $V/vo_06.wav \
  -filter_complex "$FILTER" -map "[pre]" -ar 48000 -ac 2 -c:a pcm_f32le /tmp/cf_premix.wav

# loudnorm em 2 passagens
J=$(ffmpeg -hide_banner -i /tmp/cf_premix.wav -af loudnorm=I=-14:TP=-1.5:LRA=9:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
g(){ echo "$J" | python3 -c "import json,sys;print(json.load(sys.stdin)['$1'])"; }
ffmpeg -v error -y -i /tmp/cf_premix.wav -af "loudnorm=I=-14:TP=-1.5:LRA=9:measured_I=$(g input_i):measured_TP=$(g input_tp):measured_LRA=$(g input_lra):measured_thresh=$(g input_thresh):offset=$(g target_offset):linear=true,aresample=48000" \
  -ar 48000 -ac 2 -c:a pcm_s16le public/mix.wav
cp public/mix.wav assets/audio/mix_final.wav
echo "mix ok"; ffmpeg -hide_banner -i public/mix.wav -af ebur128=peak=true -f null - 2>&1 | grep -A12 Summary | grep -E "I:|Peak:|LRA:"
