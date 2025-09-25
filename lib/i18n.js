import { useState, useContext, createContext } from "react";

const LangContext = createContext();

export function LangProvider({ children }) {
  const [lang, setLang] = useState("ko");

  const dict = {
    ko: { share: "공유하기", copy: "복사됨", today: "오늘의 역사" },
    en: { share: "Share", copy: "Copied", today: "Today’s history" },
    ja: { share: "シェア", copy: "コピーされました", today: "今日の歴史" },
  };

  const t = (key) => dict[lang]?.[key] || key;

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useI18n() {
  return useContext(LangContext);
}
