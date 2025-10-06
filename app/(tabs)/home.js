// app/(tabs)/home.js
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Text,
  View,
  Pressable,
  ScrollView,
  Animated,
  Easing,
  useWindowDimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchSheetRows } from "../../lib/sheets";
import { onRefresh, onGoPrevDay, onGoNextDay, onShareAttach } from "../../lib/bus";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Localization from "expo-localization";
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Stack } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";

// 상수
const STORAGE_KEY_SELECTED  = "selectedCountries";
const STORAGE_KEY_UI_LANG   = "@app_language";
const STORAGE_SHEET_PREFIX  = "@sheet_cache_v1:";
const STORAGE_INDEX_PREFIX  = "@sheet_day_index_v1:";

const COUNTRY_CFG = {
  usa:   { id: "usa",   label: { ko: "미국", en: "USA",   ja: "アメリカ" }, lang: "en", sheetId: "16aQeXTEmzYGHDTpu0uoWCRh6Jutq2g4u--Kr2QjYOtg", gid: "2056769855" },
  uk:    { id: "uk",    label: { ko: "영국", en: "UK",    ja: "英国"       }, lang: "en", sheetId: "16aQeXTEmzYGHDTpu0uoWCRh6Jutq2g4u--Kr2QjYOtg", gid: "1528717252" },
  korea: { id: "korea", label: { ko: "한국", en: "Korea", ja: "韓国"       }, lang: "ko", sheetId: "16aQeXTEmzYGHDTpu0uoWCRh6Jutq2g4u--Kr2QjYOtg", gid: "219522591" },
  japan: { id: "japan", label: { ko: "일본", en: "Japan", ja: "日本"       }, lang: "ja", sheetId: "16aQeXTEmzYGHDTpu0uoWCRh6Jutq2g4u--Kr2QjYOtg", gid: "1850482528" },
};

const DEFAULT_COUNTRIES_BY_LANG = {
  en: ["uk", "usa"],   // 영어 → 영국, 미국
  ko: ["korea"],       // 한국어 → 한국
  ja: ["japan"],       // 일본어 → 일본
  default: ["uk", "usa"],
};

const APP_NAME_BY_LANG = { ko: "오늘의 역사", en: "Today in History", ja: "今日の歴史" };
const APP_DOWNLOAD_URL = "https://example.com/today-in-history";

const UI_STR = {
  title: {
    ko: { prev: "어제의 역사", today: "오늘의 역사", next: "내일의 역사" },
    en: { prev: "Yesterday in History", today: "Today in History", next: "Tomorrow in History" },
    ja: { prev: "昨日の歴史", today: "今日の歴史", next: "明日の歴史" },
  },
  empty:   { ko: "표시할 항목이 없습니다.", en: "No items to display.", ja: "表示する項目がありません。" },
  copyBtn: { ko: "복사",                   en: "Copy",                 ja: "コピー" },
};

const COPY_TOAST   = { ko: "복사", en: "Copied", ja: "コピーしました" };
const SOURCE_LABEL = { ko: "출처",  en: "Source",  ja: "出典" };

const LOCALE_BY_LANG = { ko: "ko-KR", en: "en-US", ja: "ja-JP" };
const UI_COL = { ko: "한국어", en: "English", ja: "日本語" };
const NATIVE_COL_BY_COUNTRY = { korea: "한국어", japan: "日本語", usa: "English", uk: "English" };

// 캐시
const SHEET_CACHE      = globalThis.__SHEET_CACHE__      ?? (globalThis.__SHEET_CACHE__      = new Map()); // key → rows[]
const INFLIGHT         = globalThis.__SHEET_INFLIGHT__   ?? (globalThis.__SHEET_INFLIGHT__   = new Map()); // key → promise
const SHEET_DAY_INDEX  = globalThis.__SHEET_DAY_INDEX__  ?? (globalThis.__SHEET_DAY_INDEX__  = new Map()); // key → Map(mdLower -> row[])
export const PICK_RESULT_CACHE = globalThis.__PICK_RESULT_CACHE__ ?? (globalThis.__PICK_RESULT_CACHE__ = new Map());

