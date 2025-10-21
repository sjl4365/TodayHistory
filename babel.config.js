// babel.config.js
module.exports = function (api) {
  api.cache(true);

  // 동적으로 worklets/babel 유무 확인
  let workletsPlugin = [];
  try {
    // 존재하면 플러그인 경로를 push
    workletsPlugin = [require.resolve('react-native-worklets/babel')];
  } catch (e) {
    // 없으면 건너뜀 (필요시 콘솔로 힌트)
    console.warn('[babel] react-native-worklets/babel not found; skipping plugin');
  }

  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ...workletsPlugin,                   // ← (있으면) 먼저
      require.resolve('expo-router/babel'),
      ['module:react-native-dotenv', {   
        moduleName: '@env',
        path: '.env',
      }],
      'react-native-reanimated/plugin',    // ← 항상 마지막
    ],
  };
};
