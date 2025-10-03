// app/(tabs)/home.js
import React, { useEffect, useMemo, useState, useRef } from "react";
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
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Stack } from "expo-router";
import * as Localization from "expo-localization";

/* ── 설정 ── */
const COUNTRY_CFG = {
  usa:   { id: "usa",   label: { ko: "미국", en: "USA",   ja: "アメリカ" }, lang: "en", sheetId: "16aQeXTEmzYGHDTpu0uoWCRh6Jutq2g4u--Kr2QjYOtg", gid: "2056769855" },
  uk:    { id: "uk",    label: { ko: "영국", en: "UK",    ja: "英国"       }, lang: "en", sheetId: "16aQeXTEmzYGHDTpu0uoWCRh6Jutq2g4u--Kr2QjYOtg", gid: "1528717252" },
  korea: { id: "korea", label: { ko: "한국", en: "Korea", ja: "韓国"       }, lang: "ko", sheetId: "16aQeXTEmzYGHDTpu0uoWCRh6Jutq2g4u--Kr2QjYOtg", gid: "219522591" },
  japan: { id: "japan", label: { ko: "일본", en: "Japan", ja: "日本"       }, lang: "ja", sheetId: "16aQeXTEmzYGHDTpu0uoWCRh6Jutq2g4u--Kr2QjYOtg", gid: "1850482528" },
};

const STORAGE_KEY_SELECTED = "selectedCountries";
const STORAGE_KEY_UI_LANG  = "uiLang";
const DEFAULT_COUNTRIES_BY_LANG = { ko: ["korea"], en: ["usa", "uk"], ja: ["japan"] };

/* 앱 이름/주소 */
const APP_NAME_BY_LANG = { ko: "오늘의 역사", en: "Today in History", ja: "今日の歴史" };
const APP_DOWNLOAD_URL = "https://example.com/today-in-history";

/* ── 헤더 텍스트(언어별) ── */
const UI_STR = {
  title: { ko: "오늘의 역사", en: "Today’s History", ja: "今日の歴史" },
  empty: { ko: "표시할 항목이 없습니다.", en: "No items to display.", ja: "表示する項目がありません。" },
};

/* ── 디바이스 언어 감지 → ko/en/ja 매핑 ── */
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

