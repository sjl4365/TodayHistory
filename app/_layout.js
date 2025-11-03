// Root layout
import { Stack } from 'expo-router';
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Platform, LogBox } from "react-native";

export default function RootLayout() {

  useEffect(() => {
    if (__DEV__) {
      LogBox.ignoreLogs([
        'Amplitude Logger [Error]: Request missing required field',
        'Amplitude Logger [Warn]:',
        "Cannot set property 'cookie' of undefined",
      ]);
    }
  }, []);

  // ANDROID 전용: 앱 시작 시 네비게이션 바 스타일 적용
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    (async () => {
      try {
        const NavigationBar = await import('expo-navigation-bar');
        await NavigationBar.setBackgroundColorAsync('transparent');
        await NavigationBar.setButtonStyleAsync('dark');
        await NavigationBar.setVisibilityAsync('visible');
      } catch {
        // noop
      }
    })();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" translucent={false} backgroundColor="transparent" />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </SafeAreaProvider>
  );
}
