// This file defines the tab navigation layout
// Declare the <Tabs> and register the screens to display
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { emitRefresh, emitGoPrevDay, emitGoNextDay } from "../../lib/bus";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        initialRouteName: "home",
        tabBarShowLabel: false, // 라벨 숨겨서 탭 간격 균일
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
            e.preventDefault(); // 라우팅 막고
            emitGoPrevDay();    // 이벤트만 발행
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

      {/* Share: 실제 페이지가 있다면 라우팅 허용 */}
      <Tabs.Screen
        name="share"
        options={{
          title: "",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="share-social" size={size} color={color} />
          ),
        }}
      />

      {/* Settings */}
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
