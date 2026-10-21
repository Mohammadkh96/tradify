import React from "react";
import { render, screen } from "@testing-library/react-native";

jest.mock("expo-router", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return {
    Redirect: ({ href }: { href: string }) =>
      React.createElement(Text, { testID: "route-redirect" }, href),
  };
});

describe("mobile Admin route boundary", () => {
  it("sends legacy Admin and lab links to the customer profile", () => {
    const AdminRoute = require("../app/admin").default;
    const LabRoute = require("../app/(tabs)/lab").default;

    const adminRoute = render(<AdminRoute />);
    expect(screen.getByTestId("route-redirect").props.children).toBe("/profile");
    adminRoute.unmount();

    render(<LabRoute />);
    expect(screen.getByTestId("route-redirect").props.children).toBe("/profile");
  });
});
