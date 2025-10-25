// app/(tabs)/_layout.js
import React, { memo, useMemo } from "react";
import { Pressable, InteractionManager, Image, View, useWindowDimensions } from "react-native";
import { Tabs, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  emitRefresh,
  emitGoPrevDay,
  emitGoNextDay,
  emitShareAttach,
} from "../../lib/bus";
import { markUserInteracted } from "../../lib/idle";

// 아이콘 PNG 매핑
const ICONS = {
  "chevron-back": require("../../assets/images/prev.png"),
  "chevron-forward": require("../../assets/images/next.png"),
  refresh: require("../../assets/images/refresh.png"),
  share: require("../../assets/images/share.png"),
  setting: require("../../assets/images/setting.png"),
};

// 공통 버튼 — 가변(폭/높이) + 내부 패딩 0
const ActionButton = memo(function ActionButton({
  onPress,
  name,
  w, // 가로(px)
  h, // 세로(px)
  hitSlop = 10,
}) {
  const src = ICONS[name];
  return (
    <Pressable
      onPress={() => {
        markUserInteracted();
        InteractionManager.runAfterInteractions(() => onPress && onPress());
      }}
      hitSlop={hitSlop}
      android_ripple={{ color: "rgba(0,0,0,0)", borderless: true }}
      style={({ pressed }) => ({
        width: w,
        height: h,
        borderRadius: Math.min(w, h) / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "transparent",
        opacity: pressed ? 0.6 : 1,
      })}
    >
      {src ? (
        <Image
          source={src}
          style={{ width: w, height: h, backgroundColor: "transparent" }}
          resizeMode="contain"
          pointerEvents="none"
        />
      ) : null}
    </Pressable>
  );
});

const SettingsButton = memo(function SettingsButton({
  href,
  name,
  router,
  w,
  h,
  hitSlop = 10,
}) {
  const src = ICONS[name];
  return (
    <Pressable
      onPress={() => {
        markUserInteracted();
        requestAnimationFrame(() => {
          if (href) router.navigate(href);
        });
      }}
      hitSlop={hitSlop}
      android_ripple={{ color: "rgba(0,0,0,0)", borderless: true }}
      style={({ pressed }) => ({
        width: w,
        height: h,
        borderRadius: Math.min(w, h) / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "transparent",
        opacity: pressed ? 0.6 : 1,
      })}
    >
      {src ? (
        <Image
          source={src}
          style={{ width: w, height: h, backgroundColor: "transparent" }}
          resizeMode="contain"
          pointerEvents="none"
        />
      ) : null}
    </Pressable>
  );
});

