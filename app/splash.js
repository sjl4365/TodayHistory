// app/splash.js
import React, { useEffect } from "react";
import { View, ImageBackground, StyleSheet } from "react-native";
import { useRouter } from "expo-router";

export default function SplashScreen() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace("(tabs)");
    }, 1500); // 1.5초 후 탭 화면으로
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <View style={styles.container}>
      <ImageBackground
        source={require("../assets/splash.png")}
        style={styles.bg}
        resizeMode="cover" // 전체화면 채우기
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,                 // 화면 전체
    backgroundColor: "#000", // 로딩 중 깜빡임 방지용
  },
  bg: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
});
