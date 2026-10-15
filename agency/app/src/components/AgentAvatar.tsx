import { Image, Platform, View } from 'react-native';

import { colors } from '../theme/theme';

const SHEETS = [
  require('../../assets/characters/char_0.png'),
  require('../../assets/characters/char_1.png'),
  require('../../assets/characters/char_2.png'),
  require('../../assets/characters/char_3.png'),
  require('../../assets/characters/char_4.png'),
  require('../../assets/characters/char_5.png'),
];
const SHEET_W = 112;
const SHEET_H = 96;
const FRAME_W = 16;
const FRAME_H = 32;

/** The agent's own office sprite (front-facing frame), pixel-scaled. */
export function AgentAvatar({
  palette,
  size = 48,
  framed = true,
}: {
  palette: number;
  size?: number;
  framed?: boolean;
}) {
  const scale = Math.max(1, Math.floor(size / FRAME_H)) || 1;
  const w = FRAME_W * scale;
  const h = FRAME_H * scale;
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'flex-end',
          overflow: 'hidden',
        },
        framed && { backgroundColor: colors.panelAlt, borderWidth: 2, borderColor: colors.border },
      ]}
    >
      <View style={{ width: w, height: h, overflow: 'hidden' }}>
        <Image
          source={SHEETS[palette % SHEETS.length]}
          style={[
            { width: SHEET_W * scale, height: SHEET_H * scale },
            Platform.OS === 'web' ? ({ imageRendering: 'pixelated' } as object) : null,
          ]}
          resizeMode="stretch"
          accessibilityIgnoresInvertColors
        />
      </View>
    </View>
  );
}
