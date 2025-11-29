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
  Modal,
  BackHandler,
  ToastAndroid,
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
import { getLocalHistory } from "../../lib/localHistory";
import { Image as ExpoImage } from "expo-image";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { WebView } from "react-native-webview";
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';

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
const STORAGE_KEY_SEEN_PREFIX = "@seen_events_v1:";


// 데이터 캐시 TTL (6시간)
const DATA_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const DATA_CACHE_VERSION = "v5";


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

const FIELD_LABELS = {
  ko: {
    location: "위치",
    date: "날짜",
  },
  en: {
    location: "Location",
    date: "Date",
  },
  ja: {
    location: "場所",
    date: "日付",
  },
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
const LOCALE_BY_LANG = { ko: "ko", en: "en", ja: "ja" };
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
  world: require("../../assets/flag/world.png"),
  korea: require("../../assets/flag/korea.png"),
  japan: require("../../assets/flag/japan.png"),
};

// 나라별 헤더 배경 이미지 (각 7장씩)
const HERO_BG_IMAGES = {
  korea: [
    require("../../assets/bg-images/k-photo1.jpg"),
    require("../../assets/bg-images/k-photo2.jpg"),
    require("../../assets/bg-images/k-photo3.jpg"),
    require("../../assets/bg-images/k-photo4.jpg"),
    require("../../assets/bg-images/k-photo5.jpg"),
    require("../../assets/bg-images/k-photo6.jpg"),
    require("../../assets/bg-images/k-photo7.jpg"),
  ],
  japan: [
    require("../../assets/bg-images/j-photo1.jpg"),
    require("../../assets/bg-images/j-photo2.jpg"),
    require("../../assets/bg-images/j-photo3.jpg"),
    require("../../assets/bg-images/j-photo4.jpg"),
    require("../../assets/bg-images/j-photo5.jpg"),
    require("../../assets/bg-images/j-photo6.jpg"),
    require("../../assets/bg-images/j-photo7.jpg"),
  ],
  world: [
    require("../../assets/bg-images/uk-photo1.jpg"),
    require("../../assets/bg-images/uk-photo2.jpg"),
    require("../../assets/bg-images/uk-photo3.jpg"),
    require("../../assets/bg-images/uk-photo4.jpg"),
    require("../../assets/bg-images/uk-photo5.jpg"),
    require("../../assets/bg-images/uk-photo6.jpg"),
    require("../../assets/bg-images/uk-photo7.jpg"),
  ],
};

const DEFAULT_HERO_BG = require("../../assets/bg-images/k-photo1.jpg");

const AD_RATIO = 3.2;
const AD_TARGET = { w: 320, h: 100 };
const ENABLE_BOTTOM_BANNER = true;

// 날짜 시간
function safeTimeZone(tzCandidate) {
  const tz = String(tzCandidate || "");
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz }).format(0);
    return tz;
  } catch {
    return "UTC";
  }
}

const SUPPORTED_LOCALES = new Set(["en", "ko", "ja"]);

