// app/(tabs)/home.js
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  ActivityIndicator, Text, View, Pressable, ScrollView, Animated, Easing,
  useWindowDimensions, Platform, InteractionManager, Image, StyleSheet, StatusBar,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { onRefresh, onGoPrevDay, onGoNextDay, onShareAttach } from "../../lib/bus";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import * as Localization from "expo-localization";
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Stack } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { initAmplitude, trackEvent, setUserProperties, AMPLITUDE_EVENTS } from "../../lib/amplitude";
import { scheduleDailyAt, cancelAllScheduled } from "./settings/notification";
import { fetchHistory } from "../../api/history";            // ← Apps Script API (최적화)
import { fetchImageForContent } from "../../lib/googleSearch";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";

// 개발 모드 콘솔 필터링
if (__DEV__) {
  const ignore = ["Amplitude Logger", "ENOENT", "InternalBytecode.js"];
  const _e = console.error, _w = console.warn;
  console.error = (...a) => (ignore.some(t => a.join(" ").includes(t)) ? void 0 : _e(...a));
  console.warn  = (...a) => (ignore.some(t => a.join(" ").includes(t)) ? void 0 : _w(...a));
}

// 상수 정의
const STORAGE_KEY_SELECTED = "selectedCountries";
const STORAGE_KEY_UI_LANG = "@app_language";
const STORAGE_KEY_FONT = "@app_font";
const STORAGE_KEY_FONT_SIZE = "@app_font_size";
const STORAGE_KEY_FONT_COLOR = "@app_font_color";
const STORAGE_KEY_BG_COLOR = "@app_bg_color";
const STORAGE_KEY_NOTIFY_ENABLED = "@notify_enabled";
const STORAGE_KEY_NOTIFY_TIME = "@notify_time";
const STORAGE_KEY_CARD_BG = "@card_bg"; // "bg1" | "bg2" | "bg3" | "none"

// 앱 캐시 (데이터) — 6시간 TTL
const DATA_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const COUNTRY_CFG = {
  korea: { id: "korea", label: { ko: "한국", en: "Korea", ja: "韓国" }, lang: "ko" },
  japan: { id: "japan", label: { ko: "일본", en: "Japan", ja: "日本" }, lang: "ja" },
  world: { id: "world", label: { ko: "세계", en: "World", ja: "世界" }, lang: "en" },
};
const DEFAULT_COUNTRIES_BY_LANG = { en: ["world"], ko: ["korea"], ja: ["japan"], default: ["world"] };
const APP_NAME_BY_LANG = { ko: "Histree", en: "Histree", ja: "Histree" };
const APP_DOWNLOAD_URL = "https://example.com/today-in-history";

const UI_STR = {
  title: {
    ko: { prev: "어제의 역사", today: "오늘의 역사", next: "내일의 역사" },
    en: { prev: "Yesterday in History", today: "Today in History", next: "Tomorrow in History" },
    ja: { prev: "昨日の歴史", today: "今日の歴史", next: "明日の歴史" },
  },
  empty: { ko: "표시할 항목이 없습니다.", en: "No items to display.", ja: "表示する項目がありません。" },
};
const COPY_TOAST = { ko: "복사", en: "Copied", ja: "コピーしました" };
const SOURCE_LABEL = { ko: "출처", en: "Source", ja: "出典" };
const LOCALE_BY_LANG = { ko: "ko-KR", en: "en-US", ja: "ja-JP" };
const UI_COL = { ko: "한국어", en: "English", ja: "日本語" };
const NATIVE_COL_BY_COUNTRY = { korea: "한국어", japan: "日本語", world: "English" };

const LABEL_BY_ID = {
  world: COUNTRY_CFG.world.label,
  korea: COUNTRY_CFG.korea.label,
  japan: COUNTRY_CFG.japan.label,
};

const FLAG_ICON = {
  korea: require("../../assets/flag/korea.png"),
  japan: require("../../assets/flag/japan.png"),
};

const AD_RATIO = 3.2;
const AD_TARGET = { w: 320, h: 100 };
const ENABLE_BOTTOM_BANNER = true;

