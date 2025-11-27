// api/history.ts
const APP_SCRIPT_URL =
"https://script.google.com/macros/s/AKfycbwSfPg9XT9Xx4cnnc5Wz41LvLoAPUuoNna2qZRH5gzz8UkhwV9LP0UsJfzwLBbPICg33w/exec"

type Mode = "world" | "korea" | "japan";

function abortAfter(ms: number) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, cancel: () => clearTimeout(t) };
}

async function getJSON(url: string, timeoutMs = 5000) {
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
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    q.set(k, String(v));
  }
  return q.toString();
}

export async function fetchHistory(opts: {
  mode?: Mode;
  date: string;         // YYYY-MM-DD (필수)
  n?: number;
  month?: number;       // 1~12, world에서 사용 (없으면 date에서 자동 추출)
  shuffle?: boolean;
}) {
  const {
    mode = "world",
    date,
    n = 20,
    month,
    shuffle = true,
  } = opts || ({} as any);

  if (!date) {
    throw new Error("fetchHistory: 'date' is required (YYYY-MM-DD)");
  }

  // date에서 month 자동 추출 (month 안 넘겨주면)
  let finalMonth = month;
  if (!finalMonth) {
    const parts = date.split("-");
    if (parts.length >= 2) {
      const m = parseInt(parts[1], 10);
      if (!Number.isNaN(m) && m >= 1 && m <= 12) {
        finalMonth = m;
      }
    }
  }

  const baseParams: any = {
    mode,
    date,
    n,
    shuffle,
  };

  // Apps Script에서 월별 시트 고르는데 사용
  if (finalMonth) {
    baseParams.month = finalMonth;
  }

  const url = `${APP_SCRIPT_URL}?${qs(baseParams)}`;

  // Apps Script 응답: 배열 or { error: true, message: "..." }
  const data = await getJSON(url, 5000);

  // 에러 객체 형태면 에러 던지기
  if (data && typeof data === "object" && !Array.isArray(data) && (data as any).error) {
    throw new Error((data as any).message || "Sheet error");
  }

  // 순수 배열이면 그대로 리턴
  if (Array.isArray(data)) {
    return data;
  }

  // 혹시 옛날 형식({ ok, items })도 같이 지원
  const anyData: any = data;
  if (anyData && anyData.ok && Array.isArray(anyData.items)) {
    return anyData.items;
  }

  throw new Error("Unexpected API response format");
}
