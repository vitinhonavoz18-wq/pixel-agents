# ConectFly Cinematic Originals — Ep. 01
## "Contratei um funcionário que trabalha 24 horas"

Comercial vertical de 30 s (Reels/TikTok/Shorts) produzido 100% com código: Remotion + React + TypeScript (imagem), Python/NumPy (trilha e efeitos), Piper TTS (locução) e FFmpeg (mixagem e master).

## Entregáveis (`output/`)
| Arquivo | Descrição |
|---|---|
| `conectfly-ia-24h-fullhd.mp4` | Master final 1080x1920, 30 fps, H.264 CRF 17, yuv420p, AAC 48 kHz estéreo 320 kbps |
| `conectfly-ia-24h-preview.mp4` | Preview leve (540x960) da edição completa |
| `thumbnail.png` | Capa do Reels 1080x1920 |
| `validation.txt` | Relatório técnico (ffprobe + loudness) |
| `contact-sheet.png` | Quadros de todas as cenas |

## Como renderizar de novo
```bash
npm install
npm run audio            # (opcional) regera trilha + efeitos + mix  -> public/mix.wav
npm run render           # master Full HD -> output/conectfly-ia-24h-fullhd.mp4
npm run render:preview   # preview 540x960
node scripts/render.mjs --thumb
node scripts/render.mjs --stills 2,6,12 --scale 0.5   # quadros soltos p/ conferência
npm run studio           # editor visual do Remotion
```
Locução (requer `pip install piper-tts faster-whisper` e a voz `pt_BR-cadu-medium` do repositório rhasspy/piper-voices): os arquivos já gerados estão em `assets/audio/voice/vo_01..06.wav`. Após trocar a voz, rode `python3 scripts/align_words.py` (recalcula o tempo de cada palavra das legendas) e `npm run audio`.

## Estrutura
- `src/timeline/timeline.json` — **fonte única de tempo** (cenas, mensagens, efeitos, falas). Vídeo e áudio leem o mesmo arquivo.
- `src/timeline/words.json` — tempo real de cada palavra falada (Whisper local).
- `src/scenes/` — `CinematicOpening`, `IntentRecognition`, `AnimatedConversation`, `HumanHandoff` (fluxo + especialista), `DashboardReveal`, `BrandFinale`.
- `src/components/` — `OfficeSet` (escritório em camadas com parallax, noite/amanhecer, celular que vibra = PhoneNotification), `Chat` (balões, digitação, etiquetas de intenção, vidro), `SubtitleRenderer`, `SoundTimeline`, `ConectflyLogo`, `PostFX` (grão, vinheta, névoa, bokeh, feixes de luz).
- `scripts/make_audio.py` — trilha original + 9 efeitos sintetizados (sem amostras de terceiros).
- `scripts/mix_audio.sh` — mixagem com ducking da música sob a voz, -14 LUFS / -1,5 dBTP.
- `assets/brand/` — símbolo oficial extraído do site (geometria intacta), paleta e tipografia.

## Licenças e honestidade
- Logo/paleta: extraídos de site.conectfly.com.br (marca do cliente). Fontes Sora e Inter: SIL OFL.
- Música e efeitos: sintetizados neste projeto — livres para uso comercial.
- Voz: Piper TTS, voz `pt_BR-cadu-medium` (modelo aberto). É uma voz sintética neural de boa clareza, **não** uma locução de estúdio. Para versão premium, substituir `vo_0X.wav` por ElevenLabs ou locutor humano e rodar os passos acima.
- Todas as conversas, nomes e números são fictícios e sinalizados como "dramatização / dados ilustrativos". Nenhum resultado comercial é prometido.
- Não houve filmagem real: escritório, especialista e empresário são ilustrações em silhueta feitas em código.
