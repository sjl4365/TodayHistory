// lib/localHistory.js

/**
 * @typedef {Object} Anchor
 * @property {string=} text
 * @property {string=} url
 */

/**
 * @typedef {Object} HistoryItem
 * @property {number|string=} year
 * @property {string=} en
 * @property {string=} ko
 * @property {string=} ja
 * @property {string=} sc
 * @property {string=} tc
 * @property {string=} es
 * @property {string=} fr
 * @property {Anchor[]=} enAnchors
 * @property {Anchor[]=} koAnchors
 * @property {Anchor[]=} jaAnchors
 * @property {Anchor[]=} scAnchors
 * @property {Anchor[]=} tcAnchors
 * @property {Anchor[]=} esAnchors
 * @property {Anchor[]=} frAnchors
 */

/**
 * @typedef {Object} LocalBucket
 * @property {Record<string, HistoryItem[]>} days  // key: "DMMDD" (또는 china는 "D0000" 사용중)
 */

// world: 월별(01~12) JSON을 사용
const LOCAL_WORLD_PATH = {
  "01": () => require("../assets/seed/world-q1.json"),
  "02": () => require("../assets/seed/world-q2.json"),
  "03": () => require("../assets/seed/world-q3.json"),
  "04": () => require("../assets/seed/world-q4.json"),
  "05": () => require("../assets/seed/world-q5.json"),
  "06": () => require("../assets/seed/world-q6.json"),
  "07": () => require("../assets/seed/world-q7.json"),
  "08": () => require("../assets/seed/world-q8.json"),
  "09": () => require("../assets/seed/world-q9.json"),
  "10": () => require("../assets/seed/world-q10.json"),
  "11": () => require("../assets/seed/world-q11.json"),
  "12": () => require("../assets/seed/world-q12.json"),
};

// korea/japan/china: 전체 연도 통합 버킷 (all.json)
const LOCAL_KOREA_PATH = () => require("../assets/seed/korea-all.json");
const LOCAL_JAPAN_PATH = () => require("../assets/seed/japan-all.json");
const LOCAL_CHINA_PATH = () => require("../assets/seed/china-all.json");

/**
 * 메모리 캐시
 *  - world: "01"~"12"
 *  - korea/japan/china: all bucket 1개씩
 */
const BUCKET_CACHE = {
  world: {
    "01": null,
    "02": null,
    "03": null,
    "04": null,
    "05": null,
    "06": null,
    "07": null,
    "08": null,
    "09": null,
    "10": null,
    "11": null,
    "12": null,
  },
};

/** @type {LocalBucket|null} */
let KOREA_BUCKET_CACHE = null;
/** @type {LocalBucket|null} */
let JAPAN_BUCKET_CACHE = null;
/** @type {LocalBucket|null} */
let CHINA_BUCKET_CACHE = null;

/** "DMMDD" (연도는 사용 안 함, 월/일만 사용) */
function makeDCode(m, d) {
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `D${mm}${dd}`;
}

/**
 * 내부용: world 월 버킷 불러오기 + 캐싱
 * @param {string} key "01"..."12"
 * @returns {LocalBucket|null}
 */
function loadWorldBucket(key) {
  const getter = LOCAL_WORLD_PATH[key];
  if (!getter) return null;

  let cached = BUCKET_CACHE.world[key];
  if (!cached) {
    cached = getter();
    BUCKET_CACHE.world[key] = cached;
  }
  return cached;
}

/** 내부용: korea-all 버킷 불러오기 + 캐싱 */
function loadKoreaBucket() {
  if (!KOREA_BUCKET_CACHE) {
    KOREA_BUCKET_CACHE = LOCAL_KOREA_PATH();
  }
  return KOREA_BUCKET_CACHE;
}

/** 내부용: japan-all 버킷 불러오기 + 캐싱 */
function loadJapanBucket() {
  if (!JAPAN_BUCKET_CACHE) {
    JAPAN_BUCKET_CACHE = LOCAL_JAPAN_PATH();
  }
  return JAPAN_BUCKET_CACHE;
}

/** 내부용: china-all 버킷 불러오기 + 캐싱 */
function loadChinaBucket() {
  if (!CHINA_BUCKET_CACHE) {
    CHINA_BUCKET_CACHE = LOCAL_CHINA_PATH();
  }
  return CHINA_BUCKET_CACHE;
}

/**
 * 로컬 JSON에서 특정 날짜의 데이터 반환 (없으면 빈 배열)
 * @param {"korea"|"japan"|"world"|"china"} mode
 * @param {{y:number|string, m:number|string, d:number|string}} parts
 * @returns {HistoryItem[]}
 */
// lib/localHistory.js
export function getLocalHistory(mode, parts) {
  const dcode = makeDCode(parts.m, parts.d);

  if (mode === "korea") {
    const b = loadKoreaBucket();
    const list = b?.days?.[dcode] ?? b?.days?.["D0000"]; // ✅ fallback
    return Array.isArray(list) ? list : [];
  }

  if (mode === "japan") {
    const b = loadJapanBucket();
    const list = b?.days?.[dcode] ?? b?.days?.["D0000"]; // ✅ fallback
    return Array.isArray(list) ? list : [];
  }

  if (mode === "china") {
    const b = loadChinaBucket();
    const list = b?.days?.["D0000"];
    return Array.isArray(list) ? list : [];
  }

  if (mode === "world") {
    const mm = String(parts.m).padStart(2, "0");
    const b = loadWorldBucket(mm);
    const list = b?.days?.[dcode];
    return Array.isArray(list) ? list : [];
  }

  return [];
}



/**
 * (호환용) 기존 API 유지: 이제 korea/japan은 분기 개념이 없음
 */
export function monthToQuarter(_m) {
  return "Q1";
}

/**
 * (호환용) 기존 API 유지: 이제 korea/japan은 항상 true처럼 동작시키거나,
 * 필요 없으면 호출부에서 제거해도 됨.
 */
export function hasLocalQuarter(mode, _q) {
  if (mode === "korea") return true;
  if (mode === "japan") return true;
  return false;
}

export default { getLocalHistory, monthToQuarter, hasLocalQuarter };
