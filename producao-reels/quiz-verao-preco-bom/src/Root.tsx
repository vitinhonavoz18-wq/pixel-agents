import React from 'react';
import { Composition, Still } from 'remotion';
import { CapaReels, QuizVerao } from './compositions/QuizVerao';
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from './config/timing';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="QuizVerao" component={QuizVerao} durationInFrames={DURATION_IN_FRAMES} fps={FPS} width={WIDTH} height={HEIGHT} />
    <Still id="CapaReels" component={CapaReels} width={WIDTH} height={HEIGHT} />
  </>
);
