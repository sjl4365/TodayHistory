import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { Animated, Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const ToastCtx = createContext(null);

// 사용: const toast = useCapsuleToast(); toast.show("메시지");
export function useCapsuleToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useCapsuleToast must be used within CapsuleToastProvider");
  return ctx;
}

export default function CapsuleToastProvider({ children }) {
  const insets = useSafeAreaInsets();

  const [msg, setMsg] = useState("");
  const [visible, setVisible] = useState(false);

  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-8)).current;

  const timerRef = useRef(null);

  const hide = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: -8, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      setVisible(false);
      setMsg("");
    });
  }, [opacity, translateY]);

  const show = useCallback(
    (text, options = {}) => {
      const duration = options.duration ?? 1400;

      setMsg(text);
      setVisible(true);

      // 기존 타이머/애니 정리
      if (timerRef.current) clearTimeout(timerRef.current);
      opacity.stopAnimation();
      translateY.stopAnimation();

      // show anim
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 160, useNativeDriver: true }),
      ]).start();

      timerRef.current = setTimeout(() => {
        hide();
      }, duration);
    },
    [hide, opacity, translateY]
  );

  const value = useMemo(() => ({ show, hide }), [show, hide]);

  return (
    <ToastCtx.Provider value={value}>
      {children}

      {visible && (
        <View
          pointerEvents="none"
          style={[
            styles.wrap,
            {
              top: (Platform.OS === "android" ? 10 : 6) + insets.top,
            },
          ]}
        >
          <Animated.View
            style={[
              styles.capsule,
              {
                opacity,
                transform: [{ translateY }],
              },
            ]}
          >
            <Text style={styles.text} numberOfLines={2}>
              {msg}
            </Text>
          </Animated.View>
        </View>
      )}
    </ToastCtx.Provider>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 9999,
  },
  capsule: {
    maxWidth: "92%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.78)",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  text: {
    color: "#fff",
    fontSize: 13,
    lineHeight: 18,
  },
});