/* ── 날짜 유틸 ── */
function startOfDayInTz(base = new Date(), tz = "UTC") {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(base)
    .reduce((a, p) => { if (p.type !== "literal") a[p.type] = p.value; return a; }, {});
  return new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00`);
}
function getDayPartsFrom(date, tz) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(date)
    .reduce((a, p) => { if (p.type !== "literal") a[p.type] = p.value; return a; }, {});
  return { md: `${parts.month}-${parts.day}`, dcode: `D${parts.month}${parts.day}`, y: parts.year, m: parts.month, d: parts.day };
}
function isTodayRow(row, today) {
  const dateStr = row?.Date || row?.__DATE || "";
  const md = today.md;
  const mmdd = today.dcode.slice(1);

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
  return false;
}

/* 공유용: 월·일만 (공유 헤더에 사용) */
const LOCALE_BY_LANG = { ko: "ko-KR", en: "en-US", ja: "ja-JP" };
function getMonthDayOnly(baseDate, uiLang, tz) {
  return baseDate.toLocaleDateString(
    LOCALE_BY_LANG[uiLang] || "en-US",
    { month: "long", day: "numeric", timeZone: tz }
  );
}

/* 화면용: 연·월·일 (라벨 없이 한 줄) */
function getFullDate(baseDate, uiLang, tz) {
  // 각 언어권 표기 규칙에 맞춰 로컬라이즈 (라벨 없이)
  return baseDate.toLocaleDateString(
    LOCALE_BY_LANG[uiLang] || "en-US",
    { year: "numeric", month: "long", day: "numeric", timeZone: tz }
  );
}

/* ── 텍스트/컬럼 ── */
const trimHtml = (s) => String(s || "").replace(/<[^>]+>/g, "").trim();
const hasAnyText = (t) => String(t || "").replace(/\s+/g, " ").trim().length > 0;

const UI_COL = { ko: "한국어", en: "English", ja: "日本語" };
const NATIVE_COL_BY_COUNTRY = { korea: "한국어", japan: "日本語", usa: "English", uk: "English" };

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

/* ── 날짜 포맷(카드 표기용) ── */
function formatRowDate(row, uiLang) {
  let y, m, d;
  const iso = row?.isoDate || row?.dateISO || row?.dateString || "";
  const dateStr = row?.Date || row?.__DATE || "";
  const trySplit = (s) => {
    if (!s || typeof s !== "string") return null;
    const m = s.match(/^(\d{4})[-/](\d{2})[-/](\d{2})/);
    if (m) return { y: m[1], m: m[2], d: m[3] };
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
      m = mm;
      d = dd;
    } else if (row?.month && row?.day) {
      m = String(row.month).padStart(2, "0");
      d = String(row.day).padStart(2, "0");
    }
  }
  const L =
    {
      ko: (Y, M, D) => [Y && `${Y}년`, M && `${parseInt(M, 10)}월`, D && `${parseInt(D, 10)}일`].filter(Boolean).join(" "),
      ja: (Y, M, D) => [Y && `${Y}年`, M && `${parseInt(M, 10)}月`, D && `${parseInt(D, 10)}日`].filter(Boolean).join(" "),
      en: (Y, M, D) => [M && parseInt(M, 10), D && parseInt(D, 10), Y].filter(Boolean).join(" "),
    }[uiLang] || ((Y, M, D) => [Y, M, D].filter(Boolean).join("-"));
  return L(y || "", m || "", d || "") || "";
}

/* ── 키/노출 기준 ── */
const rowKey = (raw) => {
  const date = String(raw?.Date || raw?.date || "");
  const year = String(raw?.Year || raw?.year || "");
  const any = trimHtml(raw?.["한국어"] || raw?.English || raw?.["日本語"] || "").slice(0, 50);
  return `${year}|${date}|${any}`;
};
const rowKeyWithCid = (cid, raw) => `${cid}|${rowKey(raw)}`;
function wantTwoByLang(text, uiLang) {
  const len = String(text || "").replace(/\s+/g, " ").trim().length;
  if (uiLang === "en") return len <= 75;
  if (uiLang === "ja" || uiLang === "ko") return len <= 50;
  return false;
}

/* ── Seen 저장 ── */
const SEEN_KEY_COUNTRY = (dcode, countryId, uiLang) => `seen:${countryId}:${uiLang}:${dcode}`;
async function getSeenCountry(dcode, countryId, uiLang) {
  const raw = await AsyncStorage.getItem(SEEN_KEY_COUNTRY(dcode, countryId, uiLang)).catch(() => null);
  return raw ? new Set(JSON.parse(raw)) : new Set();
}
async function addSeenCountry(dcode, countryId, uiLang, ids) {
  const set = await getSeenCountry(dcode, countryId, uiLang);
  ids.forEach((id) => set.add(id));
  await AsyncStorage.setItem(SEEN_KEY_COUNTRY(dcode, countryId, uiLang), JSON.stringify([...set]));
}
async function resetSeenCountry(dcode, countryId, uiLang) {
  await AsyncStorage.removeItem(SEEN_KEY_COUNTRY(dcode, countryId, uiLang)).catch(() => {});
}
const hashSelected = (set) => [...set].sort().join("-");
const SEEN_KEY_ALL = (dcode, uiLang, selectedHash) => `seen:ALL:${uiLang}:${dcode}:${selectedHash}`;
async function getSeenAll(dcode, uiLang, selectedHash) {
  const raw = await AsyncStorage.getItem(SEEN_KEY_ALL(dcode, uiLang, selectedHash)).catch(() => null);
  return raw ? new Set(JSON.parse(raw)) : new Set();
}
async function addSeenAll(dcode, uiLang, selectedHash, ids) {
  const set = await getSeenAll(dcode, uiLang, selectedHash);
  ids.forEach((id) => set.add(id));
  await AsyncStorage.setItem(SEEN_KEY_ALL(dcode, uiLang, selectedHash), JSON.stringify([...set]));
}
async function resetSeenAll(dcode, uiLang, selectedHash) {
  await AsyncStorage.removeItem(SEEN_KEY_ALL(dcode, uiLang, selectedHash)).catch(() => {});
}

/* ── 공유 텍스트 ── */
const SOURCE_LABEL = { ko: "출처", en: "Source", ja: "出典" };
function getYearFromRow(row) {
  const fromField = String(row?.Year || row?.year || "").trim();
  if (fromField) return fromField;
  const dateStrs = [row?.isoDate, row?.dateISO, row?.dateString, row?.Date, row?.__DATE].map((v) => String(v || ""));
  for (const s of dateStrs) {
    const m = s.match(/^(\d{4})[-/](\d{2})[-/](\d{2})/) || s.match(/^(\d{4})/);
    if (m) return m[1];
  }
  return "";
}
/* 공유 포맷:
   (헤더) 월·일만
   (블록) 나라 → 년도 → 내용 → 출처: 앱이름
   (푸터) 앱 주소(라벨 없음)
*/
function buildShareText({ baseDate, uiLang, picks, tz }) {
  const header = getMonthDayOnly(baseDate, uiLang, tz);
  const appName = APP_NAME_BY_LANG[uiLang] || APP_NAME_BY_LANG.en;
  const sourceLabel = SOURCE_LABEL[uiLang] || SOURCE_LABEL.en;

  const blocks = (picks || []).map((p) => {
    const countryLabel = COUNTRY_CFG[p.cid]?.label?.[uiLang] || p.cid;
    const yr = getYearFromRow(p.row) || "";
    const content = (p.body || "").trim();
    return [
      countryLabel,
      yr,
      content,
      `${sourceLabel}: ${appName}`,
    ].filter(Boolean).join("\n");
  });

  const footer = APP_DOWNLOAD_URL;
  return [header, ...blocks, footer].join("\n\n");
}

/* ── 복사 토스트(언어별) ── */
const COPY_TOAST = { ko: "복사됨", en: "Copied", ja: "コピーしました" };
function CopyToast({ trigger, message }) {
  const [visible, setVisible] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;
  const mounted = useRef(false);
  const lastSeen = useRef(trigger);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      lastSeen.current = trigger;
      return;
    }
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
    <Animated.View
      pointerEvents="none"
      style={{ position: "absolute", bottom: 24, left: 0, right: 0, alignItems: "center", opacity, transform: [{ translateY }] }}
    >
      <View style={{ backgroundColor: "#111827", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 }}>
        <Text style={{ color: "white", fontWeight: "700" }}>{message}</Text>
      </View>
    </Animated.View>
  );
}

export async function loadOnePickForDay({ today, selectedCountries, uiLang }) {
  const selHash = hashSelected(selectedCountries);
  const globalSeen = await getSeenAll(today.dcode, uiLang, selHash);

  const pool = [];
  for (const cid of selectedCountries) {
    const cfg = COUNTRY_CFG[cid];
    const data = await fetchSheetRows({ sheetId: cfg.sheetId, gid: cfg.gid }).catch(() => []);
    const todayRows = (Array.isArray(data) ? data : []).filter((r) => isTodayRow(r, today));

    await getSeenCountry(today.dcode, cid, uiLang);

    for (const r of todayRows) {
      const body = bodyOfRowByLang(r, uiLang);
      if (!hasAnyText(body)) continue;
      const key = rowKeyWithCid(cid, r);
      if (globalSeen.has(key)) continue;
      pool.push({ cid, row: r, key, body });
    }
  }

  let workingPool = pool;
  if (workingPool.length === 0) {
    await resetSeenAll(today.dcode, uiLang, selHash);
    workingPool = [];
    for (const cid of selectedCountries) {
      const cfg = COUNTRY_CFG[cid];
      const data = await fetchSheetRows({ sheetId: cfg.sheetId, gid: cfg.gid }).catch(() => []);
      const todayRows = (Array.isArray(data) ? data : []).filter((r) => isTodayRow(r, today));
      for (const r of todayRows) {
        const body = bodyOfRowByLang(r, uiLang);
        if (!hasAnyText(body)) continue;
        workingPool.push({ cid, row: r, key: rowKeyWithCid(cid, r), body });
      }
    }
  }

  let picks = [];
  if (workingPool.length > 0) {
    const first = workingPool[Math.floor(Math.random() * workingPool.length)];
    picks.push(first);
    if (wantTwoByLang(first.body, uiLang) && workingPool.length > 1) {
      const rest = workingPool.filter((x) => x.key !== first.key);
      if (rest.length > 0) {
        const second = rest[Math.floor(Math.random() * rest.length)];
        picks.push(second);
      }
    }
    const selHash2 = hashSelected(selectedCountries);
    await addSeenAll(today.dcode, uiLang, selHash2, picks.map((p) => p.key));
    for (const p of picks) await addSeenCountry(today.dcode, p.cid, uiLang, [rowKey(p.row)]);
  }

  return picks;
}

// home parameter extract하는 helper
export async function getLastHomeParams() {
  const tz = Intl?.DateTimeFormat?.().resolvedOptions().timeZone || 'UTC';

  // baseDate 복원 (없으면 오늘 00:00 in tz)
  const baseISO = await AsyncStorage.getItem('BASE_DATE_ISO').catch(() => null);
  const baseDate = baseISO ? new Date(baseISO) : startOfDayInTz(new Date(), tz);

  // uiLang 복원 (없으면 'ko')
  const storedLang = await AsyncStorage.getItem('uiLang').catch(() => null);
  const uiLang = (storedLang === 'ko' || storedLang === 'en' || storedLang === 'ja') ? storedLang : 'ko';

  // selectedCountries 복원 (없으면 언어 기본값)
  const storedSel = await AsyncStorage.getItem('selectedCountries').catch(() => null);
  let selectedCountries;
  if (storedSel) {
    try {
      const arr = JSON.parse(storedSel);
      selectedCountries = new Set(Array.isArray(arr) && arr.length ? arr : DEFAULT_COUNTRIES_BY_LANG[uiLang]);
    } catch {
      selectedCountries = new Set(DEFAULT_COUNTRIES_BY_LANG[uiLang]);
    }
  } else {
    selectedCountries = new Set(DEFAULT_COUNTRIES_BY_LANG[uiLang]);
  }

  // today 계산 (Home과 동일 로직)
  const today = getDayPartsFrom(baseDate, tz);

  return { today, selectedCountries, uiLang, tz, baseDate };
}


/* ── 메인 ── */
export default function Home() {
  const [tz] = useState(Intl?.DateTimeFormat?.().resolvedOptions().timeZone || "UTC");
  const [baseDate, setBaseDate] = useState(() => startOfDayInTz(new Date(), tz));
  const [now, setNow] = useState(new Date());

  // 자정 경계 자동 갱신
  useEffect(() => {
    const nextMidnight = (() => {
      const t = startOfDayInTz(new Date(), tz);
      t.setDate(t.getDate() + 1);
      return t.getTime();
    })();
    const ms = Math.max(1000, nextMidnight - Date.now());
    const timer = setTimeout(() => setNow(new Date()), ms);
    return () => clearTimeout(timer);
  }, [tz, now]);

  const todayStart = useMemo(() => startOfDayInTz(now, tz), [now, tz]);
  const lower = useMemo(() => { const t = new Date(todayStart); t.setDate(t.getDate() - 1); return t; }, [todayStart]);
  const upper = useMemo(() => { const t = new Date(todayStart); t.setDate(t.getDate() + 1); return t; }, [todayStart]);
  const today = useMemo(() => getDayPartsFrom(baseDate, tz), [baseDate, tz]);

  // ⬇️ 디바이스 언어를 초기값으로 사용
  const [uiLang, setUiLang] = useState(() => resolveUiLangFromDevice());
  const [selectedCountries, setSelectedCountries] = useState(new Set(DEFAULT_COUNTRIES_BY_LANG[resolveUiLangFromDevice()]));
  const [onePick, setOnePick] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);
  const [copyTick, setCopyTick] = useState(0);

  // 이벤트
  useEffect(() => { const off = onRefresh(() => setRefreshTick((t) => t + 1)); return () => off(); }, []);
  useEffect(() => {
    const off = onGoPrevDay(() => {
      setBaseDate((prev) => {
        const next = new Date(prev);
        next.setDate(next.getDate() - 1);
        return next >= lower ? next : prev;
      });
    });
    return off;
  }, [lower]);
  useEffect(() => {
    const off = onGoNextDay(() => {
      setBaseDate((prev) => {
        const next = new Date(prev);
        next.setDate(next.getDate() + 1);
        return next <= upper ? next : prev;
      });
    });
    return off;
  }, [upper]);

  // 저장 로드 (있으면 저장값 우선, 없으면 디바이스 언어 유지)
  useEffect(() => {
    (async () => {
      const storedLang = await AsyncStorage.getItem(STORAGE_KEY_UI_LANG).catch(() => null);
      const detected = resolveUiLangFromDevice();
      const lang = (storedLang === "ko" || storedLang === "en" || storedLang === "ja") ? storedLang : detected;
      setUiLang(lang);

      const storedSel = await AsyncStorage.getItem(STORAGE_KEY_SELECTED).catch(() => null);
      if (storedSel) {
        try {
          const arr = JSON.parse(storedSel);
          if (Array.isArray(arr) && arr.length) setSelectedCountries(new Set(arr));
          else setSelectedCountries(new Set(DEFAULT_COUNTRIES_BY_LANG[lang]));
        } catch {
          setSelectedCountries(new Set(DEFAULT_COUNTRIES_BY_LANG[lang]));
        }
      } else {
        setSelectedCountries(new Set(DEFAULT_COUNTRIES_BY_LANG[lang]));
      }
    })();
  }, []);

  // 언어 바뀌면 기본 국가 반영 + 저장 + 복사 트리거 초기화
  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY_UI_LANG, uiLang);
    setSelectedCountries(new Set(DEFAULT_COUNTRIES_BY_LANG[uiLang]));
    AsyncStorage.setItem(STORAGE_KEY_SELECTED, JSON.stringify(DEFAULT_COUNTRIES_BY_LANG[uiLang]));
    setOnePick([]);
    setCopyTick(0);
  }, [uiLang]);

  // 국가 선택 저장
  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY_SELECTED, JSON.stringify([...selectedCountries]));
  }, [selectedCountries]);

  // 시트 로드
  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        setLoading(true);
        setOnePick([]);
        setErr("");
        const initialPicks = await loadOnePickForDay({ today, selectedCountries, uiLang });
        const selHash = hashSelected(selectedCountries);
        const globalSeen = await getSeenAll(today.dcode, uiLang, selHash);

        const pool = [];
        for (const cid of selectedCountries) {
          const cfg = COUNTRY_CFG[cid];
          const data = await fetchSheetRows({
            sheetId: cfg.sheetId,
            gid: cfg.gid,
          }).catch(() => []);
          const todayRows = (Array.isArray(data) ? data : []).filter((r) =>
            isTodayRow(r, today)
          );

           //await getSeenCountry(today.dcode, cid, uiLang);

          for (const r of todayRows) {
            const body = bodyOfRowByLang(r, uiLang);
            if (!hasAnyText(body)) continue;
            const key = rowKeyWithCid(cid, r);
            if (globalSeen.has(key)) continue;
            pool.push({ cid, row: r, key, body });
          }
        }

        let workingPool = pool;
        if (workingPool.length === 0) {
          await resetSeenAll(today.dcode, uiLang, selHash);
          workingPool = [];
          for (const cid of selectedCountries) {
            const cfg = COUNTRY_CFG[cid];
            const data = await fetchSheetRows({
              sheetId: cfg.sheetId,
              gid: cfg.gid,
            }).catch(() => []);
            const todayRows = (Array.isArray(data) ? data : []).filter((r) =>
              isTodayRow(r, today)
            );
            for (const r of todayRows) {
              const body = bodyOfRowByLang(r, uiLang);
              if (!hasAnyText(body)) continue;
              workingPool.push({
                cid,
                row: r,
                key: rowKeyWithCid(cid, r),
                body,
              });
            }
          }
        }

        let picks = [];
        let finalPicks = Array.isArray(initialPicks) ? [...initialPicks] : [];
        if (finalPicks.length === 0 && workingPool.length > 0) {
          const first =
            workingPool[Math.floor(Math.random() * workingPool.length)];
          finalPicks.push(first);
          if (wantTwoByLang(first.body, uiLang) && workingPool.length > 1) {
            const rest = workingPool.filter((x) => x.key !== first.key);
            if (rest.length > 0) {
              const second = rest[Math.floor(Math.random() * rest.length)];
              finalPicks.push(second);
            }
          }
          const selHash2 = hashSelected(selectedCountries);
          await addSeenAll(
            today.dcode,
            uiLang,
            selHash2,
            finalPicks.map((p) => p.key)
          );
          for (const p of finalPicks)
            await addSeenCountry(today.dcode, p.cid, uiLang, [rowKey(p.row)]);
        }

        if (!canceled) setOnePick(finalPicks);
      } catch (e) {
        if (!canceled) setErr(String(e?.message || e));
      } finally {
        if (!canceled) setLoading(false);
      }
    })();
    return () => { canceled = true; };
  }, [today, selectedCountries, uiLang, refreshTick]);

  // 복사/공유
  const onAttachPress = async () => {
    try {
      const list = Array.isArray(onePick) ? onePick : onePick ? [onePick] : [];
      if (list.length === 0) {
        await Clipboard.setStringAsync("");
        setCopyTick((t) => t + 1);
        return;
      }
      const payload = buildShareText({ baseDate, uiLang, picks: list, tz });
      await Clipboard.setStringAsync(payload);
      setCopyTick((t) => t + 1);

      const fileName = `history_${Date.now()}.txt`;
      const uri = FileSystem.cacheDirectory + fileName;
      await FileSystem.writeAsStringAsync(uri, payload, { encoding: FileSystem.EncodingType.UTF8 });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { dialogTitle: "내용 공유", UTI: "public.plain-text", mimeType: "text/plain" });
      }
    } catch (e) {
      console.warn("attach/share failed:", e);
    }
  };
  useEffect(() => {
    const off = onShareAttach?.(() => { onAttachPress(); });
    return off || (() => {});
  }, [onAttachPress]);

  if (loading && !err) return <ActivityIndicator style={{ marginTop: 24 }} />;
  if (err) return (<View style={{ padding: 16 }}><Text style={{ color: "crimson" }}>Error: {err}</Text></View>);

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
      <Stack.Screen options={{ headerRight: () => <HeaderAttachButton onPress={onAttachPress} /> }} />

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 16, maxWidth: 460, alignSelf: "center", paddingBottom: 40, width: "100%" }}
      >
        {/* 1) 언어 선택 */}
        <LangSelector value={uiLang} onChange={setUiLang} />

        {/* 2) 나라 선택 */}
        <CountrySelector value={selectedCountries} onChange={setSelectedCountries} uiLang={uiLang} />

        {/* 3) 제목(언어별) + 4) 날짜(연·월·일) — 라벨 없이 */}
        <View>
          <Text style={{ fontSize: 20, fontWeight: "800" }}>
            {UI_STR.title[uiLang] || UI_STR.title.en}
          </Text>
          <Text style={{ marginTop: 6, fontSize: 14, color: "#64748b" }}>
            {getFullDate(baseDate, uiLang, tz)}
          </Text>
        </View>

        {/* 카드 영역 */}
        <View style={{ padding: 16, borderRadius: 12, backgroundColor: "#F8FAFC", gap: 10 }}>
          {(() => {
            const list = Array.isArray(onePick) ? onePick : onePick ? [onePick] : [];
            if (list.length === 0) return <Text style={{ color: "#6b7280" }}>{UI_STR.empty[uiLang] || UI_STR.empty.en}</Text>;
            return (
              <View style={{ marginTop: 6, gap: 14 }}>
                {list.map((p) => {
                  const label = COUNTRY_CFG[p.cid].label[uiLang] || p.cid;
                  const dateLine = formatRowDate(p.row, uiLang);
                  return (
                    <View key={p.key} style={{ gap: 4 }}>
                      <View style={{ alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: "#E5E7EB" }}>
                        <Text style={{ fontWeight: "700" }}>{label}</Text>
                      </View>
                      {!!dateLine && <Text style={{ fontSize: 12, color: "#64748b" }}>{dateLine}</Text>}
                      <Text style={{ lineHeight: 28, fontSize: 18 }}>{p.body}</Text>
                    </View>
                  );
                })}
              </View>
            );
          })()}
        </View>
      </ScrollView>

      {/* 언어별 복사 토스트 */}
      <CopyToast trigger={copyTick} message={COPY_TOAST[uiLang] || COPY_TOAST.en} />
    </SafeAreaView>
  );
}

/* ── 보조 UI ── */
function HeaderAttachButton({ onPress }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} style={{ paddingHorizontal: 12 }}>
      <Text style={{ fontWeight: "700" }}>첨부</Text>
    </Pressable>
  );
}
function LangSelector({ value, onChange }) {
  const opt = [{ id: "ko", label: "한국어" }, { id: "en", label: "English" }, { id: "ja", label: "日本語" }];
  return (
    <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
      {opt.map((o) => (
        <Pressable
          key={o.id}
          onPress={() => onChange(o.id)}
          style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: value === o.id ? "#201d6aff" : "#E5E7EB" }}
        >
          <Text style={{ color: value === o.id ? "white" : "black", fontWeight: "700" }}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
function CountrySelector({ value, onChange, uiLang }) {
  const toggleOne = (id) => {
    const next = new Set(value);
    if (next.has(id)) {
      if (next.size > 1) next.delete(id);
    } else next.add(id);
    onChange(next);
  };
  const order = ["usa", "uk", "korea", "japan"];
  return (
    <View style={{ gap: 10, marginBottom: 12 }}>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        {order.map((id) => (
          <Pressable
            key={id}
            onPress={() => toggleOne(id)}
            style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: value.has(id) ? "#201d6aff" : "#E5E7EB" }}
          >
            <Text style={{ color: value.has(id) ? "white" : "black", fontWeight: "600" }}>
              {COUNTRY_CFG[id].label[uiLang] || id}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
