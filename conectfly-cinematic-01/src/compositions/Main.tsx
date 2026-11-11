import React from 'react';
import {AbsoluteFill} from 'remotion';
import {DramaTag} from '../components/Chat';
import {FilmGrain, LightSweep, Vignette} from '../components/PostFX';
import {SoundTimeline} from '../components/SoundTimeline';
import {SubtitleRenderer} from '../components/SubtitleRenderer';
import {AnimatedConversation} from '../scenes/AnimatedConversation';
import {BrandFinale} from '../scenes/BrandFinale';
import {CinematicOpening} from '../scenes/CinematicOpening';
import {DashboardReveal} from '../scenes/DashboardReveal';
import {SpecialistShot} from '../scenes/HumanHandoff';
import {IntentRecognition} from '../scenes/IntentRecognition';
import {loadFonts} from '../styles/fonts';
import {lin, useTime, windowFade} from '../timeline/time';

loadFonts();

// Janelas das cenas (s). Sobreposição intencional = transições sem frame preto.
const SCENES: [number, number, React.FC<{t: number}>, number?, number?][] = [
  [0, 4.2, CinematicOpening, 0.001, 0.25],
  [3.95, 9.25, IntentRecognition, 0.25, 0.3],
  [8.95, 19.55, AnimatedConversation, 0.3, 0.3],
  [19.2, 21.25, SpecialistShot, 0.3, 0.35],
  [20.9, 26.1, DashboardReveal, 0.35, 0.1],
  [25.9, 30.01, BrandFinale, 0.15, 0.001],
];

export const Main: React.FC<{withAudio?: boolean}> = ({withAudio = true}) => {
  const t = useTime();
  const dramaTag = Math.min(lin(t, 4.3, 4.8), 1 - lin(t, 25.3, 25.7));
  const subY = t >= 26 ? 1222 : 1430;
  return (
    <AbsoluteFill style={{background: '#020309'}}>
      {SCENES.map(([a, b, Scene, fin, fout], i) =>
        t >= a && t < b ? (
          <AbsoluteFill key={i} style={{opacity: windowFade(t, a, b, fin, fout)}}>
            <Scene t={t} />
          </AbsoluteFill>
        ) : null,
      )}
      {/* transições motivadas por luz */}
      <LightSweep p={lin(t, 8.75, 9.35)} />
      <LightSweep p={lin(t, 15.7, 16.2)} angle={-24} width={200} />
      <LightSweep p={lin(t, 19.05, 19.6)} color="255,190,130" />
      <LightSweep p={lin(t, 20.75, 21.35)} color="255,200,150" angle={-30} />
      <Vignette strength={t >= 26 ? 0.55 : 0.72} />
      <DramaTag opacity={dramaTag} />
      <SubtitleRenderer t={t} y={subY} />
      <FilmGrain />
      {withAudio && <SoundTimeline />}
    </AbsoluteFill>
  );
};
