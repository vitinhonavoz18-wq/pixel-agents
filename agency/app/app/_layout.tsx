import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useAgency } from '../src/state/store';
import { ProjectThemeProvider } from '../src/theme/ProjectThemeProvider';
import { colors, fonts } from '../src/theme/theme';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    [fonts.pixel]: require('../assets/fonts/FSPixelSansUnicode-Regular.ttf'),
  });
  const hydrated = useAgency((s) => s.hydrated);
  const hydrate = useAgency((s) => s.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const ready = fontsLoaded && hydrated;
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);
  if (!ready) return null;

  return (
    <GestureHandlerRootView style={s.root}>
      <SafeAreaProvider>
        <ProjectThemeProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.panel },
              headerTintColor: colors.text,
              headerTitleStyle: { fontFamily: fonts.pixel },
              contentStyle: { backgroundColor: colors.bg },
              animation: 'fade',
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="chat/[agentId]" options={{ title: 'Chat' }} />
            <Stack.Screen name="mission/[id]" options={{ title: 'Missão' }} />
            <Stack.Screen
              name="mission/new"
              options={{ title: 'Nova missão', presentation: 'modal' }}
            />
            <Stack.Screen name="project/[id]" options={{ title: 'Projeto' }} />
            <Stack.Screen name="agent/[id]" options={{ title: 'Agente' }} />
            <Stack.Screen name="usage" options={{ title: 'Uso Claude' }} />
            <Stack.Screen name="approvals" options={{ title: 'Aprovações' }} />
          </Stack>
        </ProjectThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const s = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.bg } });
