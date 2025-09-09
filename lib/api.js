// lib/wiki.js

/** 한국어 검색어 뽑기: 앞 20자, 괄호/각주 제거 + [[ ]] 제거 */
export const makeKoKeyword = (text, maxLen = 25) =>
  String(text || "")
    .replace(/\[[^\]]*\]/g, "")     // [각주] 제거
    .replace(/\(\s*[^)]*\)/g, "")   // ( ) 제거
    // .replace(/\[\[|\]\]/g, "")      // 위키 내부링크 대괄호 제거
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);

/** 위키 리다이렉트 문법(#넘겨주기 / #REDIRECT) → 대상 제목만 추출 */
export const normalizeKoKeyword = (q) => {
  const s = String(q || "").trim();
  const m = s.match(/^#\s*(?:넘겨주기|REDIRECT)\s*\[\[(.+?)\]\]/i);
  return m ? m[1].trim() : s;
};

/** ko 위키백과: 제목 요약 시도 → 실패 시 검색 후 최상위 문서 요약 */
export const fetchKoSummaryByKeyword = async (keyword, desiredChars = 300) => {
  let q = normalizeKoKeyword(makeKoKeyword(keyword, 40));
  if (!q) return null;

  const summaryOf = async (title) => {
    const u = `https://ko.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}?redirect=true`;
    const j = await fetch(u).then(r => (r.ok ? r.json() : null)).catch(() => null);
    if (!j) return null;

    // 혹시 타입이 redirect/standard 상관없이 extract만 사용
    const extract = typeof j?.extract === "string" ? j.extract.trim() : "";
    const url = j?.content_urls?.desktop?.page || j?.content_urls?.mobile?.page || "";
    if (!extract) return null;

    const snippet = extract.length > desiredChars
      ? extract.slice(0, desiredChars) + "…"
      : extract;
    return { title: j.title || title, snippet, url, lang: "ko" };
  };

  // 바로 요약 시도(redirect=true로 자동 추적)
  const direct = await summaryOf(q);
  if (direct) return direct;

  // 1개 타이틀로 다시 요약
  const searchUrl =
    `https://ko.wikipedia.org/w/api.php` +
    `?action=query&list=search&srsearch=${encodeURIComponent(q)}` +
    `&srlimit=1&format=json&origin=*`;
  const sres = await fetch(searchUrl).then(r => (r.ok ? r.json() : null)).catch(() => null);
  const title = sres?.query?.search?.[0]?.title;
  if (!title) return null;

  return await summaryOf(title);
};
