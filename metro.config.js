const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Web-specific module resolution
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Redirect react-native-maps to an empty module on web
  if (platform === 'web' && moduleName === 'react-native-maps') {
    return {
      filePath: require.resolve('./components/map/maps-web-stub.js'),
      type: 'sourceFile',
    };
  }

  // Default resolution
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
