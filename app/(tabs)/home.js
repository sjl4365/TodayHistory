// app/(tabs)/home.js
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import {
  ActivityIndicator,
  Text,
  View,
  Pressable,
  ScrollView,
  useWindowDimensions,
  Platform,
  InteractionManager,
  Image as RNImage,
  StyleSheet,
  StatusBar,
  Linking,
  RefreshControl,
  Share as NativeShare,
  AppState,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  onRefresh,
  onGoPrevDay,
  onGoNextDay,
  onShareAttach,
} from "../../lib/bus";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import * as Localization from "expo-localization";
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Stack } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import {
  initAmplitude,
  trackEvent,
  setUserProperties,
  AMPLITUDE_EVENTS,
} from "../../lib/amplitude";
import {
  scheduleDailyAt,
  cancelAllScheduled,
} from "./settings/notification";
import { fetchHistory } from "../../api/history";
import { fetchWikipediaImageFromAnchors } from "../../lib/wikipediaSearch";
import { fetchImageForContent } from "../../lib/googleSearch";
import {
  getLocalHistory,
  monthToQuarter,
} from "../../lib/localHistory";
import { Image as ExpoImage } from "expo-image";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";

// 콘솔
if (__DEV__) {
  const ignore = ["Amplitude Logger", "ENOENT", "InternalBytecode.js"];
  const _e = console.error;
  const _w = console.warn;
  console.error = (...a) =>
    ignore.some((t) => a.join(" ").includes(t)) ? undefined : _e(...a);
  console.warn = (...a) =>
    ignore.some((t) => a.join(" ").includes(t)) ? undefined : _w(...a);
}

// 상수
const STORAGE_KEY_SELECTED = "selectedCountries";
const STORAGE_KEY_UI_LANG = "@app_language";
const STORAGE_KEY_FONT = "@app_font";
const STORAGE_KEY_FONT_SIZE = "@app_font_size";
const STORAGE_KEY_FONT_COLOR = "@app_font_color";
const STORAGE_KEY_BG_COLOR = "@app_bg_color";
const STORAGE_KEY_NOTIFY_ENABLED = "@notify_enabled";
const STORAGE_KEY_NOTIFY_TIME = "@notify_time";
const STORAGE_KEY_CARD_BG = "@card_bg"; // "bg1" | "bg2" | "bg3" | "none"
const STORAGE_KEY_NOTIFY_TITLE = "@notification_title";
const STORAGE_KEY_NOTIFY_BODY = "@notification_body";

// 데이터 캐시 TTL (6시간)
const DATA_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const COUNTRY_CFG = {
  korea: {
    id: "korea",
    label: { ko: "한국", en: "Korea", ja: "韓国" },
    lang: "ko",
  },
  japan: {
    id: "japan",
    label: { ko: "일본", en: "Japan", ja: "日本" },
    lang: "ja",
  },
  world: {
    id: "world",
    label: { ko: "세계", en: "World", ja: "世界" },
    lang: "en",
  },
};

const DEFAULT_COUNTRIES_BY_LANG = {
  en: ["world"],
  ko: ["korea"],
  ja: ["japan"],
  default: ["world"],
};

const APP_NAME_BY_LANG = {
  ko: "Histree",
  en: "Histree",
  ja: "Histree",
};

const APP_DOWNLOAD_URL = "https://example.com/today-in-history";

const UI_STR = {
  title: {
    ko: {
      prev: "어제의 역사",
      today: "오늘의 역사",
      next: "내일의 역사",
    },
    en: {
      prev: "Yesterday in History",
      today: "Today in History",
      next: "Tomorrow in History",
    },
    ja: {
      prev: "昨日の歴史",
      today: "今日の歴史",
      next: "明日の歴史",
    },
  },
  empty: {
    ko: "표시할 항목이 없습니다.",
    en: "No items to display.",
    ja: "表示する項目がありません。",
  },
  imageLoading: {
    ko: "사진을 불러오는 중입니다…",
    en: "Loading image…",
    ja: "画像を読み込み中…",
  },
};

const SOURCE_LABEL = { ko: "출처", en: "Source", ja: "出典" };
const LOCALE_BY_LANG = { ko: "ko-KR", en: "en-US", ja: "ja-JP" };
const UI_COL = { ko: "한국어", en: "English", ja: "日本語" };
const NATIVE_COL_BY_COUNTRY = {
  korea: "한국어",
  japan: "日本語",
  world: "English",
};

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

// 날짜 시간
function safeTimeZone(tzCandidate) {
  const tz = String(tzCandidate || "");
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(0);
    return tz;
  } catch {
    return "UTC";
  }
}

const SUPPORTED_LOCALES = new Set(["en-US", "ko-KR", "ja-JP"]);

function safeLocale(localeCandidate) {
  const lc = String(localeCandidate || "en-US");
  return SUPPORTED_LOCALES.has(lc) ? lc : "en-US";
}

function safeToLocaleDateString(date, locale, opts = {}) {
  try {
    const tz = safeTimeZone(opts.timeZone);
    return date.toLocaleDateString(safeLocale(locale), {
      ...opts,
      timeZone: tz,
    });
  } catch {
    try {
      return date.toLocaleDateString("en-US");
    } catch {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(date.getDate()).padStart(2, "0")}`;
    }
  }
}

function safeFormatParts(date, tz) {
  try {
    const dtf = new Intl.DateTimeFormat("en-CA", {
      timeZone: safeTimeZone(tz),
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return dtf
      .formatToParts(date)
      .reduce((a, p) => {
        if (p.type !== "literal") a[p.type] = p.value;
        return a;
      }, {});
  } catch {
    const dtf = new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return dtf
      .formatToParts(date)
      .reduce((a, p) => {
        if (p.type !== "literal") a[p.type] = p.value;
        return a;
      }, {});
  }
}

// 유틸
function resolveUiLangFromDevice() {
  const locales =
    (Localization.getLocales && Localization.getLocales()) || [];
  const primary =
    locales[0]?.languageTag ||
    locales[0]?.languageCode ||
    Localization.locale ||
    "en";
  const tag = String(primary).toLowerCase();
  if (tag.startsWith("ko")) return "ko";
  if (tag.startsWith("ja")) return "ja";
  return "en";
}

function startOfDayInTz(base = new Date(), tz = "UTC") {
  const parts = safeFormatParts(base, tz);
  return new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00`);
}

function getDayPartsFrom(date, tz) {
  const parts = safeFormatParts(date, tz);
  return {
    md: `${parts.month}-${parts.day}`,
    dcode: `D${parts.month}${parts.day}`,
    y: parts.year,
    m: parts.month,
    d: parts.day,
  };
}

const trimHtml = (s) => String(s || "").replace(/<[^>]+>/g, "").trim();
const hasAnyText = (t) =>
  String(t || "").replace(/\s+/g, " ").trim().length > 0;

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
  const order = [
    UI_COL[uiLang] || "English",
    "English",
    NATIVE_COL_BY_COUNTRY[cid] || "English",
  ];
  const unique = Array.from(new Set([...order, "한국어", "日本語"]));
  return pickFirstNonEmpty(raw, unique);
}

