module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    // Reanimated 4: el plugin de worklets va SIEMPRE al final.
    plugins: ['react-native-worklets/plugin'],
  };
};
