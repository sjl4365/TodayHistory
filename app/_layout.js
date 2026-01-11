// app/_layout.js
import * as SplashScreen from "expo-splash-screen";
SplashScreen.preventAutoHideAsync();

import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Platform, LogBox } from "react-native";

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
    let mounted = true;

    (async () => {
      try {
        // 필요하면 아주 짧게만 (0~100ms 정도) 두고, 길게는 index에서 처리
        // await new Promise((r) => setTimeout(r, 50));
      } finally {
        if (mounted) {
          await SplashScreen.hideAsync();
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    (async () => {
      try {
        const NavigationBar = await import("expo-navigation-bar");
        await NavigationBar.setBackgroundColorAsync("transparent");
        await NavigationBar.setButtonStyleAsync("dark");
        await NavigationBar.setVisibilityAsync("visible");
      } catch {
        // noop
      }
    })();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" translucent backgroundColor="transparent" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </SafeAreaProvider>
  );
}
