// Todos os textos do vídeo ficam aqui — para criar outro quiz, edite só este arquivo.

export type Option = { letter: 'A' | 'B' | 'C'; text: string };

export const QUIZ = {
  hookLines: ['VOCÊ', 'SOBREVIVERIA', 'AO VERÃO DE', 'SALVADOR?'],
  chip: 'QUIZ DO VERÃO',
  questionLines: ['QUAL É A MELHOR PROTEÇÃO', 'NO SOL FORTE?'],
  options: [
    { letter: 'A', text: 'Só protetor pela manhã' },
    { letter: 'B', text: 'Sombra + chapéu + FPS 30+' },
    { letter: 'C', text: 'Só água e óculos' },
  ] as Option[],
  correct: 'B' as Option['letter'],
  countdownBanner: 'VOCÊ TEM 5 SEGUNDOS!',
  revealText: 'RESPOSTA CORRETA: B!',
  tipTitle: ['FPS 30', 'OU MAIS'],
  tipSub: 'Reaplique conforme as instruções do produto.',
  tipIcons: ['Sombra', 'Chapéu', 'Protetor'],
  ctaTitle: 'ACERTOU?',
  ctaSub: 'COMENTA A, B OU C!',
  commentUser: 'você',
  commentText: 'É a B! Sombra, chapéu e FPS 30+',
  brandName: 'Farmácia Preço Bom',
  brandCity: 'Salvador · BA',
};

// Legendas: cada bloco tem início/fim em frames ABSOLUTOS do vídeo.
// Palavras entre *asteriscos* ganham destaque amarelo.
// Tempos derivados da duração real das falas (e, na cena 5, dos tempos
// por palavra da transcrição ElevenLabs Scribe, divididos pelo ajuste 1,12x).
export type CaptionBlock = { from: number; to: number; text: string };

export const CAPTIONS: CaptionBlock[] = [
  { from: 1, to: 50, text: '*SALVADOR*, ATENÇÃO!' },
  { from: 53, to: 85, text: 'QUAL DESSAS OPÇÕES' },
  { from: 85, to: 116, text: 'PROTEGE *MELHOR* NO SOL?' },
  // contagem regressiva: sem legenda, de propósito (foco no quiz)
  { from: 268, to: 303, text: 'É A LETRA *B*!' },
  { from: 303, to: 339, text: '*SOMBRA*, *CHAPÉU* E' },
  { from: 339, to: 374, text: '*PROTETOR SOLAR*!' },
  { from: 375, to: 412, text: 'USE *FPS 30*' },
  { from: 412, to: 430, text: 'OU MAIS,' },
  { from: 430, to: 478, text: 'E LEMBRE DE *REAPLICAR*!' },
  { from: 480, to: 506, text: '*ACERTOU?*' },
  { from: 506, to: 539, text: 'COMENTA AÍ!' },
];
