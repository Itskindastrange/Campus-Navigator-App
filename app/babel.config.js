module.exports = function(api) {
    api.cache(true);
    return {
      presets: ['babel-preset-expo'],
      plugins: [
        // Other plugins...
        'react-native-reanimated/plugin', // Add this line! Must be last.
      ],
    };
  };