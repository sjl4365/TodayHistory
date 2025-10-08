// app/(tabs)/home.js
import React, {
  useEffect, useMemo, useRef, useState, useCallback, useLayoutEffect, useTransition,
} from "react";
import {
  ActivityIndicator, Text, View, Pressable, ScrollView, Animated, Easing,
  useWindowDimensions, InteractionManager,
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
import { runChunked, afterFirstInput } from "../../lib/idle";

// Web Worker 기반 JSON 파서(비동기 파싱)
import { parseJsonInWorker } from "../../lib/worker-utils";

/* ─── 상수/설정 ─── */
const STORAGE_KEY_SELECTED = "selectedCountries";
const STORAGE_KEY_UI_LANG  = "@app_language";
const STORAGE_SHEET_PREFIX = "@sheet_cache_v1:";
const STORAGE_INDEX_PREFIX = "@sheet_day_index_v1:";

const COUNTRY_CFG = {
  usa:   { id: "usa",   label: { ko: "미국",  en: "USA",   ja: "アメリカ" }, lang: "en", sheetId: "16aQeXTEmzYGHDTpu0uoWCRh6Jutq2g4u--Kr2QjYOtg", gid: "2056769855" },
  uk:    { id: "uk",    label: { ko: "영국",  en: "UK",    ja: "英国"     }, lang: "en", sheetId: "16aQeXTEmzYGHDTpu0uoWCRh6Jutq2g4u--Kr2QjYOtg", gid: "1528717252" },
  korea: { id: "korea", label: { ko: "한국",  en: "Korea", ja: "韓国"     }, lang: "ko", sheetId: "16aQeXTEmzYGHDTpu0uoWCRh6Jutq2g4u--Kr2QjYOtg", gid: "219522591" },
  japan: { id: "japan", label: { ko: "일본",  en: "Japan", ja: "日本"     }, lang: "ja", sheetId: "16aQeXTEmzYGHDTpu0uoWCRh6Jutq2g4u--Kr2QjYOtg", gid: "1850482528" },
};

const DEFAULT_COUNTRIES_BY_LANG = { en: ["uk", "usa"], ko: ["korea"], ja: ["japan"], default: ["uk", "usa"] };

const APP_NAME_BY_LANG = { ko: "오늘의 역사", en: "Today in History", ja: "今日の歴史" };
const APP_DOWNLOAD_URL = "https://example.com/today-in-history";

const UI_STR = {
  title: {
    ko: { prev: "어제의 역사", today: "오늘의 역사", next: "내일의 역사" },
    en: { prev: "Yesterday in History", today: "Today in History", next: "Tomorrow in History" },
    ja: { prev: "昨日の歴史", today: "今日の歴史", next: "明日の歴史" },
  },
  empty:   { ko: "표시할 항목이 없습니다.", en: "No items to display.", ja: "表示する項目がありません。" },
  copyBtn: { ko: "복사", en: "Copy", ja: "コピー" },
};

const COPY_TOAST   = { ko: "복사", en: "Copied", ja: "コピーしました" };
const SOURCE_LABEL = { ko: "출처",  en: "Source", ja: "出典" };

const LOCALE_BY_LANG = { ko: "ko-KR", en: "en-US", ja: "ja-JP" };
const UI_COL = { ko: "한국어", en: "English", ja: "日本語" };
const NATIVE_COL_BY_COUNTRY = { korea: "한국어", japan: "日本語", usa: "English", uk: "English" };

/* ─── 전역 캐시 ─── */
const SHEET_CACHE      = globalThis.__SHEET_CACHE__      ?? (globalThis.__SHEET_CACHE__      = new Map());
const INFLIGHT         = globalThis.__SHEET_INFLIGHT__   ?? (globalThis.__SHEET_INFLIGHT__   = new Map());
const SHEET_DAY_INDEX  = globalThis.__SHEET_DAY_INDEX__  ?? (globalThis.__SHEET_DAY_INDEX__  = new Map());
export const PICK_RESULT_CACHE = globalThis.__PICK_RESULT_CACHE__ ?? (globalThis.__PICK_RESULT_CACHE__ = new Map());

/* ─── 유틸 ─── */
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
const trimHtml   = (s) => String(s || "").replace(/<[^>]+>/g, "").trim();
const hasAnyText = (t) => String(t || "").replace(/\s+/g, " ").trim().length > 0;

function pickFirstNonEmpty(raw, keys) {
  for (const k of keys) {
    const s = String(raw?.[k] ?? "").replace(/<[^>]+>/g, "").trim();
    if (s) return s;
  }
  return "";
}
function bodyOfRowByLang(raw, uiLang, cid) {
  // UI 언어 → 국가 고유어 → English 순
  const order = [
    UI_COL[uiLang] || "English",
    NATIVE_COL_BY_COUNTRY[cid] || "English",
    "English",
  ];
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
  return () => {
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17; x >>>= 0;
    x ^= x << 5;  x >>>= 0;
    return (x >>> 0) / 0xffffffff;
  };
}
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

/* 청크 인덱싱 */
function buildDayIndexChunked(rows, onDone) {
  const map = new Map();
  runChunked(rows, (row) => {
    const md = mdFromRowQuick(row);
    if (!md) return;
    const arr = map.get(md) || [];
    arr.push(row);
    map.set(md, arr);
  }, 6, () => onDone(map));
}

/* 빠른 로더 (워커 파싱 포함) */
async function loadSheetRowsFast(sheetId, gid, timeoutMs = 5000, todayMd = null) {
  const key = `${sheetId}:${gid}`;
  const storageKey = STORAGE_SHEET_PREFIX + key;
  const indexKey   = STORAGE_INDEX_PREFIX + key;

  if (SHEET_CACHE.has(key)) return SHEET_CACHE.get(key) || [];

  const raw = await AsyncStorage.getItem(storageKey).catch(() => null);
  if (raw) {
    try {
      const parsed = await parseJsonInWorker(raw); // 메인 스레드 블로킹 없이 파싱
      const rows = Array.isArray(parsed?.rows) ? parsed.rows : [];
      const rowsToday = Array.isArray(parsed?.rowsToday) ? parsed.rowsToday : [];

      if (rows.length) {
        SHEET_CACHE.set(key, rows);
        afterFirstInput(() => {
          buildDayIndexChunked(rows, (map) => {
            SHEET_DAY_INDEX.set(key, map);
            const plain = Object.fromEntries([...map.entries()]);
            AsyncStorage.setItem(indexKey, JSON.stringify(plain)).catch(() => {});
          });
        });
        return rows;
      }
      if (rowsToday.length && todayMd) {
        const map = new Map();
        map.set(todayMd.toLowerCase(), rowsToday);
        SHEET_DAY_INDEX.set(key, map);
        return rowsToday;
      }
    } catch (e) {
      console.error("Local JSON parsing failed:", e);
    }
  }

  if (INFLIGHT.has(key)) return INFLIGHT.get(key);
  const withTimeout = (p, ms) => new Promise((resolve) => {
    const t = setTimeout(() => resolve([]), ms);
    p.finally(() => clearTimeout(t)).then(resolve).catch(() => resolve([]));
  });

  const task = withTimeout(fetchSheetRows({ sheetId, gid }), timeoutMs)
    .then((rows) => {
      const safe = Array.isArray(rows) ? rows : [];
      SHEET_CACHE.set(key, safe);

      const mapQuick = buildDayIndex(safe);
      const todaysQuick = todayMd ? (mapQuick.get((todayMd || "").toLowerCase()) || []) : [];
      AsyncStorage.setItem(storageKey, JSON.stringify({ rowsToday: todaysQuick, ts: Date.now() })).catch(() => {});

      afterFirstInput(() => {
        AsyncStorage.setItem(storageKey, JSON.stringify({ rows: safe, ts: Date.now() })).catch(() => {});
        buildDayIndexChunked(safe, (map) => {
          SHEET_DAY_INDEX.set(key, map);
          const plain = Object.fromEntries([...map.entries()]);
          AsyncStorage.setItem(STORAGE_INDEX_PREFIX + key, JSON.stringify(plain)).catch(() => {});
        });
      });

      INFLIGHT.delete(key);
      return safe;
    })
    .catch(() => { INFLIGHT.delete(key); return []; });

  INFLIGHT.set(key, task);
  return task;
}

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
function getHistoryTitle(uiLang, deltaDay) {
  const t = UI_STR.title[uiLang] || UI_STR.title.en;
  if (deltaDay < 0) return t.prev;
  if (deltaDay > 0) return t.next;
  return t.today;
}

/* ── Notification에서 재사용할 헬퍼 ───────────────────── */
export async function getLastHomeParams() {
  const tz = Intl?.DateTimeFormat?.().resolvedOptions().timeZone || "UTC";

  const deviceLang = resolveUiLangFromDevice();
  const storedLang = await AsyncStorage.getItem(STORAGE_KEY_UI_LANG).catch(() => null);
  const uiLang =
    storedLang === "ko" || storedLang === "en" || storedLang === "ja"
      ? storedLang
      : deviceLang;

  // 선택 국가
  let selectedCountries;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_SELECTED).catch(() => null);
    const arr = raw ? JSON.parse(raw) : [];
    if (Array.isArray(arr) && arr.length) selectedCountries = arr;
  } catch {}
  if (!selectedCountries) {
    selectedCountries = (DEFAULT_COUNTRIES_BY_LANG[uiLang] || DEFAULT_COUNTRIES_BY_LANG.default).slice();
  }

  const today = startOfDayInTz(new Date(), tz);
  return { today, selectedCountries, uiLang, tz };
}

