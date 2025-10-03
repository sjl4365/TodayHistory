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

/* ── 설정 ───────────────────────────────────────────────────────── */
const STORAGE_KEY_SELECTED = "selectedCountries";
const STORAGE_KEY_UI_LANG  = "@app_language";

const COUNTRY_CFG = {
  usa:   { id: "usa",   label: { ko: "미국", en: "USA",   ja: "アメリカ" }, lang: "en", sheetId: "16aQeXTEmzYGHDTpu0uoWCRh6Jutq2g4u--Kr2QjYOtg", gid: "2056769855" },
  uk:    { id: "uk",    label: { ko: "영국", en: "UK",    ja: "英国"       }, lang: "en", sheetId: "16aQeXTEmzYGHDTpu0uoWCRh6Jutq2g4u--Kr2QjYOtg", gid: "1528717252" },
  korea: { id: "korea", label: { ko: "한국", en: "Korea", ja: "韓国"       }, lang: "ko", sheetId: "16aQeXTEmzYGHDTpu0uoWCRh6Jutq2g4u--Kr2QjYOtg", gid: "219522591" },
  japan: { id: "japan", label: { ko: "일본", en: "Japan", ja: "日本"       }, lang: "ja", sheetId: "16aQeXTEmzYGHDTpu0uoWCRh6Jutq2g4u--Kr2QjYOtg", gid: "1850482528" },
};

