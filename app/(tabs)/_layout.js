import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { emitRefresh, emitGoPrevDay, emitGoNextDay, emitCopyShare } from "../../lib/bus"; // ✅ emitCopyShare 가져오기

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        initialRouteName: "home",
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
      {/* Back */}
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
            e.preventDefault();
            emitGoPrevDay();
          },
        }}
      />

      {/* Refresh */}
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

      {/* Forward */}
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

      {/* Share → 라우팅 막고 복사만 수행 */}
      <Tabs.Screen
        name="share"
        options={{
          title: "",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="share-social" size={size} color={color} />
          ),
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();     // 라우팅 금지
            emitCopyShare();        // 복사 이벤트 발행
          },
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

      {/* Home (탭에서 숨김) */}
      <Tabs.Screen name="home" options={{ href: null, headerShown: false }} />
    </Tabs>
  );
}