export async function loadOnePickForDay({ today, selectedCountries, uiLang }) {
  const tz = Intl?.DateTimeFormat?.().resolvedOptions().timeZone || "UTC";
  const todayParts = getDayPartsFrom(today, tz);
  const chosen = Array.isArray(selectedCountries) ? selectedCountries : [...selectedCountries];

  const pool = [];

  for (const cid of chosen) {
    const cfg = COUNTRY_CFG[cid];
    if (!cfg) continue;

    await loadSheetRowsFast(cfg.sheetId, cfg.gid, 3000, todayParts.md);
    const key = `${cfg.sheetId}:${cfg.gid}`;
    const todays = getTodayRowsSmart(key, todayParts);

    for (const r of todays) {
      const body = bodyOfRowByLang(r, uiLang, cid);
      if (!hasAnyText(body)) continue;
      const tag = trimHtml(r?.["한국어"] || r?.English || r?.["日本語"] || "").slice(0, 50);
      pool.push({
        cid,
        row: r,
        key: `${cid}|${String(r?.Year || r?.year || "")}|${String(r?.Date || r?.date || "")}|${tag}`,
        body,
      });
    }
  }

  const stableKey = `${startOfDayInTz(today, tz).toISOString()}__${uiLang}__${chosen.slice().sort().join(",")}`;
  const picks = makePicksFromPool(pool, uiLang, stableKey);

  const notificationBody =
    Array.isArray(picks) && picks.length ? picks.map((p) => `• ${p.body}`).join("\n") : "";
  try {
    PICK_RESULT_CACHE.set("notificationBody", notificationBody);
  } catch {
    PICK_RESULT_CACHE.notificationBody = notificationBody;
  }

  return picks;
}

