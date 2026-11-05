# Relatório de validação — Quiz do Verão (Farmácia Preço Bom)

Arquivo: `output/quiz-verao-farmacia-preco-bom.mp4` · gerado por `npm run validate` (ffprobe/ffmpeg)

| Verificação | Resultado | Status |
|---|---|---|
| Resolução | 1080 × 1920 (9:16) | ✅ |
| Codec de vídeo | H.264, 30 fps | ✅ |
| Total de frames | 540 | ✅ |
| Duração | 18,00 s | ✅ |
| Áudio | AAC 48 kHz estéreo | ✅ |
| Volume | −15,6 LUFS integrado, pico −0,8 dBFS (sem distorção) | ✅ |
| Narração sem cortes | Todas as 5 falas terminam antes do próximo trecho; a última acaba em 17,88 s | ✅ |
| Contagem regressiva | 5 s exatos (3,9 → 8,9 s), 1 s por número, 5 ticks | ✅ |
| B sem destaque antes da revelação | Conferido no quadro 8,85 s (cards idênticos) | ✅ |
| Resposta correta | B — Sombra + chapéu + FPS 30+ | ✅ |
| Legendas durante a contagem | Nenhuma (foco no quiz) | ✅ |
| Pronúncia de "FPS" | Transcrição ElevenLabs Scribe confirmou "Use FPS trinta ou mais, e lembre de reaplicar!" | ✅ |
| Textos cortados / área segura | Inspeção visual dos quadros: tudo dentro de x 80–1000 e y 210–1540 | ✅ |
| Ortografia e acentos | VOCÊ, VERÃO, PROTEÇÃO, CHAPÉU, ÁGUA, ÓCULOS, FARMÁCIA, PREÇO conferidos | ✅ |
| Logo | Arquivo oficial enviado pelo cliente (150×150 px) | ✅ (baixa resolução) |

## Correções feitas durante a revisão
1. Um véu branco (flash da revelação) aparecia por engano em toda a cena da pergunta → corrigido.
2. O sol cobria o título na abertura → sol reduzido e reposicionado.
3. O cronômetro encostava na pergunta → layout reorganizado.
4. Volume final estava baixo (−17 LUFS) e depois distorcia → voz nivelada, pico em −0,8 dB.
5. Capa: raios do sol tocavam o "Ê" → sol reduzido.

## Não verificado automaticamente
- Audição humana da mixagem (feita por medição técnica, não por ouvido).
- Exibição real no app do Instagram (recomendado subir como rascunho e conferir).
