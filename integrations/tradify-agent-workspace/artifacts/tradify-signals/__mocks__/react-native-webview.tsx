import React, { forwardRef, useImperativeHandle } from "react";
import { View } from "react-native";

export const WebView = forwardRef((props: Record<string, unknown>, ref) => {
  useImperativeHandle(ref, () => ({
    postMessage: jest.fn(),
  }));
  return <View {...props} />;
});

WebView.displayName = "WebView";
