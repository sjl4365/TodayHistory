// app/(tabs)/_layout.js
import React, { memo, useEffect, useRef, useState, useCallback } from "react";
import {
  Pressable,
  InteractionManager,
  Image,
  View,
  Text,
  useWindowDimensions,
  Platform,
} from "react-native";
import { Tabs, useRouter, useSegments } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  emitRefresh,
  emitGoPrevDay,
  emitGoNextDay,
  emitShareAttach,
  onCountriesChanged,
  onUiLangChanged,
} from "../../lib/bus";
import { markUserInteracted } from "../../lib/idle";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LanguageProvider } from "../../lib/languageContext";

const ICONS = {
  "chevron-back": require("../../assets/images/prev.png"),
  "chevron-forward": require("../../assets/images/next.png"),
  "blur-left": require("../../assets/images/empty.png"),
  "blur-right": require("../../assets/images/empty.png"),
  refresh: require("../../assets/images/refresh.png"),
  share: require("../../assets/images/share.png"),
  setting: require("../../assets/images/setting.png"),
};

const NAV_POPUP_TEXT = {
  prev: {
    ko: "어제",
    en: "Yesterday",
    ja: "昨日",
    sc: "昨天",
    tc: "昨天",
    es: "Ayer",
    fr: "Hier",
  },
  next: {
    ko: "내일",
    en: "Tomorrow",
    ja: "明日",
    sc: "明天",
    tc: "明天",
    es: "Mañana",
    fr: "Demain",
  },
};

function normalizeUiLang(value, fallback = "en") {
  const v = String(value || "").toLowerCase();
  if (!v) return fallback;

  if (v === "ko") return "ko";
  if (v === "ja") return "ja";
  if (v === "en") return "en";
  if (v === "sc") return "sc";
  if (v === "tc") return "tc";
  if (v === "es") return "es";
  if (v === "fr") return "fr";
  if (v === "zh-hant") return "tc";
  if (v === "zh-hans") return "sc";

  if (
    v.includes("zh-hant") ||
    v.includes("zh_tw") ||
    v.includes("zh-tw") ||
    v.includes("zh_hk") ||
    v.includes("zh-hk") ||
    v.includes("zh_mo") ||
    v.includes("zh-mo")
  ) {
    return "tc";
  }

  if (
    v.includes("zh-hans") ||
    v.includes("zh_cn") ||
    v.includes("zh-cn") ||
    v.includes("zh_sg") ||
    v.includes("zh-sg")
  ) {
    return "sc";
  }

  if (v === "zh") return "sc";

  const base = v.split(/[-_]/)[0];
  if (base === "ko") return "ko";
  if (base === "ja") return "ja";
  if (base === "en") return "en";
  if (base === "es") return "es";
  if (base === "fr") return "fr";

  return fallback;
}

