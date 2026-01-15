// app/index.js
import React, { useEffect } from "react";
import { View, ImageBackground, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Image } from "expo-image";

export default function Index() {
  useEffect(() => {
    const t = setTimeout(() => {
router.push("/(tabs)/home");
    }, 2000); 

    return () => clearTimeout(t);
  }, []);

  return (
    <View style={styles.container}>
      <Image
        source={require("../assets/splash.png")}
        style={styles.bg}
        contentFit="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  bg: { flex: 1, width: "100%", height: "100%" },
});