// 앵커(언어별, URL 없으면 제외)
function getAnchorsForLang(row, lang) {
  const colMap = {
    en: [
      { t: "Anchor_text1_english", u: "URL1_english" },
      { t: "Anchor_text2_english", u: "URL2_english" },
    ],
    ko: [
      { t: "Anchor_text1_korean", u: "URL1_korean" },
      { t: "Anchor_text2_korean", u: "URL2_korean" },
    ],
    ja: [
      { t: "Anchor_text1_japanese", u: "URL1_japanese" },
      { t: "Anchor_text2_japanese", u: "URL2_japanese" },
    ],
  };

  const out = [];
  const seen = new Set();

  const byArr = (row?.[`${lang}Anchors`] || [])
    .map((a) => ({
      text: String(a?.text || "").trim(),
      url: String(a?.url || "").trim(),
    }))
    .filter((a) => a.text && a.url);

  for (const a of byArr) {
    const k = `${a.text}__${a.url}`;
    if (!seen.has(k)) {
      seen.add(k);
      out.push(a);
    }
  }

  for (const { t, u } of colMap[lang] || []) {
    const a = {
      text: String(row?.[t] || "").trim(),
      url: String(row?.[u] || "").trim(),
    };
    if (a.text && a.url) {
      const k = `${a.text}__${a.url}`;
      if (!seen.has(k)) {
        seen.add(k);
        out.push(a);
      }
    }
  }

  return out;
}

function getMonthDayOnly(baseDate, uiLang, tz) {
  return safeToLocaleDateString(
    baseDate,
    LOCALE_BY_LANG[uiLang] || "en-US",
    { month: "long", day: "numeric", timeZone: tz }
  );
}

function getYearFromRow(row) {
  const fromField = String(row?.Year || row?.year || "").trim();
  if (fromField) return fromField;

  const dateStrs = [
    row?.isoDate,
    row?.dateISO,
    row?.dateString,
    row?.Date,
    row?.date,
    row?.__DATE,
  ].map((v) => String(v || ""));

  for (const s of dateStrs) {
    const m =
      s.match(/^(\d{4})[-/](\d{2})[-/](\d{2})/) ||
      s.match(/^(\d{4})/);
    if (m) return m[1];
  }
  return "";
}

function equalSets(a, b) {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

// 난수
function hash32(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return (h || 1) >>> 0;
}

function xorshift(seed) {
  let x = seed >>> 0;
  return () => {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x >>>= 0;
    x ^= x << 5;
    x >>>= 0;
    return (x >>> 0) / 0xffffffff;
  };
}

// 전체 pool 랜덤 1개 (백업용)
function makePicksFromPool(pool, _uiLang, stableKey) {
  if (!pool.length) return [];
  const rnd = xorshift(hash32(stableKey));
  return [pool[Math.floor(rnd() * pool.length)]];
}

// 선택된 나라들 사이에서 공평하게 1개
function makeFairSinglePickFromPools(poolsByCid, chosenIds, seed) {
  const availableCids = chosenIds.filter(
    (cid) => poolsByCid[cid] && poolsByCid[cid].length
  );
  if (!availableCids.length) return [];

  const rndCid = xorshift(hash32(`${seed}:cid`));
  const cid = availableCids[Math.floor(rndCid() * availableCids.length)];

  const arr = poolsByCid[cid];
  const rndRow = xorshift(hash32(`${seed}:${cid}:row`));
  const idx = Math.floor(rndRow() * arr.length);

  return [arr[idx]];
}

function getHistoryTitle(uiLang, deltaDay) {
  const t = UI_STR.title[uiLang] || UI_STR.title.en;
  if (deltaDay < 0) return t.prev;
  if (deltaDay > 0) return t.next;
  return t.today;
}

function ensureNonEmptySelection(inputSet, uiLang) {
  let s = new Set(inputSet || []);
  if (s.size === 0) {
    s = new Set(
      DEFAULT_COUNTRIES_BY_LANG[uiLang] ||
        DEFAULT_COUNTRIES_BY_LANG.default
    );
  }
  const allow = new Set(["world", "korea", "japan"]);
  for (const id of [...s]) if (!allow.has(id)) s.delete(id);
  if (s.size === 0) {
    s.add(
      (DEFAULT_COUNTRIES_BY_LANG[uiLang] ||
        DEFAULT_COUNTRIES_BY_LANG.default)[0]
    );
  }
  return s;
}

// 이미지로드
const RENDERABLE_EXT_RE = /\.(jpg|jpeg|png|webp)(\?.*)?$/i;

function sanitizeImageUrl(input) {
  if (!input) return null;
  try {
    const u = new URL(String(input));
    if (u.protocol === "http:") u.protocol = "https:";
    if (!RENDERABLE_EXT_RE.test(u.pathname)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

function toWikimediaThumb(input, width = 640) {
  try {
    if (!input) return null;
    const u = new URL(input);
    if (!/upload\.wikimedia\.org$/i.test(u.hostname)) return input;

    const parts = u.pathname.split("/").filter(Boolean);
    const isThumb = parts.includes("thumb");

    if (isThumb) {
      const fileName = parts[parts.length - 2];
      parts[parts.length - 1] = `${width}px-${fileName}`;
      u.pathname = "/" + parts.join("/");
      return u.toString();
    } else {
      const fileName = parts[parts.length - 1];
      const idx = parts.indexOf("wikipedia");
      if (idx === -1) return input;
      const head = parts.slice(0, idx + 2);
      const tail = parts.slice(idx + 2);
      u.pathname =
        "/" +
        [...head, "thumb", ...tail, `${width}px-${fileName}`].join(
          "/"
        );
      return u.toString();
    }
  } catch {
    return input;
  }
}

async function withTimeout(promise, ms = 6000) {
  let t;
  const timer = new Promise((_, rej) => {
    t = setTimeout(() => rej(new Error("timeout")), ms);
  });
  try {
    return await Promise.race([promise, timer]);
  } finally {
    clearTimeout(t);
  }
}

async function headOkImage(url, timeoutMs = 1500) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return false;
    const ct = (res.headers.get("content-type") || "")
      .toLowerCase();
    return ct.startsWith("image/");
  } catch {
    return false;
  }
}

async function bestWikiThumb(rawUrl, desiredPx = 640) {
  let u = sanitizeImageUrl(rawUrl);
  if (!u) return null;
  const t1 = sanitizeImageUrl(toWikimediaThumb(u, desiredPx));
  if (t1 && (await headOkImage(t1))) return t1;
  const t2 = sanitizeImageUrl(
    toWikimediaThumb(
      u,
      Math.max(320, Math.floor(desiredPx / 2))
    )
  );
  if (t2 && (await headOkImage(t2))) return t2;
  if (await headOkImage(u)) return u;
  return null;
}

// ui
function useUIScale() {
  const { width } = useWindowDimensions();
  const BASE = 393;
  const scale = (n) => Math.round((width / BASE) * n);
  return { scale, screenW: width };
}

const FIXED_ORDER = ["world", "korea", "japan"];

// 색상 유효성 검사
function isValidColorString(s) {
  if (typeof s !== "string") return false;
  const v = s.trim();
  if (!v || v === "null" || v === "undefined") return false;
  if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v)) return true;
  if (
    /^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*(0|1|0?\.\d+))?\s*\)$/i.test(
      v
    )
  )
    return true;
  if (/^(white|black|transparent)$/i.test(v)) return true;
  return false;
}