const DEFAULT_COUNTRIES_BY_LANG = {
  en: ["usa", "uk"],
  ko: ["korea"],
  ja: ["japan"],
  default: ["usa", "uk"],
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

const COPY_TOAST   = { ko: "복사됨", en: "Copied", ja: "コピーしました" };
const SOURCE_LABEL = { ko: "출처",  en: "Source",  ja: "出典" };

const LOCALE_BY_LANG = { ko: "ko-KR", en: "en-US", ja: "ja-JP" };
const UI_COL = { ko: "한국어", en: "English", ja: "日本語" };
const NATIVE_COL_BY_COUNTRY = { korea: "한국어", japan: "日本語", usa: "English", uk: "English" };

/* ── 전역 캐시 (시트 재호출 최소화) ───────────────────────────────── */
const SHEET_CACHE = globalThis.__SHEET_CACHE__ ?? (globalThis.__SHEET_CACHE__ = new Map());
const INFLIGHT = globalThis.__SHEET_INFLIGHT__ ?? (globalThis.__SHEET_INFLIGHT__ = new Map());

async function loadSheetRowsCached(sheetId, gid, timeoutMs = 6000) {
  const key = `${sheetId}:${gid}`;
  if (SHEET_CACHE.has(key)) return SHEET_CACHE.get(key);
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

/* ── 유틸 ───────────────────────────────────────────────────────── */
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
  }).formatToParts(base).reduce((a, p) => {
    if (p.type !== "literal") a[p.type] = p.value; return a;
  }, {});
  return new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00`);
}

function getDayPartsFrom(date, tz) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date).reduce((a, p) => {
    if (p.type !== "literal") a[p.type] = p.value; return a;
  }, {});
  return {
    md: `${parts.month}-${parts.day}`,
    dcode: `D${parts.month}${parts.day}`,
    y: parts.year, m: parts.month, d: parts.day,
  };
}

function isTodayRow(row, today) {
  const md = today.md;               // "MM-DD"
  const mmdd = today.dcode.slice(1); // "MMDD"

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
    return `${mm}-${dd}` === md;
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
function buildShareText({ baseDate, uiLang, picks, tz }) {
  const header = getMonthDayOnly(baseDate, uiLang, tz);
  const appName = APP_NAME_BY_LANG[uiLang] || APP_NAME_BY_LANG.en;
  const sourceLabel = SOURCE_LABEL[uiLang] || SOURCE_LABEL.en;

  const blocks = (picks || []).map((p) => {
    const countryLabel = COUNTRY_CFG[p.cid]?.label?.[uiLang] || p.cid;
    const yr = getYearFromRow(p.row) || "";
    const content = (p.body || "").trim();
    return [countryLabel, yr, content, `${sourceLabel}: ${appName}`].filter(Boolean).join("\n");
  });

  const footer = APP_DOWNLOAD_URL;
  return [header, ...blocks, footer].join("\n\n");
}

/* 제목 문자열 */
function getHistoryTitle(uiLang, deltaDay) {
  const t = UI_STR.title[uiLang] || UI_STR.title.en;
  if (deltaDay < 0) return t.prev;
  if (deltaDay > 0) return t.next;
  return t.today;
}

/* ── 토스트 ─────────────────────────────────────────────────────── */
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

/* 나라 칩 정렬: 언어 기본 나라 먼저 */
const ALL_ORDER = ["usa", "uk", "korea", "japan"];
function orderCountriesForLang(uiLang) {
  const pref = DEFAULT_COUNTRIES_BY_LANG[uiLang] || DEFAULT_COUNTRIES_BY_LANG.default;
  const set = new Set(pref);
  const rest = ALL_ORDER.filter((c) => !set.has(c));
  return [...pref, ...rest];
}

/* ── 메인 화면 ───────────────────────────────────────────────────── */
export default function Home() {
  const [tz] = useState(Intl?.DateTimeFormat?.().resolvedOptions().timeZone || "UTC");

  // 오늘 00:00
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const nextMidnight = (() => {
      const t = startOfDayInTz(new Date(), tz); t.setDate(t.getDate() + 1); return t.getTime();
    })();
    const ms = Math.max(1000, nextMidnight - Date.now());
    const timer = setTimeout(() => setNow(new Date()), ms);
    return () => clearTimeout(timer);
  }, [tz, now]);

  // 표시 기준 날짜
  const [baseDate, setBaseDate] = useState(() => startOfDayInTz(new Date(), tz));

  // 언어/국가
  const [uiLang, setUiLang] = useState(() => resolveUiLangFromDevice());
  const [selectedCountries, setSelectedCountries] = useState(new Set(DEFAULT_COUNTRIES_BY_LANG[resolveUiLangFromDevice()] || DEFAULT_COUNTRIES_BY_LANG.default));

  // 데이터 상태
  const [onePick, setOnePick] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);
  const [copyTick, setCopyTick] = useState(0);

  // -1(어제)/0(오늘)/1(내일) 범위 내에서만 이동 + 같은 날이면 상태 갱신 X
const DAY_MS = 86400000;

const getIndexFromToday = useCallback((date) => {
  const base0  = startOfDayInTz(date, tz).getTime();
  const today0 = startOfDayInTz(new Date(), tz).getTime();
  return Math.round((base0 - today0) / DAY_MS);
}, [tz]);

const goBy = useCallback((delta) => {
  setBaseDate((prev) => {
    const curIdx  = getIndexFromToday(prev);                    // -1 / 0 / 1
    const nextIdx = Math.max(-1, Math.min(1, curIdx + delta));  // clamp
    if (nextIdx === curIdx) return prev; // ★ 같은 날이면 업데이트하지 않음(리로드 X)

    const today0 = startOfDayInTz(new Date(), tz);
    const target = new Date(today0);
    target.setDate(target.getDate() + nextIdx);
    return target;
  });
}, [tz, getIndexFromToday]);

  // prev/next/refresh 구독
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

  // 최초 로드: 언어/나라 불러오기
  useEffect(() => {
    (async () => {
      try {
        const storedLang = await AsyncStorage.getItem(STORAGE_KEY_UI_LANG).catch(() => null);
        const detected = resolveUiLangFromDevice();
        const lang = (storedLang === "ko" || storedLang === "en" || storedLang === "ja") ? storedLang : detected;
        setUiLang(lang);

        const storedSel = await AsyncStorage.getItem(STORAGE_KEY_SELECTED).catch(() => null);
        if (storedSel) {
          const arr = JSON.parse(storedSel);
          if (Array.isArray(arr) && arr.length) {
            setSelectedCountries(new Set(arr));
          } else {
            setSelectedCountries(new Set(DEFAULT_COUNTRIES_BY_LANG[lang] || DEFAULT_COUNTRIES_BY_LANG.default));
          }
        } else {
          setSelectedCountries(new Set(DEFAULT_COUNTRIES_BY_LANG[lang] || DEFAULT_COUNTRIES_BY_LANG.default));
        }
      } catch {}
    })();
  }, []);

  // 설정에서 돌아오면 언어/나라 동기화 (언어 바뀌면 기본 나라로 덮어씀)
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        try {
          const storedLang = await AsyncStorage.getItem(STORAGE_KEY_UI_LANG).catch(() => null);
          if (!alive) return;
          if (storedLang && storedLang !== uiLang) {
            setUiLang(storedLang);
            const def = DEFAULT_COUNTRIES_BY_LANG[storedLang] || DEFAULT_COUNTRIES_BY_LANG.default;
            setSelectedCountries(new Set(def));
            await AsyncStorage.setItem(STORAGE_KEY_SELECTED, JSON.stringify(def));
            return;
          }
          const storedSel = await AsyncStorage.getItem(STORAGE_KEY_SELECTED).catch(() => null);
          if (!alive) return;
          if (storedSel) {
            const arr = JSON.parse(storedSel);
            if (Array.isArray(arr)) setSelectedCountries(new Set(arr));
          }
        } catch {}
      })();
      return () => { alive = false; };
    }, [uiLang])
  );

  const todayParts = useMemo(() => getDayPartsFrom(baseDate, tz), [baseDate, tz]);

  // 데이터 로드 (병렬 + 캐시, 기존 카드 유지)
  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        setErr("");
        setLoading(true); // 기존 콘텐츠 유지한 채 스피너만

        const chosen = [...selectedCountries].filter(Boolean);
        if (chosen.length === 0) { setOnePick([]); return; }

        const datasets = await Promise.all(
          chosen.map((cid) => {
            const cfg = COUNTRY_CFG[cid];
            if (!cfg) return Promise.resolve({ cid, rows: [] });
            return loadSheetRowsCached(cfg.sheetId, cfg.gid).then((rows) => ({ cid, rows: rows || [] }));
          })
        );

        const pool = [];
        for (const { cid, rows } of datasets) {
          const todayRows = rows.filter((r) => isTodayRow(r, todayParts));
          for (const r of todayRows) {
            const body = bodyOfRowByLang(r, uiLang);
            if (!hasAnyText(body)) continue;
            const key = `${cid}|${String(r?.Year || r?.year || "")}|${String(r?.Date || r?.date || "")}|${trimHtml(r?.["한국어"] || r?.English || r?.["日本語"] || "").slice(0, 50)}`;
            pool.push({ cid, row: r, key, body });
          }
        }

        let picks = [];
        if (pool.length > 0) {
          const first = pool[Math.floor(Math.random() * pool.length)];
          picks.push(first);
          const len = String(first.body || "").replace(/\s+/g, " ").trim().length;
          const wantTwo = uiLang === "en" ? len <= 75 : (uiLang === "ko" || uiLang === "ja") ? len <= 50 : false;
          if (wantTwo && pool.length > 1) {
            const rest = pool.filter((x) => x.key !== first.key);
            if (rest.length > 0) picks.push(rest[Math.floor(Math.random() * rest.length)]);
          }
        }

        if (!canceled) setOnePick(picks);
      } catch (e) {
        if (!canceled) setErr(String(e?.message || e));
      } finally {
        if (!canceled) setLoading(false);
      }
    })();
    return () => { canceled = true; };
  }, [todayParts, uiLang, selectedCountries, refreshTick]);

  // 제목(어제/오늘/내일)
  const deltaDay = useMemo(() => {
    const base = startOfDayInTz(baseDate, tz).getTime();
    const today0 = startOfDayInTz(new Date(), tz).getTime();
    const diff = Math.round((base - today0) / 86400000);
    return diff < 0 ? -1 : diff > 0 ? 1 : 0;
  }, [baseDate, tz]);

  // 선택 저장 동기화
  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY_SELECTED, JSON.stringify([...selectedCountries])).catch(() => {});
  }, [selectedCountries]);

  // 복사/공유
  const onCopyPress = useCallback(async () => {
    try {
      const list = Array.isArray(onePick) ? onePick : onePick ? [onePick] : [];
      const payload = buildShareText({ baseDate, uiLang, picks: list, tz });
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

  // Share 탭의 첨부 트리거 구독 → 홈에서 복사/공유 실행
  useEffect(() => {
    const offShare = onShareAttach?.(() => onCopyPress());
    return () => { offShare && offShare(); };
  }, [onCopyPress]);

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

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, maxWidth: 460, alignSelf: "center", paddingBottom: 40, width: "100%" }}>
        {/* 나라 선택 */}
        <CountrySelector
          uiLang={uiLang}
          ordered={ordered}
          value={selectedCountries}
          onChange={setSelectedCountries}
        />

        {/* 제목 + 날짜 */}
        <View>
          <Text style={{ fontSize: 20, fontWeight: "800" }}>{getHistoryTitle(uiLang, deltaDay)}</Text>
          <Text style={{ marginTop: 6, fontSize: 14, color: "#64748b" }}>
            {baseDate.toLocaleDateString(LOCALE_BY_LANG[uiLang] || "en-US", { year: "numeric", month: "long", day: "numeric", timeZone: tz })}
          </Text>
        </View>

        {/* 카드 */}
        <View style={{ padding: 16, borderRadius: 12, backgroundColor: "#F8FAFC", gap: 14 }}>
          {list.length === 0 ? (
            <Text style={{ color: "#6b7280" }}>{UI_STR.empty[uiLang] || UI_STR.empty.en}</Text>
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
                  <Text style={{ lineHeight: 28, fontSize: 18 }}>{p.body}</Text>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* 작은 로딩 인디케이터 */}
      {loading && !err && (
        <View style={{ position: "absolute", top: 12, right: 12 }}>
          <ActivityIndicator />
        </View>
      )}

      {/* 에러 표시 */}
      {!!err && (
        <View style={{ position: "absolute", bottom: 12, left: 12, right: 12, backgroundColor: "#fee2e2", padding: 10, borderRadius: 8 }}>
          <Text style={{ color: "#b91c1c" }}>Error: {err}</Text>
        </View>
      )}

      {/* 복사 토스트 */}
      <CopyToast trigger={copyTick} message={COPY_TOAST[uiLang] || COPY_TOAST.en} />
    </SafeAreaView>
  );
}

/* ── 보조 UI ─────────────────────────────────────────────────────── */
function HeaderCopyButton({ label, onPress }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} style={{ paddingHorizontal: 12 }}>
      <Text style={{ fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

function CountrySelector({ uiLang, ordered, value, onChange }) {
  const toggleOne = (id) => {
    const next = new Set(value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
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
              style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: active ? "#201d6aff" : "#E5E7EB" }}
            >
              <Text style={{ color: active ? "white" : "black", fontWeight: "700" }}>
                {(COUNTRY_CFG[id]?.label?.[uiLang]) || id}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
