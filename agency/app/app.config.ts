import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * PIXEL AGENCY — Expo config. No secrets here: the backend URL and the API
 * token are entered by the user in Config and kept in the device keystore
 * (expo-secure-store). EXPO_PUBLIC_AGENCY_URL only pre-fills the URL field.
 */
const base: ExpoConfig = {
  name: 'PIXEL AGENCY',
  slug: 'pixel-agency',
  owner: 'vitinho157s-team',
  scheme: 'pixelagency',
  version: '1.0.0',
  orientation: 'default',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  backgroundColor: '#0f1830',
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.pixelagency.app',
  },
  android: {
    package: 'com.pixelagency.app',
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0f1830',
    },
    // Only what the app uses: network, notifications for approvals/alerts.
    permissions: ['INTERNET', 'POST_NOTIFICATIONS'],
    blockedPermissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.READ_CONTACTS',
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
    ],
  },
  web: {
    bundler: 'metro',
    output: 'single',
    favicon: './assets/favicon.png',
    name: 'PIXEL AGENCY',
    shortName: 'PIXEL AGENCY',
    themeColor: '#0f1830',
    backgroundColor: '#0f1830',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-font',
    [
      'expo-splash-screen',
      {
        image: './assets/splash-logo.png',
        imageWidth: 260,
        resizeMode: 'contain',
        backgroundColor: '#0f1830',
      },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/adaptive-icon.png',
        color: '#f5a623',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission:
          'Selecione imagens oficiais dos seus projetos para as prévias da agência.',
        cameraPermission: false,
        microphonePermission: false,
      },
    ],
  ],
  experiments: {
    typedRoutes: false,
    // Set for sub-path hosting (e.g. GitHub Pages: /pixel-agents).
    ...(process.env.EXPO_BASE_URL ? { baseUrl: process.env.EXPO_BASE_URL } : {}),
  },
};

/** EAS project @vitinho157s-team/pixel-agency (an id, not a secret). */
const EAS_PROJECT_ID = 'd9442883-caaf-47af-8266-440d3d8fc970';

/**
 * EAS_PROJECT_ID or an app.json written by CI (`extra.eas.projectId`) can
 * point a fork at its own EAS project.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const projectId =
    process.env.EAS_PROJECT_ID ??
    (config.extra?.eas as { projectId?: string } | undefined)?.projectId ??
    EAS_PROJECT_ID;
  return {
    ...base,
    extra: {
      defaultAgencyUrl: process.env.EXPO_PUBLIC_AGENCY_URL ?? '',
      eas: { projectId },
    },
  };
};
