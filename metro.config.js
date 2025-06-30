const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

/**
 * Metro configuration for TypeScript support
 * https://reactnative.dev/docs/metro
 */
const config = {
  resolver: {
    sourceExts: ['ts', 'tsx', 'js', 'jsx', 'json', 'cjs'],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);