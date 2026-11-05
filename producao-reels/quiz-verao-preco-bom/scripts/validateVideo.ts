/**
 * Validação técnica do MP4 final.
 * Uso: npx tsx scripts/validateVideo.ts [caminho.mp4]
 * Gera: output/relatorio-validacao.json + output/conferencia/*.png
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { CAPTIONS, QUIZ } from '../src/data/quiz';
import { COUNTDOWN_SECONDS, DURATION_IN_FRAMES, FPS, FRAMES_PER_COUNT, SCENES, VOICE } from '../src/config/timing';

const file = process.argv[2] ?? 'output/quiz-verao-farmacia-preco-bom.mp4';
const run = (cmd: string, args: string[]) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const ffmpegStderr = (args: string[]) => String(spawnSync('ffmpeg', args, { encoding: 'utf8' }).stderr);

const probe = JSON.parse(run('ffprobe', ['-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', file]));
const v = probe.streams.find((s: { codec_type: string }) => s.codec_type === 'video');
const a = probe.streams.find((s: { codec_type: string }) => s.codec_type === 'audio');

const vol = ffmpegStderr(['-hide_banner', '-i', file, '-af', 'volumedetect', '-vn', '-f', 'null', '-']);
const maxVol = Number(/max_volume: (-?[\d.]+) dB/.exec(vol)?.[1]);
const meanVol = Number(/mean_volume: (-?[\d.]+) dB/.exec(vol)?.[1]);
const loud = ffmpegStderr(['-hide_banner', '-i', file, '-af', 'ebur128=peak=true', '-vn', '-f', 'null', '-']);
const lufs = Number(/I:\s+(-?[\d.]+) LUFS/.exec(loud.split('Summary:')[1] ?? '')?.[1]);
const truePeak = Number(/Peak:\s+(-?[\d.]+) dBFS/.exec(loud.split('Summary:')[1] ?? '')?.[1]);

const voiceEnds = Object.entries(VOICE).map(([k, s]) => ({ fala: k, inicio_s: +(s.from / FPS).toFixed(2), fim_s: +((s.from / FPS) + s.seconds).toFixed(2) }));

const checks: Record<string, { ok: boolean; valor: unknown; esperado: unknown }> = {
  resolucao: { ok: v.width === 1080 && v.height === 1920, valor: `${v.width}x${v.height}`, esperado: '1080x1920' },
  codec_video: { ok: v.codec_name === 'h264', valor: v.codec_name, esperado: 'h264' },
  fps: { ok: v.r_frame_rate === '30/1', valor: v.r_frame_rate, esperado: '30/1' },
  frames: { ok: Number(v.nb_read_frames) === DURATION_IN_FRAMES, valor: Number(v.nb_read_frames), esperado: DURATION_IN_FRAMES },
  duracao_video_s: { ok: Math.abs(Number(v.duration) - 18) < 0.01, valor: Number(v.duration), esperado: 18 },
  audio_presente: { ok: !!a && a.codec_name === 'aac', valor: a ? `${a.codec_name} ${a.sample_rate}Hz ${a.channels}ch` : 'ausente', esperado: 'aac' },
  audio_nao_silencioso: { ok: meanVol > -40, valor: `${meanVol} dB média`, esperado: '> -40 dB' },
  sem_clipping: { ok: maxVol < 0 && truePeak < 0, valor: `pico ${maxVol} dB / true peak ${truePeak} dBFS`, esperado: '< 0 dB' },
  loudness: { ok: lufs > -20 && lufs < -9, valor: `${lufs} LUFS`, esperado: 'entre -20 e -9 LUFS (Reels ~ -14)' },
  falas_terminam_antes_do_fim: { ok: voiceEnds.every((x) => x.fim_s <= 18), valor: voiceEnds, esperado: 'todas <= 18 s' },
  falas_nao_se_sobrepoem: {
    ok: voiceEnds.every((x, i) => i === 0 || x.inicio_s >= voiceEnds[i - 1].fim_s - 0.001),
    valor: 'checado em sequência',
    esperado: 'sem sobreposição',
  },
  contagem_5s: {
    ok: SCENES.countdown.to - SCENES.countdown.from === COUNTDOWN_SECONDS * FRAMES_PER_COUNT && FRAMES_PER_COUNT === FPS,
    valor: `${(SCENES.countdown.to - SCENES.countdown.from) / FPS} s (${SCENES.countdown.from / FPS}s → ${SCENES.countdown.to / FPS}s)`,
    esperado: '5 s, 1 s por número',
  },
  resposta_correta_B: {
    ok: QUIZ.correct === 'B' && QUIZ.options.find((o) => o.letter === 'B')!.text.includes('FPS 30'),
    valor: QUIZ.options.find((o) => o.letter === QUIZ.correct)!.text,
    esperado: 'B — Sombra + chapéu + FPS 30+',
  },
  sem_legenda_na_contagem: {
    ok: !CAPTIONS.some((c) => c.from < SCENES.countdown.to && c.to > SCENES.countdown.from),
    valor: 'checado',
    esperado: 'nenhuma legenda entre 3,9 s e 8,9 s',
  },
};

const outDir = 'output/conferencia';
mkdirSync(outDir, { recursive: true });
for (const t of [0.5, 3.0, 5.0, 9.5, 13.5, 17.0]) {
  run('ffmpeg', ['-y', '-v', 'error', '-ss', String(t), '-i', file, '-frames:v', '1', path.join(outDir, `frame-${t.toFixed(1)}s.png`)]);
}

const ok = Object.values(checks).every((c) => c.ok);
const report = { arquivo: file, aprovado: ok, tamanho_mb: +(Number(probe.format.size) / 1e6).toFixed(2), checks };
writeFileSync('output/relatorio-validacao.json', JSON.stringify(report, null, 2));
for (const [k, c] of Object.entries(checks)) console.log(`${c.ok ? 'OK  ' : 'FALHA'} ${k}: ${typeof c.valor === 'object' ? JSON.stringify(c.valor) : c.valor}`);
console.log(ok ? '\nVALIDAÇÃO APROVADA' : '\nVALIDAÇÃO COM FALHAS');
process.exit(ok ? 0 : 1);