// \나라 선택 UI
function SegmentedCountrySelector({
  uiLang,
  ordered,
  value,
  onChange,
  fixedHeight = 39,
}) {
  const { scale } = useUIScale();
  const W = scale(340);
  const H = fixedHeight;
  const R = scale(100);
  const BTN_W = scale(90);
  const BTN_H = H;
  const GAP = Math.max(0, (W - BTN_W * 3) / 2);
  const ICON = Math.max(14, Math.min(22, scale(16)));

  const toggle = (id) => {
    const next = new Set(value);
    if (next.has(id)) {
      if (next.size === 1) return;
      next.delete(id);
    } else {
      next.add(id);
    }
    onChange(next);
  };

  return (
    <View
      style={{
        width: W,
        height: H,
        backgroundColor: "rgba(167,167,167,0.27)",
        borderRadius: R,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-start",
        shadowColor: "#000",
        shadowOpacity: 0.15,
        shadowRadius: scale(8),
        shadowOffset: { width: 0, height: scale(4) },
        elevation: 4,
        paddingHorizontal: 6,
      }}
    >
      {ordered.map((id, idx) => {
        const active = value.has(id);
        const iconId = id === "world" ? null : id;
        const label =
          LABEL_BY_ID[id]?.[uiLang] ||
          LABEL_BY_ID[id]?.en ||
          id;
        return (
          <Pressable
            key={id}
            onPress={() => toggle(id)}
            style={{
              width: BTN_W,
              height: BTN_H,
              borderRadius: R,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: active ? "#FFFFFF" : "transparent",
              marginLeft: idx === 0 ? 0 : GAP,
              paddingHorizontal: 4,
            }}
            hitSlop={6}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              {!!iconId && !!FLAG_ICON[iconId] && (
                <RNImage
                  source={FLAG_ICON[iconId]}
                  style={{
                    width: ICON,
                    height: ICON,
                    marginRight: 6,
                    opacity: active ? 1 : 0.9,
                  }}
                  resizeMode="contain"
                />
              )}
              <Text
                style={{
                  fontWeight: "700",
                  fontSize: scale(13),
                  color: "#000",
                  textShadowColor: active
                    ? "transparent"
                    : "rgba(0,0,0,0.25)",
                  textShadowOffset: active
                    ? undefined
                    : { width: 0, height: 1 },
                  textShadowRadius: active ? 0 : 2,
                }}
              >
                {label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

// 헤더 (assets만)
function HeaderHero({ height, bgSource, imageUrl, uiLang }) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <View
      style={{
        height,
        width: "100%",
        position: "relative",
        zIndex: 0,
      }}
    >
      <RNImage
        source={
          bgSource ||
          require("../../assets/bg-images/k-photo1.jpg")
        }
        style={{
          width: "100%",
          height: "100%",
        }}
        resizeMode="cover"
        pointerEvents="none"
        onLoad={() => setImageLoaded(true)}
        onError={() => setImageFailed(true)}
      />
      {imageUrl && !imageLoaded && !imageFailed && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0,0,0,0.35)",
          }}
        >
          <ActivityIndicator color="#fff" />
          <Text
            style={{
              marginTop: 8,
              color: "#fff",
              fontWeight: "700",
            }}
          >
            {UI_STR.imageLoading[uiLang] ||
              UI_STR.imageLoading.en}
          </Text>
        </View>
      )}
      <View
        pointerEvents="none"
        style={{
          ...StyleSheet.absoluteFillObject,
          backgroundColor: "rgba(0,0,0,0.12)",
        }}
      />
    </View>
  );
}

// Wikipedia Banner
function WikipediaBanner({
  imageUrl,
  maxWidth = 340,
  cardBg = "none",
  customBgColor = null,
}) {
  const [imageFailed, setImageFailed] = useState(false);
  if (!imageUrl || imageFailed) return null;

  const w = maxWidth;
  const h = Math.round(w * 0.625);

  const BG_MAP = {
    none: "#FFFFFF",
    bg1: "#F9FAFB",
    bg2: "#FFF7ED",
    bg3: "#ECFEFF",
  };

  const bgColor = isValidColorString(customBgColor)
    ? customBgColor.trim()
    : BG_MAP[cardBg] ?? "#FFFFFF";

  return (
    <View
      style={{
        width: w,
        height: h,
        borderRadius: 12,
        alignSelf: "center",
        backgroundColor: bgColor,
        overflow: "hidden",
      }}
    >
      <ExpoImage
        source={imageUrl}
        style={{
          width: "100%",
          height: "100%",
        }}
        contentFit="cover"
        cachePolicy="disk"
        transition={150}
        onError={(e) => {
          console.warn("expo-image load error:", e?.nativeEvent);
          setImageFailed(true);
        }}
      />
    </View>
  );
}

// 기타 UI
function FullBleedCard({
  children,
  topInset,
  cardBg,
  customBgColor,
}) {
  const BG_MAP = {
    none: "#FFFFFF",
    bg1: "#F9FAFB",
    bg2: "#FFF7ED",
    bg3: "#ECFEFF",
  };
  const bgColor = isValidColorString(customBgColor)
    ? customBgColor.trim()
    : BG_MAP[cardBg] ?? "#FFFFFF";

  return (
    <View
      style={{
        position: "absolute",
        top: topInset,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: bgColor,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: "hidden",
        zIndex: 1,
      }}
    >
      {children}
    </View>
  );
}

function formatYearOnly(year, uiLang) {
  const y = String(year || "").trim();
  if (!y) return "";
  if (uiLang === "ko") return `${y}년`;
  if (uiLang === "ja") return `${y}年`;
  return y;
}

// 캐시 
function cacheKey(mode, parts) {
  return `@hist_cache:${mode}:${String(parts.m).padStart(
    2,
    "0"
  )}${String(parts.d).padStart(2, "0")}`;
}

async function saveCache(mode, parts, rows) {
  const key = cacheKey(mode, parts);
  const payload = JSON.stringify({
    t: Date.now(),
    rows,
  });
  try {
    await AsyncStorage.setItem(key, payload);
  } catch {}
}

async function loadCache(mode, parts) {
  const key = cacheKey(mode, parts);
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj?.t || !Array.isArray(obj?.rows)) return null;
    if (Date.now() - obj.t > DATA_CACHE_TTL_MS) return null;
    return obj.rows;
  } catch {
    return null;
  }
}

// API/로컬 응답 정규화
function normalizeItemsToRows(items, iso, parts) {
  const mm = String(parts.m).padStart(2, "0");
  const dd = String(parts.d).padStart(2, "0");
  return (items || []).map((it) => ([
    "en",
    "ko",
    "ja",
  ], {
    isoDate: iso,
    date: `D${mm}${dd}`,
    Date: `D${mm}${dd}`,
    Year: it.year,
    year: it.year,
    English: it.en || "",
    "한국어": it.ko || "",
    "日本語": it.ja || "",
    enAnchors: (it.enAnchors || [])
      .map((a) => ({
        text: a?.text,
        url: a?.url,
      }))
      .filter(
        (a) =>
          (a.text && a.text !== "#VALUE!") ||
          a.url
      ),
    koAnchors: (it.koAnchors || [])
      .map((a) => ({
        text: a?.text,
        url: a?.url,
      }))
      .filter(
        (a) =>
          (a.text && a.text !== "#VALUE!") ||
          a.url
      ),
    jaAnchors: (it.jaAnchors || [])
      .map((a) => ({
        text: a?.text,
        url: a?.url,
      }))
      .filter(
        (a) =>
          (a.text && a.text !== "#VALUE!") ||
          a.url
      ),
  }))[1]; // 작은 최적화: 배열 리터럴로 파싱 방지
}

// 로컬 우선 → API 폴백
async function apiFetchForMode(mode, todayParts) {
  const iso = `${todayParts.y}-${String(todayParts.m).padStart(
    2,
    "0"
  )}-${String(todayParts.d).padStart(2, "0")}`;

  try {
    const local = getLocalHistory(mode, todayParts);
    if (Array.isArray(local) && local.length) {
      return normalizeItemsToRows(local, iso, todayParts);
    }
  } catch {}

  if (mode === "world") {
    const quarter = monthToQuarter(todayParts.m);
    try {
      const items = await withTimeout(
        fetchHistory({
          mode: "world",
          date: iso,
          quarter,
          n: 20,
          shuffle: false,
        }),
        6000
      );
      return normalizeItemsToRows(items, iso, todayParts);
    } catch {
      const items2 = await withTimeout(
        fetchHistory({
          mode: "world",
          date: iso,
          n: 20,
          shuffle: false,
        }),
        6000
      );
      return normalizeItemsToRows(items2, iso, todayParts);
    }
  }

  const items = await withTimeout(
    fetchHistory({
      mode,
      date: iso,
      n: 20,
      shuffle: false,
    }),
    6000
  );
  return normalizeItemsToRows(items, iso, todayParts);
}

