// app/(tabs)/_layout.js
import React, { memo, useEffect, useRef, useState } from "react";
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
  onCountriesChanged,
} from "../../lib/bus";
import { markUserInteracted } from "../../lib/idle";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LanguageProvider } from "../../lib/languageContext";

// 아이콘 PNG 매핑
const ICONS = {
  "chevron-back": require("../../assets/images/prev.png"),
  "chevron-forward": require("../../assets/images/next.png"),

  "blur-left": require("../../assets/images/empty.png"),
  "blur-right": require("../../assets/images/empty.png"),

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

function TabLayoutContent() {
  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const isInSettings = segments.includes("settings");

  const ANDROID_EXTRA_BOTTOM =
    Platform.OS === "android" ? insets.bottom || 20 : 0;

  const [isCjkTab, setIsCjkTab] = useState(false);


  const STORAGE_KEY_FOCUSED_CID = "@focused_cid_v1";

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY_FOCUSED_CID);
        if (!alive) return;

        const on = saved === "korea" || saved === "china" || saved === "japan";
        setIsCjkTab(!!on);
      } catch {
        // ignore
      }
    })();

    return () => {
      alive = false;
    };
  }, []);


  useEffect(() => {
    // home에서 emitCountriesChanged(payload)로 보내주는 값을 받음
    const off = onCountriesChanged((payload) => {
      // payload 허용 형태:
      // 1) "korea" 같은 string
      // 2) ["korea"] 같은 array
      // 3) { currentCid: "korea" } 같은 object (혹시 몰라서)
      let cid = payload;

      if (Array.isArray(payload)) cid = payload[0];
      else if (payload && typeof payload === "object") cid = payload.currentCid ?? payload.cid;

      const on = cid === "korea" || cid === "china" || cid === "japan";
      setIsCjkTab(!!on);
    });

    return off;
  }, []);

  // 디자인 상수(그대로)
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

  const backIconName = isCjkTab ? "blur-left" : "chevron-back";
  const forwardIconName = isCjkTab ? "blur-right" : "chevron-forward";

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
        tabBarStyle: isInSettings
          ? { display: "none" }
          : {
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
                name={backIconName}
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
              <ActionButton name="refresh" onPress={emitRefresh} w={itemW} h={itemH} />
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
                name={forwardIconName}
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
              <ActionButton name="share" onPress={emitShareAttach} w={itemW} h={itemH} />
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
              <SettingsButton router={router} href="/settings" name="setting" w={itemW} h={itemH} />
            </Slot>
          ),
        }}
      />

      <Tabs.Screen name="home" options={{ href: null }} />
    </Tabs>
  );
}

export default function TabLayout() {
  return (
    <LanguageProvider>
      <TabLayoutContent />
    </LanguageProvider>
  );
}