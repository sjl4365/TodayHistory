// components/CopyToast.js
import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Platform, StyleSheet, View, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * CopyToast
 * props:
 *  - text: 표시할 문자열 (예: "복사", "Copied")
 *  - tick: 숫자 카운터. 값이 바뀔 때마다 토스트가 뜸 (parent에서 setTick(t=>t+1))
 *  - duration: 유지 시간(ms), 기본 1200
 *  - bottomOffset: 추가 하단 여백 (안드 기본 24, iOS 기본 32 + safe area)
 */
export default function CopyToast({
  text = "Copied",
  tick = 0,
  duration = 1200,
  bottomOffset,
}) {
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(8)).current; // 아래서 살짝 올라오는 느낌
  const hideTimerRef = useRef(null);

  const bottom = useMemo(() => {
    const base = bottomOffset ?? (Platform.OS === "ios" ? 32 : 24);
    return base + (insets?.bottom ?? 0);
  }, [bottomOffset, insets?.bottom]);

  useEffect(() => {
    if (!tick) return; // 초기 마운트 시 무시

    // 이전 타이머 제거
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    // 보여주기
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 160,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(translate, {
        toValue: 0,
        duration: 160,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();

    // duration 지난 후 숨기기
    hideTimerRef.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 180,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(translate, {
          toValue: 8,
          duration: 180,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
      hideTimerRef.current = null;
    }, Math.max(400, duration));

    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, [tick, duration, opacity, translate]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        {
          opacity,
          transform: [{ translateY: translate }],
          bottom,
        },
      ]}
      accessibilityLiveRegion="polite"
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.pill}>
        <Text style={styles.text} numberOfLines={2}>{text}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  pill: {
    maxWidth: 600,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.85)",
  },
  text: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
});