// 토스트
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

/* ─── UI 헬퍼 (예전 칩 UI) ─── */
const ALL_ORDER = ["usa", "uk", "korea", "japan"];
function orderCountriesForLang(uiLang) {
  const pref = DEFAULT_COUNTRIES_BY_LANG[uiLang] || DEFAULT_COUNTRIES_BY_LANG.default;
  const set = new Set(pref);
  const rest = ALL_ORDER.filter((c) => !set.has(c));
  return [...pref, ...rest];
}

const HeaderCopyButton = React.memo(function HeaderCopyButton({ label, onPress }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} style={{ paddingHorizontal: 12 }}>
      <Text style={{ fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
});

function CountrySelector({ uiLang, ordered, value, onChange, size }) {
  const toggleOne = (id) => {
    const next = new Set(value);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange(next);
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

// 메인
export default function Home() {
  const [tz] = useState(Intl?.DateTimeFormat?.().resolvedOptions().timeZone || "UTC");
  const [isPending, startTransition] = useTransition();

  // 반응형
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

  // 날짜
  const today0 = useMemo(() => startOfDayInTz(new Date(), tz), [tz]);
  const [viewDate, setViewDate] = useState(() => today0);
  const [dataDate, setDataDate] = useState(() => today0);

  // 상태
  const [onePick, setOnePick] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);
  const [copyTick, setCopyTick] = useState(0);

  // 언어/국가
  const deviceLang = useMemo(() => resolveUiLangFromDevice(), []);
  const [uiLang, setUiLang] = useState(deviceLang);
  // ★ 저장값 로딩 완료 전엔 빈 Set으로 시작 (영국/미국 깜빡임 방지)
  const [selectedCountries, setSelectedCountries] = useState(new Set());
  const [initReady, setInitReady] = useState(false); // ★ 초기 로딩 완료 플래그

  // 날짜 인덱스 유틸
  const DAY_MS = 86400000;
  const getIndexFromToday = useCallback((date) => {
    const base0  = startOfDayInTz(date, tz).getTime();
    const t0     = startOfDayInTz(new Date(), tz).getTime();
    return Math.round((base0 - t0) / DAY_MS);
  }, [tz]);

  const goBy = useCallback((delta) => {
    setViewDate((prev) => {
      const curIdx  = getIndexFromToday(prev);
      const nextIdx = Math.max(-1, Math.min(1, curIdx + delta));
      if (nextIdx === curIdx) return prev;
      const target = new Date(today0);
      target.setDate(target.getDate() + nextIdx);
      requestAnimationFrame(() => {
        setLoading(true);
        setDataDate(target);
      });
      return target;
    });
  }, [getIndexFromToday, today0]);

  // 탭 이벤트
  useEffect(() => {
    const offPrev = onGoPrevDay?.(() => goBy(-1));
    const offNext = onGoNextDay?.(() => goBy(+1));
    const offRefresh = onRefresh?.(() => {
      requestAnimationFrame(() => {
        setLoading(true);
        setTimeout(() => setRefreshTick((t) => t + 1), 0);
      });
    });
    return () => { offPrev && offPrev(); offNext && offNext(); offRefresh && offRefresh(); };
  }, [goBy]);

  // 최초 로드: 저장된 언어/선택
  useEffect(() => {
    (async () => {
      try {
        const storedLang = await AsyncStorage.getItem(STORAGE_KEY_UI_LANG).catch(() => null);
        const lang = (storedLang === "ko" || storedLang === "en" || storedLang === "ja") ? storedLang : deviceLang;
        setUiLang(lang);

        const storedSel = await AsyncStorage.getItem(STORAGE_KEY_SELECTED).catch(() => null);
        if (storedSel) {
          let arr = [];
          try { arr = JSON.parse(storedSel); } catch {}
          if (Array.isArray(arr) && arr.length) {
            setSelectedCountries(new Set(arr));
          } else {
            const def = new Set(DEFAULT_COUNTRIES_BY_LANG[lang] || DEFAULT_COUNTRIES_BY_LANG.default);
            setSelectedCountries(def);
            InteractionManager.runAfterInteractions(() => {
              AsyncStorage.setItem(STORAGE_KEY_SELECTED, JSON.stringify([...def])).catch(() => {});
            });
          }
        } else {
          const def = new Set(DEFAULT_COUNTRIES_BY_LANG[lang] || DEFAULT_COUNTRIES_BY_LANG.default);
          setSelectedCountries(def);
          InteractionManager.runAfterInteractions(() => {
            AsyncStorage.setItem(STORAGE_KEY_SELECTED, JSON.stringify([...def])).catch(() => {});
          });
        }
      } finally {
        setLoading(true);
        setInitReady(true); // ★ 초기 로딩 완료
      }
    })();
  }, [deviceLang]);

  // 설정 복귀 동기화
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        try {
          const storedLang = await AsyncStorage.getItem(STORAGE_KEY_UI_LANG).catch(() => null);
          if (!alive) return;
          const nextLang = (storedLang === "ko" || storedLang === "en" || storedLang === "ja") ? storedLang : uiLang;

          if (nextLang !== uiLang) {
            // 언어가 바뀌면, 해당 언어의 기본 국가로 재설정
            setUiLang(nextLang);
            const def = new Set(DEFAULT_COUNTRIES_BY_LANG[nextLang] || DEFAULT_COUNTRIES_BY_LANG.default);
            setSelectedCountries(def);
            InteractionManager.runAfterInteractions(() => {
              AsyncStorage.setItem(STORAGE_KEY_SELECTED, JSON.stringify([...def])).catch(() => {});
            });
            // ★ 영어 잔상 방지: 즉시 비우고 재로딩 유도
            setOnePick([]);
            setLoading(true);
            setRefreshTick((t) => t + 1);
            return;
          }

          const storedSel = await AsyncStorage.getItem(STORAGE_KEY_SELECTED).catch(() => null);
          if (!alive) return;
          if (storedSel) {
            let arr = [];
            try { arr = JSON.parse(storedSel); } catch {}
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

  // todayParts / stableKey
  const todayParts = useMemo(() => getDayPartsFrom(dataDate, tz), [dataDate, tz]);
  const stableKey  = useMemo(() => {
    const baseISO = startOfDayInTz(dataDate, tz).toISOString();
    const sel = [...selectedCountries].sort().join(",");
    return `${baseISO}__${uiLang}__${sel}`;
  }, [dataDate, tz, uiLang, selectedCountries]);
  const seedKey    = useMemo(() => `${stableKey}__r${refreshTick}`, [stableKey, refreshTick]);

  // 언어만 바뀌면 본문 재조합
  useEffect(() => {
    setOnePick((prev) => {
      if (!Array.isArray(prev) || !prev.length) return prev;
      return prev.map((it) => {
        const newBody = bodyOfRowByLang(it.row, uiLang, it.cid);
        return newBody && hasAnyText(newBody) ? { ...it, body: newBody } : it;
      });
    });
  }, [uiLang]);

  // 초기 렌더 (첫 로드) — ★ initReady 이후에만
  const didMountRef = useRef(false);
  useEffect(() => {
    if (didMountRef.current || !initReady) return;
    let canceled = false;

    const run = async () => {
      await new Promise(r => setTimeout(r, 200)); // 초기 터치 여유
      try {
        setErr(""); setLoading(true);

        // ★ 선택 배열을 언어 선호 순서로 정렬
        const chosen = orderCountriesForLang(uiLang).filter((c) => selectedCountries.has(c));
        if (!chosen.length) { if (!canceled) { setOnePick([]); setLoading(false); } return; }

        const pool = [];
        const head = chosen[0];
        const tail = chosen.slice(1);

        if (head) {
          const cfg = COUNTRY_CFG[head];
          await loadSheetRowsFast(cfg.sheetId, cfg.gid, 2000, todayParts.md);
          const key = `${cfg.sheetId}:${cfg.gid}`;
          const todays = getTodayRowsSmart(key, todayParts);
          for (const r of todays) {
            const body = bodyOfRowByLang(r, uiLang, head);
            if (!hasAnyText(body)) continue;
            const tag = trimHtml(r?.["한국어"] || r?.English || r?.["日本語"] || "").slice(0, 50);
            pool.push({ cid: head, row: r, key: `${head}|${String(r?.Year || r?.year || "")}|${String(r?.Date || r?.date || "")}|${tag}`, body });
          }
        }

        const picks = makePicksFromPool(pool, uiLang, `${stableKey}__init`);
        if (!canceled) {
          startTransition(() => { setOnePick(picks); setLoading(false); });
        }

        // 알림 본문 캐시 업데이트
        const notificationBody =
          Array.isArray(picks) && picks.length ? picks.map(p => `• ${p.body}`).join('\n') : '';
        try { PICK_RESULT_CACHE.set('notificationBody', notificationBody); }
        catch { PICK_RESULT_CACHE.notificationBody = notificationBody; }

        afterFirstInput(() => {
          const tasks = tail.map(async (cid) => {
            const cfg = COUNTRY_CFG[cid];
            await loadSheetRowsFast(cfg.sheetId, cfg.gid, 3000, todayParts.md);
          });
          Promise.allSettled(tasks).catch(() => {});
        });
      } catch (e) {
        if (!canceled) { setErr(String(e?.message || e)); setLoading(false); }
      } finally { didMountRef.current = true; }
    };

    run();
    return () => { canceled = true; };
  }, [initReady, todayParts, uiLang, selectedCountries, stableKey]); // ★ initReady 추가

  // 이후 변경 — ★ initReady 이후에만
  useEffect(() => {
    if (!didMountRef.current || !initReady) return;
    let canceled = false;

    const run = async () => {
      try {
        setErr(""); setLoading(true);

        // ★ 선택 배열을 언어 선호 순서로 정렬
        const chosen = orderCountriesForLang(uiLang).filter((c) => selectedCountries.has(c));
        if (!chosen.length) { if (!canceled) { setOnePick([]); setLoading(false); } return; }

        const pool = [];

        await new Promise((resolve) => {
          afterFirstInput(() => {
            Promise.allSettled(
              chosen.map(async (cid) => {
                await new Promise((r) => requestAnimationFrame(() => r()));
                const cfg = COUNTRY_CFG[cid];
                await loadSheetRowsFast(cfg.sheetId, cfg.gid, 3000, todayParts.md);
              })
            ).finally(resolve);
          });
        });

        for (const cid of chosen) {
          const cfg = COUNTRY_CFG[cid];
          const key = `${cfg.sheetId}:${cfg.gid}`;
          const todays = getTodayRowsSmart(key, todayParts);
          for (const r of todays) {
            const body = bodyOfRowByLang(r, uiLang, cid);
            if (!hasAnyText(body)) continue;
            const tag = trimHtml(r?.["한국어"] || r?.English || r?.["日本語"] || "").slice(0, 50);
            pool.push({ cid, row: r, key: `${cid}|${String(r?.Year || r?.year || "")}|${String(r?.Date || r?.date || "")}|${tag}`, body });
          }
        }

        const picks = makePicksFromPool(pool, uiLang, seedKey);
        if (!canceled) {
          startTransition(() => { setOnePick(picks); setLoading(false); });
        }

        const notificationBody =
          Array.isArray(picks) && picks.length ? picks.map(p => `• ${p.body}`).join('\n') : '';
        try { PICK_RESULT_CACHE.set('notificationBody', notificationBody); }
        catch { PICK_RESULT_CACHE.notificationBody = notificationBody; }

      } catch (e) {
        if (!canceled) { setErr(String(e?.message || e)); setLoading(false); }
      }
    };

    run();
  }, [todayParts, uiLang, selectedCountries, seedKey, initReady]); // ★ initReady 추가

  // 제목(어제/오늘/내일)
  const deltaDay = useMemo(() => {
    const base = startOfDayInTz(viewDate, tz).getTime();
    const t0 = startOfDayInTz(new Date(), tz).getTime();
    const diff = Math.round((base - t0) / 86400000);
    return diff < 0 ? -1 : diff > 0 ? 1 : 0;
  }, [viewDate, tz]);

  // 나라 선택 저장
  const handleCountriesChange = useCallback((nextSet) => {
    setSelectedCountries(nextSet);
    InteractionManager.runAfterInteractions(() => {
      AsyncStorage.setItem(STORAGE_KEY_SELECTED, JSON.stringify([...nextSet])).catch(() => {});
    });
    setRefreshTick((t) => t + 1);
  }, []);

  // 복사/공유
  const onCopyPress = useCallback(async () => {
    try {
      const list = Array.isArray(onePick) ? onePick : onePick ? [onePick] : [];
      const header = getMonthDayOnly(viewDate, uiLang, tz);
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

      setTimeout(async () => {
        try {
          const fileName = `history_${Date.now()}.txt`;
          const uri = FileSystem.cacheDirectory + fileName;
          await FileSystem.writeAsStringAsync(uri, payload, { encoding: FileSystem.EncodingType.UTF8 });
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(uri, { dialogTitle: UI_STR.copyBtn[uiLang] || UI_STR.copyBtn.en, UTI: "public.plain-text", mimeType: "text/plain" });
          }
        } catch {}
      }, 16);
    } catch {}
  }, [onePick, viewDate, uiLang, tz]);

  // Share 탭 트리거
  useEffect(() => {
    const offShare = onShareAttach?.(() => onCopyPress());
    return () => { offShare && offShare(); };
  }, [onCopyPress]);

  const list = Array.isArray(onePick) ? onePick : onePick ? [onePick] : [];
  const ordered = orderCountriesForLang(uiLang);

  useLayoutEffect(() => {}, [uiLang, onCopyPress]);

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
          padding: S.pagePad, gap: S.gap, maxWidth: S.containerMaxWidth,
          alignSelf: "center", paddingBottom: S.pagePad + 16, width: "100%",
        }}
      >
        {/* 국가 선택 칩 */}
        <CountrySelector uiLang={uiLang} ordered={ordered} value={selectedCountries} onChange={handleCountriesChange} size={S} />

        {/* 제목/날짜 */}
        <View>
          <Text style={{ fontSize: S.titleSize, fontWeight: "800" }}>{getHistoryTitle(uiLang, deltaDay)}</Text>
          <Text style={{ marginTop: 6, fontSize: S.dateSize, color: "#64748b" }}>
            {viewDate.toLocaleDateString(LOCALE_BY_LANG[uiLang] || "en-US", { year: "numeric", month: "long", day: "numeric", timeZone: tz })}
          </Text>
        </View>

        {/* 카드 */}
        <View style={{ padding: S.cardPad, borderRadius: 12, backgroundColor: "#F8FAFC", gap: 14 }}>
          {list.length === 0 ? (
            (loading || isPending)
              ? <ActivityIndicator />
              : <Text style={{ color: "#6b7280" }}>{UI_STR.empty[uiLang] || UI_STR.empty.en}</Text>
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

      {(loading || isPending) && !err && (
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
