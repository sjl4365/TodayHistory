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
 * @property {Record<string, HistoryItem[]>} days  // key: "DMMDD"
 */

// 분기 JSON을 "필요할 때만" require 하도록 지연 로드 (korea, japan)
const LOCAL_DATA_PATH = {
  korea: {
    Q1: () => require("../assets/seed/korea-q1.json"),
    Q2: () => require("../assets/seed/korea-q2.json"),
    Q3: () => require("../assets/seed/korea-q3.json"),
    Q4: () => require("../assets/seed/korea-q4.json"),
  },
  japan: {
    Q1: () => require("../assets/seed/japan-q1.json"),
    Q2: () => require("../assets/seed/japan-q2.json"),
    Q3: () => require("../assets/seed/japan-q3.json"),
    Q4: () => require("../assets/seed/japan-q4.json"),
  },
};

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

// china: 전체 연도 통합 버킷 (china-all.json)
const LOCAL_CHINA_PATH = () => require("../assets/seed/china-all.json");

/**
 * 메모리 캐시: 이미 로드한 JSON 버킷 재사용
 *  - korea/japan: Q1~Q4
 *  - world: "01"~"12"
 */
const BUCKET_CACHE = {
  korea: { Q1: null, Q2: null, Q3: null, Q4: null },
  japan: { Q1: null, Q2: null, Q3: null, Q4: null },
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

// china는 분기/월 개념 없이 한 파일만 사용
/** @type {LocalBucket|null} */
let CHINA_BUCKET_CACHE = null;

/** 달 → 분기 (korea / japan 전용) */
export function monthToQuarter(m) {
  const mm = Number(m);
  if (mm >= 1 && mm <= 3) return "Q1";
  if (mm >= 4 && mm <= 6) return "Q2";
  if (mm >= 7 && mm <= 9) return "Q3";
  if (mm >= 10 && mm <= 12) return "Q4";
  // 이상한 값 들어오면 기본값 Q4
  return "Q4";
}

/** "DMMDD" (연도는 사용 안 함, 월/일만 사용) */
function makeDCode(m, d) {
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `D${mm}${dd}`;
}

/**
 * 내부용: 분기/월 버킷 불러오기 + 캐싱
 * @param {"korea"|"japan"|"world"} mode
 * @param {string} key  "Q1"..."Q4" 또는 "01"..."12"
 * @returns {LocalBucket | null}
 */
function loadLocalBucket(mode, key) {
  if (mode === "world") {
    const getter = LOCAL_WORLD_PATH[key];
    if (!getter) return null;

    let cached = BUCKET_CACHE.world[key];
    if (!cached) {
      cached = getter(); // require로 JSON 로드
      BUCKET_CACHE.world[key] = cached;
    }
    return cached;
  }

  // korea / japan
  const getter = LOCAL_DATA_PATH[mode]?.[key];
  if (!getter) return null;

  let cached = BUCKET_CACHE[mode][key];
  if (!cached) {
    cached = getter();
    BUCKET_CACHE[mode][key] = cached;
    }
  return cached;
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
export function getLocalHistory(mode, parts) {
  // 날짜 키는 "DMMDD" (연도 무시)
  const dcode = makeDCode(parts.m, parts.d);

  // 🇨🇳 china: china-all.json 하나만 사용
if (mode === "china") {
  const bucket = loadChinaBucket();
  if (!bucket || !bucket.days) return [];
  const list = bucket.days["D0000"];  
  return Array.isArray(list) ? list : [];
}


  if (mode === "world") {
    const mm = String(parts.m).padStart(2, "0"); // "01" ~ "12"
    const bucket = loadLocalBucket("world", mm);
    if (!bucket || !bucket.days) return [];
    const list = bucket.days[dcode];
    return Array.isArray(list) ? list : [];
  }

  // 🇰🇷 / 🇯🇵 : 분기(JSON) 사용
  const q = monthToQuarter(Number(parts.m));
  const bucket = loadLocalBucket(mode, q);
  if (!bucket || !bucket.days) return [];
  const list = bucket.days[dcode];
  return Array.isArray(list) ? list : [];
}

/**
 * 해당 분기가 준비되어 있는지 (korea/japan용, 디버그/표시용)
 * @param {"korea"|"japan"} mode
 * @param {"Q1"|"Q2"|"Q3"|"Q4"} q
 */
export function hasLocalQuarter(mode, q) {
  if (mode === "world") return false;
  if (mode === "china") return false;
  return !!LOCAL_DATA_PATH[mode]?.[q];
}

export default { getLocalHistory, monthToQuarter, hasLocalQuarter };
