// app/(tabs)/_layout.js
import React, { memo } from "react";
import { Pressable, InteractionManager, Image } from "react-native";
import { Tabs, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  emitRefresh,
  emitGoPrevDay,
  emitGoNextDay,
  emitShareAttach,
} from "../../lib/bus";
import { markUserInteracted } from "../../lib/idle";

// 아이콘 PNG 매핑 (경로/파일명 확인)
const ICONS = {
  "chevron-back": require("../../assets/images/prev.png"),
  "chevron-forward": require("../../assets/images/next.png"),
 // refresh: require("../../assets/images/refresh.png"),
  "share": require("../../assets/images/share.png"),
  "setting": require("../../assets/images/setting.png"),
};

// 공통 버튼 (이벤트 실행 전용)
const ActionButton = memo(function ActionButton({
  onPress,
  name,
  size,
  hitSlop = 10,
}) {
  const iconSize = size ?? 40;
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
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingVertical: 14,
        paddingHorizontal: 18,
        backgroundColor: "transparent",
        opacity: pressed ? 0.6 : 1,
      })}
    >
      {src ? (
        <Image
          source={src}
          style={{
            width: iconSize,
            height: iconSize,
            backgroundColor: "transparent",
          }}
          resizeMode="contain"
          pointerEvents="none"
        />
      ) : null}
    </Pressable>
  );
});

// 라우팅 전용 버튼
const SettingsButton = memo(function SettingsButton({
  href,
  name,
  size,
  hitSlop = 10,
  router,
}) {
  const iconSize = size ?? 40;
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
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingVertical: 14,
        paddingHorizontal: 18,
        backgroundColor: "transparent",
        opacity: pressed ? 0.6 : 1,
      })}
    >
      {src ? (
        <Image
          source={src}
          style={{
            width: iconSize,
            height: iconSize,
            backgroundColor: "transparent",
          }}
          resizeMode="contain"
          pointerEvents="none"
        />
      ) : null}
    </Pressable>
  );
});

export default function TabLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const totalTabBarHeight = 68 + insets.bottom;

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
          backgroundColor: "#fff",
          borderTopWidth: 0,
          height: totalTabBarHeight,
          paddingBottom: 0,
        },
        lazy: true,
      }}
    >
      {/* 이벤트 전용 탭들 */}
      <Tabs.Screen
        name="back"
        options={{
          tabBarButton: (props) => (
            <ActionButton
              name="chevron-back"
              size={props.size}
              onPress={emitGoPrevDay}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="refresh"
        options={{
          tabBarButton: (props) => (
            <ActionButton
              name="refresh"
              size={props.size}
              onPress={emitRefresh}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="forward"
        options={{
          tabBarButton: (props) => (
            <ActionButton
              name="chevron-forward"
              size={props.size}
              onPress={emitGoNextDay}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="share"
        options={{
          tabBarButton: (props) => (
            <ActionButton
              name="share"
              size={props.size}
              onPress={emitShareAttach}
            />
          ),
        }}
      />

      {/* 설정(라우팅) */}
      <Tabs.Screen
        name="settings"
        options={{
          tabBarButton: (props) => (
            <SettingsButton
              router={router}
              href="/settings"
              name="settings"
              size={props.size}
            />
          ),
        }}
      />

      {/* 홈은 탭에 표시하지 않음 */}
      <Tabs.Screen name="home" options={{ href: null }} />
    </Tabs>
  );
}
