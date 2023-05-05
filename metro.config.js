/**
 * Metro configuration for React Native
 * https://github.com/facebook/react-native
 *
 * @format
 */

module.exports = {
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
  resolver: {
    // for did-jwt error on index.cjs "Error: While trying to resolve module ... Indeed, none of these files exist"
    sourceExts: ['cjs', 'js', 'json', 'jsx', 'ts', 'tsx'],
  },
};
