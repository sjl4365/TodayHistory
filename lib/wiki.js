// lib/wiki.js

// 불용어 (KO/EN)
const STOP_KO = new Set([
  // 기존
  "그리고","또는","그러나","입니다","이었다","하였다","했다",
  "그","이","저","에서","으로","에게","에서의","등","및","같은","관련","당시","해당",
  "년","월","일","시기","사건","전투","조약","법","정부","군","함대","부대",
  // 설명형/노이즈(추가)
  "과정","과정에서","지속","전국적","전국","요구","확정","완료","발생","진행","전개","이후","이전",
  "당시의","등의","중","기간","동안","대해","대한","관련된","초기","말","초","중반","후반",
  // 흔한 보조/의존 명사
  "것","수","등등","부분","측","측의","측은","위해","로서","로써","때문","때문에","뿐","뿐만"
]);

const STOP_EN = new Set([
  "the","a","an","and","or","but","of","in","on","at","to","for","by","with","as","from",
  "this","that","these","those","it","its","is","was","are","were","be","been","st",
  "into","over","under","about","between","during","after","before","more","most","some","any",
  "such","no","not","only","other","than","then","there","here","their","them",
  // 흔한 개념/정의 유도 단어(자동 제거용)
  "experience","experiences",
  "market","markets","marketing","marketed","marketer","marketers","merchandising",
  "inauguration","inaugurations","inaugurate","inaugurated","inaugurating"
]);