// 본문 아래 앵커
function AnchorList({ anchors }) {
  if (!anchors || !anchors.length) return null;
  return (
    <View
      style={{
        marginTop: 6,
        flexDirection: "row",
        flexWrap: "wrap",
      }}
    >
      {anchors.map((a, idx) => {
        const text = String(a?.text || "").trim();
        const url = String(a?.url || "").trim();
        if (!text || !url) return null;
        const onPress = () => Linking.openURL(url).catch(() => {});
        return (
          <Pressable
            key={`${text}-${url}-${idx}`}
            onPress={onPress}
            accessibilityRole="link"
            hitSlop={6}
            style={{
              marginRight: 10,
              marginBottom: 4,
            }}
          >
            <Text
              style={{
                fontSize: 13,
                color: "#2563EB",
                textDecorationLine: "underline",
                fontWeight: "600",
              }}
              numberOfLines={1}
            >
              {text}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// 배너 URL 캐시 키
const BANNER_KEY = (dateISO, lang) =>
  `@banner_url:${dateISO}:${lang}`;

// pick → 배너 URL 계산
async function computeBannerUrlForPick(pick, uiLang) {
  const anchorsText = getAnchorsForLang(
    pick.row,
    uiLang || "en"
  )
    .map((a) => a.text)
    .filter(Boolean);

  let imageUrl = null;

  try {
    if (anchorsText.length) {
      imageUrl = await withTimeout(
        fetchWikipediaImageFromAnchors(
          anchorsText,
          uiLang
        ),
        2500
      );
    }
  } catch {}

  if (!imageUrl) {
    const y = getYearFromRow(pick.row);
    try {
      imageUrl = await withTimeout(
        fetchImageForContent(
          pick.body,
          y,
          pick.cid
        ),
        2500
      );
    } catch {}
  }

  if (imageUrl) {
    const best = await bestWikiThumb(
      imageUrl,
      640
    );
    imageUrl = best || sanitizeImageUrl(imageUrl);
  }
  return imageUrl || null;
}

// 오늘 캐시 워밍
async function warmCacheFor({
  date,
  tz,
  uiLang,
  selectedCountries,
}) {
  const parts = getDayPartsFrom(date, tz);
  const chosen = [
    ...ensureNonEmptySelection(
      selectedCountries,
      uiLang
    ),
  ];
  for (const cid of chosen) {
    try {
      let rows = await loadCache(cid, parts);
      if (!rows) {
        rows = await apiFetchForMode(
          cid,
          parts
        );
        await saveCache(cid, parts, rows);
      }
    } catch {}
  }
}

// 캐시 + 배너 프리컴퓨트
async function warmCacheAndBanner({
  date,
  tz,
  uiLang,
  selectedCountries,
}) {
  await warmCacheFor({
    date,
    tz,
    uiLang,
    selectedCountries,
  });

  const parts = getDayPartsFrom(date, tz);
  const chosen = [
    ...ensureNonEmptySelection(
      selectedCountries,
      uiLang
    ),
  ];

  const pool = [];
  for (const cid of chosen) {
    const rows = await loadCache(
      cid,
      parts
    );
    if (Array.isArray(rows)) {
      for (const r of rows) {
        const body = bodyOfRowByLang(
          r,
          uiLang,
          cid
        );
        if (!hasAnyText(body)) continue;
        const tag = trimHtml(
          r?.["한국어"] ||
            r?.English ||
            r?.["日本語"] ||
            ""
        ).slice(0, 50);
        pool.push({
          cid,
          row: r,
          key: `${cid}|${String(
            r?.Year ||
              r?.year ||
              ""
          )}|${String(
            r?.Date ||
              r?.date ||
              ""
          )}|${tag}`,
          body,
        });
      }
    }
  }

  if (pool.length) {
    const seed = `${date
      .toISOString()
      .slice(0, 10)}__${chosen
      .sort()
      .join(",")}`;
    const pick = makePicksFromPool(
      pool,
      uiLang,
      seed
    )[0];
    const url =
      await computeBannerUrlForPick(
        pick,
        uiLang
      );
    try {
      await AsyncStorage.setItem(
        BANNER_KEY(
          date
            .toISOString()
            .slice(0, 10),
          uiLang || "en"
        ),
        url || ""
      );
    } catch {}
  }
}

// 자정 워밍(00:02)
function scheduleMidnightWarmup({
  tz,
  uiLang,
  selectedCountries,
}) {
  const now = new Date();
  const today0 = startOfDayInTz(now, tz);
  const tomorrow0 = new Date(today0);
  tomorrow0.setDate(today0.getDate() + 1);

  const target = new Date(tomorrow0);
  target.setMinutes(2, 0, 0);

  const delay = Math.max(
    0,
    target.getTime() - now.getTime()
  );

  const timer = setTimeout(async () => {
    try {
      await warmCacheAndBanner({
        date: target,
        tz,
        uiLang,
        selectedCountries,
      });
    } finally {
      scheduleMidnightWarmup({
        tz,
        uiLang,
        selectedCountries,
      });
    }
  }, delay);

  return () => clearTimeout(timer);
}

// 홈 화면
export default function Home() {
  const insets = useSafeAreaInsets();
  const { scale } = useUIScale();
  const [tz] = useState(() => {
    const z =
      Intl?.DateTimeFormat?.().resolvedOptions().timeZone ||
      "UTC";
    return safeTimeZone(z);
  });

  const tabBarHeight = useBottomTabBarHeight();
  const { width } = useWindowDimensions();

  const bannerHeight = Math.max(
    60,
    Math.round(
      Math.min(
        AD_TARGET.h,
        Math.min(width, 340) / AD_RATIO
      )
    )
  );

  const [hydrated, setHydrated] = useState(false);
  const [baseDate, setBaseDate] = useState(() =>
    startOfDayInTz(new Date(), tz)
  );
  const deviceLang = useMemo(
    () => resolveUiLangFromDevice(),
    []
  );
  const [uiLang, setUiLang] = useState(null);
  const [selectedCountries, setSelectedCountries] =
    useState(new Set());
  const [onePick, setOnePick] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [refreshTick, setRefreshTick] =
    useState(0);
  const [copyTick, setCopyTick] = useState(0);
  const [isRefreshing, setIsRefreshing] =
    useState(false);

  const [headerImageUrl, setHeaderImageUrl] =
    useState(null);

  const [notifyEnabled, setNotifyEnabled] =
    useState(false);
  const [notifyTime, setNotifyTime] =
    useState("09:00");
  const [cardBg, setCardBg] = useState("none");
  const [customBgColor, setCustomBgColor] =
    useState(null);

  const [customFont, setCustomFont] =
    useState("System");
  const [customFontSize, setCustomFontSize] =
    useState(18);
  const [customFontColor, setCustomFontColor] =
    useState("#111827");

  const getFontFamily = (font) => {
    switch (font) {
      case "System":
        return Platform.OS === "ios"
          ? "System"
          : "Roboto";
      case "Verdana":
        return Platform.OS === "ios"
          ? "Verdana"
          : "sans-serif";
      case "Arial":
        return Platform.OS === "ios"
          ? "Arial"
          : "sans-serif";
      case "Times New Roman":
        return Platform.OS === "ios"
          ? "Times New Roman"
          : "serif";
      case "Courier New":
        return Platform.OS === "ios"
          ? "Courier New"
          : "monospace";
      case "Georgia":
        return Platform.OS === "ios"
          ? "Georgia"
          : "serif";
      default:
        return Platform.OS === "ios"
          ? "System"
          : "Roboto";
    }
  };

  const bodyLineHeight = Math.round(
    (customFontSize || 18) * 1.45
  );

  const amplitudeReadyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    InteractionManager.runAfterInteractions(
      async () => {
        if (cancelled) return;
        try {
          await initAmplitude();
          amplitudeReadyRef.current = true;
          trackEvent(
            AMPLITUDE_EVENTS.SCREEN_VIEW,
            { screen: "Home" }
          );
        } catch {}
      }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setHeaderImageUrl(null);
  }, [uiLang]);

  const DAY_MS = 86400000;

  const idxFromToday = useCallback(
    (dt) => {
      const todayStart =
        startOfDayInTz(new Date(), tz).getTime();
      const tgtStart =
        startOfDayInTz(dt, tz).getTime();
      const diff = Math.round(
        (tgtStart - todayStart) / DAY_MS
      );
      return Math.max(-1, Math.min(1, diff));
    },
    [tz]
  );

  const setDayIndex = useCallback(
    (idx) => {
      const clamped = Math.max(
        -1,
        Math.min(1, idx)
      );
      const todayStart =
        startOfDayInTz(new Date(), tz);
      const next = new Date(todayStart);
      next.setDate(
        todayStart.getDate() +
          clamped
      );
      if (idxFromToday(baseDate) === clamped)
        return;
      setBaseDate(next);
    },
    [tz, baseDate, idxFromToday]
  );

  const goBy = useCallback(
    (delta) => {
      const cur = idxFromToday(baseDate);
      const next = Math.max(
        -1,
        Math.min(
          1,
          cur +
            (delta < 0
              ? -1
              : delta > 0
              ? 1
              : 0)
        )
      );
      setDayIndex(next);
    },
    [baseDate, idxFromToday, setDayIndex]
  );

  const today0 = useMemo(
    () => startOfDayInTz(baseDate, tz),
    [baseDate, tz]
  );

  const buildSharePayload =
    useCallback(() => {
      const list = Array.isArray(onePick)
        ? onePick
        : onePick
        ? [onePick]
        : [];
      const header = getMonthDayOnly(
        today0,
        uiLang || "en",
        tz
      );
      const appName =
        APP_NAME_BY_LANG[uiLang || "en"] ||
        APP_NAME_BY_LANG.en;
      const sourceLabel =
        SOURCE_LABEL[uiLang || "en"] ||
        SOURCE_LABEL.en;

      const blocks = (list || []).map(
        (p) => {
          const label =
            COUNTRY_CFG[p.cid]
              ?.label?.[uiLang || "en"] ||
            p.cid;
          const yr =
            getYearFromRow(p.row) || "";
          const content = (p.body || "").trim();

          const anchors =
            getAnchorsForLang(
              p.row,
              uiLang || "en"
            ).slice(0, 2);
          const anchorLines =
            anchors
              .map((a) => {
                const text = (a?.text || "").trim();
                const url = (a?.url || "").trim();
                if (text && url)
                  return `${text} — ${url}`;
                return null;
              })
              .filter(Boolean);

          return [
            label,
            yr,
            content,
            ...anchorLines,
            `${sourceLabel}: ${appName}`,
          ]
            .filter(Boolean)
            .join("\n");
        }
      );

      const payload = [
        header,
        ...blocks,
        APP_DOWNLOAD_URL,
      ].join("\n\n");

      return { header, payload };
    }, [onePick, today0, uiLang, tz]);

  const onSystemSharePress =
    useCallback(async () => {
      try {
        const {
          header,
          payload,
        } = buildSharePayload();
        try {
          await NativeShare.share({
            message: payload,
            title: header,
          });
          return;
        } catch {}

        if (await Sharing.isAvailableAsync()) {
          const uri =
            FileSystem.cacheDirectory +
            `history_${Date.now()}.txt`;
          await FileSystem.writeAsStringAsync(
            uri,
            payload,
            {
              encoding:
                FileSystem
                  .EncodingType
                  .UTF8,
            }
          );
          await Sharing.shareAsync(uri, {
            dialogTitle: header,
            UTI: "public.plain-text",
            mimeType: "text/plain",
          });
          return;
        }

        await Clipboard.setStringAsync(
          payload
        );
        setCopyTick((t) => t + 1);
      } catch {}
    }, [buildSharePayload]);

  useEffect(() => {
    const offPrev =
      onGoPrevDay?.(() => {
        if (amplitudeReadyRef.current)
          trackEvent(
            AMPLITUDE_EVENTS.YESTERDAY_CLICKED,
            {
              language: uiLang,
              countries: [
                ...selectedCountries,
              ],
            }
          );
        goBy(-1);
      });

    const offNext =
      onGoNextDay?.(() => {
        if (amplitudeReadyRef.current)
          trackEvent(
            AMPLITUDE_EVENTS.TOMORROW_CLICKED,
            {
              language: uiLang,
              countries: [
                ...selectedCountries,
              ],
            }
          );
        goBy(+1);
      });

    const offRefresh =
      onRefresh?.(() => {
        if (amplitudeReadyRef.current)
          trackEvent(
            AMPLITUDE_EVENTS.REFRESH_CLICKED,
            {
              language: uiLang,
              countries: [
                ...selectedCountries,
              ],
            }
          );
        handlePullToRefresh();
      });

    const offShare =
      onShareAttach?.(() => {
        onSystemSharePress();
      });

    return () => {
      offPrev && offPrev();
      offNext && offNext();
      offRefresh && offRefresh();
      offShare && offShare();
    };
  }, [
    goBy,
    uiLang,
    selectedCountries,
    onSystemSharePress,
  ]);

  const fetchingRef = useRef(false);
  const handlePullToRefresh =
    useCallback(() => {
      if (fetchingRef.current) return;
      setIsRefreshing(true);
      setRefreshTick((t) => t + 1);
    }, []);

  // 초기 AsyncStorage 복원
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const pairs =
          await AsyncStorage.multiGet([
            STORAGE_KEY_UI_LANG,
            STORAGE_KEY_SELECTED,
            STORAGE_KEY_NOTIFY_ENABLED,
            STORAGE_KEY_NOTIFY_TIME,
            STORAGE_KEY_CARD_BG,
            STORAGE_KEY_BG_COLOR,
            STORAGE_KEY_FONT,
            STORAGE_KEY_FONT_SIZE,
            STORAGE_KEY_FONT_COLOR,
          ]).catch(() => []);
        const dict =
          Object.fromEntries(
            pairs || []
          );
        if (!alive) return;

        const storedLang =
          dict[STORAGE_KEY_UI_LANG] ||
          null;
        const lang =
          storedLang === "ko" ||
          storedLang === "en" ||
          storedLang === "ja"
            ? storedLang
            : deviceLang;

        setUiLang(lang);
        if (amplitudeReadyRef.current) {
          setUserProperties({
            language: lang,
            device_language:
              deviceLang,
          });
        }

        let nextSet;
        if (dict[STORAGE_KEY_SELECTED]) {
          let arr = [];
          try {
            arr = JSON.parse(
              dict[STORAGE_KEY_SELECTED]
            );
          } catch {}
          nextSet =
            ensureNonEmptySelection(
              new Set(
                Array.isArray(arr)
                  ? arr
                  : []
              ),
              lang
            );
        } else {
          nextSet =
            ensureNonEmptySelection(
              new Set(),
              lang
            );
        }
        setSelectedCountries(nextSet);
        try {
          await AsyncStorage.setItem(
            STORAGE_KEY_SELECTED,
            JSON.stringify([
              ...nextSet,
            ])
          );
        } catch {}

        setNotifyEnabled(
          dict[STORAGE_KEY_NOTIFY_ENABLED] ===
            "1"
        );
        if (dict[STORAGE_KEY_NOTIFY_TIME]) {
          setNotifyTime(
            dict[STORAGE_KEY_NOTIFY_TIME]
          );
        }

        if (dict[STORAGE_KEY_CARD_BG]) {
          setCardBg(
            dict[STORAGE_KEY_CARD_BG]
          );
        }

        const rawBg =
          dict[STORAGE_KEY_BG_COLOR];
        setCustomBgColor(
          isValidColorString(rawBg)
            ? rawBg
            : null
        );

        if (dict[STORAGE_KEY_FONT])
          setCustomFont(
            dict[STORAGE_KEY_FONT]
          );
        if (dict[STORAGE_KEY_FONT_SIZE]) {
          const v = parseInt(
            dict[STORAGE_KEY_FONT_SIZE],
            10
          );
          if (!Number.isNaN(v) && v > 8)
            setCustomFontSize(v);
        }
        if (dict[STORAGE_KEY_FONT_COLOR])
          setCustomFontColor(
            dict[STORAGE_KEY_FONT_COLOR]
          );
      } catch (e) {
        console.warn(
          "Init restore failed:",
          e
        );
      } finally {
        setHydrated(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [deviceLang]);

  // 포커스 시 설정/언어 동기화 (언어 되돌림 방지)
  useFocusEffect(
    useCallback(() => {
      if (!hydrated) return () => {};
      let alive = true;

      (async () => {
        try {
          const pairs = await AsyncStorage.multiGet([
            STORAGE_KEY_UI_LANG,
            STORAGE_KEY_SELECTED,
            STORAGE_KEY_CARD_BG,
            STORAGE_KEY_BG_COLOR,
            STORAGE_KEY_FONT,
            STORAGE_KEY_FONT_SIZE,
            STORAGE_KEY_FONT_COLOR,
            STORAGE_KEY_NOTIFY_ENABLED,
            STORAGE_KEY_NOTIFY_TIME,
          ]).catch(() => []);
          const dict = Object.fromEntries(pairs || []);
          if (!alive) return;

          const storedLang = dict[STORAGE_KEY_UI_LANG] || null;

          // 핵심: 메모리에 있는 uiLang을 우선 신뢰하고,
          // 저장소에 유효 값(ko/en/ja)이 있을 때만 그걸로 덮어씀.
          // 비어있다고 deviceLang으로 되돌리지 않는다.
          let nextLang = uiLang || deviceLang;
          if (storedLang === "ko" || storedLang === "en" || storedLang === "ja") {
            nextLang = storedLang;
          }
          if (!nextLang) {
            nextLang = deviceLang;
          }

          if (nextLang !== uiLang) {
            setUiLang(nextLang);

            let arr = [];
            try {
              arr = JSON.parse(
                dict[STORAGE_KEY_SELECTED] || "[]"
              );
            } catch {}
            let cur = new Set(
              Array.isArray(arr) ? arr : []
            );
            if (cur.size === 0) {
              cur = ensureNonEmptySelection(cur, nextLang);
              setSelectedCountries(cur);
              try {
                await AsyncStorage.setItem(
                  STORAGE_KEY_SELECTED,
                  JSON.stringify([...cur])
                );
              } catch {}
            }
            setRefreshTick((t) => t + 1);
          } else {
            const storedSel =
              dict[STORAGE_KEY_SELECTED];
            if (storedSel) {
              let arr = [];
              try {
                arr = JSON.parse(storedSel);
              } catch {}
              if (Array.isArray(arr)) {
                let nextSet =
                  ensureNonEmptySelection(
                    new Set(arr),
                    nextLang
                  );
                if (
                  !equalSets(
                    nextSet,
                    selectedCountries
                  )
                ) {
                  setSelectedCountries(
                    nextSet
                  );
                  try {
                    await AsyncStorage.setItem(
                      STORAGE_KEY_SELECTED,
                      JSON.stringify(
                        [...nextSet]
                      )
                    );
                  } catch {}
                  setRefreshTick(
                    (t) => t + 1
                  );
                }
              }
            }
          }

          const storedBgColor =
            dict[STORAGE_KEY_BG_COLOR] ?? null;
          setCustomBgColor(
            isValidColorString(storedBgColor)
              ? storedBgColor
              : null
          );

          const storedCardBg =
            dict[STORAGE_KEY_CARD_BG] || null;
          if (
            storedCardBg &&
            storedCardBg !== cardBg
          ) {
            setCardBg(storedCardBg);
          }

          if (dict[STORAGE_KEY_FONT]) {
            setCustomFont(dict[STORAGE_KEY_FONT]);
          }

          if (dict[STORAGE_KEY_FONT_SIZE]) {
            const v = parseInt(
              dict[STORAGE_KEY_FONT_SIZE],
              10
            );
            if (!Number.isNaN(v) && v > 8) {
              setCustomFontSize(v);
            }
          }

          if (dict[STORAGE_KEY_FONT_COLOR]) {
            setCustomFontColor(
              dict[STORAGE_KEY_FONT_COLOR]
            );
          }

          if (
            dict[STORAGE_KEY_NOTIFY_ENABLED] !=
            null
          ) {
            setNotifyEnabled(
              dict[STORAGE_KEY_NOTIFY_ENABLED] ===
                "1"
            );
          }

          if (dict[STORAGE_KEY_NOTIFY_TIME]) {
            setNotifyTime(
              dict[STORAGE_KEY_NOTIFY_TIME]
            );
          }
        } catch (e) {
          console.warn("focus sync failed:", e);
        }
      })();

      return () => {
        alive = false;
      };
    }, [
      hydrated,
      uiLang,
      selectedCountries,
      cardBg,
      customBgColor,
      deviceLang,
    ])
  );

  const todayParts = useMemo(
    () => getDayPartsFrom(today0, tz),
    [today0, tz]
  );

  // 언어와 독립적으로 날짜+선택국가 기준 시드
  const stableKey = useMemo(
    () =>
      `${today0.toISOString()}__${[
        ...selectedCountries,
      ]
        .sort()
        .join(",")}`,
    [today0, selectedCountries]
  );

  const seedKey = useMemo(
    () =>
      `${stableKey}__r${refreshTick}`,
    [stableKey, refreshTick]
  );

  // 언어 변경 시 기존 pick의 body만 새 언어로 재매핑
  useEffect(() => {
    setOnePick((prev) => {
      if (!Array.isArray(prev) || !prev.length)
        return prev;
      return prev.map((it) => {
        const newBody = bodyOfRowByLang(
          it.row,
          uiLang,
          it.cid
        );
        return newBody && hasAnyText(newBody)
          ? { ...it, body: newBody }
          : it;
      });
    });
  }, [uiLang]);

  const endLoading = useCallback(() => {
    setLoading(false);
    setIsRefreshing(false);
  }, []);

  // 데이터 로드: 캐시 → 네트워크
  useEffect(() => {
    if (!hydrated || !uiLang) return;
    let canceled = false;
    fetchingRef.current = true;

    (async () => {
      try {
        setErr("");

        const safeSelected =
          ensureNonEmptySelection(
            selectedCountries,
            uiLang
          );
        if (
          !equalSets(
            safeSelected,
            selectedCountries
          )
        ) {
          setSelectedCountries(
            safeSelected
          );
          try {
            await AsyncStorage.setItem(
              STORAGE_KEY_SELECTED,
              JSON.stringify(
                [...safeSelected]
              )
            );
          } catch {}
        }

        const chosen = [
          ...ensureNonEmptySelection(
            selectedCountries,
            uiLang
          ),
        ];
        if (!chosen.length) {
          if (!canceled) endLoading();
          return;
        }

        // 1) 캐시
        const cachedPoolsByCid = {};
        for (const cid of chosen) {
          const c =
            await loadCache(
              cid,
              todayParts
            );
          if (
            Array.isArray(c) &&
            c.length
          ) {
            const arr = [];
            for (const r of c) {
              const body =
                bodyOfRowByLang(
                  r,
                  uiLang,
                  cid
                );
              if (!hasAnyText(body))
                continue;
              const tag =
                trimHtml(
                  r?.["한국어"] ||
                    r?.English ||
                    r?.["日本語"] ||
                    ""
                ).slice(0, 50);
              arr.push({
                cid,
                row: r,
                key: `${cid}|${String(
                  r?.Year ||
                    r?.year ||
                    ""
                )}|${String(
                  r?.Date ||
                    r?.date ||
                    ""
                )}|${tag}`,
                body,
              });
            }
            if (arr.length) {
              cachedPoolsByCid[cid] =
                arr;
            }
          }
        }

        const hadCache = Object.values(
          cachedPoolsByCid
        ).some(
          (arr) =>
            arr &&
            arr.length
        );

        if (!canceled && hadCache) {
          const picks =
            makeFairSinglePickFromPools(
              cachedPoolsByCid,
              chosen,
              stableKey
            );
          if (picks.length) {
            setOnePick(picks);
            endLoading();
          }
        }

        if (!hadCache) {
          setLoading(true);
        }

        // 2) 네트워크
        const poolsByCid = {};
        for (const cid of chosen) {
          const rows =
            await apiFetchForMode(
              cid,
              todayParts
            );
          await saveCache(
            cid,
            todayParts,
            rows
          );
          const arr = [];
          for (const r of rows) {
            const body =
              bodyOfRowByLang(
                r,
                uiLang,
                cid
              );
            if (!hasAnyText(body))
              continue;
            const tag =
              trimHtml(
                r?.["한국어"] ||
                  r?.English ||
                  r?.["日本語"] ||
                  ""
              ).slice(0, 50);
            arr.push({
              cid,
              row: r,
              key: `${cid}|${String(
                r?.Year ||
                  r?.year ||
                  ""
              )}|${String(
                r?.Date ||
                  r?.date ||
                  ""
              )}|${tag}`,
              body,
            });
          }
          if (arr.length) {
            poolsByCid[cid] = arr;
          }
        }

        if (!canceled) {
          const hasAny =
            Object.values(
              poolsByCid
            ).some(
              (arr) =>
                arr &&
                arr.length
            );
          if (hasAny) {
            const picks =
              makeFairSinglePickFromPools(
                poolsByCid,
                chosen,
                seedKey
              );
            if (picks.length) {
              setOnePick(picks);
              endLoading();
            }
          } else if (!hadCache) {
            setOnePick([]);
            setHeaderImageUrl(
              null
            );
            endLoading();
          }
        }
      } catch (e) {
        if (!canceled) {
          setErr(
            String(
              e?.message || e
            )
          );
          endLoading();
        }
      }
    })().finally(() => {
      fetchingRef.current = false;
    });

    return () => {
      canceled = true;
    };
  }, [
    hydrated,
    todayParts,
    uiLang,
    selectedCountries,
    stableKey,
    seedKey,
    endLoading,
  ]);

  // 배너 이미지
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!onePick || !onePick.length) {
          if (hydrated && uiLang) {
            const iso =
              startOfDayInTz(
                new Date(),
                tz
              )
                .toISOString()
                .slice(0, 10);
            try {
              const cachedUrl =
                await AsyncStorage.getItem(
                  BANNER_KEY(
                    iso,
                    uiLang
                  )
                );
              if (
                alive &&
                cachedUrl !==
                  null
              ) {
                setHeaderImageUrl(
                  cachedUrl ||
                    null
                );
                return;
              }
            } catch {}
          }
          setHeaderImageUrl(null);
          return;
        }

        const first =
          onePick[0];
        const url =
          await computeBannerUrlForPick(
            first,
            uiLang
          );
        if (alive) {
          setHeaderImageUrl(
            url || null
          );
          try {
            const iso =
              startOfDayInTz(
                new Date(),
                tz
              )
                .toISOString()
                .slice(0, 10);
            await AsyncStorage.setItem(
              BANNER_KEY(
                iso,
                uiLang ||
                  "en"
              ),
              url || ""
            );
          } catch {}
        }
      } catch {
        if (alive)
          setHeaderImageUrl(
            null
          );
      }
    })();
    return () => {
      alive = false;
    };
  }, [
    onePick,
    uiLang,
    hydrated,
    tz,
  ]);

  // 자정 캐시 워밍
  useEffect(() => {
    if (!hydrated || !uiLang)
      return;
    const stop =
      scheduleMidnightWarmup({
        tz,
        uiLang,
        selectedCountries,
      });
    return stop;
  }, [
    hydrated,
    tz,
    uiLang,
    selectedCountries,
  ]);

  // 앱 복귀 시 프리워밍
  useEffect(() => {
    const sub =
      AppState.addEventListener(
        "change",
        (s) => {
          if (s === "active") {
            const today =
              startOfDayInTz(
                new Date(),
                tz
              );
            warmCacheAndBanner({
              date: today,
              tz,
              uiLang,
              selectedCountries,
            }).catch(
              () => {}
            );
          }
        }
      );
    return () => sub.remove();
  }, [tz, uiLang, selectedCountries]);

  const deltaDay = useMemo(() => {
    const idx =
      idxFromToday(baseDate);
    return idx;
  }, [baseDate, idxFromToday]);

  const handleCountriesChange =
    useCallback(
      (nextSetRaw) => {
        const ensured =
          ensureNonEmptySelection(
            nextSetRaw,
            uiLang
          );
        const added = [
          ...ensured,
        ].filter(
          (c) =>
            !selectedCountries.has(
              c
            )
        );
        const removed = [
          ...selectedCountries,
        ].filter(
          (c) =>
            !ensured.has(c)
        );

        if (
          amplitudeReadyRef.current &&
          (added.length ||
            removed.length)
        ) {
          trackEvent(
            AMPLITUDE_EVENTS.COUNTRY_CLICKED,
            {
              language: uiLang,
              added_countries:
                added,
              removed_countries:
                removed,
              total_selected:
                ensured.size,
              selected_countries:
                [
                  ...ensured,
                ],
            }
          );
        }

        setSelectedCountries(
          ensured
        );
        AsyncStorage.setItem(
          STORAGE_KEY_SELECTED,
          JSON.stringify(
            [...ensured]
          )
        ).catch(() => {});
        setRefreshTick(
          (t) => t + 1
        );
      },
      [selectedCountries, uiLang]
    );

  // 알림 제목/본문 (현재 언어 기준)
  const buildNotificationTitleNow =
    useCallback(() => {
      const appName =
        APP_NAME_BY_LANG[uiLang || "en"] ||
        APP_NAME_BY_LANG.en;
      const t =
        UI_STR.title[uiLang || "en"] ||
        UI_STR.title.en;
      const todayTitle =
        t.today || "Today in History";
      return `${appName} · ${todayTitle}`;
    }, [uiLang]);

  const buildNotificationBodyNow =
  useCallback(() => {
    const list = Array.isArray(onePick)
      ? onePick
      : onePick
      ? [onePick]
      : [];
    
    // 날짜를 YYYY/MM/DD 형식으로 변환
    const currentDate = startOfDayInTz(new Date(), tz);
    const parts = getDayPartsFrom(currentDate, tz);
    const dateStr = `${parts.y}/${parts.m}/${parts.d}`;
    
    const maxBodyLen =
      uiLang === "ko" ||
      uiLang === "ja"
        ? 20
        : 40;

    const body = list.length
      ? `${dateStr} — ` +
        list
          .map((p) => {
            const label =
              COUNTRY_CFG[p.cid]
                ?.label?.[
                uiLang ||
                  "en"
              ] || p.cid;
            const yr =
              getYearFromRow(
                p.row
              );
            const txt =
              p.body || "";
            const trunc =
              txt.length >
              maxBodyLen
                ? `${txt.slice(
                    0,
                    maxBodyLen
                  )}...`
                : txt;
            return `${label}${
              yr
                ? ` ${formatYearOnly(
                    yr,
                    uiLang ||
                      "en"
                  )}`
                : ""
            }: ${trunc}`;
          })
          .join(" • ")
      : `${dateStr}`;

    return body;
  }, [onePick, uiLang, tz]);

  // 알림: 언어/콘텐츠 변경 시 항상 최신 텍스트로 재저장 + 재스케줄
  useEffect(() => {
    (async () => {
      try {
        if (!hydrated || !uiLang) return;

        const nextTitle =
          buildNotificationTitleNow();
        const nextBody =
          buildNotificationBodyNow();

        await AsyncStorage.multiSet([
          [STORAGE_KEY_NOTIFY_TITLE, nextTitle],
          [STORAGE_KEY_NOTIFY_BODY, nextBody],
        ]);

        if (notifyEnabled) {
          const [H, M] = (notifyTime || "09:00")
            .split(":")
            .map((x) => parseInt(x, 10) || 0);

          try {
            await cancelAllScheduled?.();
          } catch {}

          // scheduleDailyAt 구현체가 title/body 인자를 안 쓰더라도 문제 없음.
          try {
            await scheduleDailyAt?.(
              H,
              M,
              nextTitle,
              nextBody
            );
          } catch (e) {
            console.warn(
              "re-schedule failed:",
              e
            );
          }
        }
      } catch (e) {
        console.warn(
          "notify/lang sync failed:",
          e
        );
      }
    })();
  }, [
    hydrated,
    uiLang,
    onePick,
    notifyEnabled,
    notifyTime,
    buildNotificationTitleNow,
    buildNotificationBodyNow,
  ]);

  const list = Array.isArray(onePick)
    ? onePick
    : onePick
    ? [onePick]
    : [];

  const ordered = FIXED_ORDER;

  const SEGMENT_H = 38;
  const TOP_PX = 58;
  const BOTTOM_PX = 93;
  const HEADER_H =
    insets.top +
    TOP_PX +
    SEGMENT_H +
    BOTTOM_PX;
  const CONTENT_W = 340;

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: "transparent",
      }}
      edges={["top", "bottom"]}
    >
      {!hydrated ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ActivityIndicator />
        </View>
      ) : (
        <>
          <StatusBar
            translucent
            backgroundColor="transparent"
            barStyle="dark-content"
          />
          <Stack.Screen
            options={{
              headerShown: false,
              freezeOnBlur: true,
            }}
          />

          {/* 헤더 */}
          <HeaderHero
            height={HEADER_H + 15}
            bgSource={require("../../assets/bg-images/k-photo1.jpg")}
            imageUrl={null}
            uiLang={uiLang || "en"}
          />

          {/* 나라 선택 */}
          <View
            pointerEvents="box-none"
            style={{
              position: "absolute",
              top: insets.top + TOP_PX,
              left: 0,
              right: 0,
              alignItems: "center",
              zIndex: 3,
            }}
          >
            <SegmentedCountrySelector
              uiLang={uiLang || "en"}
              ordered={ordered}
              value={selectedCountries}
              onChange={handleCountriesChange}
              fixedHeight={SEGMENT_H}
            />
          </View>

          {/* 본문 카드 */}
          <FullBleedCard
            topInset={HEADER_H - 15}
            cardBg={cardBg}
            customBgColor={customBgColor}
          >
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{
                flexGrow: 1,
                paddingHorizontal: 16,
                paddingBottom:
                  24 +
                  (ENABLE_BOTTOM_BANNER
                    ? bannerHeight +
                      12 +
                      tabBarHeight
                    : 0),
              }}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={handlePullToRefresh}
                />
              }
            >
              <View
                style={{
                  paddingTop: 20,
                  width: CONTENT_W,
                  alignSelf: "center",
                }}
              >
                {/* 제목/날짜 */}
                <View
                  style={{
                    paddingVertical: 20,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 20,
                      fontWeight: "800",
                    }}
                  >
                    {getHistoryTitle(
                      uiLang || "en",
                      deltaDay
                    )}
                  </Text>
                  <Text
                    style={{
                      marginTop: 6,
                      fontSize: 14,
                      color: "#374151",
                    }}
                  >
                    {safeToLocaleDateString(
                      today0,
                      LOCALE_BY_LANG[
                        uiLang || "en"
                      ] || "en-US",
                      {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        timeZone: tz,
                      }
                    )}
                  </Text>
                </View>

                {/* 이벤트 (최대 1개) */}
                <View
                  style={{
                    marginTop: 0,
                    gap: 14,
                  }}
                >
                  {list.length === 0 ? (
                    <Text
                      style={{
                        color: "#6b7280",
                      }}
                    >
                      {loading
                        ? "..."
                        : UI_STR.empty[
                            uiLang || "en"
                          ] ||
                          UI_STR.empty.en}
                    </Text>
                  ) : (
                    list.map((p) => {
                      const label =
                        COUNTRY_CFG[p.cid]
                          ?.label?.[
                          uiLang || "en"
                        ] || p.cid;
                      const eventYear =
                        getYearFromRow(
                          p.row
                        );
                      const yearLabel =
                        formatYearOnly(
                          eventYear,
                          uiLang || "en"
                        );
                      const anchors =
                        getAnchorsForLang(
                          p.row,
                          uiLang || "en"
                        );

                      return (
                        <View
                          key={p.key}
                          style={{
                            gap: 6,
                          }}
                        >
                          <Text
                            style={{
                              fontWeight: "700",
                            }}
                          >
                            {label}
                            {!!yearLabel && (
                              <Text
                                style={{
                                  fontSize: 12,
                                  color:
                                    "#64748b",
                                }}
                              >
                                {` (${yearLabel})`}
                              </Text>
                            )}
                          </Text>

                          <Text
                            style={{
                              marginTop: 14,
                              marginBottom: 14,
                              fontSize:
                                customFontSize,
                              lineHeight:
                                bodyLineHeight,
                              fontFamily:
                                getFontFamily(
                                  customFont
                                ),
                              color:
                                customFontColor,
                            }}
                          >
                            {p.body}
                          </Text>

                          <AnchorList
                            anchors={
                              anchors
                            }
                          />
                        </View>
                      );
                    })
                  )}
                </View>

                <View
                  style={{
                    height: 36,
                  }}
                />
              </View>
            </ScrollView>
          </FullBleedCard>

          {/* 하단 배너 */}
          {ENABLE_BOTTOM_BANNER &&
            headerImageUrl && (
              <View
                pointerEvents="box-none"
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom:
                    tabBarHeight -
                    40,
                  alignItems:
                    "center",
                  zIndex: 10000,
                  elevation: 10000,
                }}
              >
                <View
                  style={{
                    height:
                      bannerHeight,
                  }}
                >
                  <WikipediaBanner
                    imageUrl={
                      headerImageUrl
                    }
                    maxWidth={Math.min(
                      820,
                      Math.floor(
                        width *
                          0.84
                      )
                    )}
                    cardBg={cardBg}
                    customBgColor={
                      customBgColor
                    }
                  />
                </View>
              </View>
            )}

          {/* 상단 로딩 인디케이터 */}
          {loading &&
            !isRefreshing && (
              <View
                style={{
                  position:
                    "absolute",
                  top: 12,
                  right: 12,
                }}
              >
                <ActivityIndicator />
              </View>
            )}

          {/* 에러 표시 */}
          {!!err && (
            <View
              style={{
                position:
                  "absolute",
                bottom: 12,
                left: 12,
                right: 12,
                backgroundColor:
                  "#fee2e2",
                padding: 10,
                borderRadius: 8,
              }}
            >
              <Text
                style={{
                  color: "#b91c1c",
                }}
              >
                Error: {err}
              </Text>
            </View>
          )}
        </>
      )}
    </SafeAreaView>
  );
}
