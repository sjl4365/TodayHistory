// app/(tabs)/_layout.js
import React, { memo } from "react";
import { Pressable, InteractionManager } from "react-native";
import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  emitRefresh,
  emitGoPrevDay,
  emitGoNextDay,
  emitShareAttach,
} from "../../lib/bus";
import { markUserInteracted } from "../../lib/idle";

/** 네비 전환 없이 즉시 이벤트만 실행하는 탭 버튼 */
const ActionButton = memo(function ActionButton({ onPress, name, color, size, hitSlop = 10 }) {
  return (
    <Pressable
      onPress={() => {
        // 첫 터치 표시 → 이후 무거운 작업 허용
        markUserInteracted();
        // 터치 응답은 즉시, 무거운 작업은 프레임 뒤로
        InteractionManager.runAfterInteractions(() => onPress && onPress());
      }}
      hitSlop={hitSlop}
      style={({ pressed }) => ({ 
        paddingVertical: 6, 
        paddingHorizontal: 10,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Ionicons name={name} size={size ?? 24} color={color ?? "black"} />
    </Pressable>
  );
});

// ---

/** 라우팅을 위해 설계된 커스텀 탭 버튼 (즉각적인 라우팅 시작) */
const SettingsButton = memo(function SettingsButton({ href, name, color, size, hitSlop = 10, router }) {
  return (
    <Pressable
      onPress={() => {
        markUserInteracted();
        
        // requestAnimationFrame을 사용해 터치 피드백을 우선하고 다음 프레임에 라우팅 시작
        requestAnimationFrame(() => {
            if (href) {
                router.navigate(href);
            }
        });
      }}
      hitSlop={hitSlop}
      style={({ pressed }) => ({ 
        paddingVertical: 6, 
        paddingHorizontal: 10,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Ionicons name={name} size={size ?? 24} color={color ?? "black"} />
    </Pressable>
  );
});

// ---

export default function TabLayout() {
  const router = useRouter();

  return (
    <Tabs
      initialRouteName="home"
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: "#007AFF",
        tabBarInactiveTintColor: "black",
        tabBarStyle: {
          backgroundColor: "white",
          borderTopWidth: 1,
          borderTopColor: "black",
        },
        lazy: true,
      }}
    >
      {/* 액션 탭들: href 없음 (onPress로 이벤트만 발생) */}
      <Tabs.Screen
        name="back"
        options={{
          title: "",
          tabBarButton: (props) => (
            <ActionButton
              name="chevron-back"
              color={props.color}
              size={props.size}
              onPress={emitGoPrevDay}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="refresh"
        options={{
          title: "",
          tabBarButton: (props) => (
            <ActionButton
              name="refresh"
              color={props.color}
              size={props.size}
              onPress={emitRefresh}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="forward"
        options={{
          title: "",
          tabBarButton: (props) => (
            <ActionButton
              name="chevron-forward"
              color={props.color}
              size={props.size}
              onPress={emitGoNextDay}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="share"
        options={{
          title: "",
          tabBarButton: (props) => (
            <ActionButton
              name="share-social"
              color={props.color}
              size={props.size}
              onPress={emitShareAttach}
            />
          ),
        }}
      />

      {/* settings만 실제 라우팅 - 커스텀 SettingsButton 사용 */}
      <Tabs.Screen
        name="settings"
        options={{
          title: "",
          tabBarButton: (props) => (
            <SettingsButton
              router={router}
              href="/settings" // SettingsButton 내부에서만 사용
              name="settings"
              color={props.color}
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