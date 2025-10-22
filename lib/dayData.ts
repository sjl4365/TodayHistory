// lib/dayData.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_PREFIX = "@day_v3:"; // v3로 키 버전업

type DayPayload = {
  date: string;        // "2025-10-13"
  lang: "ko" | "ja" | "en";
  items: Array<{ country: string; year: number; title: string; source?: string }>;
  lastUpdated?: number;
};

function cacheKey(dateISO: string, lang: string) {
  return `${CACHE_PREFIX}${dateISO}:${lang}`;
}
function endpoint(dateISO: string, lang: string) {
  // 네가 가능한 형태: 날짜+언어로 전체(모든 국가) 번역된 이벤트 반환
  return `https://your.api/events?date=${dateISO}&lang=${lang}`;
}

export async function getDay(dateISO: string, lang: string) {
  const key = cacheKey(dateISO, lang);
  const cached = await AsyncStorage.getItem(key);
  const parsed: DayPayload | null = cached ? JSON.parse(cached) : null;

  // 캐시 즉시 사용 + 백그라운드 재검증
  revalidate(dateISO, lang, key).catch(() => {});
  return parsed; // null이면 화면에서 스피너
}

async function revalidate(dateISO: string, lang: string, key: string) {
  const res = await fetch(endpoint(dateISO, lang), { cache: "no-store" });
  if (!res.ok) return;
  const fresh: DayPayload = await res.json();

  // 1) 국가지도 인덱스 미리 생성해서 저장 (클라 필터 O(1))
  const byCountry: Record<string, number[]> = {};
  for (let i = 0; i < fresh.items.length; i++) {
    const c = fresh.items[i].country;
    (byCountry[c] ??= []).push(i);
  }

  // 2) 저장 포맷: 원본 + 인덱스
  const pack = { ...fresh, __indexByCountry: byCountry };
  await AsyncStorage.setItem(key, JSON.stringify(pack));
}
