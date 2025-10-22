// lib/dayCache.js
// mm-dd 분할 + 느슨한 매칭(fallback) 복원

import { setJSON, getJSON, multiSetStrings } from "./storage";
import { fetchSheetRows } from "./sheets";

const DAY_KEY  = (sheetId, gid, md) => `@sheet_day_v2:${sheetId}:${gid}:${md}`;
const META_KEY = (sheetId, gid)      => `@sheet_meta_v2:${sheetId}:${gid}`;

// ───────────── mdFromRowQuick (그대로) ─────────────
export function mdFromRowQuick(row) {
  const dateStr = row?.Date || row?.date || row?.__DATE || "";
  if (typeof dateStr === "string") {
    const s = dateStr.trim();
    if (/^\d{2}-\d{2}$/.test(s)) return s.toLowerCase();
    const m = s.match(/^\d{4}[-/](\d{2})[-/](\d{2})/);
    if (m) return `${m[1]}-${m[2]}`.toLowerCase();
  }
  const iso = row?.isoDate || row?.dateISO || row?.dateString || "";
  if (typeof iso === "string") {
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[2]}-${m[3]}`.toLowerCase();
  }
  if (row?.month && row?.day) {
    const mm = String(row.month).padStart(2, "0");
    const dd = String(row.day).padStart(2, "0");
    return `${mm}-${dd}`.toLowerCase();
  }
  return "";
}

// ───────────── 느슨한 매칭 복원 ─────────────
export function isTodayRowLoose(row, todayParts) {
  const md = todayParts.md;                  // "MM-DD"
  const mmdd = todayParts.dcode.slice(1);   // "MMDD"
  const tryStr = (s) => typeof s === "string" ? s.trim() : "";

  const dateStr = tryStr(row?.Date || row?.date || row?.__DATE || "");
  if (dateStr) {
    if (dateStr.toLowerCase().includes(`d${mmdd.toLowerCase()}`)) return true; // D1015
    if (dateStr === md) return true;                                           // 10-15
    if (/^\d{4}[-/]\d{2}[-/]\d{2}/.test(dateStr)) return dateStr.slice(5, 10) === md;
  }
  const iso = tryStr(row?.isoDate || row?.dateISO || row?.dateString || "");
  if (iso && /^\d{4}-\d{2}-\d{2}/.test(iso)) return iso.slice(5, 10) === md;

  if (row?.month && row?.day) {
    const mm = String(row.month).padStart(2, "0");
    const dd = String(row.day).padStart(2, "0");
    if (`${mm}-${dd}` === md) return true;
  }

  for (const v of Object.values(row || {})) {
    const s = tryStr(v);
    if (!s) continue;
    if (new RegExp(`\\b[dD]${mmdd}\\b`).test(s)) return true;
    if (s.includes(md)) return true;
  }
  return false;
}

// rows → { md: rows[] }
function partitionRowsByDay(rows) {
  const map = new Map();
  for (let i = 0; i < rows.length; i++) {
    const md = mdFromRowQuick(rows[i]);
    if (!md) continue;
    const arr = map.get(md) || [];
    arr.push(rows[i]);
    map.set(md, arr);
  }
  return map;
}

async function persistPartitioned(sheetId, gid, rows) {
  const map = partitionRowsByDay(rows);
  const entries = [...map.entries()];

  if (entries.length) {
    const pairs = entries.map(([md, arr]) => [DAY_KEY(sheetId, gid, md), JSON.stringify(arr)]);
    await multiSetStrings(pairs);
  }
  await setJSON(META_KEY(sheetId, gid), { ts: Date.now() });
}

// ───────────── inflight / timeout ─────────────
const INFLIGHT = new Map();
function withTimeout(promise, ms) {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), ms);
    promise.then((v) => { clearTimeout(t); resolve(v); })
           .catch(()   => { clearTimeout(t); resolve(null); });
  });
}

/**
 * 느슨한 매칭 포함 "오늘만" 로딩
 * 1) 캐시된 day bucket 있으면 즉시 반환
 * 2) 없으면 네트워크로 전체 rows 받고 분할 저장
 * 3) 분할 버킷이 비어도 느슨한 매칭으로 today 후보 생성 → 그 결과를 day bucket으로 캐싱
 */
export async function loadTodayRowsSmart(sheetId, gid, todayParts, timeoutMs = 12000) {
  const md = todayParts.md;
  const dayKey = DAY_KEY(sheetId, gid, md);

  // (A) 오늘 캐시 즉시 복구
  const cached = await getJSON(dayKey);
  if (Array.isArray(cached) && cached.length) return cached;

  // (B) 인플라이트 합류
  const k = `${sheetId}:${gid}`;
  if (INFLIGHT.has(k)) {
    try {
      await INFLIGHT.get(k);
      const cached2 = await getJSON(dayKey);
      if (Array.isArray(cached2)) return cached2;
      return [];
    } catch { return []; }
  }

  // (C) 네트워크로 전체 rows 수급 (제한시간)
  const task = withTimeout(fetchSheetRows({ sheetId, gid }), timeoutMs)
    .then(async (all) => {
      const rows = Array.isArray(all) ? all : [];
      // 분할 저장
      await persistPartitioned(sheetId, gid, rows);

      // 분할 버킷
      const partition = partitionRowsByDay(rows);
      let todays = partition.get(md) || [];

      // 분할이 비면 느슨한 매칭으로 보강
      if (!todays.length) {
        todays = rows.filter((r) => isTodayRowLoose(r, todayParts));
        // 다음번 빠르게 나오도록 오늘 키에도 캐시
        try { await setJSON(dayKey, todays); } catch {}
      }
    })
    .finally(() => INFLIGHT.delete(k));

  INFLIGHT.set(k, task);
  await task;

  const fresh = await getJSON(dayKey);
  return Array.isArray(fresh) ? fresh : [];
}