// 디바이스 언어로 UI 언어 결정
function resolveUiLangFromDevice() {
  const locales = (Localization.getLocales && Localization.getLocales()) || [];
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
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(base).reduce((a, p) => { if (p.type !== "literal") a[p.type] = p.value; return a; }, {});
  return new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00`);
}
function getDayPartsFrom(date, tz) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date).reduce((a, p) => { if (p.type !== "literal") a[p.type] = p.value; return a; }, {});
  return {
    md: `${parts.month}-${parts.day}`,
    dcode: `D${parts.month}${parts.day}`,
    y: parts.year, m: parts.month, d: parts.day,
  };
}
const trimHtml   = (s) => String(s || "").replace(/<[^>]+>/g, "").trim();
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
  const isoHit  = trySplit(iso);
  const dateHit = trySplit(dateStr);
  if (isoHit) ({ y, m, d } = isoHit);
  else if (dateHit) ({ y, m, d } = dateHit);
  else {
    y = String(row?.Year || row?.year || "").trim() || "";
    if (typeof dateStr === "string" && /^\d{2}-\d{2}$/.test(dateStr.trim())) {
      const [mm, dd] = dateStr.trim().split("-");
      m = mm; d = dd;
    } else if (row?.month && row?.day) {
      m = String(row.month).padStart(2, "0");
      d = String(row.day).padStart(2, "0");
    }
  }
  const L = ({
    ko: (Y, M, D) => [Y && `${Y}년`, M && `${parseInt(M, 10)}월`, D && `${parseInt(D, 10)}일`].filter(Boolean).join(" "),
    ja: (Y, M, D) => [Y && `${Y}年`, M && `${parseInt(M, 10)}月`, D && `${parseInt(D, 10)}日`].filter(Boolean).join(" "),
    en: (Y, M, D) => [M && parseInt(M, 10), D && parseInt(D, 10), Y].filter(Boolean).join(" "),
  }[uiLang]) || ((Y, M, D) => [Y, M, D].filter(Boolean).join("-"));
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

//  세트 동등 비교
function equalSets(a, b) {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}
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
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17; x >>>= 0;
    x ^= x << 5;  x >>>= 0;
    return (x >>> 0) / 0xffffffff;
  };
}

// 행에서 MM-DD 추출(빠른 검사)
function mdFromRowQuick(row) {
  const dateStr = row?.Date || row?.date || row?.__DATE || "";
  if (typeof dateStr === "string") {
    const s = dateStr.trim();
    if (/^\d{2}-\d{2}$/.test(s)) return s.toLowerCase();
    const m = s.match(/^\d{4}[-/](\d{2})[-/](\d{2})/);
    if (m) return `${m[1]}-${m[2]}`.toLowerCase();
  }
  const iso = row?.isoDate || row?.dateISO || row?.dateString || "";
  if (typeof iso === "string") {
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[2]}-${m[3]}`.toLowerCase();
  }
  if (row?.month && row?.day) {
    const mm = String(row.month).padStart(2, "0");
    const dd = String(row.day).padStart(2, "0");
    return `${mm}-${dd}`.toLowerCase();
  }
  return "";
}

// 느슨한 검사
function isTodayRowLoose(row, today) {
  const md = today.md;
  const mmdd = today.dcode.slice(1);

  const dateStr = row?.Date || row?.date || row?.__DATE || "";
  if (typeof dateStr === "string") {
    const s = dateStr.trim();
    if (s.toLowerCase().includes(`d${mmdd.toLowerCase()}`)) return true;
    if (s === md) return true;
    if (/^\d{4}[-/]\d{2}[-/]\d{2}/.test(s)) return s.slice(5, 10) === md;
  }
  const iso = row?.isoDate || row?.dateISO || row?.dateString || "";
  if (typeof iso === "string" && /^\d{4}-\d{2}-\d{2}/.test(iso)) return iso.slice(5, 10) === md;

  if (row?.month && row?.day) {
    const mm = String(row.month).padStart(2, "0");
    const dd = String(row.day).padStart(2, "0");
    if (`${mm}-${dd}` === md) return true;
  }

  for (const v of Object.values(row || {})) {
    if (typeof v !== "string") continue;
    const s = v.trim();
    if (!s) continue;
    if (new RegExp(`\\b[dD]${mmdd}\\b`).test(s)) return true;
    if (s.includes(md)) return true;
  }
  return false;
}

