// app/(tabs)/home.js
// Main screen for the /home route
// Renders content (history entries by date), supports country selection, external wiki fetch, and caching

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Text, View, Pressable, Linking, ScrollView  } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchSheetRows } from "../../lib/sheets";
import { makeQueriesFromBody, makeKeyword, fetchSummaryMultiLang } from "../../lib/wiki";

// Country-specific config
const COUNTRY_CFG = {
  korea: {
    label: "한국",
    lang: "ko",
    sheetId: "16aQeXTEmzYGHDTpu0uoWCRh6Jutq2g4u--Kr2QjYOtg", 
    gid: "219522591", // 예시
    bodyCol: "한국어",
    dateCol: "Date",
    yearCol: "Year",
  },
  usa: {
    label: "미국",
    lang: "en",
    sheetId: "16aQeXTEmzYGHDTpu0uoWCRh6Jutq2g4u--Kr2QjYOtg", 
    gid: "2056769855", // 예시
    bodyCol: "English",
    dateCol: "Date",
    yearCol: "Year",
  },
};

const ALL_COUNTRIES = Object.keys(COUNTRY_CFG);

// CountrySelector component
function CountrySelector({ value, onChange }) {
  const isAll = value.size === ALL_COUNTRIES.length;
  const setAll = () => onChange(new Set(ALL_COUNTRIES));

  const toggleOne = (id) => {
    const next = new Set(value);
    if (next.has(id)) {
      if (next.size > 1) next.delete(id);
    } else {
      next.add(id);
    }
    onChange(next);
  };

  const Chip = ({ active, children, onPress }) => (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: active ? "#201d6aff" : "#E5E7EB",
      }}
    >
      <Text style={{ color: active ? "white" : "black", fontWeight: "600" }}>{children}</Text>
    </Pressable>
  );

  return (
    <View style={{ gap: 10, marginBottom: 12 }}>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <Chip active={isAll} onPress={setAll}>전체</Chip>
        {ALL_COUNTRIES.map((id) => (
          <Chip key={id} active={value.has(id)} onPress={() => toggleOne(id)}>
            {COUNTRY_CFG[id]?.label || id}
          </Chip>
        ))}
      </View>
    </View>
  );
}

// Utility: timeout for async operations
const timeout = (p, ms = 5000) =>
  Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("Timeout")), ms))]);

// In-memory LRU cache
function createLRU(max = 200) {
  const map = new Map();
  return {
    get(k) {
      if (!map.has(k)) return;
      const v = map.get(k);
      map.delete(k);
      map.set(k, v);
      return v;
    },
    set(k, v) {
      if (map.has(k)) map.delete(k);
      if (map.size > max) map.delete(map.keys().next().value);
      map.set(k, v);
    },
  };
}

const wikiCache = createLRU(200); // Note: not useRef — it's used directly

// Get device time zone
function getDeviceTimeZone() {
  try {
    return Intl?.DateTimeFormat?.().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

// Get today's info in given time zone
function todayInTZ(timeZone) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(new Date())
      .reduce((acc, p) => {
        if (p.type !== "literal") acc[p.type] = p.value;
        return acc;
      }, {});
    const md = `${parts.month}-${parts.day}`;
    const dcode = `D${parts.month}${parts.day}`;
    return { md, dcode, y: parts.year, m: parts.month, d: parts.day };
  } catch {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    return {
      md: `${mm}-${dd}`,
      dcode: `D${mm}${dd}`,
      y: String(now.getFullYear()),
      m: mm,
      d: dd,
    };
  }
}

