// app/_layout.js
import * as SplashScreen from "expo-splash-screen";
SplashScreen.preventAutoHideAsync();

import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Platform, LogBox } from "react-native";
import CapsuleToastProvider from "../components/CapsuleToastProvider";

export default function RootLayout() {
  useEffect(() => {
    if (__DEV__) {
      LogBox.ignoreLogs([
        "Amplitude Logger [Error]: Request missing required field",
        "Amplitude Logger [Warn]:",
        "Cannot set property 'cookie' of undefined",
      ]);
    }
  }, []);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    (async () => {
      try {
        const NavigationBar = await import("expo-navigation-bar");
        await NavigationBar.setBackgroundColorAsync("transparent");
        await NavigationBar.setButtonStyleAsync("dark");
        await NavigationBar.setVisibilityAsync("hidden");
      } catch {
        // noop
      }
    })();
  }, []);

  return (
    <SafeAreaProvider>
      <CapsuleToastProvider>
        <StatusBar style="light" translucent backgroundColor="transparent" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" options={{ animation: "none" }} />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </CapsuleToastProvider>
    </SafeAreaProvider>
  );
}
