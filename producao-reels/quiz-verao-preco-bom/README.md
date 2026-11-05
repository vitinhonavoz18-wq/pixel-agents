# Reels — Quiz do Verão · Farmácia Preço Bom

Vídeo de 18 s (1080×1920, 30 fps, H.264 + AAC) feito 100% por código com Remotion, narração ElevenLabs e trilha/efeitos originais sintetizados localmente.

## Entregas (pasta `output/`)
| Arquivo | O que é |
|---|---|
| `quiz-verao-farmacia-preco-bom.mp4` | Vídeo final para Reels/TikTok/Shorts |
| `capa-reels.png` | Capa 1080×1920 |
| `locucao-elevenlabs-completa.mp3` | Só a narração, já sincronizada nos 18 s |
| `relatorio-validacao.json` + `RELATORIO-VALIDACAO.md` | Testes técnicos |
| `conferencia/*.png` | Quadros de conferência (0,5 · 3 · 5 · 8,85 · 9,5 · 13,5 · 17 s) |

Roteiro e legenda do Instagram: `ROTEIRO-E-PUBLICACAO.md`.

## Como editar e renderizar de novo
```bash
npm install
npm run studio     # pré-visualizar no navegador
npm run render     # gera output/quiz-verao-farmacia-preco-bom.mp4
npm run cover      # gera output/capa-reels.png
npm run validate   # confere duração, frames, áudio, etc.
```
- Textos e respostas: `src/data/quiz.ts`
- Tempos de cenas, falas e efeitos: `src/config/timing.ts`
- Cores e fontes: `src/config/theme.ts`
- Nova narração: `ELEVENLABS_API_KEY=... npm run voice` (a chave nunca vai para o código)
- Trilha e efeitos: `npm run sfx` (síntese original, sem problema de direitos autorais)
