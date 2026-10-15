import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * PIXEL AGENCY — Expo config. No secrets here: the backend URL and the API
 * token are entered by the user in Config and kept in the device keystore
 * (expo-secure-store). EXPO_PUBLIC_AGENCY_URL only pre-fills the URL field.
 */
const base: ExpoConfig = {
  name: 'PIXEL AGENCY',
  slug: 'pixel-agency',
  scheme: 'pixelagency',
  version: '0.1.0',
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

/**
 * The EAS project id is not secret but is account-specific: it comes from
 * EAS_PROJECT_ID or from an app.json written by CI (`extra.eas.projectId`).
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const projectId =
    process.env.EAS_PROJECT_ID ??
    (config.extra?.eas as { projectId?: string } | undefined)?.projectId;
  return {
    ...base,
    extra: {
      defaultAgencyUrl: process.env.EXPO_PUBLIC_AGENCY_URL ?? '',
      ...(projectId ? { eas: { projectId } } : {}),
    },
  };
};
