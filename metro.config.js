const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

/**
 * Metro configuration for TypeScript support and bundle optimization
 * https://reactnative.dev/docs/metro
 */
const config = {
  resolver: {
    sourceExts: ['ts', 'tsx', 'js', 'jsx', 'json', 'cjs'],
  },
  transformer: {
    minifierConfig: {
      // Enable aggressive minification for smaller bundles
      mangle: {
        keep_fnames: true, // Keep function names for better debugging
      },
      output: {
        comments: false, // Remove comments from bundle
        ascii_only: true, // Ensure ASCII-only output
      },
      compress: {
        drop_console: true, // Remove console.log statements in production
        drop_debugger: true, // Remove debugger statements
        pure_funcs: ['console.log', 'console.info', 'console.debug'], // Remove specific console methods
      },
    },
  },
  // Bundle optimization handled by bundleCommand and minifierConfig
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);