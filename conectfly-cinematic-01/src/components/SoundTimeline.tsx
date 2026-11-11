import React from 'react';
import {Audio, staticFile} from 'remotion';

/**
 * Trilha sonora final já mixada (voz + música com ducking + efeitos), gerada por
 * `npm run audio` a partir de src/timeline/timeline.json — a mesma timeline das cenas,
 * o que garante sincronia exata com os frames.
 */
export const SoundTimeline: React.FC = () => <Audio src={staticFile('mix.wav')} />;
