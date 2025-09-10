// app/(tabs)/home.js

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Text, View, Pressable, Linking, ScrollView } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchSheetRows } from "../../lib/sheets";
import { makeQueriesFromBody, makeKeyword, fetchSummaryMultiLang } from "../../lib/wiki";

// 국가 설정
const COUNTRY_CFG = {
  korea: {
    label: "한국",
    lang: "ko",
    sheetId: "16aQeXTEmzYGHDTpu0uoWCRh6Jutq2g4u--Kr2QjYOtg",
    gid: "219522591",
    bodyCol: "한국어",
    dateCol: "Date",
    yearCol: "Year",
  },
  usa: {
    label: "미국",
    lang: "en",
    sheetId: "16aQeXTEmzYGHDTpu0uoWCRh6Jutq2g4u--Kr2QjYOtg",
    gid: "2056769855",
    bodyCol: "English",
    dateCol: "Date",
    yearCol: "Year",
  },
};

const ALL_COUNTRIES = Object.keys(COUNTRY_CFG);
const STORAGE_KEY_SELECTED = "selectedCountries";

// 국가 선택 UI
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

// 오늘 날짜 구하기
function getToday(timeZone) {
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

    return {
      md: `${parts.month}-${parts.day}`,
      dcode: `D${parts.month}${parts.day}`,
      y: parts.year,
    };
  } catch {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    return {
      md: `${mm}-${dd}`,
      dcode: `D${mm}${dd}`,
      y: String(now.getFullYear()),
    };
  }
}

