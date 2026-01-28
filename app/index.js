import { useEffect, useRef } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { preloadAppOnce } from "../lib/preloadApp";

const MIN_MS = 2000;

export default function Index() {
  const start = useRef(Date.now());

  useEffect(() => {
    (async () => {
      await SplashScreen.hideAsync();

      // ✅ 로고 화면에서 미리 로딩
      await preloadAppOnce();

      // 최소 2초 보장
      const elapsed = Date.now() - start.current;
      if (elapsed < MIN_MS) {
        await new Promise(r => setTimeout(r, MIN_MS - elapsed));
      }

      requestAnimationFrame(() => {
        router.replace("/(tabs)/home");
      });
    })();
  }, []);

  return (
    <View style={styles.container}>
      <Image source={require("../assets/splash.png")} style={styles.bg} />
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  bg: { flex: 1 },
  loading: {
    position: "absolute",
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: "center",
  },
});
