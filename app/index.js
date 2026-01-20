// app/index.js
import React, { useCallback, useEffect, useRef } from "react";
import { View, StyleSheet, Animated } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import * as SplashScreen from "expo-splash-screen";

const MIN_JS_SPLASH_MS = 2000;
const FADE_OUT_MS = 260; // 부드럽게 (200~300 추천)

export default function Index() {
  const revealedRef = useRef(false);
  const shownAtRef = useRef(0);
  const doneRef = useRef(false);

  const opacity = useRef(new Animated.Value(1)).current;

  const revealJsSplashOnce = useCallback(async () => {
    if (revealedRef.current) return;
    revealedRef.current = true;

    shownAtRef.current = Date.now();

    try {
      await SplashScreen.hideAsync();
    } catch {}
  }, []);

  const goHomeSmoothOnce = useCallback(() => {
    if (doneRef.current) return;
    if (!revealedRef.current) return;

    const elapsed = Date.now() - shownAtRef.current;
    const remain = Math.max(0, MIN_JS_SPLASH_MS - elapsed);

    doneRef.current = true;

    setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: FADE_OUT_MS,
        useNativeDriver: true,
      }).start(() => {
        router.replace("/(tabs)/home");
      });
    }, remain);
  }, [opacity]);

  useEffect(() => {
    const t = setTimeout(async () => {
      await revealJsSplashOnce();
      goHomeSmoothOnce();
    }, 1200);
    return () => clearTimeout(t);
  }, [revealJsSplashOnce, goHomeSmoothOnce]);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.container, { opacity }]}>
        <Image
          source={require("../assets/splash.png")}
          style={styles.bg}
          contentFit="cover"
          cachePolicy="memory-disk"
          onLoad={async () => {
            await revealJsSplashOnce();
            goHomeSmoothOnce();
          }}
          onError={async () => {
            await revealJsSplashOnce();
            goHomeSmoothOnce();
          }}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  bg: { flex: 1, width: "100%", height: "100%" },
});
