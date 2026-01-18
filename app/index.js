// app/index.js
import React, { useCallback, useEffect, useRef } from "react";
import { View, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import * as SplashScreen from "expo-splash-screen";

const MIN_JS_SPLASH_MS = 2000;

export default function Index() {
  const startRef = useRef(Date.now());
  const doneRef = useRef(false);
  const loadedRef = useRef(false);

  const finishOnce = useCallback(async () => {
    if (doneRef.current) return;
    if (!loadedRef.current) return;

    const elapsed = Date.now() - startRef.current;
    const remain = Math.max(0, MIN_JS_SPLASH_MS - elapsed);

    doneRef.current = true;

    setTimeout(() => {
      // ✅ 전환 프레임 2번 확보 (겹침/툭 줄어듦)
      requestAnimationFrame(() => {
        requestAnimationFrame(async () => {
          try {
            await SplashScreen.hideAsync();
          } catch {}
          router.replace("/(tabs)/home");
        });
      });
    }, remain);
  }, []);

  // ✅ 안전장치: 이미지 로드 이벤트가 안 와도 일정 시간 뒤엔 진행
  useEffect(() => {
    const t = setTimeout(() => {
      loadedRef.current = true;
      finishOnce();
    }, MIN_JS_SPLASH_MS + 800);
    return () => clearTimeout(t);
  }, [finishOnce]);

  return (
    <View style={styles.container}>
      <Image
        source={require("../assets/splash.png")}
        style={styles.bg}
        contentFit="cover"
        cachePolicy="memory-disk"
        onLoad={() => {
          loadedRef.current = true;
          finishOnce();
        }}
        onError={() => {
          loadedRef.current = true;
          finishOnce();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  bg: { flex: 1, width: "100%", height: "100%" },
});
