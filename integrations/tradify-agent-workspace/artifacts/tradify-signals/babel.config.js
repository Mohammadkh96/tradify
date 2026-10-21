module.exports = function (api) {
  const appBaseUrl = process.env.EXPO_PUBLIC_APP_BASE_URL || process.env.EXPO_BASE_URL || "";
  api.cache.using(() => appBaseUrl);
  return {
    presets: [["babel-preset-expo", { unstable_transformImportMeta: true }]],
    plugins: [
      ({ types }) => ({
        visitor: {
          MemberExpression(path) {
            if (path.matchesPattern("process.env.EXPO_BASE_URL")) {
              path.replaceWith(types.stringLiteral(appBaseUrl));
            }
          },
        },
      }),
    ],
  };
};