// 유틸
function resolveUiLangFromDevice() {
  const locales = (Localization.getLocales && Localization.getLocales()) || [];
  const primary = locales[0]?.languageTag || locales[0]?.languageCode || Localization.locale || "en";
  const tag = String(primary).toLowerCase();
  if (tag.startsWith("ko")) return "ko";
  if (tag.startsWith("ja")) return "ja";
  return "en";
}
function startOfDayInTz(base = new Date(), tz = "UTC") {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(base).reduce((a, p) => { if (p.type !== "literal") a[p.type] = p.value; return a; }, {});
  return new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00`);
}
function getDayPartsFrom(date, tz) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(date).reduce((a, p) => { if (p.type !== "literal") a[p.type] = p.value; return a; }, {});
  return { md: `${parts.month}-${parts.day}`, dcode: `D${parts.month}${parts.day}`, y: parts.year, m: parts.month, d: parts.day };
}
const trimHtml = (s) => String(s || "").replace(/<[^>]+>/g, "").trim();
const hasAnyText = (t) => String(t || "").replace(/\s+/g, " ").trim().length > 0;
function pickFirstNonEmpty(raw, keys) {
  for (const k of keys) {
    if (!k) continue;
    const v = raw?.[k];
    const s = String(v ?? "").replace(/<[^>]+>/g, "").trim();
    if (s) return s;
  }
  return "";
}
function bodyOfRowByLang(raw, uiLang, cid) {
  const order = [UI_COL[uiLang] || "English", "English", NATIVE_COL_BY_COUNTRY[cid] || "English"];
  const unique = Array.from(new Set([...order, "한국어", "日本語"]));
  return pickFirstNonEmpty(raw, unique);
}
function formatRowDate(row, uiLang) {
  let y, m, d;
  const iso = row?.isoDate || row?.dateISO || row?.dateString || "";
  const dateStr = row?.Date || row?.date || row?.__DATE || "";
  const trySplit = (s) => {
    if (!s || typeof s !== "string") return null;
    const mat = s.match(/^(\d{4})[-/](\d{2})[-/](\d{2})/);
    if (mat) return { y: mat[1], m: mat[2], d: mat[3] };
    return null;
  };
  const isoHit = trySplit(iso);
  const dateHit = trySplit(dateStr);
  if (isoHit) ({ y, m, d } = isoHit);
  else if (dateHit) ({ y, m, d } = dateHit);
  else {
    y = String(row?.Year || row?.year || "").trim() || "";
    if (typeof dateStr === "string" && /^\d{2}-\d{2}$/.test(dateStr.trim())) {
      const [mm, dd] = dateStr.trim().split("-");
      m = mm; d = dd;
    } else if (row?.month && row?.day) {
      m = String(row.month).padStart(2, "0"); d = String(row.day).padStart(2, "0");
    }
  }
  const L = {
    ko: (Y, M, D) => [Y && `${Y}년`, M && `${parseInt(M, 10)}월`, D && `${parseInt(D, 10)}일`].filter(Boolean).join(" "),
    ja: (Y, M, D) => [Y && `${Y}年`, M && `${parseInt(M, 10)}月`, D && `${parseInt(D, 10)}日`].filter(Boolean).join(" "),
    en: (Y, M, D) => [M && parseInt(M, 10), D && parseInt(D, 10), Y].filter(Boolean).join(" "),
  }[uiLang] || ((Y, M, D) => [Y, M, D].filter(Boolean).join("-"));
  return L(y || "", m || "", d || "") || "";
}
function getMonthDayOnly(baseDate, uiLang, tz) {
  return baseDate.toLocaleDateString(LOCALE_BY_LANG[uiLang] || "en-US", { month: "long", day: "numeric", timeZone: tz });
}
function getYearFromRow(row) {
  const fromField = String(row?.Year || row?.year || "").trim();
  if (fromField) return fromField;
  const dateStrs = [row?.isoDate, row?.dateISO, row?.dateString, row?.Date, row?.date, row?.__DATE].map((v) => String(v || ""));
  for (const s of dateStrs) {
    const m = s.match(/^(\d{4})[-/](\d{2})[-/](\d{2})/) || s.match(/^(\d{4})/);
    if (m) return m[1];
  }
  return "";
}
function equalSets(a, b) {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}
function hash32(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return (h || 1) >>> 0;
}
function xorshift(seed) {
  let x = seed >>> 0;
  return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x >>>= 0; x ^= x << 5; x >>>= 0; return (x >>> 0) / 0xffffffff; };
}
function makePicksFromPool(pool, _uiLang, stableKey) {
  if (!pool.length) return [];
  const rnd = xorshift(hash32(stableKey));
  return [ pool[Math.floor(rnd() * pool.length)] ];
}
function getHistoryTitle(uiLang, deltaDay) {
  const t = UI_STR.title[uiLang] || UI_STR.title.en;
  if (deltaDay < 0) return t.prev;
  if (deltaDay > 0) return t.next;
  return t.today;
}
function ensureNonEmptySelection(inputSet, uiLang) {
  let s = new Set(inputSet || []);
  if (s.size === 0) s = new Set(DEFAULT_COUNTRIES_BY_LANG[uiLang] || DEFAULT_COUNTRIES_BY_LANG.default);
  const allow = new Set(["world", "korea", "japan"]);
  for (const id of [...s]) if (!allow.has(id)) s.delete(id);
  if (s.size === 0) s.add((DEFAULT_COUNTRIES_BY_LANG[uiLang] || DEFAULT_COUNTRIES_BY_LANG.default)[0]);
  return s;
}

// 토스트
function CopyToast({ trigger, message }) {
  const [visible, setVisible] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;
  const mounted = useRef(false);
  const lastSeen = useRef(trigger);
  const insets = useSafeAreaInsets();
  const bottom = (insets && typeof insets.bottom === "number") ? insets.bottom : 0;

  useEffect(() => {
    if (!mounted.current) { mounted.current = true; lastSeen.current = trigger; return; }
    if (!trigger || trigger === lastSeen.current) return;
    lastSeen.current = trigger;

    setVisible(true);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start(() => {
      const t = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
          Animated.timing(translateY, { toValue: 10, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        ]).start(() => setVisible(false));
      }, 1000);
      return () => clearTimeout(t);
    });
  }, [trigger, opacity, translateY]);

  if (!visible) return null;
  return (
    <Animated.View pointerEvents="none" style={{
      position: "absolute", left: 0, right: 0, bottom: bottom + 24, alignItems: "center",
      opacity, transform: [{ translateY }], zIndex: 9999, elevation: 9999,
    }}>
      <View style={{ backgroundColor: "#111827", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 }}>
        <Text style={{ color: "white", fontWeight: "700" }}>{message}</Text>
      </View>
    </Animated.View>
  );
}

//  UI 스케일링
function useUIScale() {
  const { width } = useWindowDimensions();
  const BASE = 393;
  const scale = (n) => Math.round((width / BASE) * n);
  return { scale, screenW: width };
}
const ALL_ORDER = ["world", "korea", "japan"];
function orderCountriesForLang(uiLang) {
  const pref = DEFAULT_COUNTRIES_BY_LANG[uiLang] || DEFAULT_COUNTRIES_BY_LANG.default;
  const set = new Set(pref);
  const rest = ALL_ORDER.filter((c) => !set.has(c));
  return [...pref, ...rest];
}

// 나라 선택 UI
function SegmentedCountrySelector({ uiLang, ordered, value, onChange, fixedHeight = 39 }) {
  const { scale } = useUIScale();
  const W = scale(340), H = fixedHeight, R = scale(100), BTN_W = scale(90), BTN_H = H;
  const GAP = Math.max(0, (W - BTN_W * 3) / 2);
  const ICON = Math.max(14, Math.min(22, scale(16)));

  const toggle = (id) => {
    const next = new Set(value);
    if (next.has(id)) { if (next.size === 1) return; next.delete(id); }
    else next.add(id);
    onChange(next);
  };

  return (
    <View style={{
      width: W, height: H, backgroundColor: "rgba(167,167,167,0.27)", borderRadius: R,
      flexDirection: "row", alignItems: "center", justifyContent: "flex-start",
      shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: scale(8),
      shadowOffset: { width: 0, height: scale(4) }, elevation: 4, paddingHorizontal: 6,
    }}>
      {ordered.map((id, idx) => {
        const active = value.has(id);
        const iconId = id === "world" ? null : id;
        const label = LABEL_BY_ID[id]?.[uiLang] || LABEL_BY_ID[id]?.en || id;
        return (
          <Pressable key={id} onPress={() => toggle(id)} style={{
            width: BTN_W, height: BTN_H, borderRadius: R, alignItems: "center", justifyContent: "center",
            backgroundColor: active ? "#FFFFFF" : "transparent", marginLeft: idx === 0 ? 0 : GAP, paddingHorizontal: 4,
          }} hitSlop={6}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              {!!iconId && !!FLAG_ICON[iconId] && (
                <Image source={FLAG_ICON[iconId]} style={{ width: ICON, height: ICON, marginRight: 6, opacity: active ? 1 : 0.9 }} resizeMode="contain" />
              )}
              <Text style={{
                fontWeight: "700", fontSize: scale(13), color: "#000",
                textShadowColor: active ? "transparent" : "rgba(0,0,0,0.25)",
                textShadowOffset: active ? undefined : { width: 0, height: 1 }, textShadowRadius: active ? 0 : 2,
              }}>
                {label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

// 헤더 이미지
function HeaderHero({ height, bgSource, imageUrl }) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <View style={{ height, width: "100%", position: "relative", zIndex: 0 }}>
      <Image
        source={imageUrl && !imageFailed ? { uri: imageUrl } : bgSource || require("../../assets/bg-images/k-photo1.jpg")}
        style={{ width: "100%", height: "100%" }} resizeMode="cover" pointerEvents="none"
        onLoad={() => setImageLoaded(true)} onError={() => { setImageFailed(true); }}
      />
      {imageUrl && !imageLoaded && !imageFailed && (
        <View style={{ position: "absolute", top:0, left:0, right:0, bottom:0, alignItems:"center", justifyContent:"center", backgroundColor:"rgba(0,0,0,0.3)" }}>
          <ActivityIndicator color="#fff" />
        </View>
      )}
      <View pointerEvents="none" style={{ ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.12)" }} />
    </View>
  );
}
function BannerPlaceholder({ maxWidth = 340 }) {
  const w = Math.min(maxWidth, AD_TARGET.w);
  const h = Math.round(w / AD_RATIO);
  return (
    <View style={{
      width: w, height: h, borderRadius: 12, alignSelf: "center",
      backgroundColor: "#E5E7EB", borderWidth: 1, borderColor: "#D1D5DB",
      alignItems: "center", justifyContent: "center",
    }}>
      <Text style={{ color: "#6B7280", fontWeight: "700" }}>320 × 100 Placeholder</Text>
    </View>
  );
}
function FullBleedCard({ children, topInset, cardBg, customBgColor }) {
  const BG_MAP = { none: "#FFFFFF", bg1: "#F9FAFB", bg2: "#FFF7ED", bg3: "#ECFEFF" };
  const bgColor = (customBgColor && typeof customBgColor === "string" && customBgColor.trim()) ? customBgColor : (BG_MAP[cardBg] ?? "#FFFFFF");
  return (
    <View style={{
      position: "absolute", top: topInset, left: 0, right: 0, bottom: 0, backgroundColor: bgColor,
      borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: "hidden", zIndex: 1,
    }}>
      {children}
    </View>
  );
}

// API 호출 및 데이터 정규화
function normalizeItemsToRows(items, iso, parts) {
  const mm = String(parts.m).padStart(2, "0");
  const dd = String(parts.d).padStart(2, "0");
  return (items || []).map((it) => ({
    isoDate: iso, date: `D${mm}${dd}`, Date: `D${mm}${dd}`,
    Year: it.year, year: it.year,
    English: it.en || "", "한국어": it.ko || "", "日本語": it.ja || "",
    enAnchors: it.enAnchors, koAnchors: it.koAnchors, jaAnchors: it.jaAnchors,
  }));
}
function resolveQuarterFromMonth(m) {
  const mm = parseInt(String(m), 10);
  if (mm >= 1 && mm <= 3) return "Q1";
  if (mm >= 4 && mm <= 6) return "Q2";
  if (mm >= 7 && mm <= 9) return "Q3";
  return "Q4";
}

function formatYearOnly(year, uiLang) {
  const y = String(year || "").trim();
  if (!y) return "";
  if (uiLang === "ko") return `${y}년`;
  if (uiLang === "ja") return `${y}年`;
  return y; 
}

/** 캐시 키 */
function cacheKey(mode, parts){ return `@hist_cache:${mode}:${String(parts.m).padStart(2,"0")}${String(parts.d).padStart(2,"0")}`; }
/** 캐시 저장 */
async function saveCache(mode, parts, rows){
  const key = cacheKey(mode, parts);
  const payload = JSON.stringify({ t: Date.now(), rows });
  try { await AsyncStorage.setItem(key, payload); } catch {}
}
/** 캐시 로드 (TTL 검사) */
async function loadCache(mode, parts){
  const key = cacheKey(mode, parts);
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj?.t || !Array.isArray(obj?.rows)) return null;
    if (Date.now() - obj.t > DATA_CACHE_TTL_MS) return null; // TTL 만료
    return obj.rows;
  } catch { return null; }
}

/** 서버 호출 (한국/일본/세계) */
async function apiFetchForMode(mode, todayParts) {
  const iso = `${todayParts.y}-${String(todayParts.m).padStart(2, "0")}-${String(todayParts.d).padStart(2, "0")}`;
  if (mode === "world") {
    const quarter = resolveQuarterFromMonth(todayParts.m);
    // 단일 호출 + 실패시에만 1회 폴백
    try {
      const items = await fetchHistory({ mode: "world", date: iso, quarter, n: 20, shuffle: false });
      return normalizeItemsToRows(items, iso, todayParts);
    } catch {
      const items2 = await fetchHistory({ mode: "world", date: iso, n: 20, shuffle: false });
      return normalizeItemsToRows(items2, iso, todayParts);
    }
  }
  // korea / japan
  const items = await fetchHistory({ mode, date: iso, n: 20, shuffle: false });
  return normalizeItemsToRows(items, iso, todayParts);
}

// 홈 화면용 파라미터 불러오기
export async function getLastHomeParams() {
  const tz = Intl?.DateTimeFormat?.().resolvedOptions().timeZone || "UTC";
  const deviceLang = resolveUiLangFromDevice();
  const storedLang = await AsyncStorage.getItem(STORAGE_KEY_UI_LANG).catch(() => null);
  const uiLang = storedLang === "ko" || storedLang === "en" || storedLang === "ja" ? storedLang : deviceLang;

  let selectedCountries;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_SELECTED).catch(() => null);
    const arr = raw ? JSON.parse(raw) : [];
    if (Array.isArray(arr) && arr.length) selectedCountries = arr;
  } catch {}
  if (!selectedCountries) selectedCountries = (DEFAULT_COUNTRIES_BY_LANG[uiLang] || DEFAULT_COUNTRIES_BY_LANG.default).slice();

  const today = startOfDayInTz(new Date(), tz);
  return { today, selectedCountries, uiLang, tz };
}
export async function loadOnePickForDay({ today, selectedCountries, uiLang }) {
  const tz = Intl?.DateTimeFormat?.().resolvedOptions().timeZone || "UTC";
  const todayParts = getDayPartsFrom(today, tz);
  const chosen = Array.isArray(selectedCountries) ? selectedCountries : [...selectedCountries];

  const pool = [];
  for (const cid of chosen) {
    const rows = await apiFetchForMode(cid, todayParts);
    for (const r of rows) {
      const body = bodyOfRowByLang(r, uiLang, cid);
      if (!hasAnyText(body)) continue;
      const tag = trimHtml(r?.["한국어"] || r?.English || r?.["日本語"] || "").slice(0, 50);
      pool.push({ cid, row: r, key: `${cid}|${String(r?.Year || r?.year || "")}|${String(r?.Date || r?.date || "")}|${tag}`, body });
    }
  }
  const stableKey = `${startOfDayInTz(today, tz).toISOString()}__${uiLang}__${chosen.slice().sort().join(",")}`;
  return makePicksFromPool(pool, uiLang, stableKey);
}

// 홈 화면 컴포넌트
export default function Home() {
  const insets = useSafeAreaInsets();
  const { scale } = useUIScale();
  const [tz] = useState(Intl?.DateTimeFormat?.().resolvedOptions().timeZone || "UTC");
  const tabBarHeight = useBottomTabBarHeight();
  const { width } = useWindowDimensions();

  const bannerHeight = Math.round(Math.min(AD_TARGET.h, Math.min(width, 340) / AD_RATIO));

  const [hydrated, setHydrated] = useState(false);
  const [baseDate, setBaseDate] = useState(() => startOfDayInTz(new Date(), tz));
  const deviceLang = useMemo(() => resolveUiLangFromDevice(), []);
  const [uiLang, setUiLang] = useState(null);
  const [selectedCountries, setSelectedCountries] = useState(new Set());
  const [onePick, setOnePick] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);
  const [copyTick, setCopyTick] = useState(0);

  const [headerImageUrl, setHeaderImageUrl] = useState(null);

  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [notifyTime, setNotifyTime] = useState("09:00");
  const [cardBg, setCardBg] = useState("none");
  const [customBgColor, setCustomBgColor] = useState(null);

  const [customFont, setCustomFont] = useState("System");
  const [customFontSize, setCustomFontSize] = useState(18);
  const [customFontColor, setCustomFontColor] = useState("#111827");
  const getFontFamily = (font) => {
    switch (font) {
      case "System": return Platform.OS === "ios" ? "System" : "Roboto";
      case "Verdana": return Platform.OS === "ios" ? "Verdana" : "sans-serif";
      case "Arial": return Platform.OS === "ios" ? "Arial" : "sans-serif";
      case "Times New Roman": return Platform.OS === "ios" ? "Times New Roman" : "serif";
      case "Courier New": return Platform.OS === "ios" ? "Courier New" : "monospace";
      case "Georgia": return Platform.OS === "ios" ? "Georgia" : "serif";
      default: return Platform.OS === "ios" ? "System" : "Roboto";
    }
  };
  const bodyLineHeight = Math.round((customFontSize || 18) * 1.45);

  const amplitudeReadyRef = useRef(false);
  useEffect(() => {
    let cancelled = false;
    InteractionManager.runAfterInteractions(async () => {
      if (cancelled) return;
      try { await initAmplitude(); amplitudeReadyRef.current = true; trackEvent(AMPLITUDE_EVENTS.SCREEN_VIEW, { screen: "Home" }); } catch {}
    });
    return () => { cancelled = true; };
  }, []);

  /* 날짜 이동 */
  const DAY_MS = 86400000;
  const getIndexFromToday = useCallback((date) => {
    const base0 = startOfDayInTz(date, tz).getTime();
    const today0 = startOfDayInTz(new Date(), tz).getTime();
    return Math.round((base0 - today0) / DAY_MS);
  }, [tz]);
  const goBy = useCallback((delta) => {
    setBaseDate((prev) => {
      const curIdx = getIndexFromToday(prev);
      const nextIdx = Math.max(-1, Math.min(1, curIdx + delta)); // 어제/오늘/내일
      if (nextIdx === curIdx) return prev;
      const today0 = startOfDayInTz(new Date(), tz);
      const target = new Date(today0); target.setDate(target.getDate() + nextIdx);
      return target;
    });
  }, [tz, getIndexFromToday]);

  useEffect(() => {
    const offPrev = onGoPrevDay?.(() => { if (amplitudeReadyRef.current) trackEvent(AMPLITUDE_EVENTS.YESTERDAY_CLICKED, { language: uiLang, countries: [...selectedCountries] }); goBy(-1); });
    const offNext = onGoNextDay?.(() => { if (amplitudeReadyRef.current) trackEvent(AMPLITUDE_EVENTS.TOMORROW_CLICKED, { language: uiLang, countries: [...selectedCountries] }); goBy(+1); });
    const offRefresh = onRefresh?.(() => { if (amplitudeReadyRef.current) trackEvent(AMPLITUDE_EVENTS.REFRESH_CLICKED, { language: uiLang, countries: [...selectedCountries] }); setRefreshTick((t) => t + 1); });
    return () => { offPrev && offPrev(); offNext && offNext(); offRefresh && offRefresh(); };
  }, [goBy, uiLang, selectedCountries]);

  /* 초기 복원 */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const pairs = await AsyncStorage.multiGet([
          STORAGE_KEY_UI_LANG, STORAGE_KEY_SELECTED, STORAGE_KEY_NOTIFY_ENABLED, STORAGE_KEY_NOTIFY_TIME,
          STORAGE_KEY_CARD_BG, STORAGE_KEY_BG_COLOR, STORAGE_KEY_FONT, STORAGE_KEY_FONT_SIZE, STORAGE_KEY_FONT_COLOR,
        ]).catch(() => []);
        const dict = Object.fromEntries(pairs || []);
        if (!alive) return;

        const storedLang = dict[STORAGE_KEY_UI_LANG] || null;
        const lang = storedLang === "ko" || storedLang === "en" || storedLang === "ja" ? storedLang : deviceLang;
        setUiLang(lang);
        if (amplitudeReadyRef.current) setUserProperties({ language: lang, device_language: deviceLang });

        let nextSet;
        if (dict[STORAGE_KEY_SELECTED]) {
          let arr = []; try { arr = JSON.parse(dict[STORAGE_KEY_SELECTED]); } catch {}
          nextSet = ensureNonEmptySelection(new Set(Array.isArray(arr) ? arr : []), lang);
        } else nextSet = ensureNonEmptySelection(new Set(), lang);
        setSelectedCountries(nextSet);
        try { await AsyncStorage.setItem(STORAGE_KEY_SELECTED, JSON.stringify([...nextSet])); } catch {}

        setNotifyEnabled(dict[STORAGE_KEY_NOTIFY_ENABLED] === "1");
        if (dict[STORAGE_KEY_NOTIFY_TIME]) setNotifyTime(dict[STORAGE_KEY_NOTIFY_TIME]);
        if (dict[STORAGE_KEY_CARD_BG]) setCardBg(dict[STORAGE_KEY_CARD_BG]);
        if (dict[STORAGE_KEY_BG_COLOR]) setCustomBgColor(dict[STORAGE_KEY_BG_COLOR]);
        if (dict[STORAGE_KEY_FONT]) setCustomFont(dict[STORAGE_KEY_FONT]);
        if (dict[STORAGE_KEY_FONT_SIZE]) { const v = parseInt(dict[STORAGE_KEY_FONT_SIZE], 10); if (!Number.isNaN(v) && v > 8) setCustomFontSize(v); }
        if (dict[STORAGE_KEY_FONT_COLOR]) setCustomFontColor(dict[STORAGE_KEY_FONT_COLOR]);
      } catch (e) {
        console.warn("Init restore failed:", e);
      } finally {
        setHydrated(true); // 기존 내용 유지 위해 loading은 아래 로딩 훅에서 관리
      }
    })();
    return () => { alive = false; };
  }, [deviceLang]);

  useFocusEffect(useCallback(() => {
    if (!hydrated) return () => {};
    let alive = true;
    (async () => {
      try {
        const pairs = await AsyncStorage.multiGet([
          STORAGE_KEY_UI_LANG, STORAGE_KEY_SELECTED, STORAGE_KEY_CARD_BG, STORAGE_KEY_BG_COLOR,
          STORAGE_KEY_FONT, STORAGE_KEY_FONT_SIZE, STORAGE_KEY_FONT_COLOR,
        ]).catch(() => []);
        const dict = Object.fromEntries(pairs || []);
        if (!alive) return;

        const storedLang = dict[STORAGE_KEY_UI_LANG] || null;
        const nextLang = storedLang === "ko" || storedLang === "en" || storedLang === "ja" ? storedLang : uiLang || deviceLang;

        if (nextLang !== uiLang) {
          setUiLang(nextLang);
          let arr = []; try { arr = JSON.parse(dict[STORAGE_KEY_SELECTED] || "[]"); } catch {}
          let cur = new Set(Array.isArray(arr) ? arr : []);
          if (cur.size === 0) {
            cur = ensureNonEmptySelection(cur, nextLang);
            setSelectedCountries(cur);
            try { await AsyncStorage.setItem(STORAGE_KEY_SELECTED, JSON.stringify([...cur])); } catch {}
          }
          setRefreshTick((t) => t + 1);
        } else {
          const storedSel = dict[STORAGE_KEY_SELECTED];
          if (storedSel) {
            let arr = []; try { arr = JSON.parse(storedSel); } catch {}
            if (Array.isArray(arr)) {
              let nextSet = ensureNonEmptySelection(new Set(arr), nextLang);
              if (!equalSets(nextSet, selectedCountries)) {
                setSelectedCountries(nextSet);
                try { await AsyncStorage.setItem(STORAGE_KEY_SELECTED, JSON.stringify([...nextSet])); } catch {}
                setRefreshTick((t) => t + 1);
              }
            }
          }
        }

        const storedBgColor = dict[STORAGE_KEY_BG_COLOR] ?? null;
        if (storedBgColor !== null && storedBgColor !== customBgColor) setCustomBgColor(storedBgColor);
        const storedCardBg = dict[STORAGE_KEY_CARD_BG] || null;
        if (storedCardBg && storedCardBg !== cardBg) setCardBg(storedCardBg);
        if (dict[STORAGE_KEY_FONT]) setCustomFont(dict[STORAGE_KEY_FONT]);
        if (dict[STORAGE_KEY_FONT_SIZE]) { const v = parseInt(dict[STORAGE_KEY_FONT_SIZE], 10); if (!Number.isNaN(v) && v > 8) setCustomFontSize(v); }
        if (dict[STORAGE_KEY_FONT_COLOR]) setCustomFontColor(dict[STORAGE_KEY_FONT_COLOR]);
      } catch {}
    })();
    return () => { alive = false; };
  }, [hydrated, uiLang, selectedCountries, cardBg, customBgColor, deviceLang]));

  const today0 = useMemo(() => startOfDayInTz(baseDate, tz), [baseDate, tz]);
  const todayParts = useMemo(() => getDayPartsFrom(today0, tz), [today0, tz]);
  const stableKey = useMemo(() => `${today0.toISOString()}__${uiLang}__${[...selectedCountries].sort().join(",")}`, [today0, uiLang, selectedCountries]);
  const seedKey = useMemo(() => `${stableKey}__r${refreshTick}`, [stableKey, refreshTick]);

  // 언어 바뀔 때 본문 재로컬라이즈
  useEffect(() => {
    setOnePick((prev) => {
      if (!Array.isArray(prev) || !prev.length) return prev;
      return prev.map((it) => {
        const newBody = bodyOfRowByLang(it.row, uiLang, it.cid);
        return newBody && hasAnyText(newBody) ? { ...it, body: newBody } : it;
      });
    });
  }, [uiLang]);

  // 데이터 로드: **캐시 → 즉시 표시 → 백그라운드 최신화**
  useEffect(() => {
    if (!hydrated || !uiLang) return;
    let canceled = false;
    (async () => {
      try {
        setErr("");
        setLoading(true);

        const safeSelected = ensureNonEmptySelection(selectedCountries, uiLang);
        if (!equalSets(safeSelected, selectedCountries)) {
          setSelectedCountries(safeSelected);
          try { await AsyncStorage.setItem(STORAGE_KEY_SELECTED, JSON.stringify([...safeSelected])); } catch {}
        }
        const chosen = [...safeSelected];
        if (!chosen.length) { if (!canceled) setLoading(false); return; }

        // 1) 캐시 먼저 모아서 즉시 노출
        const cachedPools = [];
        for (const cid of chosen) {
          const c = await loadCache(cid, todayParts);
          if (Array.isArray(c) && c.length) {
            for (const r of c) {
              const body = bodyOfRowByLang(r, uiLang, cid);
              if (!hasAnyText(body)) continue;
              const tag = trimHtml(r?.["한국어"] || r?.English || r?.["日本語"] || "").slice(0, 50);
              cachedPools.push({ cid, row: r, key: `${cid}|${String(r?.Year || r?.year || "")}|${String(r?.Date || r?.date || "")}|${tag}`, body });
            }
          }
        }
        if (!canceled && cachedPools.length) {
          const picks = makePicksFromPool(cachedPools, uiLang, seedKey + "::cache");
          if (picks.length) {
            setOnePick(picks);
            setLoading(false); // 캐시로 즉시 종결
            // 헤더 이미지 비동기
            setTimeout(async () => {
              try {
                const searchQuery = picks[0]?.body || "";
                if (searchQuery) {
                  const imageUrl = await fetchImageForContent(searchQuery);
                  if (!canceled && imageUrl) setHeaderImageUrl(imageUrl);
                }
              } catch {}
            }, 0);
          }
        }

        // 2) 네트워크로 최신화(백그라운드) — 한국/일본 포함 확실
        const pool = [];
        for (const cid of chosen) {
          const rows = await apiFetchForMode(cid, todayParts);
          await saveCache(cid, todayParts, rows); // 최신 캐시 저장
          for (const r of rows) {
            const body = bodyOfRowByLang(r, uiLang, cid);
            if (!hasAnyText(body)) continue;
            const tag = trimHtml(r?.["한국어"] || r?.English || r?.["日本語"] || "").slice(0, 50);
            pool.push({ cid, row: r, key: `${cid}|${String(r?.Year || r?.year || "")}|${String(r?.Date || r?.date || "")}|${tag}`, body });
          }
        }
        if (!canceled && pool.length) {
          const picks = makePicksFromPool(pool, uiLang, seedKey + "::net");
          setOnePick(picks);
          setLoading(false);
          // 헤더 이미지 비동기
          setTimeout(async () => {
            try {
              const searchQuery = picks[0]?.body || "";
              if (searchQuery) {
                const imageUrl = await fetchImageForContent(searchQuery);
                if (!canceled && imageUrl) setHeaderImageUrl(imageUrl);
              }
            } catch {}
          }, 0);
        } else if (!cachedPools.length && !canceled) {
          setOnePick([]);
          setHeaderImageUrl(null);
          setLoading(false);
        }

      } catch (e) {
        if (!canceled) { setErr(String(e?.message || e)); setLoading(false); }
      }
    })();
    return () => { canceled = true; };
  }, [hydrated, todayParts, uiLang, selectedCountries, seedKey]);

  const deltaDay = useMemo(() => {
    const todayBase = startOfDayInTz(new Date(), tz).getTime();
    const diff = Math.round((today0.getTime() - todayBase) / 86400000);
    return diff < 0 ? -1 : diff > 0 ? 1 : 0;
  }, [today0, tz]);

  const handleCountriesChange = useCallback((nextSetRaw) => {
    const ensured = ensureNonEmptySelection(nextSetRaw, uiLang);
    const added = [...ensured].filter((c) => !selectedCountries.has(c));
    const removed = [...selectedCountries].filter((c) => !ensured.has(c));
    if (amplitudeReadyRef.current && (added.length || removed.length)) {
      trackEvent(AMPLITUDE_EVENTS.COUNTRY_CLICKED, {
        language: uiLang, added_countries: added, removed_countries: removed, total_selected: ensured.size, selected_countries: [...ensured],
      });
    }
    setSelectedCountries(ensured);
    AsyncStorage.setItem(STORAGE_KEY_SELECTED, JSON.stringify([...ensured])).catch(() => {});
    setRefreshTick((t) => t + 1);
  }, [selectedCountries, uiLang]);

  const onCopyPress = useCallback(async () => {
    try {
      const list = Array.isArray(onePick) ? onePick : onePick ? [onePick] : [];
      const header = getMonthDayOnly(today0, uiLang, tz);
      const appName = APP_NAME_BY_LANG[uiLang] || APP_NAME_BY_LANG.en;
      const sourceLabel = SOURCE_LABEL[uiLang] || SOURCE_LABEL.en;
      const blocks = (list || []).map((p) => {
        const label = COUNTRY_CFG[p.cid]?.label?.[uiLang] || p.cid;
        const yr = getYearFromRow(p.row) || "";
        const content = (p.body || "").trim();
        return [label, yr, content, `${sourceLabel}: ${appName}`].filter(Boolean).join("\n");
      });
      const payload = [header, ...blocks, APP_DOWNLOAD_URL].join("\n\n");

      await Clipboard.setStringAsync(payload);
      setCopyTick((t) => t + 1);

      const fileName = `history_${Date.now()}.txt`;
      const uri = FileSystem.cacheDirectory + fileName;
      await FileSystem.writeAsStringAsync(uri, payload, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { dialogTitle: header, UTI: "public.plain-text", mimeType: "text/plain" });
      }
    } catch {}
  }, [onePick, today0, uiLang, tz]);

  useEffect(() => {
    const offShare = onShareAttach?.(() => onCopyPress());
    return () => { offShare && offShare(); };
  }, [onCopyPress]);

  // (생략 가능) 알림/공유 캐시 업데이트 — 필요 로직 유지
  useEffect(() => {
    (async () => {
      try {
        const list = Array.isArray(onePick) ? onePick : onePick ? [onePick] : [];
        const monthDay = getMonthDayOnly(today0, uiLang, tz);
        const maxBodyLen = uiLang === "ko" || uiLang === "ja" ? 20 : 40;
        const notificationBody = list.length
          ? `${monthDay} — ` + list.map((p) => {
              const label = COUNTRY_CFG[p.cid]?.label?.[uiLang] || p.cid;
              const yr = getYearFromRow(p.row);
              const body = p.body || "";
              const trunc = body.length > maxBodyLen ? body.slice(0, maxBodyLen) + "..." : body;
              return `${label}${yr ? ` ${yr}` : ""}: ${trunc}`;
            }).join(" • ")
          : `${monthDay} — ${APP_NAME_BY_LANG[uiLang] || APP_NAME_BY_LANG.en}`;

        const header = getMonthDayOnly(today0, uiLang, tz);
        const appName = APP_NAME_BY_LANG[uiLang] || APP_NAME_BY_LANG.en;
        const sourceLabel = SOURCE_LABEL[uiLang] || SOURCE_LABEL.en;
        const blocks = (list || []).map((p) => {
          const countryLabel = COUNTRY_CFG[p.cid]?.label?.[uiLang] || p.cid;
          const yr = getYearFromRow(p.row) || "";
          const content = (p.body || "").trim();
          return [countryLabel, yr, content, `${sourceLabel}: ${appName}`].filter(Boolean).join("\n");
        });
        const shareText = [header, ...blocks, APP_DOWNLOAD_URL].join("\n\n");

        // 필요 시 전역캐시/AsyncStorage 갱신 …
        await AsyncStorage.setItem("@notification_body", notificationBody);
      } catch {}
    })();
  }, [onePick, today0, uiLang, tz]);

  // 알림 스케줄
  const applySchedule = useCallback(async (timeStr) => {
    const [H, M] = (timeStr || "09:00").split(":").map((x) => parseInt(x, 10) || 0);
    try { await cancelAllScheduled?.(); } catch {}
    try { await scheduleDailyAt?.(H, M); } catch (e) { console.warn("scheduleDailyAt failed:", e); }
  }, []);
  useEffect(() => {
    (async () => {
      try {
        if (notifyEnabled) { await applySchedule(notifyTime); } else { await cancelAllScheduled?.(); }
        await AsyncStorage.setItem(STORAGE_KEY_NOTIFY_ENABLED, notifyEnabled ? "1" : "0");
        await AsyncStorage.setItem(STORAGE_KEY_NOTIFY_TIME, notifyTime);
      } catch {}
    })();
  }, [notifyEnabled, notifyTime, applySchedule]);

  const list = Array.isArray(onePick) ? onePick : onePick ? [onePick] : [];
  const ordered = useMemo(() => orderCountriesForLang(uiLang || "en"), [uiLang]);

  const SEGMENT_H = 38;
  const TOP_PX = 58;
  const BOTTOM_PX = 93;
  const HEADER_H = insets.top + TOP_PX + SEGMENT_H + BOTTOM_PX;
  const CONTENT_W = 340;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }} edges={["top", "bottom"]}>
      {!hydrated ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator />
        </View>
      ) : (
        <>
          <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
          <Stack.Screen options={{ headerShown: false, freezeOnBlur: true }} />

          {/* 1) 헤더 이미지 */}
          <HeaderHero height={HEADER_H + 15} bgSource={require("../../assets/bg-images/k-photo1.jpg")} imageUrl={headerImageUrl} />

          {/* 2) 나라 선택 */}
          <View pointerEvents="box-none" style={{ position: "absolute", top: insets.top + TOP_PX, left: 0, right: 0, alignItems: "center", zIndex: 3 }}>
            <SegmentedCountrySelector uiLang={uiLang} ordered={ordered} value={selectedCountries} onChange={handleCountriesChange} fixedHeight={SEGMENT_H} />
          </View>

          {/* 3) 본문 카드 */}
          <FullBleedCard topInset={HEADER_H - 15} cardBg={cardBg} customBgColor={customBgColor}>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 16, paddingBottom: 24 + (ENABLE_BOTTOM_BANNER ? bannerHeight + 12 + tabBarHeight : 0) }}
            >
              <View style={{ paddingTop: 20, width: CONTENT_W, alignSelf: "center" }}>
                {/* 제목/날짜 */}
                <View style={{ paddingVertical: 20 }}>
                  <Text style={{ fontSize: 20, fontWeight: "800" }}>{getHistoryTitle(uiLang, deltaDay)}</Text>
                  <Text style={{ marginTop: 6, fontSize: 14, color: "#374151" }}>
                    {today0.toLocaleDateString(LOCALE_BY_LANG[uiLang] || "en-US", { year: "numeric", month: "long", day: "numeric", timeZone: tz })}
                  </Text>
                </View>

                {/* 이벤트 리스트 */}
                <View style={{ marginTop: 0, gap: 14 }}>
                  {list.length === 0 ? (
                    <Text style={{ color: "#6b7280" }}>{loading ? "..." : UI_STR.empty[uiLang] || UI_STR.empty.en}</Text>
                  ) : (
                    list.map((p) => {
                        const label = COUNTRY_CFG[p.cid]?.label?.[uiLang] || p.cid;
                        const eventYear = getYearFromRow(p.row);
                        const yearLabel = formatYearOnly(eventYear, uiLang); // ← 로컬라이즈된 연도만

                        return (
                          <View key={p.key} style={{ gap: 6 }}>
                            <Text style={{ fontWeight: "700" }}>
                              {label}
                              {!!yearLabel && (
                                <Text style={{ fontSize: 12, color: "#64748b" }}> ({yearLabel})</Text>
                              )}
                            </Text>

                            <Text
                              style={{
                                marginTop: 14,
                                marginBottom: 14,
                                fontSize: customFontSize,
                                lineHeight: bodyLineHeight,
                                fontFamily: getFontFamily(customFont),
                                color: customFontColor,
                              }}
                            >
                              {p.body}
                            </Text>
                          </View>
                        );
                      })
                  )}
                </View>

                <View style={{ height: 36 }} />
              </View>
            </ScrollView>
          </FullBleedCard>

          {/* 하단 고정 배너 (광고) */}
          {ENABLE_BOTTOM_BANNER && (
            <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, bottom: tabBarHeight - 40, alignItems: "center", zIndex: 10000, elevation: 10000 }}>
              <View style={{ height: bannerHeight }}>
                <BannerPlaceholder maxWidth={Math.min(340, width - 24)} />
              </View>
            </View>
          )}

          {loading && (
            <View style={{ position: "absolute", top: 12, right: 12 }}>
              <ActivityIndicator />
            </View>
          )}
          {!!err && (
            <View style={{ position: "absolute", bottom: 12, left: 12, right: 12, backgroundColor: "#fee2e2", padding: 10, borderRadius: 8 }}>
              <Text style={{ color: "#b91c1c" }}>Error: {err}</Text>
            </View>
          )}

          <CopyToast trigger={copyTick} message={COPY_TOAST[uiLang] || COPY_TOAST.en} />
        </>
      )}
    </SafeAreaView>
  );
}