const ActionButton = memo(function ActionButton({
  onPress,
  onLayout,
  name,
  w,
  h,
  hitSlop = 10,
}) {
  const src = ICONS[name];

  return (
    <Pressable
      onLayout={onLayout}
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
  const [uiLang, setUiLang] = useState("en");

  const [navBtnLayouts, setNavBtnLayouts] = useState({
    left: null,
    right: null,
  });

  const [navMiniPopup, setNavMiniPopup] = useState({
    visible: false,
    x: 0,
    bottom: 0,
    side: null, // "left" | "right"
  });

  const navMiniPopupTimerRef = useRef(null);

  const STORAGE_KEY_FOCUSED_CID = "@focused_cid_v1";
  const STORAGE_KEY_UI_LANG = "@app_language";

  const loadUiLang = useCallback(async () => {
    try {
      const savedLang = await AsyncStorage.getItem(STORAGE_KEY_UI_LANG);
      setUiLang(normalizeUiLang(savedLang, "en"));
    } catch {
      setUiLang("en");
    }
  }, []);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const savedLang = await AsyncStorage.getItem(STORAGE_KEY_UI_LANG);
        if (alive) {
          setUiLang(normalizeUiLang(savedLang, "en"));
        }
      } catch {
        if (alive) setUiLang("en");
      }

      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY_FOCUSED_CID);
        if (!alive) return;
        const on = saved === "korea" || saved === "china" || saved === "japan";
        setIsCjkTab(!!on);
      } catch {}
    })();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const off = onUiLangChanged((lang) => {
      setUiLang(normalizeUiLang(lang, "en"));
    });
    return off;
  }, []);

  useEffect(() => {
    const off = onCountriesChanged((payload) => {
      let cid = payload;

      if (Array.isArray(payload)) cid = payload[0];
      else if (payload && typeof payload === "object") {
        cid = payload.currentCid ?? payload.cid;
      }

      const on = cid === "korea" || cid === "china" || cid === "japan";
      setIsCjkTab(!!on);

      if (on) {
        if (navMiniPopupTimerRef.current) {
          clearTimeout(navMiniPopupTimerRef.current);
        }
        setNavMiniPopup((prev) => ({
          ...prev,
          visible: false,
          side: null,
        }));
      }
    });

    return off;
  }, []);

  useEffect(() => {
    return () => {
      if (navMiniPopupTimerRef.current) {
        clearTimeout(navMiniPopupTimerRef.current);
      }
    };
  }, []);

  const updateNavLayout = (side, layout) => {
    setNavBtnLayouts((prev) => {
      const old = prev[side];

      if (
        old &&
        old.x === layout.x &&
        old.y === layout.y &&
        old.width === layout.width &&
        old.height === layout.height
      ) {
        return prev;
      }

      return {
        ...prev,
        [side]: layout,
      };
    });
  };

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

  const showNavMiniPopup = (side) => {
    if (isCjkTab) return;

    const layout = navBtnLayouts[side];
    if (!layout) return;

    if (navMiniPopupTimerRef.current) {
      clearTimeout(navMiniPopupTimerRef.current);
    }

    const popupWidth = 90;
    const popupGap = 8;

    let x = layout.x + layout.width / 2 - popupWidth / 2;
    x = Math.max(8, Math.min(x, screenW - popupWidth - 8));

    const bottom = tabBarHeight + ANDROID_EXTRA_BOTTOM + popupGap;

    setNavMiniPopup({
      visible: true,
      x,
      bottom,
      side,
    });

    navMiniPopupTimerRef.current = setTimeout(() => {
      setNavMiniPopup((prev) => ({
        ...prev,
        visible: false,
        side: null,
      }));
    }, 900);
  };

  const popupText =
    navMiniPopup.side === "left"
      ? NAV_POPUP_TEXT.prev[uiLang] || NAV_POPUP_TEXT.prev.en
      : navMiniPopup.side === "right"
      ? NAV_POPUP_TEXT.next[uiLang] || NAV_POPUP_TEXT.next.en
      : "";

  const backIconName = isCjkTab ? "blur-left" : "chevron-back";
  const forwardIconName = isCjkTab ? "blur-right" : "chevron-forward";

  return (
    <View style={{ flex: 1 }}>
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
        <Tabs.Screen
          name="back"
          options={{
            tabBarButton: () => (
              <Slot mr={gaps[0]} w={itemW} h={itemH}>
                <ActionButton
                  name={backIconName}
                  onLayout={(e) => {
                    const { x, y, width, height } = e.nativeEvent.layout;
                    updateNavLayout("left", { x, y, width, height });
                  }}
                  onPress={() => {
                    if (!isCjkTab) {
                      showNavMiniPopup("left");
                    }
                    emitGoPrevDay();
                  }}
                  w={itemW}
                  h={itemH}
                />
              </Slot>
            ),
          }}
        />

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

        <Tabs.Screen
          name="forward"
          options={{
            tabBarButton: () => (
              <Slot mr={gaps[2]} w={itemW} h={itemH}>
                <ActionButton
                  name={forwardIconName}
                  onLayout={(e) => {
                    const { x, y, width, height } = e.nativeEvent.layout;
                    updateNavLayout("right", { x, y, width, height });
                  }}
                  onPress={() => {
                    if (!isCjkTab) {
                      showNavMiniPopup("right");
                    }
                    emitGoNextDay();
                  }}
                  w={itemW}
                  h={itemH}
                />
              </Slot>
            ),
          }}
        />

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

        <Tabs.Screen name="home" options={{ href: null }} />
      </Tabs>

      {navMiniPopup.visible && !isCjkTab && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: navMiniPopup.x,
            bottom: navMiniPopup.bottom,
            width: 90,
            height: 36,
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999,
          }}
        >
          <View
            style={{
              backgroundColor: "rgba(0,0,0,0.88)",
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 999,
              minWidth: 90,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                color: "#fff",
                fontSize: 13,
                fontWeight: "700",
                textAlign: "center",
              }}
              numberOfLines={1}
            >
              {popupText}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

export default function TabLayout() {
  return (
    <LanguageProvider>
      <TabLayoutContent />
    </LanguageProvider>
  );
}