// app/_layout.js

import * as SplashScreen from "expo-splash-screen";
SplashScreen.preventAutoHideAsync();

import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { Platform, LogBox } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY_INITIALIZED = '@app_initialized_v1';

export default function RootLayout() {
  const initializedRef = useRef(false);

  useEffect(() => {
    if (__DEV__) {
      LogBox.ignoreLogs([
        "Amplitude Logger [Error]: Request missing required field",
        "Amplitude Logger [Warn]:",
        "Cannot set property 'cookie' of undefined",
      ]);
    }
  }, []);

  // 앱 최초 실행 시 기본 데이터 로드
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    (async () => {
      try {
        const initialized = await AsyncStorage.getItem(STORAGE_KEY_INITIALIZED);
        
        if (!initialized) {
          console.log('🎯 [APP] First launch - initializing default data...');
          
          // UI 언어 로드 (없으면 디바이스 언어 사용)
          let uiLang = await AsyncStorage.getItem('@app_language');
          if (!uiLang) {
            // 디바이스 언어 감지
            const Localization = await import('expo-localization');
            const locales = Localization.getLocales?.();
            const deviceLang = locales?.[0]?.languageCode || 'en';
            uiLang = deviceLang === 'ko' ? 'ko' : deviceLang === 'ja' ? 'ja' : 'en';
          }
          
          const tz = Intl?.DateTimeFormat?.().resolvedOptions().timeZone || 'UTC';
          
          // home.js의 초기화 함수 동적 import
          const { initializeDefaultData } = await import('./(tabs)/home');
          await initializeDefaultData(uiLang, tz);
          
          await AsyncStorage.setItem(STORAGE_KEY_INITIALIZED, 'true');
          console.log('✅ [APP] First launch initialization complete');
        } else {
          console.log('ℹ️ [APP] Already initialized, skipping');
        }
      } catch (error) {
        console.error('❌ [APP] Initialization error:', error);
      }
    })();
  }, []);

  // 스플래시 최소 1초 유지
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        await new Promise((r) => setTimeout(r, 1000)); // 1초
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
        <Stack.Screen name="(tabs)" />
      </Stack>
    </SafeAreaProvider>
  );
}