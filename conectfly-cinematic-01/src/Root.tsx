import React from 'react';
import {Composition, Still} from 'remotion';
import {Main} from './compositions/Main';
import {Thumbnail} from './compositions/Thumbnail';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="ConectflyEp01" component={Main} durationInFrames={900} fps={30} width={1080} height={1920} defaultProps={{withAudio: true}} />
    <Still id="Thumbnail" component={Thumbnail} width={1080} height={1920} />
  </>
);