// 오늘 날짜에 해당하는 행들 추출(빠른 검사 후 느슨한 검사)
function getTodayRowsSmart(key, todayParts) {
  const mdLower = todayParts.md.toLowerCase();

  const idx = SHEET_DAY_INDEX.get(key);
  if (idx && idx.has(mdLower)) {
    const arr = idx.get(mdLower) || [];
    if (arr.length) return arr;
  }

  const rows = SHEET_CACHE.get(key) || [];
  const quick = [];
  for (let i = 0; i < rows.length; i++) {
    if (mdFromRowQuick(rows[i]) === mdLower) quick.push(rows[i]);
  }
  if (quick.length) {
    const map = idx || new Map();
    map.set(mdLower, quick);
    SHEET_DAY_INDEX.set(key, map);
    return quick;
  }

  const sure = [];
  for (let i = 0; i < rows.length; i++) {
    if (isTodayRowLoose(rows[i], todayParts)) sure.push(rows[i]);
  }
  if (sure.length) {
    const map = idx || new Map();
    map.set(mdLower, sure);
    SHEET_DAY_INDEX.set(key, map);
  }
  return sure;
}

// 전체 rows로부터 md 인덱스 구축
function buildDayIndex(rows) {
  const map = new Map();
  for (let i = 0; i < rows.length; i++) {
    const md = mdFromRowQuick(rows[i]);
    if (!md) continue;
    const arr = map.get(md) || [];
    arr.push(rows[i]);
    map.set(md, arr);
  }
  return map;
}

// 빠른 로드 + 백그라운드 갱신
async function loadSheetRowsFast(sheetId, gid, timeoutMs = 5000) {
  const key = `${sheetId}:${gid}`;
  const storageKey = STORAGE_SHEET_PREFIX + key;
  const indexKey   = STORAGE_INDEX_PREFIX + key;

  if (SHEET_CACHE.has(key)) return SHEET_CACHE.get(key);

  const raw = await AsyncStorage.getItem(storageKey).catch(() => null);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      const rows = Array.isArray(parsed?.rows) ? parsed.rows : [];
      SHEET_CACHE.set(key, rows);
      if (!SHEET_DAY_INDEX.has(key)) {
        const rawIdx = await AsyncStorage.getItem(indexKey).catch(() => null);
        if (rawIdx) {
          const obj = JSON.parse(rawIdx) || {};
          const map = new Map(Object.entries(obj).map(([md, arr]) => [md, arr]));
          SHEET_DAY_INDEX.set(key, map);
        } else {
          const map = buildDayIndex(rows);
          SHEET_DAY_INDEX.set(key, map);
          const plain = Object.fromEntries([...map.entries()]);
          AsyncStorage.setItem(indexKey, JSON.stringify(plain)).catch(() => {});
        }
      }
      if (!INFLIGHT.has(key)) {
        const p = fetchSheetRows({ sheetId, gid })
          .then((fresh) => {
            if (Array.isArray(fresh)) {
              SHEET_CACHE.set(key, fresh);
              AsyncStorage.setItem(storageKey, JSON.stringify({ rows: fresh, ts: Date.now() })).catch(() => {});
              const map = buildDayIndex(fresh);
              SHEET_DAY_INDEX.set(key, map);
              const plain = Object.fromEntries([...map.entries()]);
              AsyncStorage.setItem(indexKey, JSON.stringify(plain)).catch(() => {});
            }
          })
          .finally(() => INFLIGHT.delete(key))
          .catch(() => {});
        INFLIGHT.set(key, p);
      }
      return rows;
    } catch {}
  }

  if (INFLIGHT.has(key)) return INFLIGHT.get(key);

  const withTimeout = (p, ms) =>
    new Promise((resolve) => {
      const t = setTimeout(() => resolve([]), ms);
      p.finally(() => clearTimeout(t)).then(resolve).catch(() => resolve([]));
    });

  const task = withTimeout(fetchSheetRows({ sheetId, gid }), timeoutMs)
    .then((rows) => {
      const safe = Array.isArray(rows) ? rows : [];
      SHEET_CACHE.set(key, safe);
      const map = buildDayIndex(safe);
      SHEET_DAY_INDEX.set(key, map);
      const plain = Object.fromEntries([...map.entries()]);
      AsyncStorage.setItem(storageKey, JSON.stringify({ rows: safe, ts: Date.now() })).catch(() => {});
      AsyncStorage.setItem(indexKey, JSON.stringify(plain)).catch(() => {});
      INFLIGHT.delete(key);
      return safe;
    })
    .catch(() => {
      INFLIGHT.delete(key);
      return [];
    });

  INFLIGHT.set(key, task);
  return task;
}