// Check if row matches today's date
function matchesToday(row, { md, dcode }) {
  const dateStr = row?.__DATE ?? "";

  if (typeof dateStr === "string") {
    const mmddOnly = dcode.slice(1);
    const dcodeRe = new RegExp(`(^|[^0-9A-Za-z])d\\s*${mmddOnly}([^0-9A-Za-z]|$)`, "i");

    if (dcodeRe.test(dateStr.trim())) return true;
    if (/^\d{2}-\d{2}$/.test(dateStr) && dateStr === md) return true;

    if (/^\d{4}[-/]\d{2}[-/]\d{2}/.test(dateStr)) {
      const norm = dateStr.replace(/\//g, "-").slice(5, 10);
      if (norm === md) return true;
    }
  }

  const iso = row?.isoDate || row?.dateISO || row?.dateString || "";
  if (typeof iso === "string" && /^\d{4}-\d{2}-\d{2}/.test(iso)) {
    return iso.slice(5, 10) === md;
  }

  if (row?.month != null && row?.day != null) {
    const mm = String(row.month).padStart(2, "0");
    const dd = String(row.day).padStart(2, "0");
    return `${mm}-${dd}` === md;
  }

  return false;
}

// Normalize row for easier internal use
function normalizeRow(raw, countryId) {
  const cfg = COUNTRY_CFG[countryId];
  const body = String(raw?.[cfg.bodyCol] ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const date = String(raw?.[cfg.dateCol] ?? raw?.date ?? "");
  const year = String(raw?.[cfg.yearCol] ?? raw?.year ?? "");
  return { ...raw, __country: countryId, __BODY: body, __DATE: date, __YEAR: year };
}

function rowId(r) {
  return `${r.__country}|${r.__YEAR}|${r.__DATE}|${r.title ?? r.event ?? r.__BODY.slice(0, 20)}`;
}

function getBody(r) {
  return r.__BODY || "";
}

function formatKoreanDate(row, today) {
  const yStr = row.__YEAR && /\d{1,4}/.test(row.__YEAR) ? row.__YEAR.padStart(4, "0") : "XXXX";
  let mm = null,
    dd = null,
    d = row.__DATE || "";

  if (typeof d === "string") {
    const t = d.trim();
    if (/^d\s*\d{4}$/i.test(t)) {
      const mmdd = t.replace(/[^0-9]/g, "");
      mm = mmdd.slice(0, 2);
      dd = mmdd.slice(2, 4);
    } else if (/^\d{2}-\d{2}$/.test(t)) {
      [mm, dd] = t.split("-");
    } else if (/^\d{4}-\d{2}-\d{2}/.test(t)) {
      [, mm, dd] = t.slice(0, 10).split("-");
    } else if (/^\d{4}\/\d{2}\/\d{2}$/.test(t)) {
      [, mm, dd] = t.split("/");
    }
  }

  if (!mm || !dd) {
    const mmdd = today.md.replace("-", "");
    mm = mm || mmdd.slice(0, 2);
    dd = dd || mmdd.slice(2, 4);
  }

  return `${yStr}년 ${mm}월 ${dd}일`;
}

// AsyncStorage keys for tracking shown entries
const SHOWN_KEY = (dcode) => `shown:${dcode}`;

async function getShownSet(dcode) {
  try {
    const raw = await AsyncStorage.getItem(SHOWN_KEY(dcode));
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

async function addShownId(dcode, id) {
  try {
    const set = await getShownSet(dcode);
    set.add(id);
    await AsyncStorage.setItem(SHOWN_KEY(dcode), JSON.stringify([...set]));
  } catch {}
}

async function resetShown(dcode) {
  try {
    await AsyncStorage.removeItem(SHOWN_KEY(dcode));
  } catch {}
}

// Main component
export default function Home() {
  const [tz] = useState(getDeviceTimeZone());
  const today = useMemo(() => todayInTZ(tz), [tz]);

  const [rows, setRows] = useState(null);
  const [one, setOne] = useState(null);
  const [err, setErr] = useState("");
  const [selectedCountries, setSelectedCountries] = useState(new Set(["korea"]));
  const [wiki, setWiki] = useState({ title: "", snippet: "", url: "", lang: "" });
  const [wikiLoading, setWikiLoading] = useState(false);
  const wikiReqGen = useRef(0);

  // Load selected countries from AsyncStorage
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY_SELECTED);
        if (raw) {
          const arr = JSON.parse(raw);
          const valid = Array.isArray(arr) ? arr.filter((id) => COUNTRY_CFG[id]) : [];
          if (valid.length > 0) setSelectedCountries(new Set(valid));
        }
      } catch {}
    })();
  }, []);

  // Save selected countries
  useEffect(() => {
    (async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY_SELECTED, JSON.stringify([...selectedCountries]));
      } catch {}
    })();
  }, [selectedCountries]);

  // Load sheet data and pick an entry
  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        const tasks = [...selectedCountries].map(async (cid) => {
          const cfg = COUNTRY_CFG[cid];
          const data = await timeout(fetchSheetRows({ sheetId: cfg.sheetId, gid: cfg.gid }), 7000);
          return (Array.isArray(data) ? data : []).map((r) => normalizeRow(r, cid));
        });
        const merged = (await Promise.all(tasks)).flat();
        const todayRows = merged.filter((r) => matchesToday(r, today));
        const top10 = todayRows.slice(0, 10);
        const shown = await getShownSet(today.dcode);
        let candidates = top10.filter((r) => !shown.has(rowId(r)));

        if (top10.length > 0 && candidates.length === 0) {
          await resetShown(today.dcode);
          candidates = top10;
        }

        const withBody = candidates.filter((r) => getBody(r).length > 0);
        const pool = withBody.length ? withBody : candidates;
        const pick = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;

        if (!canceled) {
          setRows(top10);
          setOne(pick);
          if (pick) await addShownId(today.dcode, rowId(pick));
        }
      } catch (e) {
        if (!canceled) setErr(String(e?.message || e));
      }
    })();
    return () => {
      canceled = true;
    };
  }, [today, selectedCountries]);

  // Fetch Wikipedia summary
  useEffect(() => {
    let canceled = false;
    (async () => {
      if (!one) return setWiki({ title: "", snippet: "", url: "", lang: "" });

      const body = getBody(one);
      if (!body) return setWiki({ title: "", snippet: "", url: "", lang: "" });

      const preferredLang = COUNTRY_CFG[one.__country]?.lang || "ko";
      const cacheKey = `${preferredLang}|${body.slice(0, 120)}`;
      const cached = wikiCache.get(cacheKey);
      if (cached) return setWiki(cached);

      setWikiLoading(true);
      const myGen = ++wikiReqGen.current;
      const outdated = () => myGen !== wikiReqGen.current || canceled;

      let queries = makeQueriesFromBody(body, preferredLang, 16).slice(0, 5);
      let found = null;

      try {
        for (const q of queries) {
          const r = await timeout(fetchSummaryMultiLang(preferredLang, q, 900), 10000).catch(() => null);
          if (r) {
            found = r;
            break;
          }
          if (outdated()) return;
        }

        if (!found) {
          const fb = makeKeyword(body, 18);
          if (fb) {
            const r = await timeout(fetchSummaryMultiLang(preferredLang, fb, 700), 10000).catch(() => null);
            if (r) found = r;
          }
        }

        if (outdated()) return;
        setWikiLoading(false);

        if (found) {
          setWiki(found);
          wikiCache.set(cacheKey, found);
        } else {
          const searchLang = preferredLang;
          const q = encodeURIComponent((queries[0] || makeKeyword(body, 16) || "").trim());
          const searchUrl = q ? `https://${searchLang}.wikipedia.org/w/index.php?search=${q}` : "";
          setWiki({
            title: "",
            snippet: "(요약을 불러올 수 없습니다)",
            url: searchUrl,
            lang: searchLang,
          });
        }
      } catch {
        if (outdated()) return;
        setWikiLoading(false);
        setWiki({ title: "", snippet: "(요약을 불러올 수 없습니다)", url: "", lang: "" });
      }
    })();
    return () => {
      canceled = true;
    };
  }, [one]);

  const handleNext = async () => {
    if (!rows || rows.length === 0) return;
    const shown = await getShownSet(today.dcode);
    let candidates = rows.filter((r) => !shown.has(rowId(r)));
    if (rows.length > 0 && candidates.length === 0) {
      await resetShown(today.dcode);
      candidates = rows;
    }
    const withBody = candidates.filter((r) => getBody(r).length > 0);
    const pool = withBody.length ? withBody : candidates;
    if (pool.length === 0) return;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    setOne(pick);
    await addShownId(today.dcode, rowId(pick));
  };

  if (!rows && !err) return <ActivityIndicator style={{ marginTop: 24 }} />;
  if (err)
    return (
      <View style={{ padding: 16 }}>
        <Text style={{ color: "crimson" }}>문제가 발생했습니다: {err}</Text>
      </View>
    );

  const dateStr = one ? formatKoreanDate(one, today) : "";
  const body = one ? getBody(one) : "";

 return (
    <ScrollView
      contentContainerStyle={{ padding: 16, gap: 12, maxWidth: 360, alignSelf: "center", paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <CountrySelector value={selectedCountries} onChange={setSelectedCountries} />
      {!one ? (
        <Text>오늘 날짜의 데이터가 없습니다.</Text>
      ) : (
        <>
          <Text accessibilityRole="header" style={{ fontWeight: "600", color: "#908f8f" }}>
            {dateStr} · {COUNTRY_CFG[one.__country]?.label || one.__country}
          </Text>
          <Text style={{ lineHeight: 32, fontWeight: "900", fontSize: 24 }}>{body}</Text>
          {wikiLoading ? (
            <ActivityIndicator style={{ marginTop: 8 }} />
          ) : (
            <Text style={{ lineHeight: 28, fontSize: 18, marginTop: 12 }}>
              {wiki.snippet || "(위키 요약 없음)"}{" "}
              {!!wiki.url && (
                <Text
                  style={{ textDecorationLine: "underline" }}
                  accessibilityRole="link"
                  onPress={() => Linking.openURL(wiki.url).catch(() => {})}
                >
                  원문 보기
                </Text>
              )}
            </Text>
          )}
        </>
      )}
    
    </ScrollView>
  );
}
