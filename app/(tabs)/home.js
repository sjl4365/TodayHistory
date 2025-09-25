import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Text,
  View,
  Pressable,
  ScrollView,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchSheetRows } from "../../lib/sheets";
import { onRefresh, onGoPrevDay, onGoNextDay, onCopyShare } from "../../lib/bus"; // 복사 이벤트 구독 추가
import * as Clipboard from "expo-clipboard"; // 클립보드
import { SafeAreaView } from "react-native-safe-area-context";

// 국가별 시트 설정
const COUNTRY_CFG = {
  usa: {
    id: "usa",
    label: { ko: "미국", en: "USA", ja: "アメリカ" },
    lang: "en",
    sheetId: "16aQeXTEmzYGHDTpu0uoWCRh6Jutq2g4u--Kr2QjYOtg",
    gid: "2056769855",
  },
  uk: {
    id: "uk",
    label: { ko: "영국", en: "UK", ja: "英国" },
    lang: "en",
    sheetId: "16aQeXTEmzYGHDTpu0uoWCRh6Jutq2g4u--Kr2QjYOtg",
    gid: "1528717252",
  },
  korea: {
    id: "korea",
    label: { ko: "한국", en: "Korea", ja: "韓国" },
    lang: "ko",
    sheetId: "16aQeXTEmzYGHDTpu0uoWCRh6Jutq2g4u--Kr2QjYOtg",
    gid: "219522591",
  },
  japan: {
    id: "japan",
    label: { ko: "일본", en: "Japan", ja: "日本" },
    lang: "ja",
    sheetId: "16aQeXTEmzYGHDTpu0uoWCRh6Jutq2g4u--Kr2QjYOtg",
    gid: "1850482528",
  },
};

// 기본값/키
const NEWS_COUNTRY_BY_LANG = { ko: "korea", en: "usa", ja: "japan" };
const BODY_COL_BY_UI_LANG = { ko: "한국어", en: "English", ja: "日本語" };
const STORAGE_KEY_SELECTED = "selectedCountries";
const STORAGE_KEY_UI_LANG = "uiLang";
const DEFAULT_COUNTRIES_BY_LANG = { ko: ["korea"], en: ["usa", "uk"], ja: ["japan"] };

// 다국어 텍스트
const STR = {
  ko: { todayTitle: "오늘의 역사", emptyToday: "오늘 항목이 없어요." },
  en: { todayTitle: "Today’s history", emptyToday: "No items for today." },
  ja: { todayTitle: "今日の歴史", emptyToday: "今日は項目がありません。" },
};

// 복사 꼬리말 라벨
const LABELS = {
  ko: { source: "출처", download: "다운로드" },
  en: { source: "Source", download: "Download" },
  ja: { source: "出典", download: "ダウンロード" },
};

// 앱/다운로드 정보
const APP_NAME = "OneMinuteTasks";
const LANDING_URL = "https://your-landing.example";

