const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// The pixel office ships as one self-contained HTML asset (built from the
// Pixel Agents webview by `npm run office:build` in agency/).
config.resolver.assetExts = [...config.resolver.assetExts, 'html'];

module.exports = config;
