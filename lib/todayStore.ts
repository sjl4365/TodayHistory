// lib/todayStore.ts
import { create } from "zustand";

export type Lang = "ko" | "en" | "ja" | "zh";

export type TodayItem = {
  id: string;
  year: string | number;

  // 나라 표시는 id로 저장하고, 라벨은 언어별로 보관
  countryId?: string; // ex) "usa" | "uk" | ...
  countryLabelByLang?: Partial<Record<Lang, string>>;

  // 본문도 언어별로 저장
  textByLang: Partial<Record<Lang, string>>;

  // 기존 호환: 혹시 홈에서 단일 텍스트만 오는 경우 대비
  text?: string;
  country?: string;
};

type TodayState = {
  items: TodayItem[];
  setItems: (items: TodayItem[]) => void;
  clear: () => void;
};

export const useTodayStore = create<TodayState>((set) => ({
  items: [],
  setItems: (items) => set({ items }),
  clear: () => set({ items: [] }),
}));