// 날짜 유틸
function startOfDayInTz(base = new Date(), tz = "UTC") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(base)
    .reduce((a, p) => {
      if (p.type !== "literal") a[p.type] = p.value;
      return a;
    }, {});
  return new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00`);
}
function getDayPartsFrom(date, tz) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(date)
    .reduce((a, p) => {
      if (p.type !== "literal") a[p.type] = p.value;
      return a;
    }, {});
  return {
    md: `${parts.month}-${parts.day}`,
    dcode: `D${parts.month}${parts.day}`,
    y: parts.year,
    m: parts.month,
    d: parts.day,
  };
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
      ko: (Y, M, D) =>
        [Y && `${Y}년`, M && `${parseInt(M, 10)}월`, D && `${parseInt(D, 10)}일`].filter(Boolean).join(" "),
      ja: (Y, M, D) =>
        [Y && `${Y}年`, M && `${parseInt(M, 10)}月`, D && `${parseInt(D, 10)}日`].filter(Boolean).join(" "),
      en: (Y, M, D) =>
        [M && parseInt(M, 10), D && parseInt(D, 10), Y].filter(Boolean).join(" "),
    }[uiLang] || ((Y, M, D) => [Y, M, D].filter(Boolean).join("-"));
  const out = L(y || "", m || "", d || "");
  return out || "";
}

// 텍스트 유틸
const trimHtml = (s) => String(s || "").replace(/<[^>]+>/g, "").trim();
const hasAnyText = (t) => String(t || "").replace(/\s+/g, " ").trim().length > 0;

// Seen 저장 키
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

// fetch 유틸
async function fetchTEXT(url, { retries = 1 } = {}) {
  const proxy = (u) =>
    Platform.OS === "web"
      ? `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`
      : u;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(proxy(url), {
        headers: {
          accept: "application/rss+xml, text/xml;q=0.9, */*;q=0.8",
          "user-agent": "HistoryApp/1.0",
        },
        redirect: "follow",
      });
      if (!res.ok) throw new Error(`HTTP_${res.status}`);
      return await res.text();
    } catch (e) {
      if (i === retries) throw e;
    }
  }
}

// 본문/키 처리
function bodyOfRowByLang(raw, uiLang) {
  const col = BODY_COL_BY_UI_LANG[uiLang] || "한국어";
  return trimHtml(raw?.[col] || "");
}
const rowKey = (raw) => {
  const date = String(raw?.Date || raw?.date || "");
  const year = String(raw?.Year || raw?.year || "");
  const any = trimHtml(raw?.["한국어"] || raw?.English || raw?.["日本語"] || "").slice(0, 50);
  return `${year}|${date}|${any}`;
};
const rowKeyWithCid = (cid, raw) => `${cid}|${rowKey(raw)}`;

// 두 개 뽑기 기준
function wantTwoByLang(text, uiLang) {
  const len = String(text || "").replace(/\s+/g, " ").trim().length;
  if (uiLang === "en") return len <= 75;
  if (uiLang === "ja" || uiLang === "ko") return len <= 50;
  return false;
}

// 언어 선택 UI
function LangSelector({ value, onChange }) {
  const opt = [
    { id: "ko", label: "한국어" },
    { id: "en", label: "English" },
    { id: "ja", label: "日本語" },
  ];
  return (
    <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
      {opt.map((o) => (
        <Pressable
          key={o.id}
          onPress={() => onChange(o.id)}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 999,
            backgroundColor: value === o.id ? "#201d6aff" : "#E5E7EB",
          }}
        >
          <Text style={{ color: value === o.id ? "white" : "black", fontWeight: "700" }}>
            {o.label}
          </Text>
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
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: value.has(id) ? "#201d6aff" : "#E5E7EB",
            }}
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

// 연도 추출 헬퍼
function pickYear(row) {
  const direct = String(row?.Year || row?.year || "").trim();
  if (direct) return direct;
  const iso = String(row?.isoDate || row?.dateISO || row?.dateString || "").trim();
  if (/^\d{4}-/.test(iso)) return iso.slice(0, 4);
  const dateStr = String(row?.Date || row?.__DATE || "").trim();
  const m = dateStr.match(/^(\d{4})[-/]/);
  if (m) return m[1];
  return "";
}

// 메인 Home 컴포넌트
export default function Home() {
  const [tz] = useState(Intl?.DateTimeFormat?.().resolvedOptions().timeZone || "UTC");
  const [baseDate, setBaseDate] = useState(() => startOfDayInTz(new Date(), tz));
  const [now, setNow] = useState(new Date());
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
  const lower = useMemo(() => {
    const t = new Date(todayStart);
    t.setDate(t.getDate() - 1);
    return t;
  }, [todayStart]);
  const upper = useMemo(() => {
    const t = new Date(todayStart);
    t.setDate(t.getDate() + 1);
    return t;
  }, [todayStart]);

  const isToday = useMemo(
    () => baseDate.getTime() === todayStart.getTime(),
    [baseDate, todayStart]
  );

  const today = useMemo(() => getDayPartsFrom(baseDate, tz), [baseDate, tz]);

  const [uiLang, setUiLang] = useState("ko");
  const [selectedCountries, setSelectedCountries] = useState(
    new Set(DEFAULT_COUNTRIES_BY_LANG.ko)
  );
  const [onePick, setOnePick] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const off = onRefresh(() => setRefreshTick((t) => t + 1));
    return () => off();
  }, []);
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

  // Share 탭 눌렀을 때 즉시 복사
  useEffect(() => {
    const unsub = onCopyShare(async () => {
      try {
        const list = Array.isArray(onePick) ? onePick : onePick ? [onePick] : [];
        const lines = list.map((p) => {
          const year = pickYear(p.row);
          const country = COUNTRY_CFG[p.cid]?.label?.[uiLang] || p.cid;
          const header = [year, country].filter(Boolean).join(" - ");
          return `${header}\n${p.body}`;
        });
        const { source, download } = LABELS[uiLang] || LABELS.en;
        const footer = `\n\n— ${source}: ${APP_NAME}\n${download}: ${LANDING_URL}`;
        const payload = (lines.join("\n\n") || APP_NAME) + footer;
        await Clipboard.setStringAsync(payload);
      } catch (e) {
        console.warn("Copy failed:", e);
      }
    });
    return unsub;
  }, [onePick, uiLang]);

  useEffect(() => {
    (async () => {
      const storedLang = await AsyncStorage.getItem(STORAGE_KEY_UI_LANG).catch(() => null);
      const lang = storedLang === "ko" || storedLang === "en" || storedLang === "ja" ? storedLang : "ko";
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
  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY_UI_LANG, uiLang);
    setSelectedCountries(new Set(DEFAULT_COUNTRIES_BY_LANG[uiLang]));
    AsyncStorage.setItem(STORAGE_KEY_SELECTED, JSON.stringify(DEFAULT_COUNTRIES_BY_LANG[uiLang]));
    setOnePick([]);
  }, [uiLang]);
  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY_SELECTED, JSON.stringify([...selectedCountries]));
  }, [selectedCountries]);

  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        setLoading(true);
        setOnePick([]);
        setErr("");
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
        if (!canceled) setOnePick(picks);
      } catch (e) {
        if (!canceled) setErr(String(e?.message || e));
      } finally {
        if (!canceled) setLoading(false);
      }
    })();
    return () => {
      canceled = true;
    };
  }, [today, selectedCountries, uiLang, refreshTick]);

  if (loading && !err) return <ActivityIndicator style={{ marginTop: 24 }} />;
  if (err) return <View style={{ padding: 16 }}><Text style={{ color: "crimson" }}>Error: {err}</Text></View>;

  const localeForDate = uiLang === "ko" ? "ko-KR" : uiLang === "ja" ? "ja-JP" : "en-US";

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          gap: 16,
          maxWidth: 460,
          alignSelf: "center",
          paddingBottom: 40,
          width: "100%",
        }}
      >
        <LangSelector value={uiLang} onChange={setUiLang} />
        <CountrySelector value={selectedCountries} onChange={setSelectedCountries} uiLang={uiLang} />

        <View>
          <Text style={{ fontSize: 18, fontWeight: "700" }}>
            {baseDate.toLocaleDateString(localeForDate, {  month: "long", day: "numeric" })}
          </Text>
        </View>
        <View style={{ padding: 16, borderRadius: 12, backgroundColor: "#F8FAFC", gap: 10 }}>
  {/* 오늘일 때만 타이틀 노출 */}
        {isToday && (
          <Text accessibilityRole="header" style={{ fontWeight: "800", fontSize: 18 }}>
            {STR[uiLang]?.todayTitle}
          </Text>
        )}

        {(() => {
          const list = Array.isArray(onePick) ? onePick : onePick ? [onePick] : [];
          if (list.length === 0)
            return <Text style={{ color: "#6b7280" }}>{STR[uiLang]?.emptyToday}</Text>;
          return (
            <View style={{ marginTop: 6, gap: 14 }}>
              {list.map((p) => {
                const label = COUNTRY_CFG[p.cid].label[uiLang] || p.cid;
                const dateLine = formatRowDate(p.row, uiLang);
                return (
                  <View key={p.key} style={{ gap: 4 }}>
                    <View
                      style={{
                        alignSelf: "flex-start",
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 999,
                        backgroundColor: "#E5E7EB",
                      }}
                    >
                      <Text style={{ fontWeight: "700" }}>{label}</Text>
                    </View>
                    {!!dateLine && (
                      <Text style={{ fontSize: 12, color: "#64748b" }}>{dateLine}</Text>
                    )}
                    <Text style={{ lineHeight: 28, fontSize: 18 }}>{p.body}</Text>
                  </View>
                );
              })}
            </View>
          );
        })()}
      </View>
        
      </ScrollView>
    </SafeAreaView>
  );
}
