// app/(tabs)/_layout.js
import React, { memo, useEffect, useRef } from "react";
import {
  Pressable,
  InteractionManager,
  Image,
  View,
  useWindowDimensions,
  Platform,
  BackHandler,
} from "react-native";
import { Tabs, useRouter, useSegments } from "expo-router";
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

// 공통 버튼
const ActionButton = memo(function ActionButton({
  onPress,
  name,
  w,
  h,
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
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();

  // 안드로이드 네비게이션바 위로 띄우기
  const ANDROID_EXTRA_BOTTOM =
    Platform.OS === "android" ? insets.bottom || 20 : 0;

  // 디자인 상수
  const MAX_CLUSTER_W = 340;
  const BASE_ITEM_W = 57;
  const BASE_ITEM_H = 56;
  const BASE_GAP = 14;
  const MIN_GAP = 8;
  const PAD_V = 14;

  const SIDE_SAFE = 16;
  const clusterW = Math.min(
    MAX_CLUSTER_W,
    Math.max(280, screenW - SIDE_SAFE * 2)
  );

  const needWidth = BASE_ITEM_W * 5 + BASE_GAP * 4;
  let itemW = BASE_ITEM_W;
  let itemH = BASE_ITEM_H;
  let gap = BASE_GAP;

  if (clusterW < needWidth) {
    const gapIfOnlyShrink = (clusterW - BASE_ITEM_W * 5) / 4;
    if (gapIfOnlyShrink >= MIN_GAP) {
      gap = gapIfOnlyShrink;
    } else {
      const scale = (clusterW - 4 * MIN_GAP) / (BASE_ITEM_W * 5);
      const clamped = Math.max(0.8, Math.min(1, scale));
      itemW = Math.round(BASE_ITEM_W * clamped);
      itemH = Math.round(BASE_ITEM_H * clamped);
      gap = (clusterW - itemW * 5) / 4;
    }
  }

  const tabBarHeight = Math.round(PAD_V + itemH + PAD_V);
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
          width: "100%",
          backgroundColor: "#fff",
          borderTopWidth: 0,
          height: tabBarHeight + ANDROID_EXTRA_BOTTOM,
          paddingTop: PAD_V,
          paddingBottom: PAD_V + ANDROID_EXTRA_BOTTOM,
          justifyContent: "center",
          alignItems: "center",
        },
        tabBarItemStyle: { width: "auto", padding: 0, margin: 0, flex: 0 },
        lazy: true,
      }}
    >
      {/* 1. 어제 */}
      <Tabs.Screen
        name="back"
        options={{
          tabBarButton: () => (
            <Slot mr={gaps[0]} w={itemW} h={itemH}>
              <ActionButton
                name="chevron-back"
                onPress={emitGoPrevDay}
                w={itemW}
                h={itemH}
              />
            </Slot>
          ),
        }}
      />

      {/* 2. 새로고침 */}
      <Tabs.Screen
        name="refresh"
        options={{
          tabBarButton: () => (
            <Slot mr={gaps[1]} w={itemW} h={itemH}>
              <ActionButton
                name="refresh"
                onPress={emitRefresh}
                w={itemW}
                h={itemH}
              />
            </Slot>
          ),
        }}
      />

      {/* 3. 내일 */}
      <Tabs.Screen
        name="forward"
        options={{
          tabBarButton: () => (
            <Slot mr={gaps[2]} w={itemW} h={itemH}>
              <ActionButton
                name="chevron-forward"
                onPress={emitGoNextDay}
                w={itemW}
                h={itemH}
              />
            </Slot>
          ),
        }}
      />

      {/* 4. 공유 */}
      <Tabs.Screen
        name="share"
        options={{
          tabBarButton: () => (
            <Slot mr={gaps[3]} w={itemW} h={itemH}>
              <ActionButton
                name="share"
                onPress={emitShareAttach}
                w={itemW}
                h={itemH}
              />
            </Slot>
          ),
        }}
      />

      {/* 5. 설정 */}
      <Tabs.Screen
        name="settings"
        options={{
          tabBarButton: () => (
            <Slot mr={gaps[4]} w={itemW} h={itemH}>
              <SettingsButton
                router={router}
                href="/settings"
                name="setting"
                w={itemW}
                h={itemH}
              />
            </Slot>
          ),
        }}
      />

      {/* 홈은 탭에 안보이게 */}
      <Tabs.Screen name="home" options={{ href: null }} />
    </Tabs>
  );
}
