// app/(tabs)/_layout.tsx
// This file defines the tab navigation layout
// Declare the <Tabs> and register the screens to display
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  emitRefresh,
  emitGoPrevDay,
  emitGoNextDay,
  emitShareAttach,   // ⬅️ 추가
} from "../../lib/bus";

export default function TabLayout() {
  return (
    <Tabs
      initialRouteName="home"           // ⬅️ 여기에 두는 게 정석 (screenOptions 아님)
      screenOptions={{
        tabBarShowLabel: false,
        tabBarActiveTintColor: "#007AFF",
        tabBarInactiveTintColor: "black",
        tabBarStyle: {
          backgroundColor: "white",
          borderTopWidth: 1,
          borderTopColor: "black",
        },
      }}
    >
      {/* Back: 어제 */}
      <Tabs.Screen
        name="back"
        options={{
          title: "",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chevron-back" size={size} color={color} />
          ),
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();   // 라우팅 막기
            emitGoPrevDay();      // 이벤트만 발행
          },
        }}
      />

      {/* Refresh: 새로고침 */}
      <Tabs.Screen
        name="refresh"
        options={{
          title: "",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="refresh" size={size} color={color} />
          ),
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            emitRefresh();
          },
        }}
      />

      {/* Forward: 내일 */}
      <Tabs.Screen
        name="forward"
        options={{
          title: "",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chevron-forward" size={size} color={color} />
          ),
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            emitGoNextDay();
          },
        }}
      />

      {/* Share: 파일첨부 버튼처럼 동작 (라우팅 X, 이벤트만) */}
      <Tabs.Screen
        name="share"
        options={{
          title: "",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="share-social" size={size} color={color} />
          ),
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();   // 라우팅 막기
            emitShareAttach();    // ⬅️ 홈 화면이 이 신호를 구독해 '복사+첨부' 실행
          },
        }}
      />

      {/* Settings (실제 화면으로 이동하고 싶다면 라우팅 유지) */}
      <Tabs.Screen
        name="settings"
        options={{
          title: "",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings" size={size} color={color} />
          ),
        }}
      />

      {/* 홈은 탭에 표시하지 않음 */}
      <Tabs.Screen name="home" options={{ href: null, headerShown: false }} />
    </Tabs>
  );
}
