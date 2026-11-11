import React from 'react';
import {AbsoluteFill} from 'remotion';
import {InfinityMark} from '../components/ConectflyLogo';
import {OfficeSet} from '../components/OfficeSet';
import {FilmGrain, Haze, Vignette} from '../components/PostFX';
import {loadFonts} from '../styles/fonts';
import {C, FONT_BRAND} from '../styles/theme';

loadFonts();

/** Capa do Reels: escritório vazio às 02:47 + celular aceso + promessa. */
export const Thumbnail: React.FC = () => (
  <AbsoluteFill>
    <OfficeSet t={2} dawn={0} zoom={1.12} focus={[540, 1400]} phoneLit={1} clock="02:47" notifText="Oi, vocês atendem agora?" />
    <Haze opacity={0.12} y={62} />
    <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(2,3,9,0.75) 0%, rgba(2,3,9,0) 38%)'}} />
    <div style={{position: 'absolute', top: 250, width: '100%', textAlign: 'center'}}>
      <div style={{fontFamily: FONT_BRAND, fontWeight: 500, fontSize: 26, letterSpacing: 9, color: C.muted}}>CONECTFLY ORIGINALS · EP. 01</div>
      <div style={{fontFamily: FONT_BRAND, fontWeight: 700, fontSize: 92, lineHeight: 1.05, color: '#fff', marginTop: 26, textShadow: '0 8px 40px rgba(0,0,0,0.9)'}}>
        Contratei um
        <br />
        funcionário que
        <br />
        trabalha <span style={{color: C.cyan, textShadow: '0 0 40px rgba(50,230,255,0.6)'}}>24 horas</span>
      </div>
      <div style={{fontFamily: FONT_BRAND, fontWeight: 600, fontSize: 44, letterSpacing: 6, color: C.cyan, marginTop: 34}}>…E ELE NÃO É HUMANO</div>
    </div>
    <div style={{position: 'absolute', top: 1080, width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16}}>
      <InfinityMark width={84} id="thumb" />
      <span style={{fontFamily: FONT_BRAND, fontWeight: 600, fontSize: 40, color: '#fff'}}>ConectFly</span>
    </div>
    <Vignette strength={0.7} />
    <FilmGrain />
  </AbsoluteFill>
);