// 슬롯: 아이콘 셀 + 오른쪽 간격
function Slot({ mr = 0, w, h, children }) {
  return (
    <View
      style={{
        width: w,
        height: h,
        marginRight: mr,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </View>
  );
}

export default function TabLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();

  // 디자인 상수(기본값)
  const MAX_CLUSTER_W = 340;  // 가운데 묶음 최대 폭
  const BASE_ITEM_W = 57;     // 기본 아이콘 가로
  const BASE_ITEM_H = 56;     // 기본 아이콘 세로
  const BASE_GAP = 14;        // 기본 간격
  const MIN_GAP = 8;          // 축소 시 최소 간격
  const PAD_V = 14;           // 위/아래 여백(항상 14)

  // 가운데 묶음 목표 폭: 기본 340, 너무 좁은 화면에서는 화면 폭에 맞춰 줄임
  // 화면이 아주 좁아도 좌우 여유 16은 남겨줌
  const SIDE_SAFE = 16;
  const clusterW = Math.min(MAX_CLUSTER_W, Math.max(280, screenW - SIDE_SAFE * 2));

  // 1) 기본 사이즈(57×56, gap=14)로 가능한지
  const needWidth = BASE_ITEM_W * 5 + BASE_GAP * 4; // 5개 아이템 + 4개 간격
  let itemW = BASE_ITEM_W;
  let itemH = BASE_ITEM_H;
  let gap = BASE_GAP;

  if (clusterW < needWidth) {
    // 2) 먼저 간격을 줄여서 맞춰보기 (최소 8)
    const gapIfOnlyShrink = (clusterW - BASE_ITEM_W * 5) / 4;
    if (gapIfOnlyShrink >= MIN_GAP) {
      gap = gapIfOnlyShrink;
    } else {
      // 3) 그래도 안 되면 아이콘도 비율 축소
      const minGap = MIN_GAP;
      const scale = (clusterW - 4 * minGap) / (BASE_ITEM_W * 5);
      const clamped = Math.max(0.8, Math.min(1, scale)); // 너무 작아지지 않게 하한 0.8
      itemW = Math.round(BASE_ITEM_W * clamped);
      itemH = Math.round(BASE_ITEM_H * clamped);
      gap = (clusterW - itemW * 5) / 4; // 남은 폭 균등 분배
    }
  }

  // 총 높이 = 위14 + 아이콘높이 + 아래14
  const tabBarHeight = Math.round(PAD_V + itemH + PAD_V);

  // 오른쪽 마진 배열 (5개: 4개만 gap, 마지막 0)
  const gaps = [gap, gap, gap, gap, 0];

  return (
    <Tabs
      initialRouteName="home"
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: "#007AFF",
        tabBarInactiveTintColor: "black",
        tabBarActiveBackgroundColor: "transparent",
        tabBarInactiveBackgroundColor: "transparent",
        tabBarStyle: {
          // 배경: 가로 100% 흰색
          width: "100%",
          backgroundColor: "#fff",
          borderTopWidth: 0,
          // 위/아래 여유 포함한 총 높이 (리사이저블)
          height: tabBarHeight,
          paddingTop: PAD_V,
          paddingBottom: PAD_V,
          // 가운데 340(또는 축소 폭) 컨테이너가 중앙에 오도록
          justifyContent: "center",
          alignItems: "center",
        },
        // 우리가 폭/간격 제어하므로 확장 방지
        tabBarItemStyle: { width: "auto", padding: 0, margin: 0, flex: 0 },
        lazy: true,
      }}
    >
      {/* 가운데 묶음 폭을 컨트롤하기 위해, 각 버튼을 슬롯으로 분배 */}
      <Tabs.Screen
        name="back"
        options={{
          tabBarButton: () => (
            <Slot mr={gaps[0]} w={itemW} h={itemH}>
              <ActionButton name="chevron-back" onPress={emitGoPrevDay} w={itemW} h={itemH} />
            </Slot>
          ),
        }}
      />
      <Tabs.Screen
        name="refresh"
        options={{
          tabBarButton: () => (
            <Slot mr={gaps[1]} w={itemW} h={itemH}>
              <ActionButton name="refresh" onPress={emitRefresh} w={itemW} h={itemH} />
            </Slot>
          ),
        }}
      />
      <Tabs.Screen
        name="forward"
        options={{
          tabBarButton: () => (
            <Slot mr={gaps[2]} w={itemW} h={itemH}>
              <ActionButton name="chevron-forward" onPress={emitGoNextDay} w={itemW} h={itemH} />
            </Slot>
          ),
        }}
      />
      <Tabs.Screen
        name="share"
        options={{
          tabBarButton: () => (
            <Slot mr={gaps[3]} w={itemW} h={itemH}>
              <ActionButton name="share" onPress={emitShareAttach} w={itemW} h={itemH} />
            </Slot>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarButton: () => (
            <Slot mr={gaps[4]} w={itemW} h={itemH}>
              <SettingsButton router={router} href="/settings" name="setting" w={itemW} h={itemH} />
            </Slot>
          ),
        }}
      />

      {/* 홈은 탭에 표시하지 않음 */}
      <Tabs.Screen name="home" options={{ href: null }} />
    </Tabs>
  );
}
