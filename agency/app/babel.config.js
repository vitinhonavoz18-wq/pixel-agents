module.exports = function (api) {
  api.cache(true);
  // babel-preset-expo wires the Reanimated/Worklets plugin automatically.
  return { presets: ['babel-preset-expo'] };
};