//  랜덤 선택(1~2개)
function makePicksFromPool(pool, uiLang, stableKey) {
  if (!pool.length) return [];
  const rnd = xorshift(hash32(stableKey));
  const first = pool[Math.floor(rnd() * pool.length)];
  const picks = [first];
  const len = String(first.body || "").replace(/\s+/g, " ").trim().length;
  const wantTwo = uiLang === "en" ? len <= 75 : (uiLang === "ko" || uiLang === "ja") ? len <= 50 : false;
  if (wantTwo && pool.length > 1) {
    const rest = pool.filter((x) => x.key !== first.key);
    if (rest.length) picks.push(rest[Math.floor(rnd() * rest.length)]);
  }
  return picks;
}

/* 제목 문자열 */
function getHistoryTitle(uiLang, deltaDay) {
  const t = UI_STR.title[uiLang] || UI_STR.title.en;
  if (deltaDay < 0) return t.prev;
  if (deltaDay > 0) return t.next;
  return t.today;
}

// 복사 완료 토스트
function CopyToast({ trigger, message }) {
  const [visible, setVisible] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;
  const mounted = useRef(false);
  const lastSeen = useRef(trigger);

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
      }, 1200);
      return () => clearTimeout(t);
    });
  }, [trigger]);

  if (!visible) return null;
  return (
    <Animated.View pointerEvents="none" style={{ position: "absolute", bottom: 24, left: 0, right: 0, alignItems: "center", opacity, transform: [{ translateY }] }}>
      <View style={{ backgroundColor: "#111827", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 }}>
        <Text style={{ color: "white", fontWeight: "700" }}>{message}</Text>
      </View>
    </Animated.View>
  );
}

// 국가 정렬
const ALL_ORDER = ["usa", "uk", "korea", "japan"];
function orderCountriesForLang(uiLang) {
  const pref = DEFAULT_COUNTRIES_BY_LANG[uiLang] || DEFAULT_COUNTRIES_BY_LANG.default;
  const set = new Set(pref);
  const rest = ALL_ORDER.filter((c) => !set.has(c));
  return [...pref, ...rest];
}

