// app/(tabs)/home.js
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import {
  ActivityIndicator,
  Text,
  View,
  Pressable,
  ScrollView,
  useWindowDimensions,
  Platform,
  InteractionManager,
  Image as RNImage,
  StyleSheet,
  StatusBar,
  Linking,
  RefreshControl,
  Share as NativeShare,
  AppState,
  Modal,
  BackHandler,
  ToastAndroid,
  PanResponder,
  Animated,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  onRefresh,
  onGoPrevDay,
  onGoNextDay,
  onShareAttach,
} from "../../lib/bus";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import * as Localization from "expo-localization";
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Stack } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import {
  initAmplitude,
  trackEvent,
  setUserProperties,
  AMPLITUDE_EVENTS,
} from "../../lib/amplitude";
import {
  scheduleDailyAt,
  cancelAllScheduled,
} from "./settings/notification";
import { fetchHistory } from "../../api/history";
import { fetchWikipediaImageFromAnchors } from "../../lib/wikipediaSearch";
import { fetchImageForContent } from "../../lib/googleSearch";
import { getLocalHistory } from "../../lib/localHistory";
import { Image as ExpoImage } from "expo-image";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { WebView } from "react-native-webview";
import mobileAds, {
  BannerAd,
  BannerAdSize,
  TestIds,
  RewardedAd,
  RewardedAdEventType,
  AdEventType,
} from "react-native-google-mobile-ads";
import { BlurView } from "expo-blur";
import * as Notifications from 'expo-notifications';

// mobileAds()
//   .initialize()
//   .then(() => {
//     console.log('[AD] mobileAds initialized');
//   });

// 콘솔
if (__DEV__) {
  const ignore = ["Amplitude Logger", "ENOENT", "InternalBytecode.js"];
  const _e = console.error;
  const _w = console.warn;
  console.error = (...a) =>
    ignore.some((t) => a.join(" ").includes(t)) ? undefined : _e(...a);
  console.warn = (...a) =>
    ignore.some((t) => a.join(" ").includes(t)) ? undefined : _w(...a);
}

// 상수
const STORAGE_KEY_SELECTED = "selectedCountries";
const STORAGE_KEY_UI_LANG = "@app_language";
const STORAGE_KEY_FONT = "@app_font";
const STORAGE_KEY_FONT_SIZE = "@app_font_size";
const STORAGE_KEY_FONT_COLOR = "@app_font_color";
const STORAGE_KEY_BG_COLOR = "@app_bg_color";
const STORAGE_KEY_BG_IMAGE = "@app_bg_image";
const STORAGE_KEY_NOTIFY_ENABLED = "@notify_enabled";
const STORAGE_KEY_NOTIFY_TIME = "@notify_time";
const STORAGE_KEY_CARD_BG = "@card_bg"; // "bg1" | "bg2" | "bg3" | "none"
const STORAGE_KEY_NOTIFY_TITLE = "@notification_title";
const STORAGE_KEY_NOTIFY_BODY = "@notification_body";
const STORAGE_KEY_SEEN_PREFIX = "@seen_events_v1:";

const STORAGE_KEY_YEAR_ROT_INDEX = "@year_rot_idx_v1:";

// 데이터 캐시 TTL (6시간)
const DATA_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const DATA_CACHE_VERSION = "v5";

// 리워드 광고 시청 후 12시간 패스
const STORAGE_KEY_REWARD_PASS_UNTIL = "@reward_pass_until_v1";
const REWARD_PASS_DURATION_MS = 12 * 60 * 60 * 1000; // 12시간


const COUNTRY_CFG = {
  korea: {
    id: "korea",
    label: { ko: "한국", en: "Korea", ja: "韓国", zh: "韩国" },
    lang: "ko",
  },
  japan: {
    id: "japan",
    label: { ko: "일본", en: "Japan", ja: "日本", zh: "日本" },
    lang: "ja",
  },
  world: {
    id: "world",
    label: { ko: "세계", en: "World", ja: "世界", zh: "世界" },
    lang: "en",
  },
  china: {
    id: "china",
    label: { ko: "중국", en: "China", ja: "中国", zh: "中国" },
    lang: "sc",
  },
};


const DEFAULT_COUNTRIES_BY_LANG = {
  en: ["world"],
  ko: ["korea"],
  ja: ["japan"],
  default: ["world"],
};

const APP_NAME_BY_LANG = {
  ko: "Histree",
  en: "Histree",
  ja: "Histree",
  sc: "Histree",
  tc: "Histree",
};

const FIELD_LABELS = {
  ko: { location: "위치", date: "날짜" },
  en: { location: "Location", date: "Date" },
  ja: { location: "場所", date: "日付" },
  sc: { location: "位置", date: "日期" },
  tc: { location: "位置", date: "日期" },
};

const APP_DOWNLOAD_URL = "https://example.com/today-in-history";

const UI_STR = {
  title: {
    ko: {
      prev: "어제의 역사",
      today: "오늘의 역사",
      next: "내일의 역사",
    },
    en: {
      prev: "Yesterday in History",
      today: "Today in History",
      next: "Tomorrow in History",
    },
    ja: {
      prev: "昨日の歴史",
      today: "今日の歴史",
      next: "明日の歴史",
    },
    sc: {
      prev: "历史上的昨天",
      today: "历史上的今天",
      next: "历史上的明天",
    },
    tc: {
      prev: "歷史上的昨天",
      today: "歷史上的今天",
      next: "歷史上的明天",
    },
  },
  yearTitle: {
    ko: {
      base: "연도별 역사",
      prev: "지난해 연도별 역사",
      next: "다음해 연도별 역사",
    },
    en: {
      base: "Year in History",
      prev: "Previous Year in History",
      next: "Next Year in History",
    },
    ja: {
      base: "年の歴史",
      prev: "前年の歴史",
      next: "翌年の歴史",
    },
    sc: {
      base: "这一年的历史",
      prev: "上一年的历史",
      next: "下一年的历史",
    },
    tc: {
      base: "這一年的歷史",
      prev: "上一年的歷史",
      next: "下一年的歷史",
    },
  },
  empty: {
    ko: "표시할 항목이 없습니다.",
    en: "No items to display.",
    ja: "表示する項目がありません。",
    sc: "没有可显示的内容。",
    tc: "沒有可顯示的內容。",
  },
  imageLoading: {
    ko: "사진을 불러오는 중입니다…",
    en: "Loading image…",
    ja: "画像を読み込み中…",
    sc: "正在加载图片…",
    tc: "正在載入圖片…",
  },
  yearLimitDone: {
    ko: "오늘 볼 수 있는 역사 이벤트를 모두 보셨습니다.\n지금까지 본 12개를 순서대로 다시 볼 수 있어요.",
    en: "You’ve seen all history events available for today.\nYou can now browse again through the 12 events you’ve already viewed.",
    ja: "本日見られる歴史イベントはすべて見ました。\nこれまでに見た12件を順番にもう一度見ることができます。",
    sc: "今天可以查看的历史事件都已经看完了。\n现在可以按顺序再次浏览这 12 条内容。",
    tc: "今天可以查看的歷史事件都已經看完了。\n現在可以依序再次瀏覽這 12 則內容。",
  },
};



const AD_MODAL_TEXT = {
  en: {
    title: "Use the history of yesterday and tomorrow",
    description:
      "Watch an ad to use “Yesterday & Tomorrow History” without video ads for the next 12 hours.",
    badge: "Enjoy all features · No ads",
    cta: "Watch Ad for Free Access",
  },
  ko: {
    title: "어제와 내일의 역사 사용",
    description:
      "광고를 시청하면, ‘어제와 내일의 역사’를 12시간 동안 동영상 광고 없이 자유롭게 이용할 수 있습니다.",
    badge: "모든 기능 이용 · 광고 없음",
    cta: "광고 보고 무료 이용",
  },
  ja: {
    title: "昨日と明日の歴史を利用",
    description:
      "広告を視聴すると、「昨日と明日の歴史」を12時間、動画広告なしで自由に利用できます。",
    badge: "全機能利用 · 広告なし",
    cta: "広告視聴で無料利用",
  },
  sc: {
    title: "使用“昨日与明日的历史”",
    description:
      "观看一则广告，即可在接下来的12小时内无视频广告地使用“Yesterday & Tomorrow History”功能。",
    badge: "全部功能 · 无广告",
    cta: "看广告免费使用",
  },
  tc: {
    title: "使用「昨日與明日的歷史」",
    description:
      "觀看一則廣告，即可在接下來的12小時內無視訊廣告地使用「Yesterday & Tomorrow History」功能。",
    badge: "全部功能 · 無廣告",
    cta: "看廣告免費使用",
  },
  es: {
    title: "Usar la historia de ayer y de mañana.",
    description:
      "Mira un anuncio para usar “Yesterday & Tomorrow History” sin anuncios de vídeo durante las próximas 12 horas.",
    badge: "Todas las funciones · Sin anuncios",
    cta: "Uso gratuito al ver un anuncio",
  },
  fr: {
    title: "Utiliser l’histoire d’hier et de demain.",
    description:
      "Regardez une annonce pour utiliser « Yesterday & Tomorrow History » sans publicité vidéo pendant les 12 prochaines heures.",
    badge: "Toutes les fonctions · Sans pub",
    cta: "Usage gratuit après publicité",
  },
};

const AD_YEAR_MODAL_TEXT = {
  en: {
    title: "See more history events",
    description:
      "Watch an ad to see more history events, without video ads, for the next 12 hours.",
    badge: "More events · Fewer ads",
    cta: "Watch Ad for Free Access",
  },
  ko: {
    title: "더 많은 역사 이벤트 보기",
    description:
      "광고를 시청하면 다음 12시간 동안 동영상 광고 없이 더 많은 역사 이벤트를 볼 수 있습니다.",
    badge: "더 많은 이벤트 · 광고 없음",
    cta: "광고 보고 무료 이용",
  },
  ja: {
    title: "より多くの歴史イベントを見る",
    description:
      "広告を視聴すると、次の12時間は動画広告なしで、より多くの歴史イベントを見ることができます。",
    badge: "イベント追加 · 広告なし",
    cta: "広告視聴で無料利用",
  },
  sc: {
    title: "查看更多历史事件",
    description:
      "观看广告后，接下来的12小时内即可在无视频广告的情况下查看更多历史事件。",
    badge: "更多事件 · 无广告",
    cta: "看广告免费使用",
  },
  tc: {
    title: "查看更多歷史事件",
    description:
      "觀看廣告後，接下來的12小時內即可在無影片廣告的情況下查看更多歷史事件。",
    badge: "更多事件 · 無廣告",
    cta: "看廣告免費使用",
  },
  es: {
    title: "Ver más eventos históricos",
    description:
      "Al ver un anuncio, podrás ver más eventos históricos sin anuncios de video durante las próximas 12 horas.",
    badge: "Más eventos · Sin anuncios",
    cta: "Uso gratuito al ver un anuncio",
  },
  fr: {
    title: "Voir plus d’événements historiques",
    description:
      "En regardant une publicité, vous pouvez consulter davantage d’événements historiques sans publicités vidéo pendant les 12 prochaines heures.",
    badge: "Plus d’événements · Sans pub",
    cta: "Usage gratuit après publicité",
  },
};




const SOURCE_LABEL = { ko: "출처", en: "Source", ja: "出典" };
const LOCALE_BY_LANG = {
  ko: "ko",
  en: "en",
  ja: "ja",
  sc: "zh-Hans",
  tc: "zh-Hant",
};
const UI_COL = { ko: "한국어", en: "English", ja: "日本語", zh: "中文" };
const NATIVE_COL_BY_COUNTRY = {
  korea: "한국어",
  japan: "日本語",
  world: "English",
  china: ["sc", "tc"],
};

const LABEL_BY_ID = {
  world: COUNTRY_CFG.world.label,
  korea: COUNTRY_CFG.korea.label,
  japan: COUNTRY_CFG.japan.label,
  china: COUNTRY_CFG.china.label,
};

const FLAG_ICON = {
  world: require("../../assets/flag/world.png"),
  korea: require("../../assets/flag/korea.png"),
  japan: require("../../assets/flag/japan.png"),
  china: require("../../assets/flag/china.png"),
};

// 나라별 헤더 배경 이미지 (각 7장씩)
const HERO_BG_IMAGES = {
  korea: [
    require("../../assets/bg-images/k-photo1.jpg"),
    require("../../assets/bg-images/k-photo2.jpg"),
    require("../../assets/bg-images/k-photo3.jpg"),
    require("../../assets/bg-images/k-photo4.jpg"),
    require("../../assets/bg-images/k-photo5.jpg"),
    require("../../assets/bg-images/k-photo6.jpg"),
    require("../../assets/bg-images/k-photo7.jpg"),
  ],
  japan: [
    require("../../assets/bg-images/j-photo1.jpg"),
    require("../../assets/bg-images/j-photo2.jpg"),
    require("../../assets/bg-images/j-photo3.jpg"),
    require("../../assets/bg-images/j-photo4.jpg"),
    require("../../assets/bg-images/j-photo5.jpg"),
    require("../../assets/bg-images/j-photo6.jpg"),
    require("../../assets/bg-images/j-photo7.jpg"),
  ],
  world: [
    require("../../assets/bg-images/uk-photo1.jpg"),
    require("../../assets/bg-images/uk-photo2.jpg"),
    require("../../assets/bg-images/uk-photo3.jpg"),
    require("../../assets/bg-images/uk-photo4.jpg"),
    require("../../assets/bg-images/uk-photo5.jpg"),
    require("../../assets/bg-images/uk-photo6.jpg"),
    require("../../assets/bg-images/uk-photo7.jpg"),
  ],
  china: [
    require("../../assets/bg-images/c-photo1.jpg"),
    require("../../assets/bg-images/c-photo2.jpg"),
    require("../../assets/bg-images/c-photo3.jpg"),
    require("../../assets/bg-images/c-photo4.jpg"),
    require("../../assets/bg-images/c-photo5.jpg"),
    require("../../assets/bg-images/c-photo6.jpg"),
    require("../../assets/bg-images/c-photo7.jpg"),
  ],
};

const DEFAULT_HERO_BG = require("../../assets/bg-images/k-photo1.jpg");
function getWeekdayIndexInTz(date, tz) {
  try {
    const wd = new Intl.DateTimeFormat("en-US", {
      timeZone: safeTimeZone(tz),
      weekday: "short",
    }).format(date);

    const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return map[wd] ?? date.getDay();
  } catch {
    return date.getDay(); // fallback
  }
}


const AD_RATIO = 3.2;
const AD_TARGET = { w: 320, h: 100 };
const ENABLE_BOTTOM_BANNER = true;

const REWARDED_AD_UNIT_ID = __DEV__
  ? TestIds.REWARDED
  : Platform.select({
    android: "ca-app-pub-3940256099942544/5224354917",
    ios: "ca-app-pub-3940256099942544/1712485313",
  });

// 전역 보상형 광고 인스턴스
const rewardedAd = RewardedAd.createForAdRequest(REWARDED_AD_UNIT_ID, {
  requestNonPersonalizedAdsOnly: true,
});

// 날짜 시간
function safeTimeZone(tzCandidate) {
  const tz = String(tzCandidate || "");
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz }).format(0);
    return tz;
  } catch {
    return "UTC";
  }
}

const SUPPORTED_LOCALES = new Set(["en", "ko", "ja", "zh-Hans", "zh-Hant"]);

function safeLocale(localeCandidate) {
  const lc = String(localeCandidate || "en");
  return SUPPORTED_LOCALES.has(lc) ? lc : "en";
}

