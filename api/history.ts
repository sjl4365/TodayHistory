// api/history.ts
const APP_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxZVCr_s5Z7n2zLvuAxelOb3vmZB5scG16om-z-228u-IFuLTl-kMlP2ZXDbu65AjP-yg/exec";

type Mode = "world" | "korea" | "japan";

function abortAfter(ms: number) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, cancel: () => clearTimeout(t) };
}

async function getJSON(url: string, timeoutMs = 2000) {
  const { signal, cancel } = abortAfter(timeoutMs);
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    cancel();
  }
}

function qs(params: Record<string, any>) {
  const q = new URLSearchParams();
  for (const [k,v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    q.set(k, String(v));
  }
  return q.toString();
}

export async function fetchHistory(opts: {
  mode?: Mode;
  date?: string;       // YYYY-MM-DD
  n?: number;
  quarter?: "Q1"|"Q2"|"Q3"|"Q4";
  shuffle?: boolean;
}) {
  const { mode="world", date, n=20, quarter, shuffle=true } = opts || {};
  const baseParams: any = { mode, n, shuffle };
  if (date) baseParams.date = date;

  // world는 quarter 1회 시도, 실패시에만 fallback
  if (mode === "world") {
    if (quarter) baseParams.quarter = quarter;
    try {
      const url = `${APP_SCRIPT_URL}?${qs(baseParams)}`;
      const j = await getJSON(url, 2000);
      if (!j?.ok) throw new Error(j?.message || "api error");
      return j.items || [];
    } catch {
      // fallback: quarter 제거 1회만
      const { quarter, ...noQ } = baseParams;
      const url2 = `${APP_SCRIPT_URL}?${qs(noQ)}`;
      const j2 = await getJSON(url2, 2000);
      if (!j2?.ok) throw new Error(j2?.message || "api error");
      return j2.items || [];
    }
  }

  // korea / japan
  const url = `${APP_SCRIPT_URL}?${qs(baseParams)}`;
  // 1차
  try {
    const j = await getJSON(url, 2000);
    if (!j?.ok) throw new Error(j?.message || "api error");
    return j.items || [];
  } catch {
    // 2차 재시도 (네트워크 일시 hiccup 대비)
    const j2 = await getJSON(url, 2000);
    if (!j2?.ok) throw new Error(j2?.message || "api error");
    return j2.items || [];
  }
}