// 텍스트 전처리 
function cleanText(s) {
  return String(s || "")
    .replace(/\[[^\]]*\]/g, "")   // [각주]
    .replace(/\([^)]*\)/g, "")    // (괄호)
    .replace(/[~!@#$%^&*_=+<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
function firstSentence(s) {
  const m = String(s || "").match(/.+?(?:\.|다\.|요\.|!|\?)/);
  return m ? m[0] : String(s || "");
}
function trimToLen(s, maxLen) {
  const str = String(s || "");
  if (str.length <= maxLen) return str;
  const cut = str.slice(0, maxLen + 2);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 6 ? cut.slice(0, lastSpace) : str.slice(0, maxLen)).trim();
}

// 한국어 조사 제거 
function stripJosaKo(w) {
  if (!/^[가-힣]+$/.test(w)) return w;
  return w
    .replace(/(에서|으로써|으로서|으로|에게서|에게|까지|부터|밖에|보다|마저|조차|마다|뿐|만|도|이나|나|든지|라도|라고|과|와|을|를|은|는|이|가|의)$/u, "")
    .replace(/(에서|으로|에게|까지|부터|만|도|과|와|을|를|은|는|이|가|의)$/u, "");
}

// 토큰화/랭킹 
function tokensByLang(s, lang) {
  const raw = String(s || "").match(/[A-Za-z가-힣0-9]{2,}/g) || [];
  if (lang === "ko") {
    return raw
      .map(stripJosaKo)
      .filter(Boolean)
      .filter(w => !STOP_KO.has(w) && w.length >= 2);
  }
  const STOP = lang === "en" ? STOP_EN : STOP_KO;
  return raw.filter(w => !STOP.has(w.toLowerCase()) && w.length >= 2);
}
function rankTokens(cands, lang) {
  return cands
    .map(w => {
      const isCapitalWord = lang === "en" ? /^[A-Z][a-z]+$/.test(w) : false;
      const isHangul = /[가-힣]/.test(w);
      const score = w.length + (isHangul ? 1.5 : 0) + (isCapitalWord ? 1 : 0);
      return { w, score };
    })
    .sort((a,b) => b.score - a.score)
    .map(x => x.w);
}

// 개념어/정의문/고유명사
function isConceptWordEN(w) {
  const s = String(w || "");
  const low = s.toLowerCase();
  if (STOP_EN.has(low)) return true;
  if (/^[a-z]+$/.test(s)) {
    if (/(ing|tion|sion|ment|ness|ism|ity|ence|ance|ship|tude|ics|ology|graphy|nomy|culture|science|economy|politics)$/.test(low)) return true;
    if (/^(process|concept|system|method|practice|policy|movement|event|industry|business|marketing|promotion|education)$/.test(low)) return true;
  }
  return false;
}
function looksLikeGenericDefinition(extract) {
  const t = String(extract || "").trim();
  const head = t.slice(0, 180);
  const defLike =
    /\b(is|are|was|were)\s+(an?|the)\b/i.test(head) ||
    /\brefers to\b/i.test(head) ||
    /\bmay refer to\b/i.test(head);
  const hasYear = /\b(1[0-9]{3}|20[0-9]{2})\b/.test(head);
  const hasPlaceCue = /\b(London|New York|United States|Germany|France|City|County|Province|England|Scotland|Wales|Ireland)\b/i.test(head);
  return defLike && !hasYear && !hasPlaceCue;
}

// 고유명사 추출(영문)
function extractProperNounsEn(text, max = 6) {
  const s = String(text || "").replace(/([A-Za-z0-9])-\s+([A-Za-z0-9])/g, "$1-$2");
  const re = /(?:[A-Z][a-z]+(?:\s+(?:[A-Z][a-z]+|[a-z]+)){0,3}|\b(?:[A-Z]{2,}|[0-9]+[A-Z]+|[A-Z]+[0-9]+)\b)/g;
  const raw = s.match(re) || [];
  const COMMON = new Set(["The","A","An","Of","In","On","At","To","For","By","With","As","From","And","Or","But","Is","Are","Was","Were","Be","Been","US","U.S","America","American","States","City","War","Act","Law","Bill","Treaty"]);
  const list = raw.map(t=>t.trim()).filter(t => t.length>=2 && !COMMON.has(t));
  const score = new Map();
  for (const t of list) score.set(t, (score.get(t)||0) + 1 + Math.min(20, t.length/4));
  return [...new Set(list)].sort((a,b)=>(score.get(b)||0)-(score.get(a)||0)).slice(0, max);
}

// 제목 후보 자동 생성 
function softTitleCase(s) {
  return String(s || "")
    .split(/\s+/)
    .map((w, i) => {
      if (/^[A-Z0-9-]+$/.test(w)) return w; // 3M, V-2
      if (/-/.test(w)) {
        return w.split('-').map(p=>{
          if (/^[A-Z0-9]+$/.test(p)) return p;
          return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
        }).join('-');
      }
      const lower = w.toLowerCase();
      const SMALL = new Set(["and","or","of","in","on","at","to","for","by","with","as","from","the","a","an"]);
      if (i>0 && SMALL.has(lower)) return lower;
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
}
function generateTitleCandidates(raw) {
  const out = new Set();
  const base = normalizeTitle(String(raw || "").trim());
  if (!base) return [];

  // 원문/정규화/타이틀케이스
  out.add(base);
  out.add(base.replace(/[“”"]/g,"").replace(/\s*,\s*/g," ").trim());
  out.add(softTitleCase(base));

  // 고유명사 파생 + 미국 맥락
  const pns = extractProperNounsEn(base, 4);
  for (const pn of pns) {
    out.add(pn);
    out.add(softTitleCase(pn));
    out.add(`${pn} United States`);
  }

  // 약어 보정
  out.add(base.replace(/\bU\.S\.\b/gi, "United States"));
  out.add(softTitleCase(base.replace(/\bU\.S\.\b/gi, "United States")));

  return [...out].map(s => s.replace(/\s{2,}/g," ").trim()).filter(Boolean);
}

// 검색 제외(EN 네거티브 필터) 
function buildNegativeFilter(raw, lang = "en", max = 8) {
  if (lang !== "en") return "";
  const toks = (String(raw||"").match(/[A-Za-z]{3,}/g) || []).map(w => w.toLowerCase());
  const seen = new Set();
  const negs = [];
  for (const t of toks) {
    if (seen.has(t)) continue; seen.add(t);
    if (isConceptWordEN(t)) {
      negs.push(`-${t}`);
      if (negs.length >= max) break;
    }
  }
  return negs.join(" ");
}

//  위키 API 공통 
function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

async function fetchJsonWithStatus(url) {
  const res = await fetch(url);
  const status = res.status;
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`HTTP ${status}`);
    err.status = status;
    err.bodyPreview = text.slice(0, 140);
    throw err;
  }
  const json = await res.json();
  return { status, json };
}

//  검색 보정 유틸 
function normalizeTitle(raw) {
  return String(raw || "")
    .replace(/\bSt\.\s/g, "Saint ")
    .replace(/\bU\.S\.\b/g, "United States")
    .replace(/[“”"]/g, "")
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}
async function pickBestSearch(lang, q, limit = 8) {
  const searchUrl = `https://${lang}.wikipedia.org/w/api.php` +
    `?action=query&list=search&srlimit=${limit}&srsearch=${encodeURIComponent(q)}&format=json&origin=*`;
  const { json: s } = await fetchJsonWithStatus(searchUrl);
  const hits = s?.query?.search || [];
  if (!hits.length) return null;

  const ids = hits.map(h => h.pageid).join("|");
  const pageMetaUrl = `https://${lang}.wikipedia.org/w/api.php` +
    `?action=query&pageids=${ids}&prop=pageprops|info&inprop=url&format=json&origin=*`;
  const { json: m } = await fetchJsonWithStatus(pageMetaUrl);
  const pages = m?.query?.pages || {};

  const ok = hits.find(h => {
    const p = pages[h.pageid];
    const isDisambig = !!(p?.pageprops && ("disambiguation" in p.pageprops));
    return !isDisambig;
  }) || hits[0];

  const meta = pages[ok.pageid] || {};
  return { title: ok.title, url: meta.fullurl };
}

// ── 사건명/동의어 정규화 규칙 ─────────────────────────
const CANON_MAP = {
  ko: new Map([
    // 민주화 계열(서술형 → 고유명)
    [/민주화.*(집회|시위|요구)/, "민주화 운동"],
    [/6월\s*민주항쟁|6월\s*항쟁|6·?10\s*민주항쟁/, "6월 민주항쟁"],
    [/4[·\.\s]*19\s*(혁명|의거)|사일구\s*(혁명|의거)/, "4·19 혁명"],
    [/부마\s*(항쟁|민주항쟁)/, "부마 민주항쟁"],
    [/광주\s*(민주화\s*운동|항쟁|사태)?/, "광주 민주화 운동"],
    // 19세기/한국전쟁 주요 사건
    [/병인양요/, "병인양요"],
    [/신미양요/, "신미양요"],
    // 평양 점령/전투 서술 → 평양 전투
    [/(평양).*(점령|전투|공략|함락)/, "평양 전투"],
  ]),
  en: new Map([
    [/(democratization|democracy).*(protest|rally|demand)/i, "Democratization movement"],
    [/june.*(struggle|uprising|protest)/i, "June Struggle"],
    [/april\s*19.*(revolution|uprising|movement)/i, "April Revolution"],
    [/byeongin.*yangyo|french.*korea.*1866/i, "French campaign against Korea"],
    [/shinmi.*yangyo|us.*expedition.*korea.*1871/i, "United States expedition to Korea (1871)"],
    [/(pyongyang).*(capture|battle|fall)/i, "Battle of Pyongyang"],
  ])
};

function extractYearAny(s) {
  const m = String(s||"").match(/\b(1[0-9]{3}|20[0-9]{2})\b|([12][0-9]{3})년/);
  if (!m) return null;
  return (m[1] || (m[2] && m[2].replace(/년$/,""))) || null;
}
function normalizeEventTitle(raw, lang="ko") {
  const s = normalizeTitle(cleanText(raw));
  const rules = CANON_MAP[lang];
  for (const [re, canon] of rules) {
    if (re.test(s)) return canon;
  }
  const alt = lang === "ko" ? CANON_MAP.en : CANON_MAP.ko;
  for (const [re, canon] of alt) {
    if (re.test(s)) return canon;
  }
  return "";
}

// 쿼리 생성기(ko/en 공용) 
export function makeQueriesFromBody(body, lang = "ko", maxLen = 16) {
  const base = firstSentence(cleanText(body));
  const year = extractYearAny(base);

  const toks = tokensByLang(base, lang);
  if (lang === "en") {
    for (let i = toks.length - 1; i >= 0; i--) if (isConceptWordEN(toks[i])) toks.splice(i,1);
  }
  const ranked = rankTokens(toks, lang);

  const top1   = ranked[0] ? trimToLen(ranked[0], maxLen) : "";
  const combo2 = ranked.slice(0, 2).join(" ");
  const combo3 = ranked.slice(0, 3).join(" ");
  const long2  = rankTokens(toks.filter(t => t.length >= 4), lang).slice(0, 2).join(" ");

  // 대표 사건명(서술 → 고유명) 우선
  const canon = normalizeEventTitle(base, lang);
  const canonWithYear = canon && year ? `${year} ${canon}` : "";

  // 장소+행위 보강(ko는 한글 우선)
  const placeAction =
    lang === "ko"
      ? ranked.slice(0, 3).filter(x => /[가-힣]/.test(x)).join(" ")
      : ranked.slice(0, 3).join(" ");

  let uniq = Array.from(new Set([
    canon, canonWithYear,
    year && combo2 ? `${year} ${combo2}` : "",
    year && top1  ? `${year} ${top1}`  : "",
    top1, combo2, combo3, long2,
    trimToLen(base, Math.min(maxLen, 18)),
    trimToLen(base, 12),
    trimToLen(placeAction, maxLen),
  ].filter(Boolean)));

  // EN: 고유명사/미국 맥락 강화
  if (lang === "en") {
    const pn = extractProperNounsEn(base, 4);
    const year2 = (base.match(/\b(1[0-9]{3}|20[0-9]{2})\b/)||[])[1] || "";
    const fused = [];
    if (pn.includes("Atlantic City") && /New Jersey/i.test(base)) fused.push(trimToLen("Atlantic City, New Jersey", maxLen));
    const usBoost = pn.map(p => trimToLen(`${p} United States`, maxLen));
    const yearPn  = year2 ? pn.map(p => trimToLen(`${year2} ${p}`, maxLen)) : [];
    uniq = [...new Set([...fused, ...pn, ...usBoost, ...yearPn, ...uniq])];
  }

  return uniq;
}

export const makeKeyword = (text, maxLen = 20) =>
  String(text || "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);

// 요약: 단일언어(간단)
export async function fetchSummaryByKeywordSmart(lang, keyword, desiredChars = 900) {
  const q = String(keyword || '').trim();
  if (!q) return null;

  const summaryOf = async (title) => {
    const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}?redirect=true`;
    const { json } = await fetchJsonWithStatus(url);
    const extract = typeof json?.extract === 'string' ? json.extract.trim() : '';
    if (!extract) return null;
    const pageUrl = json?.content_urls?.desktop?.page || json?.content_urls?.mobile?.page || '';
    const snippet = extract.length > desiredChars ? (extract.slice(0, desiredChars).trim() + '…') : extract;
    return { title: json.title || title, snippet, url: pageUrl, lang };
  };

  // 1) direct
  try {
    const direct = await summaryOf(q);
    if (direct) return direct;
  } catch (e) {
    if (e?.status === 429 || e?.status === 503) { await sleep(300 + Math.random()*400); }
    else if (e?.status && e.status >= 500) { await sleep(200); }
  }

  // 2) search → top1 → summary
  try {
    const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srlimit=1&srsearch=${encodeURIComponent(q)}&format=json&origin=*`;
    const { json } = await fetchJsonWithStatus(searchUrl);
    const title = json?.query?.search?.[0]?.title;
    if (!title) return null;
    return await summaryOf(title);
  } catch (e) {
    if (e?.status === 429 || e?.status === 503) { await sleep(300 + Math.random()*400); }
    return null;
  }
}

// 요약: 단일언어(강화) 
export async function fetchSummaryByKeyword(lang, keyword, desiredChars = 900) {
  const raw = String(keyword || '').trim();
  if (!raw) return null;

  const summaryOf = async (title) => {
    const safe = title.replace(/ /g, "_");
    const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(safe)}?redirect=true`;
    const { json } = await fetchJsonWithStatus(url);

    if (json?.type === "disambiguation") return null;

    const extract = typeof json?.extract === 'string' ? json.extract.trim() : '';
    if (!extract) return null;
    if (looksLikeGenericDefinition(extract)) return null;

    const pageUrl = json?.content_urls?.desktop?.page || json?.content_urls?.mobile?.page || '';
    const snippet = extract.length > desiredChars ? (extract.slice(0, desiredChars).trim() + '…') : extract;
    return { title: json.title || title, snippet, url: pageUrl, lang };
  };

  // 0) 제목 후보 자동 생성 → 순차 시도
  const candidates = generateTitleCandidates(raw);
  for (const cand of candidates) {
    try {
      const res = await summaryOf(cand);
      if (res) return res;
    } catch (e) {
      if (e?.status === 429 || e?.status === 503) { await sleep(200 + Math.random()*300); }
    }
  }

  // 1) 검색 폴백: 동음이의어 제외 + 네거티브 필터(-단어)
  try {
    const neg = buildNegativeFilter(raw, lang, 8);
    for (const cand of candidates) {
      const boosted = `intitle:"${cand}" ${cand} ${neg}`.trim();
      const pick = await pickBestSearch(lang, boosted, 10);
      if (pick?.title) {
        const res = await summaryOf(pick.title);
        if (res) return res;
        return { title: pick.title, snippet: "", url: pick.url || "", lang };
      }
    }
  } catch (e) {
    if (e?.status === 429 || e?.status === 503) { await sleep(300 + Math.random()*400); }
  }

  // 2) EN: 고유명사 기반 재탐색
  try {
    if (lang === "en") {
      const props = extractProperNounsEn(raw, 6);
      const yearMatch = raw.match(/\b(1[0-9]{3}|20[0-9]{2})\b/);
      const year = yearMatch ? yearMatch[1] : "";
      const neg = buildNegativeFilter(raw, "en", 6);

      for (const pn of props) {
        const variants = [
          `intitle:"${pn}" "${pn}" "United States"`,
          year ? `intitle:"${pn}" ${year} "United States"` : "",
          `intitle:"${pn}" "${pn}" US`,
          `intitle:"${pn}" ${pn} American`,
          `intitle:"${pn}" "3M"`,
          `"3M" "${pn}"`,
          pn
        ].filter(Boolean);

        for (const v of variants) {
          const pick2 = await pickBestSearch(lang, `${v} ${neg}`.trim(), 10).catch(() => null);
          if (pick2?.title) {
            const res2 = await summaryOf(pick2.title).catch(() => null);
            if (res2) return res2;
            return { title: pick2.title, snippet: "", url: pick2.url || "", lang };
          }
        }
      }
    }
  } catch {}

  return null;
}

// 다국어 폴백 
export async function fetchSummaryMultiLang(preferredLang, keyword, desiredChars = 900) {
  const langs = Array.from(new Set([preferredLang || "ko", "en", "ko"]));
  for (const lang of langs) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetchSummaryByKeyword(lang, keyword, desiredChars);
        if (res) return res;
        break; // 정상응답인데 extract 없음 → 다음 언어
      } catch (e) {
        if ((e?.status === 429 || e?.status === 503) && attempt === 0) {
          await sleep(300 + Math.random()*400);
          continue;
        }
        break;
      }
    }
  }
  return null;
}

// 본문 위키요약
export async function getWikiForBody(body, preferredLang = "ko", {
  maxQueries = 8,
  perTryTimeoutMs = 10000,
  desiredChars = 900
} = {}) {
  const clean = String(body || "").trim();
  if (!clean) return null;

  // 대표 사건명 최우선
  const canon = normalizeEventTitle(clean, preferredLang);
  const canonList = canon ? [canon] : [];

  const queries = [
    ...canonList,
    ...makeQueriesFromBody(clean, preferredLang, 16)
  ].slice(0, maxQueries);

  for (const q of queries) {
    try {
      const r = await Promise.race([
        fetchSummaryMultiLang(preferredLang, q, desiredChars),
        new Promise((_,rej)=>setTimeout(()=>rej(new Error("timeout")), perTryTimeoutMs))
      ]);
      if (r) return r;
    } catch (_) {}
  }

  const fb = makeKeyword(clean, 18);
  if (fb) {
    try {
      const r = await Promise.race([
        fetchSummaryMultiLang(preferredLang, fb, Math.min(700, desiredChars)),
        new Promise((_,rej)=>setTimeout(()=>rej(new Error("timeout")), perTryTimeoutMs))
      ]);
      if (r) return r;
    } catch (_) {}
  }

  try {
    const r = await Promise.race([
      fetchSummaryMultiLang(preferredLang, clean, desiredChars),
      new Promise((_,rej)=>setTimeout(()=>rej(new Error("timeout")), perTryTimeoutMs))
    ]);
    if (r) return r;
  } catch (_) {}

  const q = encodeURIComponent((queries[0] || fb || clean).slice(0, 40));
  const searchUrl = `https://${preferredLang || "en"}.wikipedia.org/w/index.php?search=${q}`;
  return { title: "", snippet: "", url: searchUrl, lang: preferredLang || "en" };
}