function safeToLocaleDateString(date, locale, opts = {}) {
  try {
    const tz = safeTimeZone(opts.timeZone);
    return date.toLocaleDateString(safeLocale(locale), {
      ...opts,
      timeZone: tz,
    });
  } catch {
    try {
      return date.toLocaleDateString("en");
    } catch {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(date.getDate()).padStart(2, "0")}`;
    }
  }
}

function safeFormatParts(date, tz) {
  // date를 무조건 유효한 Date로 정규화
  let d = date;

  // Date 인스턴스가 아니면 한 번 감싸보기
  if (!(d instanceof Date)) {
    d = new Date(d);
  }

  // 그래도 Invalid Date면 현재 시간으로 대체
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) {
    d = new Date();
  }

  // 실제 formatToParts 호출
  try {
    const dtf = new Intl.DateTimeFormat("en-CA", {
      timeZone: safeTimeZone(tz),
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return dtf
      .formatToParts(d)  // 항상 유효한 Date만 들어감
      .reduce((a, p) => {
        if (p.type !== "literal") a[p.type] = p.value;
        return a;
      }, {});
  } catch {
    const dtf = new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return dtf
      .formatToParts(d)
      .reduce((a, p) => {
        if (p.type !== "literal") a[p.type] = p.value;
        return a;
      }, {});
  }
}


// 유틸
function resolveUiLangFromDevice() {
  try {
    const locales = Localization.getLocales?.();
    if (Array.isArray(locales) && locales.length > 0) {
      const code = String(locales[0].languageCode || "").toLowerCase();
      if (code === "ko") return "ko";
      if (code === "ja") return "ja";
      if (code === "en") return "en";
      if (code === "zh") return "sc"; // 기본은 간체
      return "en";
    }
  } catch (e) {
    console.log("[LOCALIZATION] getLocales error:", e);
  }

  const raw = Localization.locale || "en";
  const tag = String(raw).toLowerCase();
  const base = tag.split(/[-_]/)[0];

  if (base === "ko") return "ko";
  if (base === "ja") return "ja";
  if (base === "en") return "en";
  if (base === "zh") return "sc";
  return "en";
}



function normalizeUiLang(value, fallback = "en") {
  const v = String(value || "").toLowerCase();
  if (!v) return fallback;

  const code = v.split(/[-_]/)[0];

  if (code === "ko") return "ko";
  if (code === "ja") return "ja";
  if (code === "en") return "en";

  // 중국어: 기본은 간체(sc), 사용자가 tc 저장하면 그대로 tc 유지
  if (code === "sc") return "sc";
  if (code === "tc") return "tc";
  if (code === "zh") return "sc"; // 장치 언어 zh → 간체로 매핑

  return fallback;
}



function startOfDayInTz(base = new Date(), tz = "UTC") {
  const parts = safeFormatParts(base, tz);
  const y = parts.year || "1970";
  const m = parts.month || "01";
  const d = parts.day || "01";

  const result = new Date(`${y}-${m}-${d}T00:00:00`);

  // 혹시라도 여전히 Invalid Date면 그냥 현재 날짜 리턴
  if (!(result instanceof Date) || isNaN(result.getTime())) {
    return new Date();
  }
  return result;
}


function getDayPartsFrom(date, tz) {
  const parts = safeFormatParts(date, tz);
  return {
    md: `${parts.month}-${parts.day}`,
    dcode: `D${parts.month}${parts.day}`,
    y: parts.year,
    year: parts.year,    // ⭐ 추가
    m: parts.month,      // ⭐ 추가
    month: parts.month,  // ⭐ 기존 유지
    d: parts.day,        // ⭐ 추가
    day: parts.day,      // ⭐ 기존 유지
  };
}

const trimHtml = (s) => String(s || "").replace(/<[^>]+>/g, "").trim();
const hasAnyText = (t) =>
  String(t || "").replace(/\s+/g, " ").trim().length > 0;

function pickFirstNonEmpty(raw, keys) {
  for (const k of keys) {
    if (!k) continue;
    const v = raw?.[k];
    const s = String(v ?? "").replace(/<[^>]+>/g, "").trim();
    if (s) return s;
  }
  return "";
}

function bodyOfRowByLang(raw, uiLang, cid) {
  const base = String(uiLang || "en").split(/[-_]/)[0];

  let order;

  if (base === "sc" || base === "tc" || base === "zh") {
    // 중국어 UI → 간체/번체 우선, 없으면 영어 → 한 → 일
    order = ["sc", "tc", "English", "한국어", "日本語"];
  } else if (base === "ko") {
    order = ["한국어", "English", "日本語", "sc", "tc"];
  } else if (base === "ja") {
    order = ["日本語", "English", "한국어", "sc", "tc"];
  } else {
    // 기본 영어
    order = ["English", "한국어", "日本語", "sc", "tc"];
  }

  return pickFirstNonEmpty(raw, order);
}


// 앵커(언어별, URL 없으면 제외)
function getAnchorsForLang(row, lang) {
  const colMap = {
    en: [
      { t: "Anchor_text1_english", u: "URL1_english" },
      { t: "Anchor_text2_english", u: "URL2_english" },
    ],
    ko: [
      { t: "Anchor_text1_korean", u: "URL1_korean" },
      { t: "Anchor_text2_korean", u: "URL2_korean" },
    ],
    ja: [
      { t: "Anchor_text1_japanese", u: "URL1_japanese" },
      { t: "Anchor_text2_japanese", u: "URL2_japanese" },
    ],
    sc: [
      { t: "Anchor_text1_sc", u: "URL1_sc" },
      { t: "Anchor_text2_sc", u: "URL2_sc" },
    ],
    tc: [
      { t: "Anchor_text1_tc", u: "URL1_tc" },
      { t: "Anchor_text2_tc", u: "URL2_tc" },
    ],
  };

  const out = [];
  const seen = new Set();

  // 1) row.scAnchors / row.tcAnchors / row.enAnchors 등 우선 사용
  const byArr = (row?.[`${lang}Anchors`] || [])
    .map((a) => ({
      text: String(a?.text || "").trim(),
      url: String(a?.url || "").trim(),
    }))
    .filter((a) => a.text);

  for (const a of byArr) {
    const k = `${a.text}__${a.url}`;
    if (!seen.has(k)) {
      seen.add(k);
      out.push(a);
    }
  }

  // 2) 시트의 Anchor_text1_sc / URL1_sc ... 보강
  for (const { t, u } of colMap[lang] || []) {
    const a = {
      text: String(row?.[t] || "").trim(),
      url: String(row?.[u] || "").trim(),
    };
    if (a.text && a.url) {
      const k = `${a.text}__${a.url}`;
      if (!seen.has(k)) {
        seen.add(k);
        out.push(a);
      }
    }
  }

  return out;
}

function getMonthDayOnly(baseDate, uiLang, tz) {
  return safeToLocaleDateString(
    baseDate,
    LOCALE_BY_LANG[uiLang] || "en",
    { month: "long", day: "numeric", timeZone: tz }
  );
}

function getYearRandomRank(yearStr, isoDate) {
  const y = String(yearStr || "").trim() || "0";
  // isoDate(YYYY-MM-DD) + 연도 기준으로 날짜마다 고정된 랜덤값
  const rnd = xorshift(hash32(`yrank:${isoDate}:${y}`));
  return rnd(); // 0 ~ 1 사이
}

function buildYearOrder(allItems, isoDate) {
  if (!allItems.length) return [];

  const withRank = allItems.map((it) => {
    const yStr = getYearFromRow(it.row);
    const rank = getYearRandomRank(yStr, isoDate);
    return {
      ...it,
      yearKey: yStr || "0",
      rank,
    };
  });

  // rank 기준으로 오름차순 (연도 숫자순이 아니라 랜덤순)
  withRank.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    if (a.yearKey !== b.yearKey)
      return String(a.yearKey).localeCompare(String(b.yearKey));
    return String(a.key).localeCompare(String(b.key));
  });

  return withRank.map((it) => it.key);
}

async function pickByYearRotation(poolsByCid, chosenIds, isoDate) {
  const all = [];
  for (const cid of chosenIds) {
    const arr = poolsByCid[cid] || [];
    for (const it of arr) {
      all.push(it); // { cid, row, key, body }
    }
  }
  if (!all.length) return null;

  // 여기서 "랜덤 연도 순서" (고정된 랜덤) 배열 생성
  const order = buildYearOrder(all, isoDate);
  if (!order.length) return null;

  const idxKey = `${STORAGE_KEY_YEAR_ROT_INDEX}${isoDate}`;
  let rawIdx = null;
  try {
    rawIdx = await AsyncStorage.getItem(idxKey);
  } catch { }
  let curIdx = parseInt(rawIdx || "0", 10);
  if (Number.isNaN(curIdx) || curIdx < 0) curIdx = 0;

  // 현재 인덱스에 해당하는 key 선택
  const pickKey = order[curIdx % order.length];

  let pick = all.find((it) => it.key === pickKey);
  if (!pick) {
    pick = all[0];
  }

  const nextIdx = (curIdx + 1) % order.length;
  try {
    await AsyncStorage.setItem(idxKey, String(nextIdx));
  } catch { }

  return pick;
}


function getYearFromRow(row) {
  const fromField = String(row?.Year || row?.year || "").trim();
  if (fromField) return fromField;

  const dateStrs = [
    row?.isoDate,
    row?.dateISO,
    row?.dateString,
    row?.Date,
    row?.date,
    row?.__DATE,
  ].map((v) => String(v || ""));

  for (const s of dateStrs) {
    const m =
      s.match(/^(\d{4})[-/](\d{2})[-/](\d{2})/) ||
      s.match(/^(\d{4})/);
    if (m) return m[1];
  }
  return "";
}

function equalSets(a, b) {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

// 나라+날짜 기준 헤더 배경 선택 (7장 순환)
function pickDailyHeroBg(cid, date, tz) {
  const list = HERO_BG_IMAGES[cid];
  if (!list || !list.length) return DEFAULT_HERO_BG;
  const dayIndex = getWeekdayIndexInTz(date, tz); // 0~6
  return list[dayIndex % list.length];
}

// 난수
function hash32(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return (h || 1) >>> 0;
}

function xorshift(seed) {
  let x = seed >>> 0;
  return () => {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x >>>= 0;
    x ^= x << 5;
    x >>>= 0;
    return (x >>> 0) / 0xffffffff;
  };
}

// 전체 pool 랜덤 1개 (백업용)
function makePicksFromPool(pool, _uiLang, stableKey) {
  if (!pool.length) return [];
  const rnd = xorshift(hash32(stableKey));
  return [pool[Math.floor(rnd() * pool.length)]];
}

// 선택된 나라들 사이에서 공평하게 1개 (진짜 랜덤)
function makeFairSinglePickFromPools(poolsByCid, chosenIds, _seed) {
  const availableCids = chosenIds.filter(
    (cid) => poolsByCid[cid] && poolsByCid[cid].length
  );
  if (!availableCids.length) return [];

  // 1) 나라 랜덤 선택
  const cid =
    availableCids[Math.floor(Math.random() * availableCids.length)];

  // 2) 그 나라 안에서 이벤트 랜덤 선택
  const arr = poolsByCid[cid];
  const idx = Math.floor(Math.random() * arr.length);

  return [arr[idx]];
}

function getSeenCountForCid(seenMap, cid, isoDate) {
  const bucketKey = `${STORAGE_KEY_SEEN_PREFIX}${cid}:${isoDate}`;
  const set = seenMap[bucketKey];
  return set ? set.size : 0;
}

function chooseFairAmong(candidates, effectivePools, seenMap, isoDate, seed) {
  if (!candidates || !candidates.length) return null;

  const metrics = candidates.map((cid) => ({
    cid,
    seen: getSeenCountForCid(seenMap, cid, isoDate),
  }));

  const minSeen = Math.min(...metrics.map((m) => m.seen));
  const best = metrics.filter((m) => m.seen === minSeen).map((m) => m.cid);

  if (best.length === 1) return best[0];

  const rnd = xorshift(
    hash32(`fair:${isoDate}:${seed || ""}`)
  );
  return best[Math.floor(rnd() * best.length)];
}

// 나라 패턴(세계 2번 + 한국/일본 1번, 한국/일본 1:1 등) 선택
async function pickCidByPattern(
  effectivePools,
  chosenIds,
  isoDate,
  seenMap,
  seed
) {
  // 지금 실제로 이벤트가 남아 있는 나라들만
  const activeCids = chosenIds.filter(
    (cid) => effectivePools[cid] && effectivePools[cid].length
  );
  if (!activeCids.length) return null;
  if (activeCids.length === 1) return activeCids[0];

  const hasWorld = activeCids.includes("world");
  const nonWorld = activeCids.filter((c) => c !== "world");

  // 패턴 step 저장용 키 (날짜 + 나라 조합 기준)
  const patternKey = `@country_pattern_v1:${isoDate}:${activeCids
    .slice()
    .sort()
    .join(",")}`;

  let step = 0;
  try {
    const raw = await AsyncStorage.getItem(patternKey);
    const n = parseInt(raw || "0", 10);
    if (!Number.isNaN(n) && n >= 0 && n < 3) {
      step = n;
    }
  } catch { }

  let chosenCid = null;
  let nextStep = step;

  // ① world가 아예 없거나, world 하나뿐인 경우 → 그냥 균등 분배
  if (!hasWorld || !nonWorld.length) {
    chosenCid = chooseFairAmong(
      activeCids,
      effectivePools,
      seenMap,
      isoDate,
      seed
    );
  }
  // ② world + (한국 또는 일본) 둘만 선택된 경우
  else if (nonWorld.length === 1) {
    const other = nonWorld[0];
    const slots = ["world", "world", other]; // 세계, 세계, 다른 나라

    let cur = step;
    for (let i = 0; i < 3; i++) {
      const target = slots[cur];
      if (effectivePools[target] && effectivePools[target].length) {
        chosenCid = target;
        nextStep = (cur + 1) % 3;
        break;
      }
      cur = (cur + 1) % 3;
    }

    if (!chosenCid) {
      // 둘 중 하나라도 남아 있으면 그걸 선택
      if (effectivePools["world"] && effectivePools["world"].length) {
        chosenCid = "world";
      } else {
        chosenCid = other;
      }
    }
  }
  // ③ world + 한국 + 일본 (또는 world + 여러 나라)인 경우
  else {
    const slots = ["world", "world", "nonWorld"]; // 세계, 세계, (한국/일본 중 하나)

    let cur = step;
    for (let i = 0; i < 5; i++) {
      const slot = slots[cur];

      if (slot === "world") {
        if (effectivePools["world"] && effectivePools["world"].length) {
          chosenCid = "world";
          nextStep = (cur + 1) % 3;
          break;
        }
      } else {
        const availNonWorld = nonWorld.filter(
          (cid) => effectivePools[cid] && effectivePools[cid].length
        );
        if (availNonWorld.length) {
          // 한국/일본 쪽은 서로 균등하게 돌려줌
          chosenCid = chooseFairAmong(
            availNonWorld,
            effectivePools,
            seenMap,
            isoDate,
            seed
          );
          nextStep = (cur + 1) % 3;
          break;
        }
      }

      cur = (cur + 1) % 3;
    }

    if (!chosenCid) {
      // 다 막히면 world 우선, 그마저도 없으면 전체 중 균등
      if (effectivePools["world"] && effectivePools["world"].length) {
        chosenCid = "world";
      } else {
        chosenCid = chooseFairAmong(
          activeCids,
          effectivePools,
          seenMap,
          isoDate,
          seed
        );
      }
    }
  }

  try {
    await AsyncStorage.setItem(patternKey, String(nextStep));
  } catch { }

  return chosenCid;
}


async function pickOneWithSeenRotation(
  poolsByCid,
  chosenIds,
  isoDate,
  seed
) {
  if (!chosenIds || !chosenIds.length) return null;

  const bucketKeys = chosenIds.map(
    (cid) => `${STORAGE_KEY_SEEN_PREFIX}${cid}:${isoDate}`
  );

  let pairs = [];
  try {
    pairs = await AsyncStorage.multiGet(bucketKeys);
  } catch {
    pairs = [];
  }

  const seenMap = {}; // bucketKey -> Set(keys)
  for (const [k, v] of pairs || []) {
    if (!k) continue;
    try {
      const arr = v ? JSON.parse(v) : [];
      seenMap[k] = new Set(Array.isArray(arr) ? arr : []);
    } catch {
      seenMap[k] = new Set();
    }
  }

  const unSeenPoolsByCid = {};
  let anyUnseen = false;

  // 아직 안 본 이벤트만 모으기
  for (const cid of chosenIds) {
    const pool = poolsByCid[cid] || [];
    if (!pool.length) continue;

    const bucketKey = `${STORAGE_KEY_SEEN_PREFIX}${cid}:${isoDate}`;
    const seenSet = seenMap[bucketKey] || new Set();

    const unSeen = pool.filter((p) => !seenSet.has(p.key));
    if (unSeen.length > 0) {
      anyUnseen = true;
      unSeenPoolsByCid[cid] = unSeen;
    }
  }

  let effectivePools = {};

  if (anyUnseen) {
    // 아직 안 본 것들만 후보
    effectivePools = unSeenPoolsByCid;
  } else {
    // 오늘 날짜 기준으로 한 바퀴 다 돌았으면 → seen 리셋하고 다시 시작
    for (const cid of chosenIds) {
      const bucketKey = `${STORAGE_KEY_SEEN_PREFIX}${cid}:${isoDate}`;
      seenMap[bucketKey] = new Set();
      try {
        await AsyncStorage.setItem(bucketKey, JSON.stringify([]));
      } catch { }
      const pool = poolsByCid[cid] || [];
      if (pool.length) {
        effectivePools[cid] = pool;
      }
    }
  }

  const activeCids = Object.keys(effectivePools);
  if (!activeCids.length) return null;

  // 여기서 나라 패턴(세계 2번 + 한국/일본 1번 등)을 적용해서
  // 어떤 나라에서 뽑을지 먼저 결정
  const cid = await pickCidByPattern(
    effectivePools,
    activeCids,
    isoDate,
    seenMap,
    seed
  );
  if (!cid) return null;

  const pool = effectivePools[cid];

  const bucketKey = `${STORAGE_KEY_SEEN_PREFIX}${cid}:${isoDate}`;
  const seenSet = seenMap[bucketKey] || new Set();

  // 같은 나라 안에서는 랜덤하게 골라주기 (하지만 한 번 뽑힌 건 seen에 기록됨)
  const rnd = xorshift(
    hash32(
      `pick:${isoDate}:${cid}:${seed || ""}:${seenSet.size}:${pool.length}`
    )
  );
  const idx = Math.floor(rnd() * pool.length);
  const pick = pool[idx];

  seenSet.add(pick.key);
  try {
    await AsyncStorage.setItem(
      bucketKey,
      JSON.stringify([...seenSet])
    );
  } catch { }

  return pick;
}


// function getHistoryTitle(uiLang, deltaDay) {
//   const t = UI_STR.title[uiLang] || UI_STR.title.en;
//   if (deltaDay < 0) return t.prev;
//   if (deltaDay > 0) return t.next;
//   return t.today;
// }

function getOnlyCountryId(selectedSet) {
  if (!selectedSet || !selectedSet.size) return null;
  const arr = [...selectedSet];
  return arr[0] || null;
}

function getHistoryTitle(
  uiLang,
  deltaDay,
  selectedCountries,
  yearDeltaForTitle
) {
  const lang = uiLang || "en";
  const t = UI_STR.title[lang] || UI_STR.title.en;

  // yearTitle은 문자열이던 예전형이랑, 지금처럼 객체형 둘 다 지원
  const yearRaw = UI_STR.yearTitle?.[lang] || UI_STR.yearTitle.en;
  const yearT =
    typeof yearRaw === "string"
      ? { base: yearRaw, prev: yearRaw, next: yearRaw }
      : yearRaw;

  const cid = getOnlyCountryId(selectedCountries);

  // world 는 기존처럼 어제/오늘/내일
  if (cid === "world") {
    if (deltaDay < 0) return t.prev;
    if (deltaDay > 0) return t.next;
    return t.today;
  }

  // 🇰🇷🇯🇵🇨🇳 연도 모드: 기준 연도/이전/다음
  if (typeof yearDeltaForTitle === "number") {
    if (yearDeltaForTitle < 0) return yearT.prev || yearT.base;
    if (yearDeltaForTitle > 0) return yearT.next || yearT.base;
  }

  // 기본: Year in History
  return yearT.base || yearRaw;
}




function ensureNonEmptySelection(inputSet, uiLang) {
  let s = new Set(inputSet || []);
  if (s.size === 0) {
    s = new Set(
      DEFAULT_COUNTRIES_BY_LANG[uiLang] ||
      DEFAULT_COUNTRIES_BY_LANG.default
    );
  }

  // china 허용
  const allow = new Set(["world", "korea", "japan", "china"]);
  for (const id of [...s]) if (!allow.has(id)) s.delete(id);

  if (s.size === 0) {
    s.add(
      (DEFAULT_COUNTRIES_BY_LANG[uiLang] ||
        DEFAULT_COUNTRIES_BY_LANG.default)[0]
    );
  }
  return s;
}


// 이미지로드
const RENDERABLE_EXT_RE = /\.(jpg|jpeg|png|webp)(\?.*)?$/i;

function sanitizeImageUrl(input) {
  if (!input) return null;
  try {
    const u = new URL(String(input));
    if (u.protocol === "http:") u.protocol = "https:";
    if (!RENDERABLE_EXT_RE.test(u.pathname)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

function toWikimediaThumb(input, width = 640) {
  try {
    if (!input) return null;
    const u = new URL(input);
    if (!/upload\.wikimedia\.org$/i.test(u.hostname)) return input;

    const parts = u.pathname.split("/").filter(Boolean);
    const isThumb = parts.includes("thumb");

    if (isThumb) {
      const fileName = parts[parts.length - 2];
      parts[parts.length - 1] = `${width}px-${fileName}`;
      u.pathname = "/" + parts.join("/");
      return u.toString();
    } else {
      const fileName = parts[parts.length - 1];
      const idx = parts.indexOf("wikipedia");
      if (idx === -1) return input;
      const head = parts.slice(0, idx + 2);
      const tail = parts.slice(idx + 2);
      u.pathname =
        "/" +
        [...head, "thumb", ...tail, `${width}px-${fileName}`].join(
          "/"
        );
      return u.toString();
    }
  } catch {
    return input;
  }
}

async function withTimeout(promise, ms = 6000) {
  let t;
  const timer = new Promise((_, rej) => {
    t = setTimeout(() => rej(new Error("timeout")), ms);
  });
  try {
    return await Promise.race([promise, timer]);
  } finally {
    clearTimeout(t);
  }
}

async function headOkImage(url, timeoutMs = 1500) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return false;
    const ct = (res.headers.get("content-type") || "")
      .toLowerCase();
    return ct.startsWith("image/");
  } catch {
    return false;
  }
}

async function bestWikiThumb(rawUrl, desiredPx = 640) {
  let u = sanitizeImageUrl(rawUrl);
  if (!u) return null;
  const t1 = sanitizeImageUrl(toWikimediaThumb(u, desiredPx));
  if (t1 && (await headOkImage(t1))) return t1;
  const t2 = sanitizeImageUrl(
    toWikimediaThumb(
      u,
      Math.max(320, Math.floor(desiredPx / 2))
    )
  );
  if (t2 && (await headOkImage(t2))) return t2;
  if (await headOkImage(u)) return u;
  return null;
}

// ui
function useUIScale() {
  const { width } = useWindowDimensions();
  const BASE = 393;
  const scale = (n) => Math.round((width / BASE) * n);
  return { scale, screenW: width };
}

//const FIXED_ORDER = ["world", "korea", "japan"];
function getCountryOrderByUiLang(uiLang) {
  const base = String(uiLang || "en").split(/[-_]/)[0];

  if (base === "en" || base === "ko") {
    return ["world", "korea", "china", "japan"];
  }

  if (base === "ja") {
    return ["world", "japan", "korea", "china"];
  }

  // 중국어 UI (sc/tc/zh 모두 포함)
  if (base === "sc" || base === "tc" || base === "zh") {
    return ["world", "china", "korea", "japan"];
  }

  return ["world", "korea", "china", "japan"];
}


// 색상 유효성 검사
function isValidColorString(s) {
  if (typeof s !== "string") return false;
  const v = s.trim();
  if (!v || v === "null" || v === "undefined") return false;
  if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v)) return true;
  if (
    /^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*(0|1|0?\.\d+))?\s*\)$/i.test(
      v
    )
  )
    return true;
  if (/^(white|black|transparent)$/i.test(v)) return true;
  return false;
}

// 나라 선택 UI
function SegmentedCountrySelector({
  uiLang,
  ordered,
  value,        // Set<string>
  onChange,
  fixedHeight = 38,
}) {
  const { scale } = useUIScale();

  // Big button spec
  const BIG_W = 323;
  const BIG_H = 37;
  const BIG_RADIUS = 80;

  // Small button spec
  const BTN_W = 78;
  const BTN_H = 38;
  const BTN_RADIUS = 100;
  const GAP = 4;

  const ICON = 16;

  const selectedId = value && value.size ? [...value][0] : null;

  const handlePress = (id) => {
    if (selectedId === id) return;
    onChange(new Set([id])); // 단일 선택 유지
  };

  const fontFamily = Platform.OS === "ios" ? "Arial" : "sans-serif";

  return (
    <View
      style={{
        width: scale(BIG_W),
        height: scale(BIG_H),
        borderRadius: BIG_RADIUS,
        overflow: "hidden",
        backgroundColor: "rgba(255,255,255,0.6)", // Fill FFFFFF 60%
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.5)",      // Stroke FFFFFF 50%

        // Drop shadow (x 0 y 4 blur 4, color 000 25%)
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 4,
        shadowOpacity: 0.25,
        elevation: 4,
      }}
    >
      {/* Background blur (15) */}
      <BlurView
        intensity={15}
        tint="light"
        style={StyleSheet.absoluteFillObject}
      />

      {/*  Small buttons row (가운데에 배치) */}
      <View
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: scale(GAP),
        }}
      >
        {ordered.slice(0, 4).map((id) => {
          const active = selectedId === id;

          const label =
            LABEL_BY_ID[id]?.[uiLang] ||
            LABEL_BY_ID[id]?.en ||
            id;

          return (
            <Pressable
              key={id}
              onPress={() => handlePress(id)}
              hitSlop={8}
              style={{
                width: scale(BTN_W),
                height: scale(BTN_H),
                borderRadius: BTN_RADIUS,
                justifyContent: "center",
                paddingLeft: scale(12),

                //  선택됐을 때만 "small button"이 떠야 함
                backgroundColor: active ? "#FFFFFF" : "transparent",

                // shadow / Elevation Level 3 (선택된 것만)
                ...(active
                  ? {
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 1 },
                    shadowRadius: 3,
                    shadowOpacity: 0.3,
                    elevation: 3,
                  }
                  : null),
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                {!!FLAG_ICON[id] && (
                  <RNImage
                    source={FLAG_ICON[id]}
                    style={{
                      width: scale(ICON),
                      height: scale(ICON),
                      marginRight: scale(6),
                    }}
                    resizeMode="contain"
                  />
                )}

                <Text
                  style={{
                    fontFamily,
                    fontSize: 13, // Arial 13
                    fontWeight: "600",
                    color: "#000",
                  }}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}



// WebView Modal Component
function WebViewModal({ visible, url, title, onClose }) {
  const { scale } = useUIScale();
  const insets = useSafeAreaInsets();
  const [adLoaded, setAdLoaded] = useState(false);
  const [bgColor, setBgColor] = useState('#FFFFFF');
  const [bgImage, setBgImage] = useState(null);

  useEffect(() => {
    if (visible && url) {
      setAdLoaded(false);
    }
  }, [visible, url]);

  useEffect(() => {
    loadBackgroundSettings();
  }, [visible]);

  const loadBackgroundSettings = async () => {
    try {
      const savedBgColor = await AsyncStorage.getItem('@app_bg_color');
      const savedBgImage = await AsyncStorage.getItem('@app_bg_image');
      
      if (savedBgImage) {
        setBgImage(savedBgImage);
      } else if (savedBgColor) {
        setBgColor(savedBgColor);
        setBgImage(null);
      }
    } catch (error) {
      console.error('Error loading background settings:', error);
    }
  };

  if (!visible || !url) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: bgImage ? 'transparent' : bgColor, paddingTop: insets.top }}>
        {/* Background Image (if set) */}
        {bgImage && (
          <RNImage
            source={{ uri: bgImage }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100%',
              height: '100%',
            }}
            resizeMode="cover"
          />
        )}

        {/* Header with Ad Banner - Centered */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 20,
            paddingVertical: 12,
            backgroundColor: bgImage ? 'rgba(255,255,255,0.9)' : bgColor,
            borderBottomWidth: 1,
            borderBottomColor: "#E5E7EB",
          }}
        >
          {/* Ad Banner (centered) */}
          <BannerAd
            unitId={TestIds.BANNER}
            size={BannerAdSize.BANNER}
            requestOptions={{
              requestNonPersonalizedAdsOnly: true,
            }}
            onAdLoaded={() => {
              console.log("[WEBVIEW AD] Ad loaded successfully");
              setAdLoaded(true);
            }}
            onAdFailedToLoad={(error) => {
              console.warn("[WEBVIEW AD] Failed to load:", error);
              setAdLoaded(true);
            }}
          />
        </View>

        {/* Page Title with close button on the left side*/}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingVertical: scale(12),
            paddingHorizontal: scale(16),
            backgroundColor: "#F9FAFB",
            borderBottomWidth: scale(1),
            borderBottomColor: "#E5E7EB",
          }}
        >
          {/* Close Button (left side) */}
          <Pressable
            onPress={onClose}
            hitSlop={10}
            style={{
              padding: scale(8),
              borderRadius: scale(20),
              backgroundColor: "#F3F4F6",
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "700", color: "#374151" }}>
              ✕
            </Text>
          </Pressable>

          {/* Page Title */}
          <Text
            style={{
              flex: 1,
              fontSize: scale(16),
              fontWeight: "600",
              color: "#111827",
              textAlign: "center",
              marginHorizontal: scale(12),
            }}
            numberOfLines={1}
          >
            {title || ""}
          </Text>

          {/* Empty space to balance the close button */}
          <View style={{ width: scale(8) + scale(16) }} />
        </View>

        {/* WebView */}
        <WebView
          source={{ uri: url }}
          style={{ flex: 1 }}
          startInLoadingState={true}
          renderLoading={() => (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
              <ActivityIndicator size="large" color="#3B82F6" />
            </View>
          )}
        />
      </View>
    </Modal>
  );
}

// 헤더 (assets만)
function HeaderHero({ height, bgSource, imageUrl, uiLang }) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <View
      style={{
        height,
        width: "100%",
        position: "relative",
        zIndex: 0,
      }}
    >
      <RNImage
        source={
          bgSource ||
          DEFAULT_HERO_BG
        }
        style={{
          width: "100%",
          height: "100%",
        }}
        resizeMode="cover"
        pointerEvents="none"
        onLoad={() => setImageLoaded(true)}
        onError={() => setImageFailed(true)}
      />
      {imageUrl && !imageLoaded && !imageFailed && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0,0,0,0.35)",
          }}
        >
          <ActivityIndicator color="#fff" />
          <Text
            style={{
              marginTop: 8,
              color: "#fff",
              fontWeight: "700",
            }}
          >
            {UI_STR.imageLoading[uiLang] ||
              UI_STR.imageLoading.en}
          </Text>
        </View>
      )}
      <View
        pointerEvents="none"
        style={{
          ...StyleSheet.absoluteFillObject,
          backgroundColor: "rgba(0,0,0,0.12)",
        }}
      />
    </View>
  );
}


function WikipediaBanner({
  imageUrl,
  maxWidth = 340,
  screenWidth,
  cardBg = "none",
  customBgColor = null,
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const [imageSize, setImageSize] = useState(null);
  const [displayUrl, setDisplayUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const prevImageUrlRef = useRef(null);


  // home.js (ImageBanner 컴포넌트 내부의 useEffect 훅)

  useEffect(() => {
    console.log('🖼️ [BANNER] Image URL changed:', { prev: prevImageUrlRef.current, new: imageUrl });

    if (!imageUrl) {
      // 이미지가 없는 경우 처리
      setDisplayUrl(null);
      setImageFailed(true);
      setLoading(false);
      prevImageUrlRef.current = null;
      return;
    }

    // 1. 기존 이미지 언마운트 및 로딩 인디케이터 즉시 표시
    // 이전 이미지가 화면에 남아있는 현상을 해결하기 위해 displayUrl을 null로 즉시 설정합니다.
    setDisplayUrl(null); // 👈 **기존 이미지를 뷰 계층에서 즉시 제거**
    setLoading(true); // 👈 **로딩 인디케이터 즉시 표시**
    setImageFailed(false);

    prevImageUrlRef.current = imageUrl;
    const targetUrl = imageUrl;

    // 2. 짧은 지연(50ms) 후 새 이미지 로드 프로세스 시작
    // 이 지연은 React Native가 이전 이미지의 언마운트와 로딩 상태를 화면에 완전히 반영할 
    // 시간을 주기 위함이며, InteractionManager의 예측 불가능한 긴 대기를 방지합니다.
    const timer = setTimeout(() => {
      // 대기 중에 URL이 다시 변경되었는지 확인하여 불필요한 작업 방지
      if (targetUrl !== prevImageUrlRef.current) return;

      // 새 이미지가 로드될 때 Fade-in 애니메이션을 위해 투명도를 0으로 초기화
      fadeAnim.setValue(0);

      // 기존 로직을 따라 RNImage.getSize 호출 및 displayUrl 설정
      if (Platform.OS === 'ios') {
        RNImage.getSize(
          targetUrl,
          (width, height) => {
            if (targetUrl !== prevImageUrlRef.current) return;
            setImageSize({ width, height });
            setDisplayUrl(targetUrl); // 👈 새로운 이미지 로드 시작
          },
          (error) => {
            if (targetUrl !== prevImageUrlRef.current) return;
            console.warn("Failed to get image size:", error);
            setImageFailed(true);
            setLoading(false);
          }
        );
      } else {
        // Android/Fallback
        setImageSize({ width: maxWidth, height: maxWidth * 0.6 });
        setDisplayUrl(targetUrl); // 👈 새로운 이미지 로드 시작
      }
    }, 50); // 50ms 지연 설정

    // 컴포넌트 정리(Cleanup) 함수: useEffect가 다시 실행되거나 컴포넌트가 언마운트될 때 setTimeout을 취소
    return () => clearTimeout(timer);

  }, [imageUrl, maxWidth, fadeAnim]);
  // ... (생략) ...

  const handleImageLoad = useCallback((e) => {
    console.log(' [BANNER] Image loaded');
    setLoading(false);

    // 🔹 이미지 로드 완료 후 페이드인
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    if (Platform.OS === 'android' && e?.source) {
      const { width, height } = e.source;
      if (width && height) {
        setImageSize({ width, height });
      }
    }
  }, [fadeAnim]);

  const handleImageError = useCallback((e) => {
    console.warn("❌ [BANNER] Image load error:", e?.nativeEvent);
    setImageFailed(true);
    setLoading(false);
  }, []);

  const BG_MAP = {
    none: "#FFFFFF",
    bg1: "#F9FAFB",
    bg2: "#FFF7ED",
    bg3: "#ECFEFF",
  };

  const bgColor = isValidColorString(customBgColor)
    ? customBgColor.trim()
    : BG_MAP[cardBg] ?? "#FFFFFF";

  // 이미지가 없거나 실패했을 때만 광고 표시
  if (!imageUrl || imageFailed) {
    return (
      <View
        style={{
          width: maxWidth,
          alignSelf: "center",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: bgColor,
          borderRadius: 12,
          padding: 12,
          marginVertical: 8,
        }}
      >
        <BannerAd
          unitId={TestIds.BANNER}
          size={BannerAdSize.MEDIUM_RECTANGLE}
          requestOptions={{
            requestNonPersonalizedAdsOnly: true,
          }}
        />
      </View>
    );
  }

  if (!imageSize || !displayUrl) {
    return (
      <View
        style={{
          width: maxWidth,
          height: 200,
          alignSelf: "center",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: bgColor,
          borderRadius: 12,
        }}
      >
        <ActivityIndicator size="small" color="#999" />
      </View>
    );
  }

  const { width: imgWidth, height: imgHeight } = imageSize;
  const aspectRatio = imgWidth / imgHeight;
  const isLandscape = aspectRatio > 1;

  if (isLandscape) {
    const displayWidth = screenWidth;
    const displayHeight = displayWidth / aspectRatio;

    return (
      <View style={{ position: 'relative' }}>
        {/* 로딩 인디케이터 오버레이 */}
        {loading && (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: bgColor,
              zIndex: 10,
            }}
          >
            <ActivityIndicator size="small" color="#999" />
          </View>
        )}

        {/* 🔹 이미지는 항상 렌더링 (opacity로 숨김) */}
        <ScrollView
          horizontal={false}
          showsVerticalScrollIndicator={true}
          style={{
            width: displayWidth,
            maxHeight: screenWidth * 1.2,
          }}
          contentContainerStyle={{
            alignItems: "center",
          }}
        >
          <Animated.View
            style={{
              width: displayWidth,
              height: displayHeight,
              backgroundColor: bgColor,
              opacity: fadeAnim, // 🔹 0에서 시작 → onLoad 후 1로
            }}
          >
            <ExpoImage
              key={displayUrl}
              source={{
                uri: displayUrl,
                headers: {
                  'User-Agent': 'Histree/1.0 (Educational History App)',
                  'Referer': 'https://en.wikipedia.org/',
                }
              }}
              style={{
                width: "100%",
                height: "100%",
              }}
              contentFit="contain"
              cachePolicy="disk"
              transition={0}
              onLoad={handleImageLoad}
              onError={handleImageError}
            />
          </Animated.View>
        </ScrollView>
      </View>
    );
  } else {
    const displayWidth = Math.min(maxWidth, imgWidth);
    const displayHeight = displayWidth / aspectRatio;

    return (
      <View style={{ position: 'relative' }}>
        {/* 🔹 로딩 인디케이터 오버레이 */}
        {loading && (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: bgColor,
              zIndex: 10,
              borderRadius: 12,
            }}
          >
            <ActivityIndicator size="small" color="#999" />
          </View>
        )}

        {/* 🔹 이미지는 항상 렌더링 (opacity로 숨김) */}
        <ScrollView
          horizontal={false}
          showsVerticalScrollIndicator={true}
          style={{
            width: displayWidth,
            maxHeight: maxWidth * 1.5,
            alignSelf: "center",
          }}
          contentContainerStyle={{
            alignItems: "center",
          }}
        >
          <Animated.View
            style={{
              width: displayWidth,
              height: displayHeight,
              borderRadius: 12,
              backgroundColor: bgColor,
              overflow: "hidden",
              opacity: fadeAnim, // 🔹 0에서 시작 → onLoad 후 1로
            }}
          >
            <ExpoImage
              key={displayUrl}
              source={{
                uri: displayUrl,
                headers: {
                  'User-Agent': 'Histree/1.0 (Educational History App)',
                  'Referer': 'https://en.wikipedia.org/',
                }
              }}
              style={{
                width: "100%",
                height: "100%",
              }}
              contentFit="contain"
              cachePolicy="disk"
              transition={0}
              onLoad={handleImageLoad}
              onError={handleImageError}
            />
          </Animated.View>
        </ScrollView>
      </View>
    );
  }
}

// 기타 UI
function FullBleedCard({
  children,
  topInset,
  cardBg,
  customBgColor,
  panHandlers,
  customBgImage,
}) {
  const BG_MAP = {
    none: "#FFFFFF",
    bg1: "#F9FAFB",
    bg2: "#FFF7ED",
    bg3: "#ECFEFF",
  };
  const bgColor = isValidColorString(customBgColor)
    ? customBgColor.trim()
    : BG_MAP[cardBg] ?? "#FFFFFF";

  return (
    <View
      {...(panHandlers || {})}
      style={{
        position: "absolute",
        top: topInset,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: customBgImage ? 'transparent' : bgColor,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: "hidden",
        zIndex: 1,
      }}
    >
      {customBgImage && (
        <RNImage
          source={{ uri: customBgImage }}
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
          }}
          resizeMode="cover"
        />
      )}
      {children}
    </View>
  );
}

function formatOnlyYearLabel(y, uiLang) {
  if (!y) return "";
  if (uiLang === "ko") return `${y}년`;
  if (uiLang === "ja") return `${y}年`;
  if (uiLang === "sc" || uiLang === "tc") return `${y}年`;
  return y;
}

function formatYearsAgo(diff, uiLang) {
  if (!diff || diff <= 0) return "";
  if (uiLang === "ko") return `(${diff}년 전)`;
  if (uiLang === "ja") return `(${diff}年前)`;
  if (uiLang === "sc" || uiLang === "tc") return `（${diff}年前）`;
  if (diff === 1) return "1 year ago";
  return `(${diff} yrs ago)`;
}


function formatEventDateLabel(eventYearRaw, todayParts, uiLang, tz) {
  const yStr = String(eventYearRaw || "").trim();
  const yearNum = parseInt(yStr, 10);

  const baseYear = parseInt(String(todayParts.y), 10);
  const mNum = parseInt(String(todayParts.m), 10) || 1;
  const dNum = parseInt(String(todayParts.d), 10) || 1;

  // 연도 없으면: 그냥 오늘 날짜를 locale 기반으로 표시
  if (!yearNum || Number.isNaN(yearNum)) {
    const baseDate = new Date(
      `${todayParts.y}-${todayParts.m}-${todayParts.d}T00:00:00`
    );
    return safeToLocaleDateString(
      baseDate,
      LOCALE_BY_LANG[uiLang] || "en",
      {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: tz,
      }
    );
  }

  const diff = !Number.isNaN(baseYear) ? baseYear - yearNum : 0;

  let dateStr;
  if (uiLang === "ko") {
    dateStr = `${yearNum}년 ${mNum}월 ${dNum}일`;
  } else if (uiLang === "ja") {
    dateStr = `${yearNum}年${mNum}月${dNum}日`;
  } else if (uiLang === "zh") {
    dateStr = `${yearNum}年${mNum}月${dNum}日`;
  } else {
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];
    const monthName = monthNames[mNum - 1] || String(mNum);
    dateStr = `${monthName} ${dNum}, ${yearNum}`;
  }

  const agoStr = formatYearsAgo(diff, uiLang);
  return agoStr ? `${dateStr} ${agoStr}` : dateStr;
}


// 캐시 
function cacheKey(mode, parts) {
  return `@hist_cache:${DATA_CACHE_VERSION}:${mode}:${String(parts.m).padStart(
    2,
    "0"
  )}${String(parts.d).padStart(2, "0")}`;
}


async function saveCache(mode, parts, rows) {
  const key = cacheKey(mode, parts);
  const payload = JSON.stringify({
    t: Date.now(),
    rows,
  });
  try {
    await AsyncStorage.setItem(key, payload);
  } catch { }
}

async function loadCache(mode, parts) {
  const key = cacheKey(mode, parts);
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj?.t || !Array.isArray(obj?.rows)) return null;
    if (Date.now() - obj.t > DATA_CACHE_TTL_MS) return null;
    return obj.rows;
  } catch {
    return null;
  }
}

function isSameDayItem(it, parts) {
  // year-only dataset (한/중/일): D0000이면 날짜와 무관하게 항상 포함
  const rawDates0 = [
    it.isoDate,
    it.dateISO,
    it.dateString,
    it.Date,
    it.date,
    it.__DATE,
  ].map((v) => String(v || "").trim());

  if (
    rawDates0.includes("D0000") ||
    rawDates0.includes("0000") ||
    rawDates0.includes("D00-00") ||
    rawDates0.includes("00-00")
  ) {
    return true;
  }

  const mm = String(parts.m).padStart(2, "0");
  const dd = String(parts.d).padStart(2, "0");
  const targetD = `D${mm}${dd}`;
  const targetSuffix = `${mm}-${dd}`;

  for (const s of rawDates0) {
    if (!s) continue;

    const m1 = s.match(/^D?(\d{2})(\d{2})$/);
    if (m1) {
      const [_, m, d] = m1;
      return m === mm && d === dd;
    }

    const m2 =
      s.match(/(\d{4})[-/](\d{2})[-/](\d{2})/) ||
      s.match(/(\d{2})[-/](\d{2})$/);
    if (m2) {
      const m = m2[m2.length - 2];
      const d = m2[m2.length - 1];
      return m === mm && d === dd;
    }

    if (s === targetD) return true;
    if (s.endsWith(targetSuffix)) return true;
  }

  return true; // 날짜 정보 없으면 통과(기존 유지)
}

function toAnchorArray(src) {
  if (!src) return [];
  if (Array.isArray(src)) return src;
  // 객체 한 개만 온 경우 [obj]로 묶어서 처리
  if (typeof src === "object") return [src];
  // 문자열 등 이상한 타입이면 버림
  return [];
}


// API/로컬 응답 정규화
// parts = { y, m, d }
// isoDate = "YYYY-MM-DD" (오늘/어제/내일 중 화면 날짜)
function normalizeItemsToRows(items, iso, parts) {
  const mm = String(parts.m).padStart(2, "0");
  const dd = String(parts.d).padStart(2, "0");
  const defaultDcode = `D${mm}${dd}`;

  const cleanAnchors = (arr) =>
    toAnchorArray(arr)
      .map((a) => ({
        text: String(a?.text || "").trim(),
        url: String(a?.url || "").trim(),
      }))
      .filter((a) => a.text); // url 없어도 text는 남김(원하면 a.text && a.url로)

  return (items || [])
    .filter((it) => isSameDayItem(it, parts))
    .map((it) => {
      const originalDate = String(it.date || it.Date || it.__DATE || "").trim();
      const dcode = originalDate === "D0000" ? "D0000" : defaultDcode;

      return {
        isoDate: iso,
        date: dcode,
        Date: dcode,

        Year: it.year ?? it.Year ?? "",
        year: it.year ?? it.Year ?? "",

        English: it.en || it.English || "",
        "한국어": it.ko || it["한국어"] || "",
        "日本語": it.ja || it["日本語"] || "",
        sc: it.sc || it.sc || "",
        tc: it.tc || it.tc || "",

        // 여기!
        enAnchors: cleanAnchors(it.enAnchors),
        koAnchors: cleanAnchors(it.koAnchors),
        jaAnchors: cleanAnchors(it.jaAnchors),
        scAnchors: cleanAnchors(it.scAnchors),
        tcAnchors: cleanAnchors(it.tcAnchors),
        esAnchors: cleanAnchors(it.esAnchors),
        frAnchors: cleanAnchors(it.frAnchors),
      };
    });
}

// API/로컬 응답 정규화
// parts = { y, m, d }
// isoDate = "YYYY-MM-DD" (오늘/어제/내일 중 화면 날짜)

async function apiFetchForMode(mode, todayParts, isoDate) {
  const iso =
    isoDate ||
    `${todayParts.y}-${String(todayParts.m).padStart(2, "0")}-${String(
      todayParts.d
    ).padStart(2, "0")}`;

  console.log("[apiFetchForMode] mode=", mode, "iso=", iso, "parts=", todayParts);

  // 로컬 JSON 먼저
  try {
    const localItems = getLocalHistory(mode, todayParts);

    console.log(
      "[LOCAL]",
      "mode=",
      mode,
      "len=",
      localItems?.length,
      "dcode=",
      `D${String(todayParts.m).padStart(2, "0")}${String(todayParts.d).padStart(2, "0")}`,
      "parts=",
      todayParts
    );

    if (Array.isArray(localItems) && localItems.length > 0) {
      return normalizeItemsToRows(localItems, iso, todayParts);
    }
  } catch (e) {
    console.warn("[LOCAL] getLocalHistory failed:", mode, e);
  }

  //없으면 원격(App Script) 호출
  try {
    const month = Number(todayParts.m); // 1~12

    const items = await withTimeout(
      fetchHistory({
        mode,      // "world" | "korea" | "japan"
        date: iso, //  오늘/어제/내일 중 화면 날짜
        month,     //  시트 선택용
        n: 20,
        shuffle: false,
      }),
      6000
    );

    const rows = normalizeItemsToRows(items || [], iso, todayParts);
    if (rows.length) return rows;
  } catch (e) {
    if (e?.name !== "AbortError") {
      console.warn("fetchHistory failed:", e);
    }
  }

  return [];
}





// 앵커 리스트 (pill 버튼 스타일)
function AnchorList({ anchors, onLinkPress, fontSize }) {
  if (!anchors || !anchors.length) return null;

  const FS = fontSize || 12; // 이미지: Arial bold 12
  const H = 24;              // 이미지: H24
  const R = 21;              // 이미지: Corner radius 21

  return (
    <View style={{ marginTop: 10, flexDirection: "row", flexWrap: "wrap" }}>
      {anchors.map((a, idx) => {
        const text = String(a?.text || "").trim();
        const url = String(a?.url || "").trim();
        if (!text || !url) return null;

        const onPress = () => {
          if (onLinkPress) onLinkPress(url, text);
          else Linking.openURL(url).catch(() => { });
        };

        return (
          <Pressable
            key={`${text}-${url}-${idx}`}
            onPress={onPress}
            accessibilityRole="link"
            hitSlop={6}
            style={{
              height: H,
              borderRadius: R,
              backgroundColor: "#242424",
              borderWidth: 1,
              borderColor: "#FFFFFF",
              paddingHorizontal: 12,
              alignItems: "center",
              justifyContent: "center",
              marginRight: 10,
              marginBottom: 10,
            }}
          >
            <Text
              style={{
                fontSize: FS,
                fontWeight: "700",
                color: "#FFFFFF",
                // iOS는 Arial, Android는 기본 sans-serif로 fallback
                fontFamily: Platform.OS === "ios" ? "Arial" : "sans-serif",
              }}
              numberOfLines={1}
            >
              {text}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}



// 배너 URL 캐시 키
const BANNER_KEY = (dateISO, cid) =>
  `@banner_url:${dateISO}:${cid}`;

// pick → 배너 URL 계산
async function computeBannerUrlForPick(pick, uiLang) {
  const nativeLang = COUNTRY_CFG[pick.cid]?.lang || "en";

  const anchorsText = getAnchorsForLang(
    pick.row,
    nativeLang
  )
    .map((a) => a.text)
    .filter(Boolean);

  let imageUrl = null;

  try {
    if (anchorsText.length) {
      imageUrl = await withTimeout(
        fetchWikipediaImageFromAnchors(
          anchorsText,
          nativeLang
        ),
        2500
      );
    }
  } catch { }

  if (!imageUrl) {
    const y = getYearFromRow(pick.row);
    // 원본 언어로 작성된 본문 사용
    const nativeBody = bodyOfRowByLang(pick.row, nativeLang, pick.cid);
    try {
      imageUrl = await withTimeout(
        fetchImageForContent(
          nativeBody || pick.body,
          y,
          pick.cid
        ),
        2500
      );
    } catch { }
  }

  if (imageUrl) {
    const best = await bestWikiThumb(imageUrl, 640);
    imageUrl = best || sanitizeImageUrl(imageUrl);
  }
  return imageUrl || null;
}

// 오늘 캐시 워밍
async function warmCacheAndBanner({
  date,
  tz,
  uiLang,
  selectedCountries,
}) {
  await warmCacheFor({
    date,
    tz,
    uiLang,
    selectedCountries,
  });

  const parts = getDayPartsFrom(date, tz);
  const chosen = [
    ...ensureNonEmptySelection(
      selectedCountries,
      uiLang
    ),
  ];

  const pool = [];
  for (const cid of chosen) {
    const rows = await loadCache(cid, parts);
    if (Array.isArray(rows)) {
      for (const r of rows) {
        const body = bodyOfRowByLang(r, uiLang, cid);
        if (!hasAnyText(body)) continue;
        const tag = trimHtml(
          r?.["한국어"] || r?.English || r?.["日本語"] || ""
        ).slice(0, 50);
        pool.push({
          cid,
          row: r,
          key: `${cid}|${String(r?.Year || r?.year || "")}|${String(
            r?.Date || r?.date || ""
          )}|${tag}`,
          body,
        });
      }
    }
  }

  if (pool.length) {
    const seed = `${date.toISOString().slice(0, 10)}__${chosen
      .sort()
      .join(",")}`;
    const pick = makePicksFromPool(pool, uiLang, seed)[0];

    // 나라별로 이미지 캐시
    const url = await computeBannerUrlForPick(pick, uiLang);
    try {
      await AsyncStorage.setItem(
        BANNER_KEY(
          date.toISOString().slice(0, 10),
          pick.cid  // 나라 ID로 저장
        ),
        url || ""
      );
    } catch { }
  }
}

// 자정 워밍(00:02)
function scheduleMidnightWarmup({
  tz,
  uiLang,
  selectedCountries,
}) {
  const now = new Date();
  const today0 = startOfDayInTz(now, tz);
  const tomorrow0 = new Date(today0);
  tomorrow0.setDate(today0.getDate() + 1);

  const target = new Date(tomorrow0);
  target.setMinutes(2, 0, 0);

  const delay = Math.max(
    0,
    target.getTime() - now.getTime()
  );

  const timer = setTimeout(async () => {
    try {
      await warmCacheAndBanner({
        date: target,
        tz,
        uiLang,
        selectedCountries,
      });
    } finally {
      scheduleMidnightWarmup({
        tz,
        uiLang,
        selectedCountries,
      });
    }
  }, delay);

  return () => clearTimeout(timer);
}

// 홈 화면
export default function Home() {



  // 연도 모드 시청 카운트 & 패스
  const [yearSeenGroups, setYearSeenGroups] = useState(0);
  const [yearAdUnlockedUntil, setYearAdUnlockedUntil] = useState(0);
  const [yearAdPromptVisible, setYearAdPromptVisible] = useState(false);
  const [notificationEventKey, setNotificationEventKey] = useState(null);

  // [수정] 초기 데이터 복원 (패스, 본 횟수, +보고 있던 연도)
  useEffect(() => {
    // 오늘 날짜 기준 isoDate
    const today = startOfDayInTz(new Date(), tz);
    const { y, m, d } = getDayPartsFrom(today, tz);
    const isoDate = `${y}-${m}-${d}`;

    (async () => {
      try {
        const [passRaw, seenRaw, cursorRaw] = await AsyncStorage.multiGet([
          STORAGE_KEY_YEAR_PASS_UNTIL,
          STORAGE_KEY_YEAR_SEEN_GROUPS,
          STORAGE_KEY_YEAR_CURSOR_SAVED, // [추가]
        ]);

        if (passRaw?.[1]) {
          const n = parseInt(passRaw[1], 10);
          if (!Number.isNaN(n)) setYearAdUnlockedUntil(n);
        }

        if (seenRaw?.[1]) {
          const obj = JSON.parse(seenRaw[1]);
          if (obj?.isoDate === isoDate && typeof obj.count === "number") {
            setYearSeenGroups(obj.count);
          }
        }

        // [추가] 보고 있던 연도 복원 (날짜가 같을 때만)
        if (cursorRaw?.[1]) {
          const obj = JSON.parse(cursorRaw[1]);
          if (obj?.isoDate === isoDate && obj.year) {
            setYearCursor(obj.year);
            // 네비게이션 기준점도 같이 잡아줘야 함
            baseYearRef.current = obj.year;
          }
        }
      } catch (e) {
        console.warn("[YEAR] restore failed", e);
      }
    })();
  }, [tz]);

  const YEAR_MAX_EVENTS_PER_COUNTRY = 12; // 총 12개 (무료 2개 + 광고 후 10개)


  const canSeeMoreYearEvents = useMemo(() => {
    if (!isYearMode) return false;

    const hasPass = yearAdUnlockedUntil && yearAdUnlockedUntil > Date.now();
    if (!yearYears || !yearYears.length) return false;

    // 1) 패스 없음: 무료 구간까지만
    if (!hasPass) {
      return yearSeenGroups < YEAR_FREE_REFRESH_LIMIT; // 0 → 1까지만
    }

    // 2) 패스 있음:
    //    yearSeenGroups 기준:
    //    0 → 1개, 1 → 2개(무료), 이후 광고 후 +10개 → 최대 12개
    //    => yearSeenGroups 11(=12개)까지 증가, 그 이상은 불가
    return yearSeenGroups < YEAR_MAX_EVENTS_PER_COUNTRY - 1;
  }, [isYearMode, yearAdUnlockedUntil, yearSeenGroups, yearYears]);

  // [추가] 연도가 바뀔 때마다 저장 (앱 강제종료 대비)
  useEffect(() => {
    if (!yearCursor) return;

    const today = startOfDayInTz(new Date(), tz);
    const { y, m, d } = getDayPartsFrom(today, tz);
    const isoDate = `${y}-${m}-${d}`;

    AsyncStorage.setItem(
      STORAGE_KEY_YEAR_CURSOR_SAVED,
      JSON.stringify({ isoDate, year: yearCursor })
    ).catch(() => { });
  }, [yearCursor, tz]);

  // [수정] 상수 확인 (반드시 1이어야 2개까지 무료)
  const YEAR_FREE_REFRESH_LIMIT = 1;

  const handlePressYearMore = useCallback(async () => {
    if (!isYearMode) return;

    // 더이상 볼 수 없는 상태면 바로 리턴
    if (yearSeenGroups >= YEAR_MAX_EVENTS_PER_COUNTRY - 1) {
      const msg =
        UI_STR.yearLimitDone[uiLang] || UI_STR.yearLimitDone.en;
      if (Platform.OS === "android" && ToastAndroid?.show) {
        ToastAndroid.show(msg, ToastAndroid.SHORT);
      } else {
        // iOS 등은 일단 alert 정도만
        alert(msg);
      }
      return;
    }

    const hasPass = yearAdUnlockedUntil && yearAdUnlockedUntil > Date.now();

    // 1) 패스 없음 + 무료 구간 남음 → 그냥 한 개 늘려줌
    if (!hasPass && yearSeenGroups < YEAR_FREE_REFRESH_LIMIT) {
      await showNextYearGroup();
      await updateYearSeenCount(yearSeenGroups + 1);
      return;
    }

    // 2) 패스 없음 + 무료 구간 끝 → 광고 모달 오픈
    if (!hasPass) {
      setShowYearAdModal(true);
      return;
    }

    // 3) 패스 있음 → 한 개 더 보여주고 count+1
    await showNextYearGroup();
    await updateYearSeenCount(yearSeenGroups + 1);
  }, [
    isYearMode,
    yearSeenGroups,
    yearAdUnlockedUntil,
    uiLang,
    showNextYearGroup,
    updateYearSeenCount,
  ]);


  function showNextYearGroup() {
    // Year 모드에서 "한 번 더 보기" = refreshTick 올려서 로딩 useEffect 다시 돌리기
    setIsRefreshing(true);
    setRefreshTick((t) => t + 1);
  }


  async function updateYearSeenCount(nextCount) {
    setYearSeenGroups(nextCount);

    const today = startOfDayInTz(new Date(), tz);
    const { y, m, d } = getDayPartsFrom(today, tz);
    const isoDate = `${y}-${m}-${d}`;

    try {
      await AsyncStorage.setItem(
        STORAGE_KEY_YEAR_SEEN_GROUPS,
        JSON.stringify({ isoDate, count: nextCount })
      );
    } catch (e) {
      console.warn("[YEAR] save count failed", e);
    }
  }



  // [수정] 광고 보상 처리 (화면 갱신 변수 업데이트)
  async function onRewardedForYear() {
    const now = Date.now();
    const until = now + REWARD_PASS_DURATION_MS; // 12시간

    // 1. 패스 저장
    setYearAdUnlockedUntil(until);
    try {
      await AsyncStorage.setItem(STORAGE_KEY_YEAR_PASS_UNTIL, String(until));
    } catch (e) {
      console.warn("[YEAR] save pass failed", e);
    }

    // 2. 모달 닫기
    setYearAdPromptVisible(false);

    // 3. [중요] 카운트 증가시키고 화면 갱신
    // 패스를 얻었으니 바로 다음 것(3번째)을 보여줍니다.
    if (yearSeenGroups < YEAR_MAX_EVENTS_PER_COUNTRY - 1) {
      await updateYearSeenCount(yearSeenGroups + 1);
      await showNextYearGroup();
    } else {
      await showNextYearGroup();
    }

  }

  function showRewardedAdForYear() {
    if (!rewardedAd.loaded) {
      rewardedAd.load();
    }

    const subscription = rewardedAd.addAdEventListener(
      RewardedAdEventType.EARNED_REWARD,
      async () => {
        await onRewardedForYear();
        subscription(); // 리스너 해제
      }
    );

    rewardedAd.show().catch((e) => {
      console.warn("[AD] showRewardedAdForYear failed", e);
      subscription();
    });
  }

  // [추가] 월드 모드용 광고 보여주기 함수
  function showRewardedAdForWorld() {
    if (!rewardedAd.loaded) {
      rewardedAd.load();
    }
    // 리스너는 useEffect에서 이미 등록되어 있으므로 show만 호출
    rewardedAd.show().catch((e) => {
      console.warn("[AD] showWorld failed", e);
      // 에러 시 강제로라도 모달 닫기
      setAdPromptVisible(false);
    });
  }



  const STORAGE_KEY_SEEN_YEAR_PREFIX = "@seen_year_v1:";

  function getYearsFromPool(pool) {
    const ys = new Set();
    for (const it of pool || []) {
      const y = parseInt(getYearFromRow(it.row), 10);
      if (!Number.isNaN(y) && y > 0) ys.add(y);
    }
    return ys;
  }

  function pickTargetYearFromUnion(poolsByCid, cids, seedKey) {
    const union = [];
    const seen = new Set();
    for (const cid of cids) {
      for (const y of getYearsFromPool(poolsByCid[cid] || [])) {
        if (!seen.has(y)) {
          seen.add(y);
          union.push(y);
        }
      }
    }
    if (!union.length) return null;

    // 날짜 + 나라조합 + seedKey까지 같이 섞어서 더 다양하게
    const today = new Date().toISOString().slice(0, 10); // "2025-12-18" 이런 형태
    const rnd = xorshift(hash32(`year:${today}:${seedKey}`));
    const idx = Math.floor(rnd() * union.length);
    return union[idx];
  }

  const STORAGE_KEY_YEAR_EVT_IDX = "@year_evt_idx_v1:";

  async function pickYearEventRotate(pool, targetYear, isoDate, cid) {
    if (!pool || !pool.length || targetYear == null) return null;

    const getY = (it) => {
      const y = parseInt(getYearFromRow(it.row), 10);
      return Number.isNaN(y) ? null : y;
    };

    // exact 우선
    const exact = pool.filter((it) => getY(it) === targetYear);

    let candidates = exact;
    let isExact = true;

    // exact 없으면: 가장 가까운 연도 이벤트들 중 "가장 가까운 연도"만 묶어서 후보
    if (!candidates.length) {
      isExact = false;

      // targetYear 기준으로 각 item의 거리 계산
      const scored = pool
        .map((it) => {
          const y = getY(it);
          const dist = y == null ? 1e9 : Math.abs(y - targetYear);
          return { it, y, dist };
        })
        .sort((a, b) => a.dist - b.dist);

      if (!scored.length) return null;

      // 최소 거리의 "연도"를 하나 고르고, 그 연도의 것만 candidates로
      const bestDist = scored[0].dist;
      const bestYear = scored.find((x) => x.dist === bestDist)?.y ?? null;
      if (bestYear == null) return scored[0].it;

      candidates = pool.filter((it) => getY(it) === bestYear);
    }

    if (!candidates.length) return null;

    // 인덱스 회전: refresh마다 무조건 다음 이벤트로
    const idxKey = `${STORAGE_KEY_YEAR_EVT_IDX}${cid}:${isoDate}:${targetYear}:${isExact ? "exact" : "closest"}`;
    let idx = 0;
    try {
      const raw = await AsyncStorage.getItem(idxKey);
      const n = parseInt(raw || "0", 10);
      if (!Number.isNaN(n) && n >= 0) idx = n;
    } catch { }

    const pick = candidates[idx % candidates.length];

    try {
      await AsyncStorage.setItem(idxKey, String(idx + 1));
    } catch { }

    return pick;
  }



  const insets = useSafeAreaInsets();
  const { scale, screenW } = useUIScale();
  const [tz] = useState(() => {
    const z =
      Intl?.DateTimeFormat?.().resolvedOptions().timeZone ||
      "UTC";
    return safeTimeZone(z);
  });

  const tabBarHeight = useBottomTabBarHeight();
  const { width } = useWindowDimensions();

  const [hydrated, setHydrated] = useState(false);
  // 오늘 기준 offset (-1: 어제, 0: 오늘, +1: 내일)
  const [dayOffset, setDayOffset] = useState(0);
  const [ytPassUntil, setYtPassUntil] = useState(null); // number | null (ms)

  const STORAGE_KEY_YT_PASS_UNTIL = "@histree:yt_pass_until";
  const YT_PASS_DURATION_MS = 12 * 60 * 60 * 1000;


  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY_YT_PASS_UNTIL);
        if (raw) {
          const n = Number(raw);
          if (!Number.isNaN(n) && n > Date.now()) {
            setYtPassUntil(n);
          } else {
            setYtPassUntil(null);
          }
        }
      } catch (e) {
        console.warn("[YT PASS] load fail", e);
      }
    })();
  }, []);


  const canUseYesterdayTomorrowHistory = !!(
    ytPassUntil && ytPassUntil > Date.now()
  );

  // 현재 화면 날짜 (어제/오늘/내일)
  const screenDate = useMemo(() => {
    const todayStart = startOfDayInTz(new Date(), tz);
    const d = new Date(todayStart);
    d.setDate(todayStart.getDate() + dayOffset);

    const parts = safeFormatParts(d, tz);
    const y = parts.year;
    const m = parts.month;
    const dd = parts.day;

    const iso = `${y}-${m}-${dd}`;

    return {
      date: d,
      parts: {
        md: `${m}-${dd}`,
        dcode: `D${m}${dd}`,
        y,
        m,
        d: dd,
      },
      iso,
    };
  }, [tz, dayOffset]);

  const today0 = screenDate.date;
  const todayParts = screenDate.parts;
  const isoDate = screenDate.iso;

  const bannerHeight = Math.max(
    60,
    Math.round(Math.min(AD_TARGET.h, Math.min(width, 340) / AD_RATIO))
  );

  const deviceLang = useMemo(
    () => normalizeUiLang(resolveUiLangFromDevice(), "en"),
    []
  );

  const [uiLang, setUiLang] = useState(resolveUiLangFromDevice());


  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      async (response) => {
        console.log('📱 [NOTIFICATION] App opened from notification');
        
        try {
          const [eventKey, eventDate] = await AsyncStorage.multiGet([
            '@notification_event_key',
            '@notification_event_date',
          ]);
          
          const key = eventKey[1];
          const date = eventDate[1];
          
          console.log('🔍 [NOTIFICATION] Event key:', key);
          console.log('🔍 [NOTIFICATION] Event date:', date);
          
          // 오늘 날짜와 같은지 확인
          const todayIso = isoDate;
          if (date === todayIso && key) {
            setNotificationEventKey(key);
            console.log('✅ [NOTIFICATION] Will show event:', key);
          }
        } catch (e) {
          console.error('❌ [NOTIFICATION] Failed to load event key:', e);
        }
      }
    );

    return () => subscription.remove();
  }, [isoDate]);

  useEffect(() => {
    console.log("[LANG DEBUG] deviceLang =", deviceLang);
    console.log("[LANG DEBUG] uiLang     =", uiLang);
    console.log("[TZ DEBUG]    tz =", tz);
  }, [deviceLang, uiLang, tz]);

  const [selectedCountries, setSelectedCountries] =
    useState(new Set());
  const hasWorldSelected = useMemo(
    () => selectedCountries.has("world"),
    [selectedCountries]
  );
  // 모드 판단
  const isWorldMode = selectedCountries.size === 1 && selectedCountries.has("world");

  const handlePressWorldPrev = () => {
    if (!isWorldMode) return;

    // 오늘(0)에서 어제로 가려면 패스 필요
    if (dayOffset <= -1 && !canUseYesterdayTomorrowHistory) {
      pendingNavRef.current = "prev";
      setAdPromptKind("world");
      setAdPromptVisible(true);
      return;
    }

    // 하루만 어제로 제한
    setDayOffset((v) => Math.max(-1, v - 1));
  };

  const handlePressWorldNext = () => {
    if (!isWorldMode) return;

    if (dayOffset >= 1 && !canUseYesterdayTomorrowHistory) {
      pendingNavRef.current = "next";
      setAdPromptKind("world");
      setAdPromptVisible(true);
      return;
    }

    setDayOffset((v) => Math.min(1, v + 1));
  };


  // world가 아니고(=한/중/일 중 선택), 선택이 최소 1개면 Year 모드
  const isYearMode = useMemo(() => !isWorldMode && selectedCountries.size > 0, [
    isWorldMode,
    selectedCountries,
  ]);




  const [yearCursor, setYearCursor] = useState(null); // number | null
  const [yearNav, setYearNav] = useState({ canPrev: false, canNext: false });

  const [yearYears, setYearYears] = useState([]);

  const baseYearRef = useRef(null);





  const STORAGE_KEY_YEAR_PASS_UNTIL = "@year_pass_until_v1";
  const STORAGE_KEY_YEAR_SEEN_GROUPS = "@year_seen_groups_v2"; // { isoDate, count }

  const STORAGE_KEY_YEAR_CURSOR_SAVED = "@year_cursor_saved_v1";


  // (선택) 날짜가 바뀌면 연도 모드도 새로 시작하고 싶으면 isoDate까지 넣어줘도 됨
  // }, [selectedCountries, isoDate]);


  const [onePick, setOnePick] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);
  const [copyTick, setCopyTick] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [headerImageUrl, setHeaderImageUrl] = useState(null);

  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [notifyTime, setNotifyTime] = useState("09:00");
  const [cardBg, setCardBg] = useState("none");
  const [customBgColor, setCustomBgColor] = useState(null);
  const [customBgImage, setCustomBgImage] = useState(null);

  const [customFont, setCustomFont] = useState("System");
  const [customFontSize, setCustomFontSize] = useState(18);
  const [customFontColor, setCustomFontColor] =
    useState("#111827");
  const [webViewVisible, setWebViewVisible] = useState(false);
  const [webViewUrl, setWebViewUrl] = useState("");

  const getFontFamily = (font) => {
    switch (font) {
      case "System":
        return Platform.OS === "ios" ? "System" : "Roboto";
      case "Verdana":
        return Platform.OS === "ios" ? "Verdana" : "sans-serif";
      case "Arial":
        return Platform.OS === "ios" ? "Arial" : "sans-serif";
      case "Times New Roman":
        return Platform.OS === "ios"
          ? "Times New Roman"
          : "serif";
      case "Courier New":
        return Platform.OS === "ios"
          ? "Courier New"
          : "monospace";
      case "Georgia":
        return Platform.OS === "ios" ? "Georgia" : "serif";
      default:
        return Platform.OS === "ios" ? "System" : "Roboto";
    }
  };


  useEffect(() => {
    mobileAds()
      .initialize()
      .then(() => {
        console.log("[AD] mobileAds initialized");
      });
  }, []);

  const bodyLineHeight = Math.round(
    (customFontSize || 18) * 1.45
  );

  const baseFontSize = customFontSize || 18;
  const locationFontSize = Math.max(10, baseFontSize - 2);
  const dateFontSize = Math.max(10, baseFontSize - 3);
  const anchorFontSize = Math.max(10, baseFontSize - 2);

  const amplitudeReadyRef = useRef(false);
  const lastBackPressRef = useRef(0);
  const lastPickKeyRef = useRef(null);

  const [adPromptVisible, setAdPromptVisible] = useState(false); // "광고 시청 후 이용 가능" 알림창
  const [rewardedLoaded, setRewardedLoaded] = useState(false);   // 광고 로딩 여부
  const pendingNavRef = useRef(null); // -1(어제), +1(내일) 저장
  const [rewardPassUntil, setRewardPassUntil] = useState(0);



  // goBy를 먼저 선언
  const goBy = useCallback(
    (delta) => {
      const step = delta < 0 ? -1 : delta > 0 ? 1 : 0;
      if (!step) return;

      // World 모드: 오늘(0) / 어제(-1) / 내일(+1)
      if (isWorldMode) {
        setDayOffset((prev) => {
          const next = prev + step;
          if (next < -1) return -1;
          if (next > 1) return 1;
          return next;
        });
        return;
      }

      // Year 모드: 존재하는 연도에서만 커서 이동
      if (isYearMode) {
        setYearCursor((prev) => {
          if (prev == null) return prev;
          if (!yearYears || !yearYears.length) return prev;

          const next = prev + step;
          return yearYears.includes(next) ? next : prev;
        });
      }
    },
    [isWorldMode, isYearMode, yearYears]
  );



  // [확인/교체] 어제 보기
  const handlePrevDay = useCallback(() => {
    if (isYearMode) return;

    const now = Date.now();
    if (rewardPassUntil && rewardPassUntil > now) {
      goBy(-1);
      return;
    }
    // 패스 없으면 광고 모달 띄우기
    pendingNavRef.current = -1;
    setAdPromptVisible(true);
  }, [rewardPassUntil, goBy, isYearMode]);

  // [확인/교체] 내일 보기
  const handleNextDay = useCallback(() => {
    if (isYearMode) return;

    const now = Date.now();
    if (rewardPassUntil && rewardPassUntil > now) {
      goBy(+1);
      return;
    }
    // 패스 없으면 광고 모달 띄우기
    pendingNavRef.current = +1;
    setAdPromptVisible(true);
  }, [rewardPassUntil, goBy, isYearMode]);
  useEffect(() => {
    let isMounted = true;

    console.log("[AD] setup rewarded listener");

    const unsubscribe = rewardedAd.addAdEventsListener(({ type, payload }) => {
      console.log("[AD] event =", type);

      // 광고 로드 완료
      if (type === RewardedAdEventType.LOADED) {
        setRewardedLoaded(true);
      }

      // 광고 끝까지 시청 → 날짜 이동 + 12시간 패스 부여
      // [수정] 광고 시청 완료 시 보상 처리 로직 통합
      if (type === RewardedAdEventType.EARNED_REWARD) {
        const pending = pendingNavRef.current;

        // 1. 월드 모드: 어제(-1) 또는 내일(+1) 이동 예약인 경우
        if (pending === -1 || pending === 1) {
          const until = Date.now() + REWARD_PASS_DURATION_MS; // 12시간 패스 부여
          setRewardPassUntil(until);
          AsyncStorage.setItem(STORAGE_KEY_REWARD_PASS_UNTIL, String(until)).catch(() => { });
          goBy(pending); // 예약된 방향으로 자동 이동
        }

        // 2. 한중일(연도) 모드: 더보기 예약인 경우
        else if (pending === "year_refresh") {
          // 연도 패스 부여는 onRewardedForYear()에서 별도 처리되지만, 여기서 확실히 리프레시
          setRefreshTick((t) => t + 1);
        }

        // 공통 정리
        pendingNavRef.current = null;
        setAdPromptVisible(false); // 월드 모달 닫기
        setRewardedLoaded(false);

      }

      // 광고 닫힘 (중간에 닫은 경우 포함)
      if (type === AdEventType.CLOSED) {
        console.log("[AD] closed");
        setAdPromptVisible(false);
        pendingNavRef.current = null;
        setRewardedLoaded(false);

        // 광고 완전히 닫힌 시점에서만 다음 광고 미리 로드
        rewardedAd.load();
      }

      // 에러
      if (type === AdEventType.ERROR) {
        console.warn("[AD] error:", payload);
        setAdPromptVisible(false);
        pendingNavRef.current = null;
        setRewardedLoaded(false);
      }
    });

    // iOS 포함 전체에서 SDK 먼저 초기화 후 로드
    mobileAds()
      .initialize()
      .then(() => {
        if (!isMounted) return;
        console.log("[AD] mobileAds initialized, load rewarded");
        rewardedAd.load();
      });

    return () => {
      isMounted = false;
      console.log("[AD] cleanup rewarded listener");
      unsubscribe();
      rewardedAd.removeAllListeners();
    };
  }, [goBy]);



  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, gestureState) => {
          const { dx, dy } = gestureState;
          // 가로 스와이프만 잡기 (세로 스크롤과 충돌 최소화)
          return Math.abs(dx) > 15 && Math.abs(dx) > Math.abs(dy);
        },
        onPanResponderRelease: (_evt, gestureState) => {
          const { dx, vx } = gestureState;

          if (Math.abs(dx) < 40 || Math.abs(vx) < 0.1) return;

          if (dx > 0) {
            // 오른쪽 → 어제
            handlePrevDay();
          } else {
            // 왼쪽 → 내일
            handleNextDay();
          }
        },
      }),
    [handlePrevDay, handleNextDay]   // ⭐ 요게 포인트
  );




  const [webViewTitle, setWebViewTitle] = useState("");

  const handleLinkPress = useCallback((url, title) => {
    console.log("Opening WebView with title:", title, "url:", url);
    setWebViewUrl(url);
    setWebViewTitle(title);
    setWebViewVisible(true);
  }, []);

  const handleCloseWebView = useCallback(() => {
    setWebViewVisible(false);
    setWebViewUrl("");
    setWebViewTitle("");
  }, []);

  useEffect(() => {
    let cancelled = false;
    InteractionManager.runAfterInteractions(async () => {
      if (cancelled) return;
      try {
        await initAmplitude();
        amplitudeReadyRef.current = true;
        trackEvent(AMPLITUDE_EVENTS.SCREEN_VIEW, {
          screen: "Home",
        });
      } catch { }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setHeaderImageUrl(null);
  }, [uiLang]);



  const buildSharePayload = useCallback(() => {
    const lang = uiLang || "en";

    const appName =
      APP_NAME_BY_LANG[lang] || APP_NAME_BY_LANG.en;

    // 연도 모드일 때만 기준 기준연도 대비 -1/0/+1 계산
    let yearDeltaForTitle;
    if (
      isYearMode &&
      yearCursor != null &&
      baseYearRef.current != null
    ) {
      yearDeltaForTitle = yearCursor - baseYearRef.current;
    }

    const historyTitle = getHistoryTitle(
      lang,
      dayOffset,
      selectedCountries,
      yearDeltaForTitle // 
    );


    // 최상단 헤더: 예) "Histree: 오늘의 역사"
    const header = `${appName}: ${historyTitle}`;

    const list = Array.isArray(onePick)
      ? onePick
      : onePick
        ? [onePick]
        : [];

    // 보여줄 이벤트가 없을 때: 헤더 + 다운로드 링크만
    if (!list.length) {
      const payload = [
        header,
        "",
        `*${lang === "ko"
          ? "히스트리 앱 다운로드 링크"
          : lang === "ja"
            ? "Histreeアプリのダウンロードリンク"
            : "Download Histree app"
        } - ${APP_DOWNLOAD_URL}`,
      ].join("\n");

      return { header, payload };
    }

    const p = list[0]; // 어차피 1개만 보여주니까 첫 번째만 사용
    const label =
      COUNTRY_CFG[p.cid]?.label?.[lang] ||
      COUNTRY_CFG[p.cid]?.label?.en ||
      p.cid;

    const fieldLabels =
      FIELD_LABELS[lang] || FIELD_LABELS.en;

    const eventYear = getYearFromRow(p.row);
    const dateLabel = formatEventDateLabel(eventYear, todayParts, lang, tz);

    const downloadLabel =
      lang === "ko"
        ? "히스트리 앱 다운로드 링크"
        : lang === "ja"
          ? "Histreeアプリのダウンロードリンク"
          : "Download Histree app";

    const bodyText = (p.body || "").trim();

    const lines = [
      header,
      "",
      // 위치: 한국
      `${fieldLabels.location}: ${label}`,
      // 날짜: 2019년 11월 29일 (6년 전)
      `${fieldLabels.date}: ${dateLabel}`,
      "",
      // 본문
      bodyText,
      "",
      // *히스트리 앱 다운로드 링크 - https://.
      `*${downloadLabel} - ${APP_DOWNLOAD_URL}`,
    ];

    const payload = lines.join("\n");

    return { header, payload };

  }, [onePick,
    uiLang,
    dayOffset,
    todayParts,
    tz,
    selectedCountries,
    isYearMode,
    yearCursor,]);

  // 공유 텍스트 만드는 함수는 그대로 사용 (buildSharePayload)
  const onSystemSharePress = useCallback(async () => {
    try {
      const { header, payload } = buildSharePayload();
      // 제목 + 본문 합쳐서 하나의 메시지로
      const text = [header, payload].filter(Boolean).join("\n\n").trim();

      const message =
        text || "Histree - 오늘의 역사에서 오늘의 사건을 확인해 보세요.";

      await NativeShare.share({
        message,
        title: header || "Histree",
      });
    } catch (e) {
      console.warn("[SHARE] NativeShare.share failed:", e);
      if (Platform.OS === "android") {
        ToastAndroid.show("공유 창을 열 수 없어요.", ToastAndroid.SHORT);
      } else {
        alert("공유 창을 열 수 없어요.");
      }
    }
  }, [buildSharePayload]);


  const fetchingRef = useRef(false);

  const handlePullToRefresh = useCallback(() => {
    // World 모드: 예전처럼 무제한 새로고침
    if (!isYearMode) {
      setIsRefreshing(true);
      setRefreshTick((t) => t + 1);
      return;
    }

    // 🇰🇷🇨🇳🇯🇵 연도 모드: "더 보기" 버튼과 동일한 동작
    handlePressYearMore();
  }, [isYearMode, handlePressYearMore]);




  useEffect(() => {
    const offPrev = onGoPrevDay?.(handlePrevDay);
    const offNext = onGoNextDay?.(handleNextDay);

    const offRefresh = onRefresh?.(() => {
      if (amplitudeReadyRef.current) {
        trackEvent(AMPLITUDE_EVENTS.REFRESH_CLICKED, {
          language: uiLang,
          countries: [...selectedCountries],
        });
      }
      handlePullToRefresh();
    });

    const offShare = onShareAttach?.(() => {
      onSystemSharePress();
    });

    return () => {
      offPrev && offPrev();
      offNext && offNext();
      offRefresh && offRefresh();
      offShare && offShare();
    };
  }, [
    uiLang,
    selectedCountries,
    handlePrevDay,
    handleNextDay,
    handlePullToRefresh,
    onSystemSharePress,
  ]);






  // 초기 설정/복원
  // [수정] 초기 설정/복원 (연도 데이터 포함 통합)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // 1. 저장된 모든 키를 한 번에 가져옴
        const pairs = await AsyncStorage.multiGet([
          STORAGE_KEY_UI_LANG,
          STORAGE_KEY_SELECTED,
          STORAGE_KEY_NOTIFY_ENABLED,
          STORAGE_KEY_NOTIFY_TIME,
          STORAGE_KEY_CARD_BG,
          STORAGE_KEY_BG_COLOR,
          STORAGE_KEY_BG_IMAGE,
          STORAGE_KEY_FONT,
          STORAGE_KEY_FONT_SIZE,
          STORAGE_KEY_FONT_COLOR,
          STORAGE_KEY_REWARD_PASS_UNTIL,
          // [추가] 연도 모드 관련 키들도 여기서 같이 로드
          STORAGE_KEY_YEAR_PASS_UNTIL,
          STORAGE_KEY_YEAR_SEEN_GROUPS,
          STORAGE_KEY_YEAR_CURSOR_SAVED,
        ]).catch(() => []);

        const dict = Object.fromEntries(pairs || []);
        if (!alive) return;

        // 2. 월드 모드 패스 복원
        if (dict[STORAGE_KEY_REWARD_PASS_UNTIL]) {
          const ts = parseInt(dict[STORAGE_KEY_REWARD_PASS_UNTIL], 10);
          if (!Number.isNaN(ts) && ts > Date.now()) {
            setRewardPassUntil(ts);
          }
        }

        // 3. [추가] 연도 모드 데이터 복원 (이 부분이 핵심)
        const today = startOfDayInTz(new Date(), tz);
        const { y, m, d } = getDayPartsFrom(today, tz);
        const isoDate = `${y}-${m}-${d}`;

        // 3-1. 연도 패스
        if (dict[STORAGE_KEY_YEAR_PASS_UNTIL]) {
          const n = parseInt(dict[STORAGE_KEY_YEAR_PASS_UNTIL], 10);
          if (!Number.isNaN(n) && n > Date.now()) {
            setYearAdUnlockedUntil(n);
          }
        }
        // 3-2. 본 횟수 (날짜가 같을 때만 복원)
        if (dict[STORAGE_KEY_YEAR_SEEN_GROUPS]) {
          try {
            const obj = JSON.parse(dict[STORAGE_KEY_YEAR_SEEN_GROUPS]);
            if (obj?.isoDate === isoDate && typeof obj.count === "number") {
              setYearSeenGroups(obj.count);
            }
          } catch { }
        }
        // 3-3. 보고 있던 연도 (날짜가 같을 때만 복원)
        if (dict[STORAGE_KEY_YEAR_CURSOR_SAVED]) {
          try {
            const obj = JSON.parse(dict[STORAGE_KEY_YEAR_CURSOR_SAVED]);
            if (obj?.isoDate === isoDate && obj.year) {
              setYearCursor(obj.year);
              baseYearRef.current = obj.year; // 기준점도 복원
            }
          } catch { }
        }

        // 4. 언어 설정
        const storedLangRaw = dict[STORAGE_KEY_UI_LANG] || null;
        let lang;
        if (storedLangRaw) {
          lang = normalizeUiLang(storedLangRaw, deviceLang);
        } else {
          lang = deviceLang;
          AsyncStorage.setItem(STORAGE_KEY_UI_LANG, lang).catch(() => { });
        }
        setUiLang(lang);

        if (amplitudeReadyRef.current) {
          setUserProperties({ language: lang, device_language: deviceLang });
        }

        // 5. 국가 선택 및 기타 설정 복원
        let nextSet;
        if (dict[STORAGE_KEY_SELECTED]) {
          let arr = [];
          try { arr = JSON.parse(dict[STORAGE_KEY_SELECTED]); } catch { }
          nextSet = ensureNonEmptySelection(new Set(Array.isArray(arr) ? arr : []), lang);
        } else {
          nextSet = ensureNonEmptySelection(new Set(), lang);
        }
        setSelectedCountries(nextSet);

        setNotifyEnabled(dict[STORAGE_KEY_NOTIFY_ENABLED] === "1");
        if (dict[STORAGE_KEY_NOTIFY_TIME]) setNotifyTime(dict[STORAGE_KEY_NOTIFY_TIME]);
        if (dict[STORAGE_KEY_CARD_BG]) setCardBg(dict[STORAGE_KEY_CARD_BG]);

        const rawBg = dict[STORAGE_KEY_BG_COLOR];
        setCustomBgColor(isValidColorString(rawBg) ? rawBg : null);
        if (dict[STORAGE_KEY_BG_IMAGE]) setCustomBgImage(dict[STORAGE_KEY_BG_IMAGE]);
        if (dict[STORAGE_KEY_FONT]) setCustomFont(dict[STORAGE_KEY_FONT]);

        if (dict[STORAGE_KEY_FONT_SIZE]) {
          const v = parseInt(dict[STORAGE_KEY_FONT_SIZE], 10);
          if (!Number.isNaN(v) && v > 8) setCustomFontSize(v);
        }
        if (dict[STORAGE_KEY_FONT_COLOR]) setCustomFontColor(dict[STORAGE_KEY_FONT_COLOR]);

      } catch (e) {
        console.warn("Init restore failed:", e);
      } finally {
        // 모든 복원이 끝난 후 렌더링 시작 -> 랜덤 연도 발생 방지
        setHydrated(true);
      }
    })();

    return () => { alive = false; };
  }, [deviceLang]); // tz는 내부에서 계산


  // 포커스될 때 설정 재동기화
  useFocusEffect(
    useCallback(() => {
      if (!hydrated) return () => { };
      let alive = true;

      (async () => {
        try {
          const pairs = await AsyncStorage.multiGet([
            STORAGE_KEY_UI_LANG,
            STORAGE_KEY_SELECTED,
            STORAGE_KEY_CARD_BG,
            STORAGE_KEY_BG_COLOR,
            STORAGE_KEY_BG_IMAGE,
            STORAGE_KEY_FONT,
            STORAGE_KEY_FONT_SIZE,
            STORAGE_KEY_FONT_COLOR,
            STORAGE_KEY_NOTIFY_ENABLED,
            STORAGE_KEY_NOTIFY_TIME,
          ]).catch(() => []);
          const dict = Object.fromEntries(pairs || []);
          if (!alive) return;

          const storedLangRaw =
            dict[STORAGE_KEY_UI_LANG] || null;
          const storedLang = storedLangRaw
            ? normalizeUiLang(storedLangRaw, null)
            : null;

          if (dict[STORAGE_KEY_BG_IMAGE]) {
            setCustomBgImage(dict[STORAGE_KEY_BG_IMAGE]);
          } else {
            setCustomBgImage(null);
          }

          let nextLang = uiLang || deviceLang;
          if (storedLang) {
            nextLang = storedLang;
          }
          if (!nextLang) {
            nextLang = deviceLang;
          }

          if (nextLang !== uiLang) {
            setUiLang(nextLang);

            let arr = [];
            try {
              arr = JSON.parse(
                dict[STORAGE_KEY_SELECTED] || "[]"
              );
            } catch { }
            let cur = new Set(
              Array.isArray(arr) ? arr : []
            );
            if (cur.size === 0) {
              cur = ensureNonEmptySelection(cur, nextLang);
              setSelectedCountries(cur);
              try {
                await AsyncStorage.setItem(
                  STORAGE_KEY_SELECTED,
                  JSON.stringify([...cur])
                );
              } catch { }
            }
            setRefreshTick((t) => t + 1);
          } else {
            const storedSel = dict[STORAGE_KEY_SELECTED];
            if (storedSel) {
              let arr = [];
              try {
                arr = JSON.parse(storedSel);
              } catch { }
              if (Array.isArray(arr)) {
                let nextSet =
                  ensureNonEmptySelection(
                    new Set(arr),
                    nextLang
                  );
                if (!equalSets(nextSet, selectedCountries)) {
                  setSelectedCountries(nextSet);
                  try {
                    await AsyncStorage.setItem(
                      STORAGE_KEY_SELECTED,
                      JSON.stringify([...nextSet])
                    );
                  } catch { }
                  setRefreshTick((t) => t + 1);
                }
              }
            }
          }

          const storedBgColor =
            dict[STORAGE_KEY_BG_COLOR] ?? null;
          setCustomBgColor(
            isValidColorString(storedBgColor)
              ? storedBgColor
              : null
          );

          const storedCardBg = dict[STORAGE_KEY_CARD_BG] || null;
          if (storedCardBg && storedCardBg !== cardBg) {
            setCardBg(storedCardBg);
          }

          if (dict[STORAGE_KEY_FONT]) {
            setCustomFont(dict[STORAGE_KEY_FONT]);
          }

          if (dict[STORAGE_KEY_FONT_SIZE]) {
            const v = parseInt(
              dict[STORAGE_KEY_FONT_SIZE],
              10
            );
            if (!Number.isNaN(v) && v > 8) {
              setCustomFontSize(v);
            }
          }

          if (dict[STORAGE_KEY_FONT_COLOR]) {
            setCustomFontColor(
              dict[STORAGE_KEY_FONT_COLOR]
            );
          }

          if (dict[STORAGE_KEY_NOTIFY_ENABLED] != null) {
            setNotifyEnabled(
              dict[STORAGE_KEY_NOTIFY_ENABLED] === "1"
            );
          }

          if (dict[STORAGE_KEY_NOTIFY_TIME]) {
            setNotifyTime(dict[STORAGE_KEY_NOTIFY_TIME]);
          }
        } catch (e) {
          console.warn("focus sync failed:", e);
        }
      })();

      return () => {
        alive = false;
      };
    }, [
      hydrated,
      uiLang,
      selectedCountries,
      cardBg,
      customBgColor,
      deviceLang,
    ])
  );

  // 디버그용 로그
  useEffect(() => {
    if (!__DEV__) return;

    let iso = "Invalid Date";
    if (today0 instanceof Date && !Number.isNaN(today0.getTime())) {
      try {
        iso = `${todayParts.y}-${todayParts.m}-${todayParts.d}`;
      } catch {
        // ignore
      }
    }

    console.log("today0:", iso, "todayParts:", todayParts);
  }, [today0, todayParts]);

  const stableKey = useMemo(() => {
    const p = todayParts || {};
    const y = String(p.y || "0000");
    const m = String(p.m || "00").padStart(2, "0");
    const d = String(p.d || "00").padStart(2, "0");
    const dayKey = `${y}-${m}-${d}`; // 예: 2025-11-27

    return `${dayKey}__${[...selectedCountries]
      .sort()
      .join(",")}`;
  }, [todayParts, selectedCountries]);

  const seedKey = useMemo(
    () => `${stableKey}__r${refreshTick}`,
    [stableKey, refreshTick]
  );

  // UI 언어 변경 시 본문 재계산
  useEffect(() => {
    setOnePick((prev) => {
      if (!Array.isArray(prev) || !prev.length)
        return prev;
      return prev.map((it) => {
        const newBody = bodyOfRowByLang(
          it.row,
          uiLang,
          it.cid
        );
        return newBody && hasAnyText(newBody)
          ? { ...it, body: newBody }
          : it;
      });
    });
  }, [uiLang]);

  const endLoading = useCallback(() => {
    setLoading(false);
    setIsRefreshing(false);
  }, []);

  // 데이터 로딩 (로컬 + 원격 + 로테이션)
  // 데이터 로딩 (World = 기존 / Year = 랜덤 연도 + prev/next + refresh 중복방지)
  useEffect(() => {
    if (!hydrated || !uiLang) return;
    let canceled = false;
    fetchingRef.current = true;

    (async () => {
      try {
        setErr("");

        const safeSelected = ensureNonEmptySelection(selectedCountries, uiLang);
        if (!equalSets(safeSelected, selectedCountries)) {
          if (!canceled) setSelectedCountries(safeSelected);
          AsyncStorage.setItem(STORAGE_KEY_SELECTED, JSON.stringify([...safeSelected])).catch(() => { });
        }

        const chosen = [...ensureNonEmptySelection(safeSelected, uiLang)];
        if (!chosen.length) {
          if (!canceled) endLoading();
          return;
        }

        // 1) 캐시 → pools
        const poolsByCid = {};
        for (const cid of chosen) {
          const c = await loadCache(cid, todayParts);
          if (Array.isArray(c) && c.length) {
            const arr = [];
            for (const r of c) {
              const body = bodyOfRowByLang(r, uiLang, cid);
              if (!hasAnyText(body)) continue;
              const y = String(r?.Year || r?.year || "");
              const d = String(r?.Date || r?.date || "");
              const unique = hash32(`${y}|${d}|${body}|${JSON.stringify(r)}`); // 충돌 거의 없음

              arr.push({
                cid,
                row: r,
                key: `${cid}|${y}|${d}|h${unique}`,
                body,
              });

            }
            if (arr.length) poolsByCid[cid] = arr;
          }
        }

        // 2) 원격/로컬 최신으로 덮기
        for (const cid of chosen) {
          try {
            const rows = await apiFetchForMode(cid, todayParts, isoDate);
            await saveCache(cid, todayParts, rows);

            const arr = [];
            for (const r of rows) {
              const body = bodyOfRowByLang(r, uiLang, cid);
              if (!hasAnyText(body)) continue;
              const y = String(r?.Year || r?.year || "");
              const d = String(r?.Date || r?.date || "");
              const unique = hash32(`${y}|${d}|${body}|${JSON.stringify(r)}`); // 충돌 거의 없음

              arr.push({
                cid,
                row: r,
                key: `${cid}|${y}|${d}|h${unique}`,
                body,
              });

            }
            if (arr.length) poolsByCid[cid] = arr;
          } catch (e) {
            if (e?.name !== "AbortError") console.warn("fetchHistory failed:", e);
          }
        }

        if (canceled) return;

        const hasAny = Object.values(poolsByCid).some((arr) => arr && arr.length);
        if (!hasAny) {
          setOnePick([]);
          setHeaderImageUrl(null);
          setYearCursor(null);
          setYearNav({ canPrev: false, canNext: false });
          setYearYears([]);

          endLoading();
          return;
        }

        //  World 모드: 오늘/어제/내일은 기존 world 로직 유지
        // 데이터 로딩 useEffect 내부 - World 모드 부분만 수정

        if (isWorldMode) {
          if (notificationEventKey) {
            console.log('🔍 [PICK] Looking for notification event:', notificationEventKey);
            
            // 모든 pool에서 해당 키를 가진 이벤트 찾기
            let foundPick = null;
            for (const cid of chosen) {
              const pool = poolsByCid[cid];
              if (pool) {
                foundPick = pool.find(p => p.key === notificationEventKey);
                if (foundPick) {
                  console.log('✅ [PICK] Found notification event in', cid);
                  break;
                }
              }
            }
            
            if (foundPick && !canceled) {
              setHeaderImageUrl(null);
              setOnePick([foundPick]);
              setYearYears([]);
              setYearCursor(null);
              setYearNav({ canPrev: false, canNext: false });
              lastPickKeyRef.current = foundPick.key;
              
              // 키 초기화 (한 번만 사용)
              setNotificationEventKey(null);
              await AsyncStorage.removeItem('@notification_event_key');
              
              endLoading();
              return;
            } else {
              console.warn('⚠️ [PICK] Notification event not found, using random');
              setNotificationEventKey(null);
            }
          }
          
          // 기존 랜덤 선택 로직
          const pick = await pickOneWithSeenRotation(
            poolsByCid,
            chosen,
            isoDate,
            seedKey
          );

          if (!canceled) {
            if (pick) {
              setHeaderImageUrl(null);
              setOnePick([pick]);
              setYearYears([]);
              setYearCursor(null);
              setYearNav({ canPrev: false, canNext: false });
              lastPickKeyRef.current = pick.key;
            } else {
              setHeaderImageUrl(null);
              setOnePick([]);
              setYearYears([]);
              setYearCursor(null);
              setYearNav({ canPrev: false, canNext: false });
            }
          }

          endLoading();
          return;
}

        // Year 모드: 한/중/일에서 world처럼 1개 이벤트만 보여주기
        // Year 모드: 한/중/일에서 하루에 1개의 연도를 공유해서 사용
        if (isYearMode) {
          const cids = chosen.filter((cid) => cid !== "world");

          if (!cids.length) {
            if (!canceled) {
              setHeaderImageUrl(null);
              setOnePick([]);
              setYearYears([]);
              setYearCursor(null);
              setYearNav({ canPrev: false, canNext: false });
            }
            endLoading();
            return;
          }

          // ------------- 여기부터 네 코드 -------------
          // 나라별 연도 집합 만들기
          const yearsByCid = {};
          for (const cid of cids) {
            yearsByCid[cid] = getYearsFromPool(poolsByCid[cid] || []);
          }

          // 1) 교집합(common years) 우선
          let common = null;
          for (const cid of cids) {
            const s = yearsByCid[cid];
            if (!s || s.size === 0) continue;
            if (common == null) common = new Set(s);
            else {
              for (const y of [...common]) {
                if (!s.has(y)) common.delete(y);
              }
            }
          }
          const commonYearsArr = common ? [...common].sort((a, b) => a - b) : [];

          // 2) 교집합이 없으면 합집합(union) 사용
          const union = new Set();
          for (const cid of cids) {
            for (const y of yearsByCid[cid] || []) union.add(y);
          }
          const unionYearsArr = [...union].sort((a, b) => a - b);

          const yearsArr = commonYearsArr.length ? commonYearsArr : unionYearsArr;
          setYearYears(yearsArr);

          if (!yearsArr.length) {
            setOnePick([]);
            setHeaderImageUrl(null);
            setYearCursor(null);
            setYearNav({ canPrev: false, canNext: false });
            setYearYears([]);
            endLoading();
            return;
          }

          // 하루에 1개의 기준 연도 고정
          let targetYear = yearCursor;
          if (targetYear == null) {
            const rnd = xorshift(hash32(`year:${isoDate}:${stableKey}`));
            const idx = Math.floor(rnd() * yearsArr.length);
            targetYear = yearsArr[idx];
            baseYearRef.current = targetYear;
          } else if (baseYearRef.current == null) {
            baseYearRef.current = targetYear;
          }

          setYearYears(yearsArr);
          setYearCursor(targetYear);
          setYearNav({ canPrev: false, canNext: false });

          const picks = [];
          const countToFetch = Math.min(
            YEAR_MAX_EVENTS_PER_COUNTRY,
            yearSeenGroups + 1
          );

          for (const cid of cids) {
            const pool = poolsByCid[cid] || [];

            const getY = (it) => {
              const y = parseInt(getYearFromRow(it.row), 10);
              return Number.isNaN(y) ? null : y;
            };

            let candidates = pool.filter((it) => getY(it) === targetYear);

            if (!candidates.length && pool.length > 0) {
              const scored = pool
                .map((it) => {
                  const y = getY(it);
                  const dist = y == null ? 1e9 : Math.abs(y - targetYear);
                  return { it, y, dist };
                })
                .sort((a, b) => a.dist - b.dist);

              if (scored.length) {
                const bestDist = scored[0].dist;
                const bestYear = scored.find((x) => x.dist === bestDist)?.y;
                if (bestYear != null) {
                  candidates = pool.filter((it) => getY(it) === bestYear);
                }
              }
            }

            if (candidates.length > 0) {
              candidates.sort((a, b) =>
                String(a.key).localeCompare(String(b.key))
              );
              const selected = candidates.slice(0, countToFetch);
              picks.push(...selected);
            }
          }

          if (canceled) return;

          setHeaderImageUrl(null);
          setOnePick(picks);
          lastPickKeyRef.current = picks?.[0]?.key || null;

          endLoading();
          return;
        }


        // 혼합 모드 (world + 다른 나라 같이 선택된 경우)
        {
          const pick = await pickOneWithSeenRotation(
            poolsByCid,
            chosen,
            isoDate,
            seedKey
          );

          if (!canceled) {
            if (pick) {
              setHeaderImageUrl(null);
              setOnePick([pick]);
              setYearYears([]);
              setYearCursor(null);
              setYearNav({ canPrev: false, canNext: false });
              lastPickKeyRef.current = pick.key;
            } else {
              setHeaderImageUrl(null);
              setOnePick([]);
              setYearYears([]);
              setYearCursor(null);
              setYearNav({ canPrev: false, canNext: false });
            }
          }

          endLoading();
          return;
        }




      } catch (e) {
        if (!canceled) {
          setErr(String(e?.message || e));
          endLoading();
        }
      } finally {
        fetchingRef.current = false;
      }
    })();

    // [수정] useEffect의 마지막 의존성 배열 부분을 아래와 같이 바꾸세요.
    return () => {
      canceled = true;
      fetchingRef.current = false;
    };
  }, [
    hydrated,
    todayParts,
    uiLang,
    selectedCountries,
    stableKey,
    seedKey,
    isoDate,
    endLoading,
    isWorldMode,
    isYearMode,
    yearCursor,
    yearSeenGroups,
    notificationEventKey
  ]);


  // 헤더 배너 이미지 로딩/캐시
  useEffect(() => {
    console.log('🎯 [IMAGE EFFECT] Started', {
      onePick: onePick?.length,
      uiLang,
      hydrated,
      isoDate,
    });

    let alive = true;

    (async () => {
      try {
        const iso = isoDate;

        if (!onePick || !onePick.length) {
          console.log('❌ [IMAGE] No pick');
          if (alive) setHeaderImageUrl(null);
          return;
        }

        const first = onePick[0];
        const cid = first.cid;
        const pickKey = first.key;

        console.log('🔍 [IMAGE] Checking cache for', { iso, cid, pickKey });


        const cacheKey = `${BANNER_KEY(iso, cid)}:${pickKey}`;

        try {
          const cachedUrl = await AsyncStorage.getItem(cacheKey);
          console.log('📦 [IMAGE] Cached URL:', cachedUrl);
          if (cachedUrl && alive) {
            setHeaderImageUrl(cachedUrl || null);
            return;
          }
        } catch (e) {
          console.log('⚠️ [IMAGE] Cache read error:', e);
        }

        // 새로 계산
        console.log('🆕 [IMAGE] Computing new URL...');
        const url = await computeBannerUrlForPick(first, uiLang);
        console.log('✅ [IMAGE] Computed URL:', url);

        if (alive) {
          setHeaderImageUrl(url || null);
          try {
            await AsyncStorage.setItem(cacheKey, url || "");
            console.log('💾 [IMAGE] Saved to cache with key:', pickKey);
          } catch (e) {
            console.log('⚠️ [IMAGE] Cache save error:', e);
          }
        }
      } catch (e) {
        console.error('❌ [IMAGE] Error:', e);
        if (alive) setHeaderImageUrl(null);
      }
    })();

    return () => {
      console.log('🧹 [IMAGE EFFECT] Cleanup');
      alive = false;
    };
  }, [onePick, uiLang, hydrated, isoDate]);

  // 자정 워밍
  useEffect(() => {
    if (!hydrated || !uiLang) return;
    const stop = scheduleMidnightWarmup({
      tz,
      uiLang,
      selectedCountries,
    });
    return stop;
  }, [hydrated, tz, uiLang, selectedCountries]);

  // 앱이 다시 foreground로 돌아올 때
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") {
        const today = startOfDayInTz(new Date(), tz);

        // 앱으로 돌아오면 항상 "오늘(0)" 기준으로 맞춰주기
        setDayOffset(0);

        // 데이터 강제 리프레시
        setRefreshTick((t) => t + 1);

        // 오늘 기준으로 캐시/배너 미리 준비
        warmCacheAndBanner({
          date: today,
          tz,
          uiLang,
          selectedCountries,
        }).catch(() => { });
      }
    });

    return () => sub.remove();
  }, [tz, uiLang, selectedCountries]);

  useFocusEffect(
    useCallback(() => {
      // iOS에서는 처리 안 함
      if (Platform.OS !== "android") return;

      const onBackPress = () => {
        // 1) 오늘이 아닌 화면(어제/내일)이면 → 일단 "오늘"로만 돌아오기
        if (dayOffset !== 0) {
          setDayOffset(0);
          return true; // 이벤트 소비 (앱 종료 X)
        }

        // 2) 2초 안에 두 번 누르면 앱 종료
        const now = Date.now();
        if (now - lastBackPressRef.current < 2000) {
          BackHandler.exitApp();
          return true;
        }

        // 3) 첫 번째 누름: 토스트만 띄우고 종료 안 함
        lastBackPressRef.current = now;
        ToastAndroid.show(
          "한 번 더 누르면 앱이 종료됩니다.",
          ToastAndroid.SHORT
        );
        return true; // 기본 네비게이션 막기
      };
      const sub = BackHandler.addEventListener(
        "hardwareBackPress",
        onBackPress
      );

      // Home 화면 포커스 빠지면 핸들러 제거
      return () => {
        sub.remove();
      };
    }, [dayOffset])
  );

  const handleCountriesChange = useCallback(
    (nextSetRaw) => {
      const ensured = ensureNonEmptySelection(
        nextSetRaw,
        uiLang
      );
      const added = [...ensured].filter(
        (c) => !selectedCountries.has(c)
      );
      const removed = [...selectedCountries].filter(
        (c) => !ensured.has(c)
      );

      if (
        amplitudeReadyRef.current &&
        (added.length || removed.length)
      ) {
        trackEvent(
          AMPLITUDE_EVENTS.COUNTRY_CLICKED,
          {
            language: uiLang,
            added_countries: added,
            removed_countries: removed,
            total_selected: ensured.size,
            selected_countries: [...ensured],
          }
        );
      }

      setSelectedCountries(ensured);
      AsyncStorage.setItem(
        STORAGE_KEY_SELECTED,
        JSON.stringify([...ensured])
      ).catch(() => { });
      setRefreshTick((t) => t + 1);
    },
    [selectedCountries, uiLang]
  );



  const buildNotificationTitleNow = useCallback(() => {
    const appName = APP_NAME_BY_LANG[uiLang || "en"] || APP_NAME_BY_LANG.en;
    const t = UI_STR.title[uiLang || "en"] || UI_STR.title.en;
    const todayTitle = t.today || "Today in History";
    return `${appName} · ${todayTitle}`;
  }, [uiLang]);

  const buildNotificationBodyNow = useCallback(() => {
    const list = Array.isArray(onePick) ? onePick : onePick ? [onePick] : [];

    const currentDate = startOfDayInTz(new Date(), tz);
    const parts = getDayPartsFrom(currentDate, tz);

    const maxBodyLen = uiLang === "ko" || uiLang === "ja" ? 50 : 80;

    const body = list.length
      ? list
        .map((p) => {
          const label = COUNTRY_CFG[p.cid]?.label?.[uiLang || "en"] || p.cid;
          const yr = getYearFromRow(p.row);
          const txt = p.body || "";
          const trunc = txt.length > maxBodyLen ? `${txt.slice(0, maxBodyLen)}...` : txt;

          let eventDateStr = "";
          if (uiLang === "ko") {
            eventDateStr = `${yr}년 ${parseInt(parts.m, 10)}월 ${parseInt(parts.d, 10)}일`;
          } else if (uiLang === "ja") {
            eventDateStr = `${yr}年${parseInt(parts.m, 10)}月${parseInt(parts.d, 10)}日`;
          } else {
            const monthNames = [
              "January", "February", "March", "April", "May", "June",
              "July", "August", "September", "October", "November", "December",
            ];
            const monthName = monthNames[parseInt(parts.m, 10) - 1];
            eventDateStr = `${monthName} ${parseInt(parts.d, 10)}, ${yr}`;
          }

          if (uiLang === "ko") {
            return `${eventDateStr}, ${label}: ${trunc}`;
          } else if (uiLang === "ja") {
            return `${eventDateStr}、${label}: ${trunc}`;
          } else {
            return `${eventDateStr}, ${label}: ${trunc}`;
          }
        })
        .join(" • ")
      : "";

    return body;
  }, [onePick, uiLang, tz]);

  // 알림 타이틀/본문 업데이트 + 재스케줄
  useEffect(() => {
    (async () => {
      try {
        if (!hydrated || !uiLang) return;

        const nextTitle =
          buildNotificationTitleNow();
        const nextBody =
          buildNotificationBodyNow();

        await AsyncStorage.multiSet([
          [STORAGE_KEY_NOTIFY_TITLE, nextTitle],
          [STORAGE_KEY_NOTIFY_BODY, nextBody],
        ]);

        if (notifyEnabled) {
          const [H, M] = (notifyTime || "09:00")
            .split(":")
            .map((x) => parseInt(x, 10) || 0);

          try {
            await cancelAllScheduled?.();
          } catch { }

          try {
            await scheduleDailyAt?.(
              H,
              M,
              nextTitle,
              nextBody
            );
          } catch (e) {
            console.warn(
              "re-schedule failed:",
              e
            );
          }
        }
      } catch (e) {
        console.warn(
          "notify/lang sync failed:",
          e
        );
      }
    })();
  }, [
    hydrated,
    uiLang,
    onePick,
    notifyEnabled,
    notifyTime,
    buildNotificationTitleNow,
    buildNotificationBodyNow,
  ]);

  const list = Array.isArray(onePick)
    ? onePick
    : onePick
      ? [onePick]
      : [];

  const ordered = getCountryOrderByUiLang(uiLang || "en");

  const heroBgSource = useMemo(() => {
    const count = selectedCountries.size;

    let cid = "world";

    if (count === 1) {
      cid = [...selectedCountries][0];
    } else if (count === 0 && list[0]?.cid) {
      cid = list[0].cid;
    } else if (count > 1) {
      cid = "world";
    }

    if (!HERO_BG_IMAGES[cid]) {
      cid = "world";
    }

    return pickDailyHeroBg(cid, today0, tz);
  }, [selectedCountries, list, today0]);

  const SEGMENT_H = 38;
  const TOP_PX = 58;
  const BOTTOM_PX = 93;
  const HEADER_H =
    insets.top +
    TOP_PX +
    SEGMENT_H +
    BOTTOM_PX;
  const CONTENT_W = 340;

  const modalLang = AD_MODAL_TEXT[uiLang] ? uiLang : 'en';
  const tModal = AD_MODAL_TEXT[modalLang];
  // yearDeltaForTitle: 타이틀에서 쓸 연도 오프셋
  const yearDeltaForTitle = React.useMemo(() => {
    // World 모드면 연도 타이틀 안 씀
    if (!isYearMode) return undefined;

    if (yearCursor == null || baseYearRef.current == null) return undefined;

    // ❗ 이 나라에서 앞/뒤 해 네비가 하나도 없으면
    //    "지난해/다음해" 개념도 없는 거니까 그냥 기본 타이틀 사용
    if (!yearNav.canPrev && !yearNav.canNext) {
      return undefined;
    }

    const diff = yearCursor - baseYearRef.current;

    if (diff < 0) return -1;
    if (diff > 0) return 1;
    return 0;
  }, [isYearMode, yearCursor, yearNav]);


  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: "transparent",
      }}
      edges={["top", "bottom"]}
    >
      {!hydrated ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ActivityIndicator />
        </View>
      ) : (
        <>
          <StatusBar
            translucent
            backgroundColor="transparent"
            barStyle="dark-content"
          />
          <Stack.Screen
            options={{
              headerShown: false,
              freezeOnBlur: true,
            }}
          />

          <HeaderHero
            height={HEADER_H + 15}
            bgSource={heroBgSource}
            imageUrl={null}
            uiLang={uiLang || "en"}
          />

          <View
            pointerEvents="box-none"
            style={{
              position: "absolute",
              top: insets.top + 30,
              left: 0,
              right: 0,
              alignItems: "center",
              zIndex: 3,
            }}
          >
            <SegmentedCountrySelector
              uiLang={uiLang || "en"}
              ordered={ordered}
              value={selectedCountries}
              onChange={handleCountriesChange}
              fixedHeight={SEGMENT_H}
            />
          </View>

          <FullBleedCard
            topInset={HEADER_H - 60}
            cardBg={cardBg}
            customBgColor={customBgColor}
            customBgImage={customBgImage}
            panHandlers={panResponder.panHandlers}
          >
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{
                flexGrow: 1,
                paddingHorizontal: 16,
                paddingBottom: 24 + tabBarHeight,
              }}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={handlePullToRefresh}
                />
              }
            >
              <View
                style={{
                  paddingTop: 20,
                  width: CONTENT_W,
                  alignSelf: "center",
                }}
              >
                <View
                  style={{
                    paddingVertical: 20,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 20,
                      fontWeight: "800",
                      textAlign: "center",
                    }}
                  >

                    {getHistoryTitle(
                      uiLang || "en",
                      dayOffset,
                      selectedCountries,
                      yearDeltaForTitle
                    )}
                  </Text>
                  <Text
                    style={{
                      marginTop: 4,
                      fontSize: 13,
                      color: "#6b7280",
                      textAlign: "center",
                    }}
                  >
                  </Text>
                </View>

                <View
                  style={{
                    marginTop: 0,
                    gap: 14,
                    paddingBottom: 10,
                  }}
                >
                  {list.length === 0 ? (
                    <Text
                      style={{
                        color: "#6b7280",
                      }}
                    >
                      {loading
                        ? "..."
                        : UI_STR.empty[uiLang || "en"] ||
                        UI_STR.empty.en}
                    </Text>
                  ) : (
                    list.map((p) => {
                      const label =
                        COUNTRY_CFG[p.cid]?.label?.[
                        uiLang || "en"
                        ] || p.cid;
                      const eventYear =
                        getYearFromRow(p.row);
                      let dateLabel = "";
                      if (p.cid === "world") {
                        dateLabel = formatEventDateLabel(eventYear, todayParts, uiLang || "en", tz);
                        // 헤더 타이틀용 연도 델타 계산


                      } else {
                        // 한/중/일: 연도 + (몇년전)만
                        const yNum = parseInt(String(eventYear || ""), 10);
                        const baseYear = parseInt(String(todayParts.y), 10);
                        const diff = (!Number.isNaN(yNum) && !Number.isNaN(baseYear)) ? (baseYear - yNum) : 0;

                        if (!Number.isNaN(yNum) && yNum > 0) {
                          const yOnly = formatOnlyYearLabel(yNum, uiLang || "en");
                          const ago = formatYearsAgo(diff, uiLang || "en");
                          dateLabel = ago ? `${yOnly} ${ago}` : yOnly;
                        } else {
                          dateLabel = ""; // 연도 없으면 숨김
                        }
                      }

                      const lang = uiLang || "en";
                      const fieldLabels =
                        FIELD_LABELS[lang] ||
                        FIELD_LABELS.en;

                      const anchors =
                        getAnchorsForLang(
                          p.row,
                          uiLang || "en"
                        );

                      return (
                        <View
                          key={p.key}
                          style={{
                            gap: 6,
                          }}
                        >
                          <View
                            style={{
                              marginBottom: 8,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: locationFontSize,
                                fontWeight: "600",
                                color: "#6b7280",
                              }}
                            >
                              {fieldLabels.location}:{" "}
                              <Text
                                style={{
                                  color: "#6b7280",
                                }}
                              >
                                {label}
                              </Text>
                            </Text>
                            {!!dateLabel && (
                              <Text
                                style={{
                                  marginTop: 4,
                                  fontSize: dateFontSize,
                                  color: "#6b7280",
                                }}
                              >
                                {fieldLabels.date}:{" "}
                                {dateLabel}
                              </Text>
                            )}
                          </View>

                          <Text
                            style={{
                              marginTop: 4,
                              marginBottom: 14,
                              fontSize: customFontSize,
                              lineHeight: bodyLineHeight,
                              fontFamily:
                                getFontFamily(
                                  customFont
                                ),
                              color:
                                customFontColor,
                            }}
                          >
                            {p.body}
                          </Text>

                          <AnchorList
                            anchors={anchors}
                            onLinkPress={handleLinkPress}
                            fontSize={anchorFontSize}
                          />
                          <View
                            style={{
                              marginTop: 18,
                              marginBottom: 8,
                              alignItems: "center",
                            }}
                          >
                            <WikipediaBanner
                              key={onePick[0]?.key || 'empty'}
                              imageUrl={headerImageUrl}
                              maxWidth={CONTENT_W}
                              screenWidth={screenW}
                              cardBg={cardBg}
                              customBgColor={customBgColor}
                              resetKey={onePick[0]?.key || 'empty'} // 🔹 추가
                            />
                          </View>

                        </View>
                      );
                    })
                  )}
                </View>
              </View>
            </ScrollView>
          </FullBleedCard>

          <WebViewModal
            visible={webViewVisible}
            url={webViewUrl}
            title={webViewTitle}
            onClose={handleCloseWebView}
          />

          {loading && !isRefreshing && (
            <View
              style={{
                position: "absolute",
                top: 12,
                right: 12,
              }}
            >
              <ActivityIndicator />
            </View>
          )}

          {!!err && (
            <View
              style={{
                position: "absolute",
                bottom: 12,
                left: 12,
                right: 12,
                backgroundColor: "#fee2e2",
                padding: 10,
                borderRadius: 8,
              }}
            >
              <Text
                style={{
                  color: "#b91c1c",
                }}
              >
                Error: {err}
              </Text>
            </View>
          )}

          {/* 연도 모드용 광고 모달 */}
          <Modal
            visible={adPromptVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setAdPromptVisible(false)}
          >
            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center" }}>
              <View style={{ width: 280, borderRadius: 16, paddingHorizontal: 20, paddingVertical: 18, backgroundColor: "#FFFFFF" }}>
                <View style={{ alignItems: 'flex-end', marginBottom: 8 }}>
                  <Pressable onPress={() => setAdPromptVisible(false)} hitSlop={10}>
                    <Text style={{ fontSize: 18, fontWeight: "700", color: "#9CA3AF" }}>✕</Text>
                  </Pressable>
                </View>
                <Text style={{ fontSize: 12, fontWeight: '600', color: "#10B981", marginBottom: 4 }}>
                  {(AD_MODAL_TEXT[uiLang] || AD_MODAL_TEXT.en).badge}
                </Text>
                <Text style={{ fontSize: 16, fontWeight: '700', color: "#111827", marginBottom: 8 }}>
                  {(AD_MODAL_TEXT[uiLang] || AD_MODAL_TEXT.en).title}
                </Text>
                <Text style={{ fontSize: 14, color: "#4b5563", marginBottom: 20, lineHeight: 20 }}>
                  {(AD_MODAL_TEXT[uiLang] || AD_MODAL_TEXT.en).description}
                </Text>
                <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
                  <Pressable
                    onPress={showRewardedAdForWorld}
                    style={{ backgroundColor: "#10B981", borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: "600", color: "#FFFFFF" }}>
                      {(AD_MODAL_TEXT[uiLang] || AD_MODAL_TEXT.en).cta}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>

          {/* 2. 연도 모드용 광고 모달 */}
          <Modal
            visible={yearAdPromptVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setYearAdPromptVisible(false)}
          >
            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center" }}>
              <View style={{ width: 280, borderRadius: 16, paddingHorizontal: 20, paddingVertical: 18, backgroundColor: "#FFFFFF" }}>
                <View style={{ alignItems: 'flex-end', marginBottom: 8 }}>
                  <Pressable onPress={() => setYearAdPromptVisible(false)} hitSlop={10}>
                    <Text style={{ fontSize: 18, fontWeight: "700", color: "#9CA3AF" }}>✕</Text>
                  </Pressable>
                </View>
                <Text style={{ fontSize: 12, fontWeight: '600', color: "#10B981", marginBottom: 4 }}>
                  {(AD_YEAR_MODAL_TEXT[uiLang] || AD_YEAR_MODAL_TEXT.en).badge}
                </Text>
                <Text style={{ fontSize: 16, fontWeight: '700', color: "#111827", marginBottom: 8 }}>
                  {(AD_YEAR_MODAL_TEXT[uiLang] || AD_YEAR_MODAL_TEXT.en).title}
                </Text>
                <Text style={{ fontSize: 14, color: "#4b5563", marginBottom: 20, lineHeight: 20 }}>
                  {(AD_YEAR_MODAL_TEXT[uiLang] || AD_YEAR_MODAL_TEXT.en).description}
                </Text>
                <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
                  <Pressable
                    onPress={showRewardedAdForYear}
                    style={{ backgroundColor: "#10B981", borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: "600", color: "#FFFFFF" }}>
                      {(AD_YEAR_MODAL_TEXT[uiLang] || AD_YEAR_MODAL_TEXT.en).cta}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>

        </>
      )}
    </SafeAreaView>
  );
}


// home.js의 refreshTodayFeed 함수 (파일 맨 아래)

export async function refreshTodayFeed() {
  try {
    const currentLanguage = await AsyncStorage.getItem('@app_language') || 'en';
    const today = new Date();

    const tz = Intl?.DateTimeFormat?.().resolvedOptions().timeZone || 'UTC';
    const safeTimezone = safeTimeZone(tz);

    // ⭐ getDayPartsFrom 사용해서 형식 통일
    const todayStart = startOfDayInTz(today, safeTimezone);
    const parts = getDayPartsFrom(todayStart, safeTimezone);
    
    const month = parseInt(parts.m, 10);
    const day = parseInt(parts.d, 10);

    console.log('🔄 [REFRESH FEED] Starting for:', currentLanguage, `${month}/${day}`);

    const storedCountries = await AsyncStorage.getItem(STORAGE_KEY_SELECTED);
    let selectedCountries = new Set();
    try {
      const arr = storedCountries ? JSON.parse(storedCountries) : [];
      selectedCountries = ensureNonEmptySelection(new Set(arr), currentLanguage);
    } catch {
      selectedCountries = ensureNonEmptySelection(new Set(), currentLanguage);
    }

    const chosen = [...selectedCountries];
    console.log('🔍 [REFRESH FEED] Selected countries:', chosen);
    
    if (!chosen.length) {
      console.error('❌ [REFRESH FEED] No countries selected');
      const defaultMessages = {
        ko: '오늘의 역사를 확인하세요',
        en: 'Check today in history',
        ja: '今日の歴史を確認してください'
      };
      return defaultMessages[currentLanguage] || defaultMessages.en;
    }

    const poolsByCid = {};
    for (const cid of chosen) {
      try {
        console.log(`🔍 [REFRESH FEED] Loading cache for ${cid}...`);
        let rows = await loadCache(cid, parts);
        console.log(`🔍 [REFRESH FEED] Cache result for ${cid}:`, rows ? `${rows.length} items` : 'none');

        if (!Array.isArray(rows) || !rows.length) {
          console.log(`📥 [REFRESH FEED] No cache, fetching fresh data for ${cid}...`);
          const isoDate = `${parts.y}-${String(parts.m).padStart(2, '0')}-${String(parts.d).padStart(2, '0')}`;
          rows = await apiFetchForMode(cid, parts, isoDate);
          console.log(`🔍 [REFRESH FEED] Fetch result for ${cid}:`, rows ? `${rows.length} items` : 'none');

          if (rows && rows.length) {
            await saveCache(cid, parts, rows);
            console.log(`✅ [REFRESH FEED] Saved ${rows.length} items to cache for ${cid}`);
          }
        }

        if (Array.isArray(rows) && rows.length) {
          const arr = [];
          for (const r of rows) {
            const body = bodyOfRowByLang(r, currentLanguage, cid);
            if (!hasAnyText(body)) continue;

            const y = String(r?.Year || r?.year || '');
            const d = String(r?.Date || r?.date || '');
            const unique = hash32(`${y}|${d}|${body}|${JSON.stringify(r)}`);

            arr.push({
              cid,
              row: r,
              key: `${cid}|${y}|${d}|h${unique}`,
              body,
            });
          }
          if (arr.length) {
            poolsByCid[cid] = arr;
            console.log(`✅ [REFRESH FEED] Added ${arr.length} valid items for ${cid}`);
          }
        }
      } catch (e) {
        console.warn(`[REFRESH FEED] Failed to fetch ${cid}:`, e);
      }
    }

    console.log('🔍 [REFRESH FEED] Total pools:', Object.keys(poolsByCid).length);
    console.log('🔍 [REFRESH FEED] Pool sizes:', Object.entries(poolsByCid).map(([k, v]) => `${k}: ${v.length}`).join(', '));

    const hasAny = Object.values(poolsByCid).some(arr => arr && arr.length);
    if (!hasAny) {
      console.error('❌ [REFRESH FEED] No data available after processing all countries');
      const defaultMessages = {
        ko: '오늘의 역사를 확인하세요',
        en: 'Check today in history',
        ja: '今日の歴史를 확인してください'
      };
      return defaultMessages[currentLanguage] || defaultMessages.en;
    }

    const isoDate = `${parts.y}-${String(parts.m).padStart(2, '0')}-${String(parts.d).padStart(2, '0')}`;
    const seedKey = `${isoDate}__${chosen.sort().join(',')}__refresh`;

    console.log('🎲 [REFRESH FEED] Picking event with seed:', seedKey);
    const pick = await pickOneWithSeenRotation(
      poolsByCid,
      chosen,
      isoDate,
      seedKey
    );

    if (!pick) {
      console.error('❌ [REFRESH FEED] Failed to pick event');
      const defaultMessages = {
        ko: '오늘의 역사를 확인하세요',
        en: 'Check today in history',
        ja: '今日の歴史를 확인してください'
      };
      return defaultMessages[currentLanguage] || defaultMessages.en;
    }

    console.log('✅ [REFRESH FEED] Picked event from:', pick.cid);

    const label = COUNTRY_CFG[pick.cid]?.label?.[currentLanguage] ||
      COUNTRY_CFG[pick.cid]?.label?.en ||
      pick.cid;

    const eventYear = getYearFromRow(pick.row);
    const yearNum = parseInt(String(eventYear || ''), 10);
    const baseYear = parseInt(String(parts.y), 10);
    const mNum = parseInt(String(parts.m), 10) || 1;
    const dNum = parseInt(String(parts.d), 10) || 1;

    let dateLabel = '';
    if (!Number.isNaN(yearNum) && yearNum > 0) {
      if (currentLanguage === 'ko') {
        dateLabel = `${yearNum}년 ${mNum}월 ${dNum}일`;
      } else if (currentLanguage === 'ja') {
        dateLabel = `${yearNum}年${mNum}月${dNum}日`;
      } else {
        const monthNames = [
          "January", "February", "March", "April", "May", "June",
          "July", "August", "September", "October", "November", "December"
        ];
        const monthName = monthNames[mNum - 1] || String(mNum);
        dateLabel = `${monthName} ${dNum}, ${yearNum}`;
      }
    }

    const maxBodyLen = currentLanguage === 'ko' || currentLanguage === 'ja' ? 50 : 80;
    const bodyText = pick.body || '';
    const truncatedBody = bodyText.length > maxBodyLen
      ? `${bodyText.slice(0, maxBodyLen)}...`
      : bodyText;

    let finalBody = '';
    if (currentLanguage === 'ko') {
      finalBody = `${dateLabel}, ${label}: ${truncatedBody}`;
    } else if (currentLanguage === 'ja') {
      finalBody = `${dateLabel}、${label}: ${truncatedBody}`;
    } else {
      finalBody = `${dateLabel}, ${label}: ${truncatedBody}`;
    }

    // ⭐ 알림에 사용된 이벤트 키 저장
    await AsyncStorage.multiSet([
      ['@notification_body', finalBody],
      ['@notification_language', currentLanguage],
      ['@notification_event_key', pick.key],  // ⭐ 추가
      ['@notification_event_date', isoDate],  // ⭐ 추가
    ]);

    console.log('✅ [REFRESH FEED] Success:', finalBody.substring(0, 50) + '...');
    return finalBody;

  } catch (error) {
    console.error('❌ [REFRESH FEED] Error:', error);
    try {
      const currentLanguage = await AsyncStorage.getItem('@app_language') || 'en';
      const defaultMessages = {
        ko: '오늘의 역사를 확인하세요',
        en: 'Check today in history',
        ja: '今日の歴史를 확인してください'
      };
      return defaultMessages[currentLanguage] || defaultMessages.en;
    } catch {
      return 'Check today in history';
    }
  }
}

export async function initializeDefaultData(uiLang, tz) {
  try {
    const today = startOfDayInTz(new Date(), tz);
    const parts = getDayPartsFrom(today, tz);
    const isoDate = `${parts.y}-${parts.m}-${parts.d}`;
    
    console.log('🚀 [INIT] Loading default data for:', { uiLang, date: isoDate });
    
    // 기본 국가 설정 (언어에 따라)
    const defaultCountries = DEFAULT_COUNTRIES_BY_LANG[uiLang] || DEFAULT_COUNTRIES_BY_LANG.default;
    
    // 각 기본 국가의 데이터 로드 및 캐시
    for (const cid of defaultCountries) {
      try {
        // 캐시가 이미 있는지 확인
        const cached = await loadCache(cid, parts);
        if (cached && cached.length > 0) {
          console.log(`✅ [INIT] Cache already exists for ${cid}`);
          continue;
        }
        
        // 캐시가 없으면 로드
        console.log(`📥 [INIT] Loading data for ${cid}...`);
        const rows = await apiFetchForMode(cid, parts, isoDate);
        
        if (rows && rows.length > 0) {
          await saveCache(cid, parts, rows);
          console.log(`✅ [INIT] Cached ${rows.length} items for ${cid}`);
        }
      } catch (e) {
        console.warn(`⚠️ [INIT] Failed to load ${cid}:`, e);
      }
    }
    
    // 기본 알림 본문 생성 (실패해도 계속 진행)
    try {
      await refreshTodayFeed();
      console.log('✅ [INIT] Notification body initialized');
    } catch (e) {
      console.warn('⚠️ [INIT] Failed to initialize notification body:', e);
    }
    
    console.log('✅ [INIT] Default data initialization complete');
    
  } catch (error) {
    console.error('❌ [INIT] Failed to initialize default data:', error);
  }
}
