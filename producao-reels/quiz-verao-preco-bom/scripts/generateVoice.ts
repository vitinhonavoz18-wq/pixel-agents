/**
 * Gera as locuções pela API oficial do ElevenLabs (uma por cena).
 *
 * Nesta produção as falas foram geradas pela integração ElevenLabs conectada
 * à sessão (mesma voz e mesmo modelo abaixo). Este script permite refazer
 * tudo localmente com a sua chave:
 *
 *   ELEVENLABS_API_KEY=... npx tsx scripts/generateVoice.ts
 *   bash scripts/processVoice.sh
 *
 * A chave é lida só do ambiente e nunca é impressa nem salva.
 */
import { mkdirSync, writeFileSync } from 'node:fs';

const KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID ?? '7ete3BaGPf3vlbnyJnJK'; // "Fernando Nowvaro" — masculina, jovem, pt-BR
const MODEL = 'eleven_multilingual_v2';

export const LINES: Record<string, string> = {
  '01-gancho': 'Salvador, atenção!',
  '02-pergunta': 'Qual dessas opções protege melhor no sol?',
  '04-revelacao': 'É a letra B! Sombra, chapéu e protetor solar!',
  '05-dica': 'Use FPS trinta ou mais, e lembre de reaplicar!',
  '06-cta': 'Acertou? Comenta aí!',
};

async function main() {
  if (!KEY) {
    console.error('ELEVENLABS_API_KEY não definida. Nada foi gerado.');
    process.exit(1);
  }
  mkdirSync('public/audio/raw', { recursive: true });
  for (const [name, text] of Object.entries(LINES)) {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({
        text,
        model_id: MODEL,
        language_code: 'pt',
        voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true },
      }),
    });
    if (!res.ok) throw new Error(`${name}: HTTP ${res.status} ${await res.text()}`);
    writeFileSync(`public/audio/raw/${name}.mp3`, Buffer.from(await res.arrayBuffer()));
    console.log(`ok ${name}`);
  }
}

main().catch((e) => {
  console.error(String(e).replace(KEY ?? '__none__', '***'));
  process.exit(1);
});
