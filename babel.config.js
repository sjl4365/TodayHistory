// babel.config.js
module.exports = function (api) {
  api.cache(true);

  // 동적으로 worklets/babel 유무 확인
  let workletsPlugin = [];
  try {
    workletsPlugin = [require.resolve('react-native-worklets/babel')];
  } catch (e) {
    console.warn(
      '[babel] react-native-worklets/babel not found; skipping plugin'
    );
  }

  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ...workletsPlugin, // 있으면 먼저
      [
        'module:react-native-dotenv',
        {
          moduleName: '@env',
          path: '.env',
        },
      ],
      'react-native-reanimated/plugin', // 항상 마지막
    ],
  };
};
