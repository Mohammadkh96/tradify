# Native push setup

Tradify Signals registers native installations with Expo Push Notifications. Provider acceptance and provider receipts are recorded separately; neither is presented as proof that a person saw a notification on their device.

## Owner setup required

1. Link the Expo project to its existing Expo/EAS project and set its real project ID at `expo.extra.eas.projectId` in `app.json`. Do not use a placeholder project ID.
2. Configure Android FCM v1 credentials and iOS APNs credentials in the Expo project.
3. Build and install a native development or production build that includes `expo-notifications`. Expo Go is not a valid remote-push delivery test for this SDK.
4. Sign in to a Pro-or-higher account, enable at least one signal event preference, grant operating-system notification permission, and opt this installation in from the Alerts screen.
5. Test delivery on a real Android device and verify the alert links to the related signal. Repeat on iOS if that platform is being released.

The API server accepts `EXPO_ACCESS_TOKEN` as an optional Replit secret for projects that enable Expo Push Security. Without it, the Expo Push endpoint is used without bearer authentication. Never place the token in app configuration or client code.

Real Android delivery is not verified by the Replit web/Expo preview or automated tests. It remains pending until the owner supplies the Expo project and provider credentials and tests a signed native build on a physical device.
