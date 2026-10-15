import { useAssets } from 'expo-asset';
import { useCallback, useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';

import type { ClientMessage, ServerMessage } from '../../../../core/src/messages';
import { colors } from '../theme/theme';
import { OFFICE_ENVELOPE, useOfficeDriver } from './useOfficeDriver';

/** Web: the same office HTML in an iframe, talking via postMessage. */
export function OfficeView() {
  const [assets] = useAssets([require('../../assets/office/office.html')]);
  const frame = useRef<HTMLIFrameElement | null>(null);
  const post = useCallback((msgs: ServerMessage[]) => {
    const win = frame.current?.contentWindow;
    if (!win) return;
    for (const message of msgs) win.postMessage({ [OFFICE_ENVELOPE]: 1, message }, '*');
  }, []);
  const { onOfficeMessage, onReload } = useOfficeDriver(post);

  useEffect(() => {
    const listener = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      const env = e.data as { [OFFICE_ENVELOPE]?: 1; message?: ClientMessage };
      if (env && env[OFFICE_ENVELOPE] === 1 && env.message) onOfficeMessage(env.message);
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [onOfficeMessage]);

  const src = assets?.[0]?.uri;
  if (!src) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.bgDeep,
        }}
      >
        <ActivityIndicator color={colors.orange} />
      </View>
    );
  }
  return (
    <iframe
      ref={frame}
      src={src}
      title="Escritório PIXEL AGENCY"
      // A reloaded frame re-sends webviewReady; reset the diff state first.
      onLoad={onReload}
      style={{
        border: 0,
        width: '100%',
        height: '100%',
        display: 'block',
        background: colors.bgDeep,
      }}
      sandbox="allow-scripts allow-same-origin"
    />
  );
}