//  메인 컴포넌트
export default function Home() {
  const [tz] = useState(Intl?.DateTimeFormat?.().resolvedOptions().timeZone || "UTC");

  // 반응형 사이즈
  const { width } = useWindowDimensions();
  const S = useMemo(() => {
    const isTablet = width >= 768;
    const isLarge  = width >= 1024;
    return {
      containerMaxWidth: isLarge ? 900 : isTablet ? 700 : 460,
      pagePad:           isTablet ? 24  : 16,
      gap:               isTablet ? 20  : 16,
      cardPad:           isLarge ? 24   : 16,
      titleSize:         isLarge ? 28   : isTablet ? 24 : 20,
      dateSize:          isLarge ? 16   : 14,
      bodySize:          isLarge ? 20   : isTablet ? 18 : 18,
      bodyLH:            isLarge ? 30   : isTablet ? 28 : 26,
      chipPadH:          isTablet ? 14  : 12,
      chipPadV:          isTablet ? 10  : 8,
      chipFont:          isTablet ? 14  : 13,
    };
  }, [width]);

  // 오늘 00:00
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const nextMidnight = (() => { const t = startOfDayInTz(new Date(), tz); t.setDate(t.getDate() + 1); return t.getTime(); })();
    const ms = Math.max(1000, nextMidnight - Date.now());
    const timer = setTimeout(() => setNow(new Date()), ms);
    return () => clearTimeout(timer);
  }, [tz, now]);

  // 기준 날짜
  const [baseDate, setBaseDate] = useState(() => startOfDayInTz(new Date(), tz));

  // 언어/국가
  const deviceLang = useMemo(() => resolveUiLangFromDevice(), []);
  const [uiLang, setUiLang] = useState(deviceLang);
  const [selectedCountries, setSelectedCountries] = useState(new Set(DEFAULT_COUNTRIES_BY_LANG[deviceLang] || DEFAULT_COUNTRIES_BY_LANG.default));

  // 상태
  const [onePick, setOnePick] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);
  const [copyTick, setCopyTick] = useState(0);

  // -1/0/1
  const DAY_MS = 86400000;
  const getIndexFromToday = useCallback((date) => {
    const base0  = startOfDayInTz(date, tz).getTime();
    const today0 = startOfDayInTz(new Date(), tz).getTime();
    return Math.round((base0 - today0) / DAY_MS);
  }, [tz]);
  const goBy = useCallback((delta) => {
    setBaseDate((prev) => {
      const curIdx  = getIndexFromToday(prev);
      const nextIdx = Math.max(-1, Math.min(1, curIdx + delta));
      if (nextIdx === curIdx) return prev;
      const today0 = startOfDayInTz(new Date(), tz);
      const target = new Date(today0);
      target.setDate(target.getDate() + nextIdx);
      return target;
    });
  }, [tz, getIndexFromToday]);

  // prev/next/refresh
  useEffect(() => {
    const offPrev    = onGoPrevDay?.(() => goBy(-1));
    const offNext    = onGoNextDay?.(() => goBy(+1));
    const offRefresh = onRefresh?.(() => setRefreshTick((t) => t + 1));
    return () => {
      offPrev && offPrev();
      offNext && offNext();
      offRefresh && offRefresh();
    };
  }, [goBy]);

  // 최초 로드: 저장된 언어/선택 적용. 저장된 선택이 있으면 그걸 쓰고, 없으면 언어 기본 세트로.
  useEffect(() => {
    (async () => {
      try {
        const storedLang = await AsyncStorage.getItem(STORAGE_KEY_UI_LANG).catch(() => null);
        const lang = (storedLang === "ko" || storedLang === "en" || storedLang === "ja") ? storedLang : deviceLang;
        setUiLang(lang);

        const storedSel = await AsyncStorage.getItem(STORAGE_KEY_SELECTED).catch(() => null);
        if (storedSel) {
          const arr = JSON.parse(storedSel);
          if (Array.isArray(arr) && arr.length) {
            setSelectedCountries(new Set(arr));
          } else {
            const def = new Set(DEFAULT_COUNTRIES_BY_LANG[lang] || DEFAULT_COUNTRIES_BY_LANG.default);
            setSelectedCountries(def);
            AsyncStorage.setItem(STORAGE_KEY_SELECTED, JSON.stringify([...def])).catch(() => {});
          }
        } else {
          const def = new Set(DEFAULT_COUNTRIES_BY_LANG[lang] || DEFAULT_COUNTRIES_BY_LANG.default);
          setSelectedCountries(def);
          AsyncStorage.setItem(STORAGE_KEY_SELECTED, JSON.stringify([...def])).catch(() => {});
        }
      } finally {
        setLoading(true);
      }
    })();
  }, [deviceLang]);

  // 설정에서 복귀 시 언어가 바뀌었으면 그 언어의 기본 세트로 1회 초기화(이후엔 유저가 멀티 선택 가능)
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        try {
          const storedLang = await AsyncStorage.getItem(STORAGE_KEY_UI_LANG).catch(() => null);
          if (!alive) return;

          const nextLang =
            storedLang === "ko" || storedLang === "en" || storedLang === "ja"
              ? storedLang
              : uiLang;

          if (nextLang !== uiLang) {
            setUiLang(nextLang);
            const def = new Set(DEFAULT_COUNTRIES_BY_LANG[nextLang] || DEFAULT_COUNTRIES_BY_LANG.default);
            setSelectedCountries(def);
            AsyncStorage.setItem(STORAGE_KEY_SELECTED, JSON.stringify([...def])).catch(() => {});
            setRefreshTick((t) => t + 1);
            return; // 초기화 후 종료(유저가 이후에 멀티 선택 가능)
          }

          // 언어는 동일하지만 설정에서 나라를 바꿨다면 반영
          const storedSel = await AsyncStorage.getItem(STORAGE_KEY_SELECTED).catch(() => null);
          if (!alive) return;
          if (storedSel) {
            const arr = JSON.parse(storedSel);
            if (Array.isArray(arr)) {
              const nextSet = new Set(arr);
              if (!equalSets(nextSet, selectedCountries)) {
                setSelectedCountries(nextSet);
                setRefreshTick((t) => t + 1);
              }
            }
          }
        } catch {}
      })();
      return () => { alive = false; };
    }, [uiLang, selectedCountries])
  );

  const todayParts = useMemo(() => getDayPartsFrom(baseDate, tz), [baseDate, tz]);
  const stableKey = useMemo(() => {
    const baseISO = startOfDayInTz(baseDate, tz).toISOString();
    const sel = [...selectedCountries].sort().join(",");
    return `${baseISO}__${uiLang}__${sel}`;
  }, [baseDate, tz, uiLang, selectedCountries]);
  const seedKey = useMemo(() => `${stableKey}__r${refreshTick}`, [stableKey, refreshTick]);

  // 언어만 바뀐 경우: 기존 rows로 본문만 재조합
  useEffect(() => {
    setOnePick((prev) => {
      if (!Array.isArray(prev) || !prev.length) return prev;
      return prev.map((it) => {
        const newBody = bodyOfRowByLang(it.row, uiLang, it.cid);
        return newBody && hasAnyText(newBody) ? { ...it, body: newBody } : it;
      });
    });
  }, [uiLang]);

  // 프로그레시브 로딩
  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        setErr("");
        setLoading(true);

        const chosen = [...selectedCountries].filter(Boolean);
        if (chosen.length === 0) {
          if (!canceled) { setOnePick([]); setLoading(false); }
          return;
        }

        const pool = [];
        const commit = () => {
          if (canceled) return;
          const picks = makePicksFromPool(pool, uiLang, seedKey);
          if (picks.length) {
            setOnePick(picks);
            setLoading(false);
          }
        };

        await Promise.all(chosen.map(async (cid) => {
          const cfg = COUNTRY_CFG[cid];
          if (!cfg) return;
          const key = `${cfg.sheetId}:${cfg.gid}`;
          await loadSheetRowsFast(cfg.sheetId, cfg.gid, 5000);
          const todays = getTodayRowsSmart(key, todayParts);
          for (const r of todays) {
            const body = bodyOfRowByLang(r, uiLang, cid);
            if (!hasAnyText(body)) continue;
            const tag = trimHtml(r?.["한국어"] || r?.English || r?.["日本語"] || "").slice(0, 50);
            pool.push({ cid, row: r, key: `${cid}|${String(r?.Year || r?.year || "")}|${String(r?.Date || r?.date || "")}|${tag}`, body });
          }
          if (pool.length) commit();
        }));

        if (!pool.length && !canceled) {
          setOnePick([]);
          setLoading(false);
        }
      } catch (e) {
        if (!canceled) { setErr(String(e?.message || e)); setLoading(false); }
      }
    })();
    return () => { canceled = true; };
  }, [todayParts, uiLang, selectedCountries, seedKey]);

  // 제목(어제/오늘/내일)
  const deltaDay = useMemo(() => {
    const base = startOfDayInTz(baseDate, tz).getTime();
    const today0 = startOfDayInTz(new Date(), tz).getTime();
    const diff = Math.round((base - today0) / 86400000);
    return diff < 0 ? -1 : diff > 0 ? 1 : 0;
  }, [baseDate, tz]);

  // 나라 선택 저장 동기화(칩 클릭 시 호출)
  const handleCountriesChange = useCallback((nextSet) => {
    setSelectedCountries(nextSet);
    AsyncStorage.setItem(STORAGE_KEY_SELECTED, JSON.stringify([...nextSet])).catch(() => {});
    setRefreshTick((t) => t + 1);
  }, []);

  // 복사/공유
  const onCopyPress = useCallback(async () => {
    try {
      const list = Array.isArray(onePick) ? onePick : onePick ? [onePick] : [];
      const header = getMonthDayOnly(baseDate, uiLang, tz);
      const appName = APP_NAME_BY_LANG[uiLang] || APP_NAME_BY_LANG.en;
      const sourceLabel = SOURCE_LABEL[uiLang] || SOURCE_LABEL.en;
      const blocks = (list || []).map((p) => {
        const countryLabel = COUNTRY_CFG[p.cid]?.label?.[uiLang] || p.cid;
        const yr = getYearFromRow(p.row) || "";
        const content = (p.body || "").trim();
        return [countryLabel, yr, content, `${sourceLabel}: ${appName}`].filter(Boolean).join("\n");
      });
      const payload = [header, ...blocks, APP_DOWNLOAD_URL].join("\n\n");

      await Clipboard.setStringAsync(payload);
      setCopyTick((t) => t + 1);

      const fileName = `history_${Date.now()}.txt`;
      const uri = FileSystem.cacheDirectory + fileName;
      await FileSystem.writeAsStringAsync(uri, payload, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { dialogTitle: UI_STR.copyBtn[uiLang] || UI_STR.copyBtn.en, UTI: "public.plain-text", mimeType: "text/plain" });
      }
    } catch {}
  }, [onePick, baseDate, uiLang, tz]);

  // Share 탭 → 홈에서 복사/공유
  useEffect(() => {
    const offShare = onShareAttach?.(() => onCopyPress());
    return () => { offShare && offShare(); };
  }, [onCopyPress]);

  // PICK_RESULT_CACHE 동기화
  useEffect(() => {
    try {
      const picksList = Array.isArray(onePick) ? onePick : onePick ? [onePick] : [];
      const selectedArr = [...selectedCountries];
      const monthDay = getMonthDayOnly(baseDate, uiLang, tz);
      const notificationBody = picksList.length
        ? picksList.map((p) => {
            const label = COUNTRY_CFG[p.cid]?.label?.[uiLang] || p.cid;
            const yr = getYearFromRow(p.row);
            return `${monthDay} — ${label}${yr ? ` ${yr}` : ""}: ${p.body}`;
          }).join(" • ")
        : `${monthDay} — ${APP_NAME_BY_LANG[uiLang] || APP_NAME_BY_LANG.en}`;
      const header = getMonthDayOnly(baseDate, uiLang, tz);
      const appName = APP_NAME_BY_LANG[uiLang] || APP_NAME_BY_LANG.en;
      const sourceLabel = SOURCE_LABEL[uiLang] || SOURCE_LABEL.en;
      const blocks = (picksList || []).map((p) => {
        const countryLabel = COUNTRY_CFG[p.cid]?.label?.[uiLang] || p.cid;
        const yr = getYearFromRow(p.row) || "";
        const content = (p.body || "").trim();
        return [countryLabel, yr, content, `${sourceLabel}: ${appName}`].filter(Boolean).join("\n");
      });
      const shareText = [header, ...blocks, APP_DOWNLOAD_URL].join("\n\n");

      PICK_RESULT_CACHE.set("stableKey", stableKey);
      PICK_RESULT_CACHE.set("todayParts", todayParts);
      PICK_RESULT_CACHE.set("uiLang", uiLang);
      PICK_RESULT_CACHE.set("selectedCountries", selectedArr);
      PICK_RESULT_CACHE.set("picks", picksList);
      PICK_RESULT_CACHE.set("shareText", shareText);
      PICK_RESULT_CACHE.set("notificationBody", notificationBody);
      PICK_RESULT_CACHE.set("baseDateISO", startOfDayInTz(baseDate, tz).toISOString());
      PICK_RESULT_CACHE.set("lastSavedAt", Date.now());
    } catch {}
  }, [onePick, todayParts, uiLang, selectedCountries, baseDate, tz, stableKey]);

  const list = Array.isArray(onePick) ? onePick : onePick ? [onePick] : [];
  const ordered = orderCountriesForLang(uiLang);

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
      <Stack.Screen
        options={{
          headerRight: () => <HeaderCopyButton label={UI_STR.copyBtn[uiLang] || UI_STR.copyBtn.en} onPress={onCopyPress} />,
          title: "",
        }}
      />

      <ScrollView
        contentContainerStyle={{
          padding: S.pagePad,
          gap: S.gap,
          maxWidth: S.containerMaxWidth,
          alignSelf: "center",
          paddingBottom: S.pagePad + 16,
          width: "100%",
        }}
      >
        {/* 나라 선택(멀티 선택 가능, 저장/복원) */}
        <CountrySelector
          uiLang={uiLang}
          ordered={ordered}
          value={selectedCountries}
          onChange={handleCountriesChange}
          size={S}
        />

        {/* 제목 + 날짜 */}
        <View>
          <Text style={{ fontSize: S.titleSize, fontWeight: "800" }}>{getHistoryTitle(uiLang, deltaDay)}</Text>
          <Text style={{ marginTop: 6, fontSize: S.dateSize, color: "#64748b" }}>
            {baseDate.toLocaleDateString(LOCALE_BY_LANG[uiLang] || "en-US", { year: "numeric", month: "long", day: "numeric", timeZone: tz })}
          </Text>
        </View>

        {/* 카드 */}
        <View style={{ padding: S.cardPad, borderRadius: 12, backgroundColor: "#F8FAFC", gap: 14 }}>
          {list.length === 0 ? (
            <Text style={{ color: "#6b7280" }}>{loading ? "..." : (UI_STR.empty[uiLang] || UI_STR.empty.en)}</Text>
          ) : (
            list.map((p) => {
              const label = COUNTRY_CFG[p.cid]?.label?.[uiLang] || p.cid;
              const dateLine = formatRowDate(p.row, uiLang);
              return (
                <View key={p.key} style={{ gap: 6 }}>
                  <View style={{ alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: "#E5E7EB" }}>
                    <Text style={{ fontWeight: "700" }}>{label}</Text>
                  </View>
                  {!!dateLine && <Text style={{ fontSize: 12, color: "#64748b" }}>{dateLine}</Text>}
                  <Text style={{ lineHeight: S.bodyLH, fontSize: S.bodySize }}>{p.body}</Text>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {loading && !err && (
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
    </SafeAreaView>
  );
}

// 헤더 복사 버튼
function HeaderCopyButton({ label, onPress }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} style={{ paddingHorizontal: 12 }}>
      <Text style={{ fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

function CountrySelector({ uiLang, ordered, value, onChange, size }) {
  const toggleOne = (id) => {
    const next = new Set(value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next); // 부모에서 저장/리프레시 처리
  };

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        {ordered.map((id) => {
          const active = value.has(id);
          return (
            <Pressable
              key={id}
              onPress={() => toggleOne(id)}
              style={{
                paddingHorizontal: size?.chipPadH ?? 12,
                paddingVertical:   size?.chipPadV ?? 8,
                borderRadius: 999,
                backgroundColor: active ? "#201d6aff" : "#E5E7EB",
              }}
            >
              <Text style={{ color: active ? "white" : "black", fontWeight: "700", fontSize: size?.chipFont ?? 13 }}>
                {(COUNTRY_CFG[id]?.label?.[uiLang]) || id}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
