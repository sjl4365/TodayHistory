// app/index.js
import React, { useCallback, useEffect, useRef } from "react";
import { View, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";
import * as SplashScreen from "expo-splash-screen";

export default function Index() {
  const doneRef = useRef(false);

  const finish = useCallback(async () => {
    if (doneRef.current) return;
    doneRef.current = true;

    requestAnimationFrame(async () => {
      try {
        await SplashScreen.hideAsync();
      } catch {}
      router.replace("/(tabs)/home");
    });
  }, []);

  // ✅ 혹시 onLoad가 안 오는 케이스 대비 (안전장치)
  useEffect(() => {
    const t = setTimeout(() => {
      finish();
    }, 1500);
    return () => clearTimeout(t);
  }, [finish]);

  return (
    <View style={styles.container}>
      <Image
        source={require("../assets/splash.png")}
        style={styles.bg}
        contentFit="cover"
        cachePolicy="memory-disk"
        onLoad={finish}     // ✅ 성공적으로 그려지면 즉시 finish
        onError={finish}    // ✅ 에러 나도 멈추지 않게
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  bg: { flex: 1, width: "100%", height: "100%" },
});