// 오늘 날짜와 일치하는지 확인
function isTodayRow(row, today) {
  const dateStr = row?.__DATE || "";
  const md = today.md;
  const mmdd = today.dcode.slice(1);

  if (typeof dateStr === "string") {
    if (dateStr.trim().toLowerCase().includes(`d${mmdd.toLowerCase()}`)) return true;
    if (dateStr === md) return true;
    if (/^\d{4}[-/]\d{2}[-/]\d{2}/.test(dateStr)) return dateStr.slice(5, 10) === md;
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

// 시트 행 정리
function cleanRow(raw, countryId) {
  const cfg = COUNTRY_CFG[countryId];
  const body = String(raw?.[cfg.bodyCol] || "").replace(/<[^>]+>/g, "").trim();
  const date = String(raw?.[cfg.dateCol] || raw?.date || "");
  const year = String(raw?.[cfg.yearCol] || raw?.year || "");
  return { ...raw, __country: countryId, __BODY: body, __DATE: date, __YEAR: year };
}

// ID 생성
function rowId(r) {
  return `${r.__country}|${r.__YEAR}|${r.__DATE}|${r.title || r.event || r.__BODY.slice(0, 20)}`;
}

// 날짜 포맷
function formatDate(row, today) {
  const y = row.__YEAR && /\d{1,4}/.test(row.__YEAR) ? row.__YEAR.padStart(4, "0") : "XXXX";
  const d = row.__DATE || "";
  let mm, dd;

  if (/^d\s*\d{4}$/i.test(d)) {
    mm = d.replace(/\D/g, "").slice(0, 2);
    dd = d.replace(/\D/g, "").slice(2, 4);
  } else if (/^\d{2}-\d{2}$/.test(d)) {
    [mm, dd] = d.split("-");
  } else if (/^\d{4}[-/]\d{2}[-/]\d{2}/.test(d)) {
    [, mm, dd] = d.replace(/\//g, "-").split("-");
  }

  mm = mm || today.md.slice(0, 2);
  dd = dd || today.md.slice(3, 5);

  return `${y}년 ${mm}월 ${dd}일`;
}

// 본문 가져오기
const getBody = (r) => r.__BODY || "";

// AsyncStorage 키
const SEEN_KEY = (dcode) => `seen:${dcode}`;

// 본문 본 것 저장
async function getSeen(dcode) {
  const raw = await AsyncStorage.getItem(SEEN_KEY(dcode)).catch(() => null);
  return raw ? new Set(JSON.parse(raw)) : new Set();
}

async function addSeen(dcode, id) {
  const set = await getSeen(dcode);
  set.add(id);
  await AsyncStorage.setItem(SEEN_KEY(dcode), JSON.stringify([...set]));
}

async function resetSeen(dcode) {
  await AsyncStorage.removeItem(SEEN_KEY(dcode)).catch(() => {});
}

export default function Home() {
  const [tz] = useState(Intl?.DateTimeFormat?.().resolvedOptions().timeZone || "UTC");
  const today = useMemo(() => getToday(tz), [tz]);

  const [rows, setRows] = useState(null);
  const [one, setOne] = useState(null);
  const [err, setErr] = useState("");
  const [selectedCountries, setSelectedCountries] = useState(new Set(["korea"]));
  const [wiki, setWiki] = useState({ title: "", snippet: "", url: "", lang: "" });
  const [wikiLoading, setWikiLoading] = useState(false);
  const wikiReqGen = useRef(0);

  const wikiCache = useRef({}).current;

  // 선택 국가 불러오기
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY_SELECTED).then((raw) => {
      if (raw) {
        const arr = JSON.parse(raw);
        const valid = Array.isArray(arr) ? arr.filter((id) => COUNTRY_CFG[id]) : [];
        if (valid.length > 0) setSelectedCountries(new Set(valid));
      }
    });
  }, []);

  // 선택 국가 저장
  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY_SELECTED, JSON.stringify([...selectedCountries]));
  }, [selectedCountries]);

  // 시트 로드
  useEffect(() => {
    let canceled = false;

    (async () => {
      try {
        const tasks = [...selectedCountries].map(async (cid) => {
          const cfg = COUNTRY_CFG[cid];
          const data = await fetchSheetRows({ sheetId: cfg.sheetId, gid: cfg.gid });
          return (Array.isArray(data) ? data : []).map((r) => cleanRow(r, cid));
        });

        const merged = (await Promise.all(tasks)).flat();
        const allToday = merged.filter((r) => isTodayRow(r, today));

        const seen = await getSeen(today.dcode);
        let candidates = allToday.filter((r) => !seen.has(rowId(r)));

        if (allToday.length > 0 && candidates.length === 0) {
          await resetSeen(today.dcode);
          candidates = allToday;
        }

        const withBody = candidates.filter((r) => getBody(r).length > 0);
        const pickPool = withBody.length ? withBody : candidates;
        const pick = pickPool.length ? pickPool[Math.floor(Math.random() * pickPool.length)] : null;

        if (!canceled) {
          setRows(allToday);
          setOne(pick);
          if (pick) await addSeen(today.dcode, rowId(pick));
        }
      } catch (e) {
        if (!canceled) setErr(String(e?.message || e));
      }
    })();

    return () => {
      canceled = true;
    };
  }, [today, selectedCountries]);

  // 위키 요약
  useEffect(() => {
    let canceled = false;

    (async () => {
      if (!one) return setWiki({ title: "", snippet: "", url: "", lang: "" });

      const body = getBody(one);
      if (!body) return setWiki({ title: "", snippet: "", url: "", lang: "" });

      const lang = COUNTRY_CFG[one.__country]?.lang || "ko";
      const cacheKey = `${lang}|${body.slice(0, 120)}`;
      const cached = wikiCache[cacheKey];
      if (cached) return setWiki(cached);

      setWikiLoading(true);
      const gen = ++wikiReqGen.current;

      const queries = makeQueriesFromBody(body, lang, 16).slice(0, 5);
      let found = null;

      for (const q of queries) {
        const r = await fetchSummaryMultiLang(lang, q).catch(() => null);
        if (wikiReqGen.current !== gen || canceled) return;
        if (r) {
          found = r;
          break;
        }
      }

      if (!found) {
        const fb = makeKeyword(body, 18);
        const r = await fetchSummaryMultiLang(lang, fb).catch(() => null);
        if (wikiReqGen.current !== gen || canceled) return;
        if (r) found = r;
      }

      setWikiLoading(false);

      if (found) {
        setWiki(found);
        wikiCache[cacheKey] = found;
      } else {
        const searchUrl = `https://${lang}.wikipedia.org/w/index.php?search=${encodeURIComponent(queries[0] || makeKeyword(body, 16) || "")}`;
        setWiki({ title: "", snippet: "요약 정보를 찾을 수 없습니다.", url: searchUrl, lang });
      }
    })();

    return () => {
      canceled = true;
    };
  }, [one]);

  // 다음 항목 보기
  const handleNext = async () => {
    if (!rows || rows.length === 0) return;

    const seen = await getSeen(today.dcode);
    let candidates = rows.filter((r) => !seen.has(rowId(r)));

    if (rows.length > 0 && candidates.length === 0) {
      await resetSeen(today.dcode);
      candidates = rows;
    }

    const withBody = candidates.filter((r) => getBody(r).length > 0);
    const pickPool = withBody.length ? withBody : candidates;
    if (pickPool.length === 0) return;

    const pick = pickPool[Math.floor(Math.random() * pickPool.length)];
    setOne(pick);
    await addSeen(today.dcode, rowId(pick));
  };

  // 화면 출력
  if (!rows && !err) return <ActivityIndicator style={{ marginTop: 24 }} />;
  if (err) return <View style={{ padding: 16 }}><Text style={{ color: "crimson" }}>문제가 발생했습니다: {err}</Text></View>;

  const dateStr = one ? formatDate(one, today) : "";
  const body = one ? getBody(one) : "";

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12, maxWidth: 360, alignSelf: "center", paddingBottom: 40 }}>
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
              {wiki.snippet}{" "}
              {!!wiki.url && (
                <Text style={{ textDecorationLine: "underline" }} accessibilityRole="link" onPress={() => Linking.openURL(wiki.url).catch(() => {})}>
                  원문 보기
                </Text>
              )}
            </Text>
          )}

          {/* <Pressable onPress={handleNext} style={{ marginTop: 16, alignSelf: "flex-start", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: "#201d6aff" }}>
            <Text style={{ color: "white", fontWeight: "700" }}>다음 보기</Text>
          </Pressable> */}
        </>
      )}
    </ScrollView>
  );
}
