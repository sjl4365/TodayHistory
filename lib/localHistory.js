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
 * @property {Anchor[]=} enAnchors
 * @property {Anchor[]=} koAnchors
 * @property {Anchor[]=} jaAnchors
 */

/**
 * @typedef {Object} LocalBucket
 * @property {Record<string, HistoryItem[]>} days  // key: "DMMDD"
 */

// 분기 JSON을 "필요할 때만" require 하도록 지연 로드
const LOCAL_DATA_PATH = {
  korea: {
    Q1: () => require("../assets/seed/korea-q1.json"),
    // Q2: () => require("../assets/seed/korea-q2.json"),
    // Q3: () => require("../assets/seed/korea-q3.json"),
    Q4: () => require("../assets/seed/korea-q4.json"),
  },
  japan: {
    Q1: () => require("../assets/seed/japan-q1.json"),
    // Q2: () => require("../assets/seed/japan-q2.json"),
    // Q3: () => require("../assets/seed/japan-q3.json"),
    Q4: () => require("../assets/seed/japan-q4.json"),
  },
  world: {
    Q1: () => require("../assets/seed/world-q1.json"),
    Q2: () => require("../assets/seed/world-q2.json"),
    Q3: () => require("../assets/seed/world-q3.json"),
    Q4: () => require("../assets/seed/world-q4.json"),
  },
};

/** 달 → 분기 */
export function monthToQuarter(m) {
  const mm = Number(m);
  if (mm >= 1 && mm <= 3) return "Q1";
  if (mm >= 4 && mm <= 6) return "Q2";
  if (mm >= 7 && mm <= 9) return "Q3";
  return "Q4";
}

/** "DMMDD" */
function makeDCode(y, m, d) {
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `D${mm}${dd}`;
}

/**
 * 로컬 JSON에서 특정 날짜의 데이터 반환 (없으면 빈 배열)
 * @param {"korea"|"japan"|"world"} mode
 * @param {{y:number|string, m:number|string, d:number|string}} parts
 * @returns {HistoryItem[]}
 */
export function getLocalHistory(mode, parts) {
  const q = monthToQuarter(Number(parts.m));
  const getter = LOCAL_DATA_PATH[mode]?.[q];
  if (!getter) return [];
  /** @type {LocalBucket} */
  const bucket = getter(); // 이 시점에만 실제 파싱
  const dcode = makeDCode(parts.y, parts.m, parts.d);
  const list = bucket?.days?.[dcode];
  return Array.isArray(list) ? list : [];
}

/** 해당 분기가 준비되어 있는지 (디버그/표시용) */
export function hasLocalQuarter(mode, q /* "Q1"..."Q4" */) {
  return !!LOCAL_DATA_PATH[mode]?.[q];
}

export default { getLocalHistory, monthToQuarter, hasLocalQuarter };
