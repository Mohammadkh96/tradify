module.exports = {
  preset: "jest-expo",
  testMatch: ["<rootDir>/__tests__/**/*.test.ts?(x)"],
  testTimeout: 15_000,
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^expo-notifications$": "<rootDir>/__mocks__/expo-notifications.js",
    "^react-native-reanimated$": "<rootDir>/__mocks__/react-native-reanimated.js",
    "^react-native-webview$": "<rootDir>/__mocks__/react-native-webview.tsx",
  },
};
