import { useAssets } from 'expo-asset';
import { useCallback, useRef } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import type { ClientMessage, ServerMessage } from '../../../../core/src/messages';
import { Txt } from '../components/ui';
import { colors } from '../theme/theme';
import { OFFICE_ENVELOPE, useOfficeDriver } from './useOfficeDriver';

/**
 * Android/iOS: the Pixel Agents office (bundled offline as one HTML asset)
 * inside react-native-webview. Messages go in via `injectJavaScript` →
 * `window.__pixelAgencyDeliver`, and come back via `ReactNativeWebView.postMessage`.
 */
export function OfficeView() {
  const [assets, error] = useAssets([require('../../assets/office/office.html')]);
  const ref = useRef<WebView>(null);
  const post = useCallback((msgs: ServerMessage[]) => {
    const js = msgs
      .map(
        (m) => `window.__pixelAgencyDeliver && window.__pixelAgencyDeliver(${JSON.stringify(m)});`,
      )
      .join('\n');
    ref.current?.injectJavaScript(`${js}\ntrue;`);
  }, []);
  const { onOfficeMessage, onReload } = useOfficeDriver(post);

  const onMessage = useCallback(
    (e: WebViewMessageEvent) => {
      try {
        const env = JSON.parse(e.nativeEvent.data) as {
          [OFFICE_ENVELOPE]?: 1;
          message?: ClientMessage;
        };
        if (env[OFFICE_ENVELOPE] === 1 && env.message) onOfficeMessage(env.message);
      } catch {
        // not ours
      }
    },
    [onOfficeMessage],
  );

  const uri = assets?.[0]?.localUri ?? assets?.[0]?.uri;
  if (error) return <Txt muted>Falha ao carregar o escritório: {String(error.message)}</Txt>;
  if (!uri) {
    return (
      <View style={s.loading}>
        <ActivityIndicator color={colors.orange} />
      </View>
    );
  }
  return (
    <WebView
      ref={ref}
      source={{ uri }}
      originWhitelist={['*']}
      allowFileAccess
      allowFileAccessFromFileURLs
      allowingReadAccessToURL={uri}
      javaScriptEnabled
      domStorageEnabled
      onMessage={onMessage}
      onLoadStart={onReload}
      setSupportMultipleWindows={false}
      overScrollMode="never"
      bounces={false}
      style={s.web}
      containerStyle={s.web}
      // The office handles its own pinch/drag; the page must not zoom.
      scalesPageToFit={false}
      textZoom={100}
    />
  );
}

const s = StyleSheet.create({
  web: { flex: 1, backgroundColor: colors.bgDeep },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgDeep,
  },
});
