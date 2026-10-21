const noopSubscription = { remove: jest.fn() };

module.exports = {
  AndroidImportance: { HIGH: 4 },
  addNotificationReceivedListener: jest.fn(() => noopSubscription),
  addNotificationResponseReceivedListener: jest.fn(() => noopSubscription),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: "ExpoPushToken[test-device]" })),
  getLastNotificationResponseAsync: jest.fn(async () => null),
  getPermissionsAsync: jest.fn(async () => ({ granted: false, status: "undetermined" })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: false, status: "denied" })),
  setNotificationChannelAsync: jest.fn(async () => undefined),
  setNotificationHandler: jest.fn(),
};
