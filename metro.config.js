// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);

config.transformer.getTransformOptions = async () => ({
  transform: { experimentalImportSupport: false, inlineRequires: true },
});

config.symbolicator = {
  customizeFrame: (frame) => {
    const f = frame.file || '';
    const collapse =
      f.includes('InternalBytecode.js') ||
      f.includes('native') ||
      f.includes('[native code]');
    return { ...frame, collapse };
  },
};

module.exports = config;
