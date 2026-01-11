// app/index.js
import React, { useEffect } from "react";
import { View, ImageBackground, StyleSheet } from "react-native";
import { router } from "expo-router";

export default function Index() {
  useEffect(() => {
    const t = setTimeout(() => {
      router.replace("/(tabs)/home");
    }, 2000); 

    return () => clearTimeout(t);
  }, []);

  return (
    <View style={styles.container}>
      <ImageBackground
        source={require("../assets/splash.png")}
        style={styles.bg}
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  bg: { flex: 1, width: "100%", height: "100%" },
});
