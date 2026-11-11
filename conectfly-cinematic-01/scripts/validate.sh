#!/usr/bin/env bash
# Validação técnica do master: resolução, fps, duração, áudio, decodificação completa, loudness.
cd "$(dirname "$0")/.."
F=output/conectfly-ia-24h-fullhd.mp4
{
echo "== $F"; ls -la $F
ffprobe -v error -show_entries stream=codec_name,profile,width,height,pix_fmt,r_frame_rate,avg_frame_rate,nb_frames,sample_rate,channels,bit_rate -show_entries format=duration,size,bit_rate -of default=nw=1 $F
echo "== decodificação completa (erros abaixo, se houver):"
ffmpeg -v error -i $F -f null - && echo "decodificado sem erros"
echo "== loudness do áudio final:"
ffmpeg -hide_banner -i $F -vn -af ebur128=peak=true -f null - 2>&1 | grep -A14 Summary | grep -E "I:|LRA:|Peak:"
echo "== frames pretos (blackdetect >= 0.1s):"
ffmpeg -hide_banner -i $F -vf blackdetect=d=0.1:pix_th=0.06 -an -f null - 2>&1 | grep black_start || echo "nenhum trecho preto detectado"
} | tee output/validation.txt
