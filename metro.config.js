const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

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
      // Conservative minification to preserve module structure
      mangle: {
        keep_fnames: true, // Keep function names for better debugging
        keep_classnames: true, // Keep class names to preserve module structure
      },
      output: {
        comments: false, // Remove comments from bundle
        ascii_only: true, // Ensure ASCII-only output
      },
      compress: {
        drop_console: false, // Keep console.log statements to preserve module structure
        drop_debugger: true, // Remove debugger statements
        dead_code: false, // Disable dead code elimination that's breaking modules
        unused: false, // Don't remove "unused" code that may be dynamically imported
      },
    },
  },
  // Bundle optimization handled by bundleCommand and minifierConfig
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