function safeLocale(localeCandidate) {
  const lc = String(localeCandidate || "en");
  return SUPPORTED_LOCALES.has(lc) ? lc : "en";
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
      return date.toLocaleDateString("en");
    } catch {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(date.getDate()).padStart(2, "0")}`;
    }
  }
}

function safeFormatParts(date, tz) {
  // ✅ 1) date를 무조건 유효한 Date로 정규화
  let d = date;

  // Date 인스턴스가 아니면 한 번 감싸보기
  if (!(d instanceof Date)) {
    d = new Date(d);
  }

  // 그래도 Invalid Date면 현재 시간으로 대체
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) {
    d = new Date();
  }

  // ✅ 2) 실제 formatToParts 호출
  try {
    const dtf = new Intl.DateTimeFormat("en-CA", {
      timeZone: safeTimeZone(tz),
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return dtf
      .formatToParts(d)  // ⬅️ 항상 유효한 Date만 들어감
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
      .formatToParts(d)
      .reduce((a, p) => {
        if (p.type !== "literal") a[p.type] = p.value;
        return a;
      }, {});
  }
}


// 유틸
function resolveUiLangFromDevice() {
  const raw =
    Localization.locale ||
    (Localization.getLocales?.()[0]?.languageCode) ||
    "en";

  const tag = String(raw).toLowerCase();
  const code = tag.split(/[-_]/)[0];

  if (code === "ko") return "ko";
  if (code === "ja") return "ja";
  return "en";
}

function normalizeUiLang(value, fallback = "en") {
  const v = String(value || "").toLowerCase();
  if (!v) return fallback;

  const code = v.split(/[-_]/)[0];

  if (code === "ko") return "ko";
  if (code === "ja") return "ja";
  if (code === "en") return "en";

  return fallback;
}

function startOfDayInTz(base = new Date(), tz = "UTC") {
  const parts = safeFormatParts(base, tz);
  const y = parts.year || "1970";
  const m = parts.month || "01";
  const d = parts.day || "01";

  const result = new Date(`${y}-${m}-${d}T00:00:00`);

  // 혹시라도 여전히 Invalid Date면 그냥 현재 날짜 리턴
  if (!(result instanceof Date) || isNaN(result.getTime())) {
    return new Date();
  }
  return result;
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
    LOCALE_BY_LANG[uiLang] || "en",
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

// 나라+날짜 기준 헤더 배경 선택 (7장 순환)
function pickDailyHeroBg(cid, date) {
  const list = HERO_BG_IMAGES[cid];
  if (!list || !list.length) return DEFAULT_HERO_BG;
  const dayIndex = date.getDay(); // 0~6
  return list[dayIndex % list.length];
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

async function pickOneWithSeenRotation(poolsByCid, chosenIds, seed, isoDate) {
  if (!chosenIds || !chosenIds.length) return null;

  // 1) 나라별( cid ) + 날짜별( isoDate )로 본 이벤트 정보 불러오기
  const bucketKeys = chosenIds.map(
    (cid) => `${STORAGE_KEY_SEEN_PREFIX}${cid}:${isoDate}`
  );

  let pairs = [];
  try {
    pairs = await AsyncStorage.multiGet(bucketKeys);
  } catch {
    pairs = [];
  }

  const seenMap = {}; // bucketKey -> Set(keys)
  for (const [k, v] of pairs || []) {
    if (!k) continue;
    try {
      const arr = v ? JSON.parse(v) : [];
      seenMap[k] = new Set(Array.isArray(arr) ? arr : []);
    } catch {
      seenMap[k] = new Set();
    }
  }

  // 2) 각 나라별로 "아직 안 본 이벤트"만 남기기
  const filteredPools = {};
  for (const cid of chosenIds) {
    const pool = poolsByCid[cid] || [];
    if (!pool.length) continue;

    const bucketKey = `${STORAGE_KEY_SEEN_PREFIX}${cid}:${isoDate}`;
    const seenSet = seenMap[bucketKey] || new Set();

    const unSeen = pool.filter((p) => !seenSet.has(p.key));

    if (unSeen.length > 0) {
      // 아직 안 본 이벤트가 남아 있으면 그것들만 사용
      filteredPools[cid] = unSeen;
    } else {
      // 다 본 상태면 한 바퀴 돌았다고 보고, 다시 전체 pool로 리셋
      filteredPools[cid] = pool;
      seenMap[bucketKey] = new Set();
    }
  }

  // 3) 기존 "공평하게 나라 선택 + 해당 나라에서 랜덤 1개" 로직 재사용
  const pickArr = makeFairSinglePickFromPools(
    filteredPools,
    chosenIds,
    seed
  );
  if (!pickArr.length) return null;

  const pick = pickArr[0];

  // 4) 이번에 뽑힌 이벤트를 "봤다"로 기록
  const bucketKey = `${STORAGE_KEY_SEEN_PREFIX}${pick.cid}:${isoDate}`;
  const prevSeen = seenMap[bucketKey] || new Set();
  prevSeen.add(pick.key);

  try {
    await AsyncStorage.setItem(
      bucketKey,
      JSON.stringify([...prevSeen])
    );
  } catch {}

  return pick;
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

// 나라 선택 UI
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
        const iconId = id; // world 포함해서 모두 아이콘 사용
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

// WebView Modal Component
function WebViewModal({ visible, url, onClose }) {
  const { scale } = useUIScale();
  
  if (!visible || !url) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }} edges={["top"]}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: "#E5E7EB",
            backgroundColor: "#FFFFFF",
          }}
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              flex: 1,
              color: "#111827",
            }}
            numberOfLines={1}
          >
            {url}
          </Text>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            style={{
              marginLeft: 12,
              padding: 8,
              borderRadius: 8,
              backgroundColor: "#F3F4F6",
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "600", color: "#374151" }}>
              ✕
            </Text>
          </Pressable>
        </View>

        <WebView
          source={{ uri: url }}
          style={{ flex: 1 }}
          startInLoadingState={true}
          renderLoading={() => (
            <View
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#FFFFFF",
              }}
            >
              <ActivityIndicator size="large" color="#2563EB" />
            </View>
          )}
        />
      </SafeAreaView>
    </Modal>
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
          DEFAULT_HERO_BG
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


function WikipediaBanner({
  imageUrl,
  maxWidth = 340,
  screenWidth,
  cardBg = "none",
  customBgColor = null,
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const [imageSize, setImageSize] = useState(null);
  const [loading, setLoading] = useState(true);

  // ✅ 이미지 크기 가져오기 useEffect
  useEffect(() => {
    if (!imageUrl) {
      setLoading(false);
      setImageFailed(true);
      return;
    }
    
    // iOS는 RNImage.getSize 사용
    if (Platform.OS === 'ios') {
      RNImage.getSize(
        imageUrl,
        (width, height) => {
          setImageSize({ width, height });
          setLoading(false);
        },
        (error) => {
          console.warn("Failed to get image size:", error);
          setImageFailed(true);
          setLoading(false);
        }
      );
    } else {
      // Android: ExpoImage의 onLoad에서 처리
      setLoading(false);
      setImageSize({ width: maxWidth, height: maxWidth * 0.6 });
    }
  }, [imageUrl, maxWidth]);

  const BG_MAP = {
    none: "#FFFFFF",
    bg1: "#F9FAFB",
    bg2: "#FFF7ED",
    bg3: "#ECFEFF",
  };

  const bgColor = isValidColorString(customBgColor)
    ? customBgColor.trim()
    : BG_MAP[cardBg] ?? "#FFFFFF";

  // 🎯 이미지가 없거나 실패했을 때 AdMob 광고 표시
  if (!imageUrl || imageFailed) {
    return (
      <View
        style={{
          width: maxWidth,
          alignSelf: "center",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: bgColor,
          borderRadius: 12,
          padding: 12,
          marginVertical: 8,
        }}
      >
        <BannerAd
          unitId={TestIds.BANNER}
          size={BannerAdSize.MEDIUM_RECTANGLE}
          requestOptions={{
            requestNonPersonalizedAdsOnly: true,
          }}
        />
      </View>
    );
  }

  if (loading || !imageSize) {
    return (
      <View
        style={{
          width: maxWidth,
          height: 200,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator size="small" color="#999" />
      </View>
    );
  }

  const { width: imgWidth, height: imgHeight } = imageSize;
  const aspectRatio = imgWidth / imgHeight;
  const isLandscape = aspectRatio > 1;

  if (isLandscape) {
    const displayWidth = screenWidth;
    const displayHeight = displayWidth / aspectRatio;

    return (
      <ScrollView
        horizontal={false}
        showsVerticalScrollIndicator={true}
        style={{
          width: displayWidth,
          maxHeight: screenWidth * 1.2,
        }}
        contentContainerStyle={{
          alignItems: "center",
        }}
      >
        <View
          style={{
            width: displayWidth,
            height: displayHeight,
            backgroundColor: bgColor,
          }}
        >
          <ExpoImage
            source={{
              uri: imageUrl,
              headers: {
                'User-Agent': 'Histree/1.0 (Educational History App)',
                'Referer': 'https://en.wikipedia.org/',
              }
            }}
            style={{
              width: "100%",
              height: "100%",
            }}
            contentFit="contain"
            cachePolicy="disk"
            transition={150}
            onLoad={(e) => {
              if (Platform.OS === 'android' && e?.source) {
                const { width, height } = e.source;
                if (width && height) {
                  setImageSize({ width, height });
                }
              }
            }}
            onError={(e) => {
              console.warn("expo-image load error:", e?.nativeEvent);
              setImageFailed(true);
            }}
          />
        </View>
      </ScrollView>
    );
  } else {
    const displayWidth = Math.min(maxWidth, imgWidth);
    const displayHeight = displayWidth / aspectRatio;

    return (
      <ScrollView
        horizontal={false}
        showsVerticalScrollIndicator={true}
        style={{
          width: displayWidth,
          maxHeight: maxWidth * 1.5,
          alignSelf: "center",
        }}
        contentContainerStyle={{
          alignItems: "center",
        }}
      >
        <View
          style={{
            width: displayWidth,
            height: displayHeight,
            borderRadius: 12,
            backgroundColor: bgColor,
            overflow: "hidden",
          }}
        >
          <ExpoImage
            source={{
              uri: imageUrl,
              headers: {
                'User-Agent': 'Histree/1.0 (Educational History App)',
                'Referer': 'https://en.wikipedia.org/',
              }
            }}
            style={{
              width: "100%",
              height: "100%",
            }}
            contentFit="contain"
            cachePolicy="disk"
            transition={150}
            onLoad={(e) => {
              if (Platform.OS === 'android' && e?.source) {
                const { width, height } = e.source;
                if (width && height) {
                  setImageSize({ width, height });
                }
              }
            }}
            onError={(e) => {
              console.warn("expo-image load error:", e?.nativeEvent);
              setImageFailed(true);
            }}
          />
        </View>
      </ScrollView>
    );
  }
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

function formatYearsAgo(diff, uiLang) {
  if (!diff || diff <= 0) return "";
  if (uiLang === "ko") return `(${diff}년 전)`;
  if (uiLang === "ja") return `(${diff}年前)`;
  if (diff === 1) return "1 year ago";
  return `(${diff} yrs ago)`;
}

function formatEventDateLabel(eventYearRaw, todayParts, uiLang, tz) {
  const yStr = String(eventYearRaw || "").trim();
  const yearNum = parseInt(yStr, 10);

  const baseYear = parseInt(String(todayParts.y), 10);
  const mNum = parseInt(String(todayParts.m), 10) || 1;
  const dNum = parseInt(String(todayParts.d), 10) || 1;

  // 연도가 없으면: "오늘 날짜" 그대로, 이럴 때만 Date + toLocale 사용
  if (!yearNum || Number.isNaN(yearNum)) {
    const baseDate = new Date(
      `${todayParts.y}-${todayParts.m}-${todayParts.d}T00:00:00`
    );
    return safeToLocaleDateString(
      baseDate,
      LOCALE_BY_LANG[uiLang] || "en",
      {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: tz,
      }
    );
  }

  const diff = !Number.isNaN(baseYear) ? baseYear - yearNum : 0;

  let dateStr;
  if (uiLang === "ko") {
    dateStr = `${yearNum}년 ${mNum}월 ${dNum}일`;
  } else if (uiLang === "ja") {
    dateStr = `${yearNum}年${mNum}月${dNum}日`;
  } else {
    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const monthName = monthNames[mNum - 1] || String(mNum);
    dateStr = `${monthName} ${dNum}, ${yearNum}`;
  }

  const agoStr = formatYearsAgo(diff, uiLang);
  return agoStr ? `${dateStr} ${agoStr}` : dateStr;
}


// 캐시 
function cacheKey(mode, parts) {
  return `@hist_cache:${DATA_CACHE_VERSION}:${mode}:${String(parts.m).padStart(
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

function isSameDayItem(it, parts) {
  const mm = String(parts.m).padStart(2, "0");
  const dd = String(parts.d).padStart(2, "0");
  const targetD = `D${mm}${dd}`;
  const targetSuffix = `${mm}-${dd}`;

  const rawDates = [
    it.isoDate,
    it.dateISO,
    it.dateString,
    it.Date,
    it.date,
    it.__DATE,
  ].map((v) => String(v || "").trim());

  // date code가 있으면 그걸로 비교 (D1126 이런 거)
  for (const s of rawDates) {
    if (!s) continue;

    // D1126, 1126, D11-26 이런 류
    const m1 = s.match(/^D?(\d{2})(\d{2})$/);
    if (m1) {
      const [_, m, d] = m1;
      return m === mm && d === dd;
    }

    // 2025-11-26, 11-26, 2025/11/26 등
    const m2 =
      s.match(/(\d{4})[-/](\d{2})[-/](\d{2})/) ||
      s.match(/(\d{2})[-/](\d{2})$/);
    if (m2) {
      const m = m2[m2.length - 2];
      const d = m2[m2.length - 1];
      return m === mm && d === dd;
    }

    // 이미 DMMDD 포맷으로 왔으면 그대로 비교
    if (s === targetD) return true;
    if (s.endsWith(targetSuffix)) return true;
  }

  // 날짜 정보 없으면 일단 통과 (로컬 JSON용)
  return true;
}

function toAnchorArray(src) {
  if (!src) return [];
  if (Array.isArray(src)) return src;
  // 객체 한 개만 온 경우 [obj]로 묶어서 처리
  if (typeof src === "object") return [src];
  // 문자열 등 이상한 타입이면 버림
  return [];
}


// API/로컬 응답 정규화
// parts = { y, m, d }
// isoDate = "YYYY-MM-DD" (오늘/어제/내일 중 화면 날짜)
function normalizeItemsToRows(items, iso, parts) {
  const mm = String(parts.m).padStart(2, "0");
  const dd = String(parts.d).padStart(2, "0");
  const dcode = `D${mm}${dd}`;

  return (items || [])
    .filter((it) => isSameDayItem(it, parts))
    .map((it) => ({
      isoDate: iso,
      date: dcode,
      Date: dcode,
      Year: it.year ?? it.Year ?? "",
      year: it.year ?? it.Year ?? "",

      English: it.en || it.English || "",
      "한국어": it.ko || it["한국어"] || "",
      "日本語": it.ja || it["日本語"] || "",

      enAnchors: toAnchorArray(it.enAnchors)
        .map((a) => ({
          text: a?.text ? String(a.text).trim() : "",
          url: a?.url ? String(a.url).trim() : "",
        }))
        .filter((a) => ((a.text && a.text !== "#VALUE!") || a.url)),

      koAnchors: toAnchorArray(it.koAnchors)
        .map((a) => ({
          text: a?.text ? String(a.text).trim() : "",
          url: a?.url ? String(a.url).trim() : "",
        }))
        .filter((a) => ((a.text && a.text !== "#VALUE!") || a.url)),

      jaAnchors: toAnchorArray(it.jaAnchors)
        .map((a) => ({
          text: a?.text ? String(a.text).trim() : "",
          url: a?.url ? String(a.url).trim() : "",
        }))
        .filter((a) => ((a.text && a.text !== "#VALUE!") || a.url)),
    }));
}


// API/로컬 응답 정규화
// parts = { y, m, d }
// isoDate = "YYYY-MM-DD" (오늘/어제/내일 중 화면 날짜)

async function apiFetchForMode(mode, todayParts, isoDate) {
  const iso =
    isoDate ||
    `${todayParts.y}-${String(todayParts.m).padStart(2, "0")}-${String(
      todayParts.d
    ).padStart(2, "0")}`;

      console.log("[apiFetchForMode] mode=", mode, "iso=", iso, "parts=", todayParts);

  //로컬 JSON 먼저
  try {
    const localItems = getLocalHistory(mode, todayParts);
    if (Array.isArray(localItems) && localItems.length > 0) {
      return normalizeItemsToRows(localItems, iso, todayParts);
    }
  } catch (e) {
    console.warn("getLocalHistory failed:", e);
  }

  //없으면 원격(App Script) 호출
  try {
    const month = Number(todayParts.m); // 1~12

    const items = await withTimeout(
      fetchHistory({
        mode,      // "world" | "korea" | "japan"
        date: iso, //  오늘/어제/내일 중 화면 날짜
        month,     //  시트 선택용
        n: 20,
        shuffle: false,
      }),
      6000
    );

    const rows = normalizeItemsToRows(items || [], iso, todayParts);
    if (rows.length) return rows;
  } catch (e) {
    if (e?.name !== "AbortError") {
      console.warn("fetchHistory failed:", e);
    }
  }

  return [];
}





// 앵커 리스트 (폰트 사이즈 설정 연동)
function AnchorList({ anchors, onLinkPress, fontSize }) {
  if (!anchors || !anchors.length) return null;

  return (
    <View style={{ marginTop: 6, flexDirection: "row", flexWrap: "wrap" }}>
      {anchors.map((a, idx) => {
        const text = String(a?.text || "").trim();
        const url = String(a?.url || "").trim();
        if (!text || !url) return null;

        const onPress = () => {
          if (onLinkPress) onLinkPress(url);
          else Linking.openURL(url).catch(() => {});
        };

        return (
          <Pressable
            key={`${text}-${url}-${idx}`}
            onPress={onPress}
            accessibilityRole="link"
            hitSlop={6}
            style={{
              marginRight: 12,
              marginBottom: 4,
            }}
          >
            <Text
              style={{
                fontSize: fontSize || 15,
                color: "#000000ff",
                textDecorationLine: "underline",
              }}
              numberOfLines={1}
            >
              [{text}]
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
// 홈 화면
export default function Home() {
  const insets = useSafeAreaInsets();
  const { scale, screenW } = useUIScale();
  const [tz] = useState(() => {
    const z =
      Intl?.DateTimeFormat?.().resolvedOptions().timeZone ||
      "UTC";
    return safeTimeZone(z);
  });

  const tabBarHeight = useBottomTabBarHeight();
  const { width } = useWindowDimensions();

  const [hydrated, setHydrated] = useState(false);
  // 오늘 기준 offset (-1: 어제, 0: 오늘, +1: 내일)
  const [dayOffset, setDayOffset] = useState(0);

  // 현재 화면 날짜 (어제/오늘/내일)
  const screenDate = useMemo(() => {
    const todayStart = startOfDayInTz(new Date(), tz);
    const d = new Date(todayStart);
    d.setDate(todayStart.getDate() + dayOffset);

    const parts = safeFormatParts(d, tz);
    const y = parts.year;
    const m = parts.month;
    const dd = parts.day;

    const iso = `${y}-${m}-${dd}`;

    return {
      date: d,
      parts: {
        md: `${m}-${dd}`,
        dcode: `D${m}${dd}`,
        y,
        m,
        d: dd,
      },
      iso,
    };
  }, [tz, dayOffset]);

  const today0 = screenDate.date;
  const todayParts = screenDate.parts;
  const isoDate = screenDate.iso;

  const bannerHeight = Math.max(
    60,
    Math.round(Math.min(AD_TARGET.h, Math.min(width, 340) / AD_RATIO))
  );

  const deviceLang = useMemo(
    () => normalizeUiLang(resolveUiLangFromDevice(), "en"),
    []
  );

  const [uiLang, setUiLang] = useState(null);
  const [selectedCountries, setSelectedCountries] =
    useState(new Set());
  const [onePick, setOnePick] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);
  const [copyTick, setCopyTick] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [headerImageUrl, setHeaderImageUrl] = useState(null);

  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [notifyTime, setNotifyTime] = useState("09:00");
  const [cardBg, setCardBg] = useState("none");
  const [customBgColor, setCustomBgColor] = useState(null);

  const [customFont, setCustomFont] = useState("System");
  const [customFontSize, setCustomFontSize] = useState(18);
  const [customFontColor, setCustomFontColor] =
    useState("#111827");
  const [webViewVisible, setWebViewVisible] = useState(false);
  const [webViewUrl, setWebViewUrl] = useState("");

  const getFontFamily = (font) => {
    switch (font) {
      case "System":
        return Platform.OS === "ios" ? "System" : "Roboto";
      case "Verdana":
        return Platform.OS === "ios" ? "Verdana" : "sans-serif";
      case "Arial":
        return Platform.OS === "ios" ? "Arial" : "sans-serif";
      case "Times New Roman":
        return Platform.OS === "ios"
          ? "Times New Roman"
          : "serif";
      case "Courier New":
        return Platform.OS === "ios"
          ? "Courier New"
          : "monospace";
      case "Georgia":
        return Platform.OS === "ios" ? "Georgia" : "serif";
      default:
        return Platform.OS === "ios" ? "System" : "Roboto";
    }
  };

  const bodyLineHeight = Math.round(
    (customFontSize || 18) * 1.45
  );

  const baseFontSize = customFontSize || 18;
  const locationFontSize = Math.max(10, baseFontSize - 2);
  const dateFontSize = Math.max(10, baseFontSize - 3);
  const anchorFontSize = Math.max(10, baseFontSize - 2);

  const amplitudeReadyRef = useRef(false);
  const lastBackPressRef = useRef(0);

  const handleLinkPress = useCallback((url) => {
    setWebViewUrl(url);
    setWebViewVisible(true);
  }, []);

  const handleCloseWebView = useCallback(() => {
    setWebViewVisible(false);
    setWebViewUrl("");
  }, []);

  useEffect(() => {
    let cancelled = false;
    InteractionManager.runAfterInteractions(async () => {
      if (cancelled) return;
      try {
        await initAmplitude();
        amplitudeReadyRef.current = true;
        trackEvent(AMPLITUDE_EVENTS.SCREEN_VIEW, {
          screen: "Home",
        });
      } catch {}
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setHeaderImageUrl(null);
  }, [uiLang]);

  // +/- 1일 이동
  const goBy = useCallback((delta) => {
    const step = delta < 0 ? -1 : delta > 0 ? 1 : 0;
    if (!step) return;
    setDayOffset((prev) => {
      const next = Math.max(-1, Math.min(1, prev + step));
      return next;
    });
  }, []);

  const buildSharePayload = useCallback(() => {
  const lang = uiLang || "en";

  const appName =
    APP_NAME_BY_LANG[lang] || APP_NAME_BY_LANG.en;
  const historyTitle = getHistoryTitle(lang, dayOffset); // 오늘/어제/내일 제목 사용

  // 최상단 헤더: 예) "Histree: 오늘의 역사"
  const header = `${appName}: ${historyTitle}`;

  const list = Array.isArray(onePick)
    ? onePick
    : onePick
    ? [onePick]
    : [];

  // 보여줄 이벤트가 없을 때: 헤더 + 다운로드 링크만
  if (!list.length) {
    const payload = [
      header,
      "",
      `*${lang === "ko"
        ? "히스트리 앱 다운로드 링크"
        : lang === "ja"
        ? "Histreeアプリのダウンロードリンク"
        : "Download Histree app"
      } - ${APP_DOWNLOAD_URL}`,
    ].join("\n");

    return { header, payload };
  }

  const p = list[0]; // 어차피 1개만 보여주니까 첫 번째만 사용
  const label =
    COUNTRY_CFG[p.cid]?.label?.[lang] ||
    COUNTRY_CFG[p.cid]?.label?.en ||
    p.cid;

  const fieldLabels =
    FIELD_LABELS[lang] || FIELD_LABELS.en;

  const eventYear = getYearFromRow(p.row);
  const dateLabel = formatEventDateLabel(
    eventYear,
    todayParts,
    lang,
    tz
  );

  const downloadLabel =
    lang === "ko"
      ? "히스트리 앱 다운로드 링크"
      : lang === "ja"
      ? "Histreeアプリのダウンロードリンク"
      : "Download Histree app";

  const bodyText = (p.body || "").trim();

  const lines = [
    header,
    "",
    // 위치: 한국
    `${fieldLabels.location}: ${label}`,
    // 날짜: 2019년 11월 29일 (6년 전)
    `${fieldLabels.date}: ${dateLabel}`,
    "",
    // 본문
    bodyText,
    "",
    // *히스트리 앱 다운로드 링크 - https://...
    `*${downloadLabel} - ${APP_DOWNLOAD_URL}`,
  ];

  const payload = lines.join("\n");

  return { header, payload };
}, [onePick, uiLang, dayOffset, todayParts, tz]);


  const onSystemSharePress = useCallback(async () => {
    try {
      const { header, payload } = buildSharePayload();
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
        await FileSystem.writeAsStringAsync(uri, payload, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        await Sharing.shareAsync(uri, {
          dialogTitle: header,
          UTI: "public.plain-text",
          mimeType: "text/plain",
        });
        return;
      }

      await Clipboard.setStringAsync(payload);
      setCopyTick((t) => t + 1);
    } catch {}
  }, [buildSharePayload]);

  useEffect(() => {
    const offPrev = onGoPrevDay?.(() => {
      if (amplitudeReadyRef.current)
        trackEvent(AMPLITUDE_EVENTS.YESTERDAY_CLICKED, {
          language: uiLang,
          countries: [...selectedCountries],
        });
      goBy(-1);
    });

    const offNext = onGoNextDay?.(() => {
      if (amplitudeReadyRef.current)
        trackEvent(AMPLITUDE_EVENTS.TOMORROW_CLICKED, {
          language: uiLang,
          countries: [...selectedCountries],
        });
      goBy(+1);
    });

    const offRefresh = onRefresh?.(() => {
      if (amplitudeReadyRef.current)
        trackEvent(AMPLITUDE_EVENTS.REFRESH_CLICKED, {
          language: uiLang,
          countries: [...selectedCountries],
        });
      handlePullToRefresh();
    });

    const offShare = onShareAttach?.(() => {
      onSystemSharePress();
    });

    return () => {
      offPrev && offPrev();
      offNext && offNext();
      offRefresh && offRefresh();
      offShare && offShare();
    };
  }, [goBy, uiLang, selectedCountries, onSystemSharePress]);

  const fetchingRef = useRef(false);

  const handlePullToRefresh = useCallback(() => {
    setIsRefreshing(true);
    setRefreshTick((t) => t + 1);
  }, []);

  // 초기 설정/복원
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const pairs = await AsyncStorage.multiGet([
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
        const dict = Object.fromEntries(pairs || []);
        if (!alive) return;

        const storedLangRaw = dict[STORAGE_KEY_UI_LANG] || null;
        const lang = normalizeUiLang(storedLangRaw, deviceLang);

        setUiLang(lang);
        if (amplitudeReadyRef.current) {
          setUserProperties({
            language: lang,
            device_language: deviceLang,
          });
        }

        let nextSet;
        if (dict[STORAGE_KEY_SELECTED]) {
          let arr = [];
          try {
            arr = JSON.parse(dict[STORAGE_KEY_SELECTED]);
          } catch {}
          nextSet = ensureNonEmptySelection(
            new Set(Array.isArray(arr) ? arr : []),
            lang
          );
        } else {
          nextSet = ensureNonEmptySelection(new Set(), lang);
        }
        setSelectedCountries(nextSet);
        try {
          await AsyncStorage.setItem(
            STORAGE_KEY_SELECTED,
            JSON.stringify([...nextSet])
          );
        } catch {}

        setNotifyEnabled(
          dict[STORAGE_KEY_NOTIFY_ENABLED] === "1"
        );
        if (dict[STORAGE_KEY_NOTIFY_TIME]) {
          setNotifyTime(dict[STORAGE_KEY_NOTIFY_TIME]);
        }

        if (dict[STORAGE_KEY_CARD_BG]) {
          setCardBg(dict[STORAGE_KEY_CARD_BG]);
        }

        const rawBg = dict[STORAGE_KEY_BG_COLOR];
        setCustomBgColor(
          isValidColorString(rawBg) ? rawBg : null
        );

        if (dict[STORAGE_KEY_FONT])
          setCustomFont(dict[STORAGE_KEY_FONT]);
        if (dict[STORAGE_KEY_FONT_SIZE]) {
          const v = parseInt(
            dict[STORAGE_KEY_FONT_SIZE],
            10
          );
          if (!Number.isNaN(v) && v > 8)
            setCustomFontSize(v);
        }
        if (dict[STORAGE_KEY_FONT_COLOR])
          setCustomFontColor(dict[STORAGE_KEY_FONT_COLOR]);
      } catch (e) {
        console.warn("Init restore failed:", e);
      } finally {
        setHydrated(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [deviceLang]);

  // 포커스될 때 설정 재동기화
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

          const storedLangRaw =
            dict[STORAGE_KEY_UI_LANG] || null;
          const storedLang = storedLangRaw
            ? normalizeUiLang(storedLangRaw, null)
            : null;

          let nextLang = uiLang || deviceLang;
          if (storedLang) {
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
            const storedSel = dict[STORAGE_KEY_SELECTED];
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
                if (!equalSets(nextSet, selectedCountries)) {
                  setSelectedCountries(nextSet);
                  try {
                    await AsyncStorage.setItem(
                      STORAGE_KEY_SELECTED,
                      JSON.stringify([...nextSet])
                    );
                  } catch {}
                  setRefreshTick((t) => t + 1);
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

          const storedCardBg = dict[STORAGE_KEY_CARD_BG] || null;
          if (storedCardBg && storedCardBg !== cardBg) {
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

          if (dict[STORAGE_KEY_NOTIFY_ENABLED] != null) {
            setNotifyEnabled(
              dict[STORAGE_KEY_NOTIFY_ENABLED] === "1"
            );
          }

          if (dict[STORAGE_KEY_NOTIFY_TIME]) {
            setNotifyTime(dict[STORAGE_KEY_NOTIFY_TIME]);
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

  // 디버그용 로그
  useEffect(() => {
    if (!__DEV__) return;

    let iso = "Invalid Date";
    if (today0 instanceof Date && !Number.isNaN(today0.getTime())) {
      try {
        iso = `${todayParts.y}-${todayParts.m}-${todayParts.d}`;
      } catch {
        // ignore
      }
    }

    console.log("today0:", iso, "todayParts:", todayParts);
  }, [today0, todayParts]);

  const stableKey = useMemo(() => {
    const p = todayParts || {};
    const y = String(p.y || "0000");
    const m = String(p.m || "00").padStart(2, "0");
    const d = String(p.d || "00").padStart(2, "0");
    const dayKey = `${y}-${m}-${d}`; // 예: 2025-11-27

    return `${dayKey}__${[...selectedCountries]
      .sort()
      .join(",")}`;
  }, [todayParts, selectedCountries]);

  const seedKey = useMemo(
    () => `${stableKey}__r${refreshTick}`,
    [stableKey, refreshTick]
  );

  // UI 언어 변경 시 본문 재계산
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

   // 데이터 로딩 (로컬 + 원격 + 로테이션)
  useEffect(() => {
    if (!hydrated || !uiLang) return;
    let canceled = false;
    fetchingRef.current = true;

    (async () => {
      try {
        setErr("");

        const safeSelected = ensureNonEmptySelection(
          selectedCountries,
          uiLang
        );
        if (!equalSets(safeSelected, selectedCountries)) {
          setSelectedCountries(safeSelected);
          try {
            await AsyncStorage.setItem(
              STORAGE_KEY_SELECTED,
              JSON.stringify([...safeSelected])
            );
          } catch {}
        }

        const chosen = [...ensureNonEmptySelection(selectedCountries, uiLang)];
        if (!chosen.length) {
          if (!canceled) endLoading();
          return;
        }

        // 1) 우선 캐시에서 가능한 만큼 풀 구성
        const poolsByCid = {};
        for (const cid of chosen) {
          const c = await loadCache(cid, todayParts);
          if (Array.isArray(c) && c.length) {
            const arr = [];
            for (const r of c) {
              const body = bodyOfRowByLang(r, uiLang, cid);
              if (!hasAnyText(body)) continue;
              const tag = trimHtml(
                r?.["한국어"] || r?.English || r?.["日本語"] || ""
              ).slice(0, 50);
              arr.push({
                cid,
                row: r,
                key: `${cid}|${String(r?.Year || r?.year || "")}|${String(
                  r?.Date || r?.date || ""
                )}|${tag}`,
                body,
              });
            }
            if (arr.length) {
              poolsByCid[cid] = arr;
            }
          }
        }

        // 2) 원격/로컬 API로 최신 데이터 받아와서 덮어쓰기
        for (const cid of chosen) {
          try {
            const rows = await apiFetchForMode(cid, todayParts, isoDate);
            await saveCache(cid, todayParts, rows);
            const arr = [];
            for (const r of rows) {
              const body = bodyOfRowByLang(r, uiLang, cid);
              if (!hasAnyText(body)) continue;
              const tag = trimHtml(
                r?.["한국어"] || r?.English || r?.["日本語"] || ""
              ).slice(0, 50);
              arr.push({
                cid,
                row: r,
                key: `${cid}|${String(r?.Year || r?.year || "")}|${String(
                  r?.Date || r?.date || ""
                )}|${tag}`,
                body,
              });
            }
            if (arr.length) {
              // 원격 결과가 있으면 캐시 대신 이걸 사용
              poolsByCid[cid] = arr;
            }
          } catch (e) {
            if (e?.name !== "AbortError") {
              console.warn("fetchHistory failed:", e);
            }
          }
        }

        if (canceled) return;

        const hasAny = Object.values(poolsByCid).some(
          (arr) => arr && arr.length
        );

        if (!hasAny) {
          setOnePick([]);
          setHeaderImageUrl(null);
          endLoading();
          return;
        }

        // 3) "한 번 본 이벤트는 다시 안 나오는" 로테이션 선택
        const pick = await pickOneWithSeenRotation(
          poolsByCid,
          chosen,
          seedKey,
          isoDate
        );

        if (!canceled) {
          if (pick) {
            setOnePick([pick]);
          } else {
            setOnePick([]);
            setHeaderImageUrl(null);
          }
          endLoading();
        }
      } catch (e) {
        if (!canceled) {
          setErr(String(e?.message || e));
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
    isoDate,
    endLoading,
  ]);


  // 헤더 배너 이미지 로딩/캐시
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const iso = isoDate; // ✅ 화면 날짜 기준 키

        // 1) 픽이 없을 때: 캐시에 저장된 배너 먼저 시도
        if (!onePick || !onePick.length) {
          if (hydrated && uiLang) {
            try {
              const cachedUrl =
                await AsyncStorage.getItem(
                  BANNER_KEY(iso, uiLang)
                );
              if (alive && cachedUrl !== null) {
                setHeaderImageUrl(cachedUrl || null);
                return;
              }
            } catch {}
          }
          if (alive) setHeaderImageUrl(null);
          return;
        }

        // 2) 픽이 있으면 새 이미지 계산 + 캐시에 저장
        const first = onePick[0];
        const url = await computeBannerUrlForPick(
          first,
          uiLang
        );

        if (alive) {
          setHeaderImageUrl(url || null);
          try {
            await AsyncStorage.setItem(
              BANNER_KEY(iso, uiLang || "en"),
              url || ""
            );
          } catch {}
        }
      } catch {
        if (alive) setHeaderImageUrl(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, [onePick, uiLang, hydrated, isoDate]);

  // 자정 워밍
  useEffect(() => {
    if (!hydrated || !uiLang) return;
    const stop = scheduleMidnightWarmup({
      tz,
      uiLang,
      selectedCountries,
    });
    return stop;
  }, [hydrated, tz, uiLang, selectedCountries]);

  // 앱이 다시 foreground로 돌아올 때
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") {
        const today = startOfDayInTz(new Date(), tz);

        // 앱으로 돌아오면 항상 "오늘(0)" 기준으로 맞춰주기
        setDayOffset(0);

        // 데이터 강제 리프레시
        setRefreshTick((t) => t + 1);

        // 오늘 기준으로 캐시/배너 미리 준비
        warmCacheAndBanner({
          date: today,
          tz,
          uiLang,
          selectedCountries,
        }).catch(() => {});
      }
    });

    return () => sub.remove();
  }, [tz, uiLang, selectedCountries]);

   useFocusEffect(
    useCallback(() => {
      // iOS에서는 처리 안 함
      if (Platform.OS !== "android") return;

      const onBackPress = () => {
        // 1) 오늘이 아닌 화면(어제/내일)이면 → 일단 "오늘"로만 돌아오기
        if (dayOffset !== 0) {
          setDayOffset(0);
          return true; // 이벤트 소비 (앱 종료 X)
        }

        // 2) 2초 안에 두 번 누르면 앱 종료
        const now = Date.now();
        if (now - lastBackPressRef.current < 2000) {
          BackHandler.exitApp();
          return true;
        }

        // 3) 첫 번째 누름: 토스트만 띄우고 종료 안 함
        lastBackPressRef.current = now;
        ToastAndroid.show(
          "한 번 더 누르면 앱이 종료됩니다.",
          ToastAndroid.SHORT
        );
        return true; // 기본 네비게이션 막기
      };
      const sub = BackHandler.addEventListener(
        "hardwareBackPress",
        onBackPress
      );

      // Home 화면 포커스 빠지면 핸들러 제거
      return () => {
        sub.remove();
      };
    }, [dayOffset])
  );

  const handleCountriesChange = useCallback(
    (nextSetRaw) => {
      const ensured = ensureNonEmptySelection(
        nextSetRaw,
        uiLang
      );
      const added = [...ensured].filter(
        (c) => !selectedCountries.has(c)
      );
      const removed = [...selectedCountries].filter(
        (c) => !ensured.has(c)
      );

      if (
        amplitudeReadyRef.current &&
        (added.length || removed.length)
      ) {
        trackEvent(
          AMPLITUDE_EVENTS.COUNTRY_CLICKED,
          {
            language: uiLang,
            added_countries: added,
            removed_countries: removed,
            total_selected: ensured.size,
            selected_countries: [...ensured],
          }
        );
      }

      setSelectedCountries(ensured);
      AsyncStorage.setItem(
        STORAGE_KEY_SELECTED,
        JSON.stringify([...ensured])
      ).catch(() => {});
      setRefreshTick((t) => t + 1);
    },
    [selectedCountries, uiLang]
  );

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

  const buildNotificationBodyNow = useCallback(() => {
    const list = Array.isArray(onePick)
      ? onePick
      : onePick
      ? [onePick]
      : [];

    const currentDate = startOfDayInTz(
      new Date(),
      tz
    );
    const parts = getDayPartsFrom(
      currentDate,
      tz
    );

    const maxBodyLen =
      uiLang === "ko" || uiLang === "ja"
        ? 20
        : 40;

    const body = list.length
      ? list
          .map((p) => {
            const label =
              COUNTRY_CFG[p.cid]?.label?.[
                uiLang || "en"
              ] || p.cid;
            const yr = getYearFromRow(
              p.row
            );
            const txt = p.body || "";
            const trunc =
              txt.length > maxBodyLen
                ? `${txt.slice(
                    0,
                    maxBodyLen
                  )}...`
                : txt;

            let eventDateStr = "";
            if (uiLang === "ko") {
              eventDateStr = `${yr}년 ${parseInt(
                parts.m,
                10
              )}월 ${parseInt(
                parts.d,
                10
              )}일`;
            } else if (uiLang === "ja") {
              eventDateStr = `${yr}年${parseInt(
                parts.m,
                10
              )}月${parseInt(
                parts.d,
                10
              )}日`;
            } else {
              const monthNames = [
                "January",
                "February",
                "March",
                "April",
                "May",
                "June",
                "July",
                "August",
                "September",
                "October",
                "November",
                "December",
              ];
              const monthName =
                monthNames[
                  parseInt(parts.m, 10) - 1
                ];
              eventDateStr = `${monthName} ${parseInt(
                parts.d,
                10
              )}, ${yr}`;
            }

            if (uiLang === "ko") {
              return `${eventDateStr}, ${label}: ${trunc}`;
            } else if (uiLang === "ja") {
              return `${eventDateStr}、${label}: ${trunc}`;
            } else {
              return `${eventDateStr}, ${label}: ${trunc}`;
            }
          })
          .join(" • ")
      : "";

    return body;
  }, [onePick, uiLang, tz]);

  // 알림 타이틀/본문 업데이트 + 재스케줄
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

  const heroBgSource = useMemo(() => {
    const count = selectedCountries.size;

    let cid = "world";

    if (count === 1) {
      cid = [...selectedCountries][0];
    } else if (count === 0 && list[0]?.cid) {
      cid = list[0].cid;
    } else if (count > 1) {
      cid = "world";
    }

    if (!HERO_BG_IMAGES[cid]) {
      cid = "world";
    }

    return pickDailyHeroBg(cid, today0);
  }, [selectedCountries, list, today0]);

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

          <HeaderHero
            height={HEADER_H + 15}
            bgSource={heroBgSource}
            imageUrl={null}
            uiLang={uiLang || "en"}
          />

          <View
            pointerEvents="box-none"
            style={{
              position: "absolute",
              top: insets.top + 30,
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

          <FullBleedCard
            topInset={HEADER_H - 60}
            cardBg={cardBg}
            customBgColor={customBgColor}
          >
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{
                flexGrow: 1,
                paddingHorizontal: 16,
                paddingBottom: 24 + tabBarHeight,
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
                <View
                  style={{
                    paddingVertical: 20,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 20,
                      fontWeight: "800",
                      textAlign: "center",
                    }}
                  >
                    {getHistoryTitle(
                      uiLang || "en",
                      dayOffset   
                    )}
                  </Text>
                  <Text
                    style={{
                      marginTop: 4,
                      fontSize: 13,
                      color: "#6b7280",
                      textAlign: "center",
                    }}
                  >
                  </Text>
                </View>

                <View
                  style={{
                    marginTop: 0,
                    gap: 14,
                    paddingBottom: 10,
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
                        : UI_STR.empty[uiLang || "en"] ||
                          UI_STR.empty.en}
                    </Text>
                  ) : (
                    list.map((p) => {
                      const label =
                        COUNTRY_CFG[p.cid]?.label?.[
                          uiLang || "en"
                        ] || p.cid;
                      const eventYear =
                        getYearFromRow(p.row);
                      const dateLabel =
                        formatEventDateLabel(
                          eventYear,
                          todayParts,
                          uiLang || "en",
                          tz
                        );
                      const lang = uiLang || "en";
                      const fieldLabels =
                        FIELD_LABELS[lang] ||
                        FIELD_LABELS.en;

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
                          <View
                            style={{
                              marginBottom: 8,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: locationFontSize,
                                fontWeight: "600",
                                color: "#6b7280",
                              }}
                            >
                              {fieldLabels.location}:{" "}
                              <Text
                                style={{
                                  color: "#6b7280",
                                }}
                              >
                                {label}
                              </Text>
                            </Text>
                            {!!dateLabel && (
                              <Text
                                style={{
                                  marginTop: 4,
                                  fontSize: dateFontSize,
                                  color: "#6b7280",
                                }}
                              >
                                {fieldLabels.date}:{" "}
                                {dateLabel}
                              </Text>
                            )}
                          </View>

                          <Text
                            style={{
                              marginTop: 4,
                              marginBottom: 14,
                              fontSize: customFontSize,
                              lineHeight: bodyLineHeight,
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
                            anchors={anchors}
                            onLinkPress={handleLinkPress}
                            fontSize={anchorFontSize}
                          />
                          <View
                            style={{
                              marginTop: 18,
                              marginBottom: 8,
                              alignItems: "center",
                            }}
                          >
                            <WikipediaBanner
                              imageUrl={headerImageUrl} 
                              maxWidth={CONTENT_W}
                              screenWidth={screenW}
                              cardBg={cardBg}
                              customBgColor={customBgColor}
                            />
                          </View>
                          
                        </View>
                      );
                    })
                  )}
                </View>
              </View>
            </ScrollView>
          </FullBleedCard>

          <WebViewModal
            visible={webViewVisible}
            url={webViewUrl}
            onClose={handleCloseWebView}
          />

          {loading && !isRefreshing && (
            <View
              style={{
                position: "absolute",
                top: 12,
                right: 12,
              }}
            >
              <ActivityIndicator />
            </View>
          )}

          {!!err && (
            <View
              style={{
                position: "absolute",
                bottom: 12,
                left: 12,
                right: 12,
                backgroundColor: "#fee2e2",
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
