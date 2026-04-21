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
import {
  getString,
  setString,
  remove as removeKey,
  getJSON,
  setJSON,
  multiGet as safeMultiGet,
  multiSet as safeMultiSet,
} from "../../lib/storageSafe";
import {
  onRefresh,
  onGoPrevDay,
  onGoNextDay,
  onShareAttach,
  emitCountriesChanged,

} from "../../lib/bus";
// import { fetchWikipediaImageFromAnchors } from "../../lib/wikipediaSearch";
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
import StrokeText from '../../lib/stroketext';
import { useCapsuleToast } from "../../components/CapsuleToastProvider";

// 광고 테스트
// const ADS_ENABLED = false;

// AsyncStorage wrapper (routes everything through lib/storageSafe.js)
// - 기존 코드의 AsyncStorage.getItem/setItem/multiGet/multiSet 호출은 유지
// - 내부 구현만 storageSafe로 통일해서 try/catch/JSON 파싱/기본값 처리를 한 곳에서 관리
const AsyncStorage = {
  getItem: (key) => getString(key, null),
  setItem: async (key, value) => {
    await setString(key, value);
  },
  removeItem: async (key) => {
    await removeKey(key);
  },
  multiGet: async (keys) => {
    const map = await safeMultiGet(keys || []);
    return (keys || []).map((k) => [k, map?.[k] ?? null]);
  },
  multiSet: async (pairs) => {
    await safeMultiSet(pairs || []);
  },
};

mobileAds()
  .initialize()
  .then(() => {
    console.log('[AD] mobileAds initialized');
  });

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
const YEAR_MAX_EVENTS_PER_COUNTRY = 11;
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
const STORAGE_KEY_WORLD_PICK_CACHE_PREFIX = "@world_pick_cache_v1:"; // seedKey -> pickKey


const STORAGE_KEY_YEAR_ROT_INDEX = "@year_rot_idx_v1:";
const STORAGE_KEY_YEAR_BASE = "@year_base_v1:";

const fontColorOptions = [
  { name: 'Black', value: '#000000', useStroke: false },
  { name: 'White', value: '#FFFFFF', useStroke: false },
  { name: 'Red', value: '#FF0000', useStroke: false },
  { name: 'Orange', value: '#FF8000', useStroke: false },
  { name: 'Yellow', value: '#FFFF00', useStroke: false },
  { name: 'Green', value: '#00FF00', useStroke: false },
  { name: 'Blue', value: '#0000FF', useStroke: false },
  // ⭐ These must match look-and-feels.js exactly:
  { name: 'Black with White Outline', value: 'BLACK_WHITE_OUTLINE', useStroke: true, strokeColor: '#FFFFFF', strokeWidth: 3, fillColor: '#000000' },
  { name: 'White with Black Outline', value: 'WHITE_BLACK_OUTLINE', useStroke: true, strokeColor: '#000000', strokeWidth: 3, fillColor: '#FFFFFF' },
  { name: 'Pink', value: '#FF69B4', useStroke: false },
  { name: 'Cyan', value: '#00FFFF', useStroke: false },
  { name: 'Magenta', value: '#FF00FF', useStroke: false },
  { name: 'Lime', value: '#32CD32', useStroke: false },
  { name: 'Brown', value: '#8B4513', useStroke: false },
];
function getYearPlaylistKey(cid) {
  return `@year_playlist_v5:${cid}`;
}
function getYearDayBaseKey() {
  return `@year_day_base_v2`;
}
function clampInt(v, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}
function randomInt(min, max) {
  const a = Math.ceil(min);
  const b = Math.floor(max);
  if (b < a) return a;
  return a + Math.floor(Math.random() * (b - a + 1));
}

// 데이터 캐시 TTL (6시간)
const DATA_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const DATA_CACHE_VERSION = "v5";

// 리워드 광고 시청 후 12시간 패스
const STORAGE_KEY_REWARD_PASS_UNTIL = "@reward_pass_until_v1";
const REWARD_PASS_DURATION_MS = 12 * 60 * 60 * 1000; // 12시간

// World 모드: "오늘의 역사" 무료 새로고침 3회 제한(하루 단위)
const STORAGE_KEY_WORLD_TODAY_FREE_COUNT_PREFIX = "@world_today_free_count_v1:";
const WORLD_TODAY_FREE_LIMIT = 2;


const COUNTRY_CFG = {
  world: {
    id: "world",
    label: {
      en: "World",
      ko: "세계",
      ja: "世界",
      sc: "世界",   // 简体中文
      tc: "世界",   // 繁體中文
      es: "Mundo",
      fr: "Monde",
    },
    lang: "en",
  },
  korea: {
    id: "korea",
    label: {
      en: "Korea",
      ko: "한국",
      ja: "韓国",
      sc: "韩国",
      tc: "韓國",
      es: "Corea",
      fr: "Corée",
    },
    lang: "ko",
  },
  japan: {
    id: "japan",
    label: {
      en: "Japan",
      ko: "일본",
      ja: "日本",
      sc: "日本",
      tc: "日本",
      es: "Japón",
      fr: "Japon",
    },
    lang: "ja",
  },
  china: {
    id: "china",
    label: {
      en: "China",
      ko: "중국",
      ja: "中国",
      sc: "中国",
      tc: "中國",
      es: "China",
      fr: "Chine",
    },
    lang: "sc", // 중국 이벤트 기본 언어
  },
};




const DEFAULT_COUNTRIES_BY_LANG = {
  en: ["world"],
  ko: ["world"],  // "korea" → "world"
  ja: ["world"],  // "japan" → "world"
  sc: ["world"],  // "china" → "world"
  tc: ["world"],  // "china" → "world"
  "zh-Hans": ["world"],
  "zh-Hant": ["world"],
  "zh-hans": ["world"],
  "zh-hant": ["world"],
  es: ["world"],
  fr: ["world"],
  default: ["world"],
};

const LANG_SWITCH_DEFAULT = {
  ko: ["korea"],
  ja: ["japan"],
  sc: ["china"],
  tc: ["china"],
  "zh-Hans": ["china"],
  "zh-Hant": ["china"],
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

const APP_DOWNLOAD_URL = "https://histree.onelink.me/c9TM/bfbeczqo";

const UI_STR = {
  // title: {
  //   ko: {
  //     prev: "어제의 역사",
  //     today: "오늘의 역사",
  //     next: "내일의 역사",
  //   },
  //   en: {
  //     prev: "Yesterday in History",
  //     today: "Today in History",
  //     next: "Tomorrow in History",
  //   },
  //   ja: {
  //     prev: "昨日の歴史",
  //     today: "今日の歴史",
  //     next: "明日の歴史",
  //   },
  //   sc: {
  //     prev: "昨日历史",
  //     today: "今日历史",
  //     next: "明日历史",
  //   },
  //   tc: {
  //     prev: "昨日歷史",
  //     today: "今日歷史",
  //     next: "明日歷史",
  //   },
  //   es: {
  //     prev: "Ayer en la historia",
  //     today: "Hoy en la historia",
  //     next: "Mañana en la historia",
  //   },
  //   fr: {
  //     prev: "Hier dans l’histoire",
  //     today: "Aujourd’hui dans l’histoire",
  //     next: "Demain dans l’histoire",
  //   },
  // },

  // yearTitle: {
  //   ko: {
  //     base: "연도별 역사",
  //   },
  //   en: {
  //     base: "Year in History",
  //   },
  //   ja: {
  //     base: "年の歴史",
  //   },
  //   sc: {
  //     base: "这一年的历史",
  //   },
  //   tc: {
  //     base: "這一年的歷史",
  //   },
  // },

  empty: {
    ko: "표시할 항목이 없습니다.",
    en: "No items to display.",
    ja: "表示する項目がありません。",
    sc: "没有可显示的内容。",
    tc: "沒有可顯示的內容。",
    es: "No hay elementos para mostrar.",
    fr: "Aucun élément à afficher.",
  },

  imageLoading: {
    ko: "사진을 불러오는 중입니다…",
    en: "Loading image…",
    ja: "画像を読み込み中…",
    sc: "正在加载图片…",
    tc: "正在載入圖片…",
    es: "Cargando imagen…",
    fr: "Chargement de l’image…",
  },

  yearLimitDone: {
    ko: "오늘 볼 수 있는 역사 이벤트를 모두 보셨습니다.\n지금까지 본 11개를 순서대로 다시 볼 수 있어요.",
    en: "You’ve seen all history events available for today.\nYou can now browse again through the 11 events you’ve already viewed.",
    ja: "本日見られる歴史イベントはすべて見ました。\nこれまでに見た11件を順番にもう一度見ることができます。",
    sc: "今天可以查看的历史事件都已经看完了。\n现在可以按顺序再次浏览这 11 条内容。",
    tc: "今天可以查看的歷史事件都已經看完了。\n現在可以依序再次瀏覽這 11 則內容。",
    es: "Has visto todos los eventos históricos disponibles para hoy.\nAhora puedes volver a recorrer los 11 eventos que ya viste.",
    fr: "Vous avez vu tous les événements historiques disponibles aujourd’hui.\nVous pouvez maintenant revoir les 11 événements que vous avez déjà consultés.",
  },

  // navMiniPopup: {
  //   prev: {
  //     ko: "어제",
  //     en: "Yesterday",
  //     ja: "昨日",
  //     sc: "昨天",
  //     tc: "昨天",
  //     es: "Ayer",
  //     fr: "Hier",
  //   },
  //   next: {
  //     ko: "내일",
  //     en: "Tomorrow",
  //     ja: "明日",
  //     sc: "明天",
  //     tc: "明天",
  //     es: "Mañana",
  //     fr: "Demain",
  //   },
  // }
};




const AD_MODAL_TEXT = {
  en: {
    title: "Enjoy Histree Pro for 12 Hours",
    subTitle: "Watch one ad and Get",
    description:
      "- No video ads\n" +
      "- Explore more historical events\n" +
      "- Access to Yesterday and Tomorrow in World History",
    cta: "Watch Ad",
  },

  ko: {
    title: "Histree Pro 12시간 무료 이용",
    subTitle: "광고 1회 시청 시 혜택",
    description:
      "- 동영상 광고 없이 사용\n" +
      "- 한·중·일의 더 많은 역사 사건 탐색\n" +
      "- 세계 역사 어제·내일 이용 가능",
    cta: "광고 보기",
  },

  ja: {
    title: "Histree Pro を12時間無料で利用",
    subTitle: "広告1回視聴時の特典",
    description:
      "- 動画広告なしで利用可能\n" +
      "- 日・韓・中のより多くの歴史的出来事を探索\n" +
      "- 世界史の「昨日・明日」を利用可能",
    cta: "広告を見る",
  },

  sc: {
    title: "免费使用 Histree Pro 12 小时",
    subTitle: "广告观看 1 次的奖励",
    description:
      "- 无视频广告\n" +
      "- 探索更多日韩中的历史事件\n" +
      "- 可查看世界历史的昨天与明天",
    cta: "看广告",
  },

  tc: {
    title: "免費使用 Histree Pro 12 小時",
    subTitle: "觀看廣告 1 次的獎勵",
    description:
      "- 無影片廣告\n" +
      "- 探索更多日韓中的歷史事件\n" +
      "- 可查看世界歷史的昨天與明天",
    cta: "看廣告",
  },

  es: {
    title: "Disfruta de Histree Pro durante 12 horas",
    subTitle: "Beneficio por ver un anuncio una vez",
    description:
      "- Sin anuncios de video\n" +
      "- Explora más eventos históricos\n" +
      "- Accede al ayer y al mañana de la historia mundial",
    cta: "Ver anuncio",
  },

  fr: {
    title: "Profitez de Histree Pro pendant 12 heures",
    subTitle: "Avantage pour un visionnage de publicité",
    description:
      "- Sans publicité vidéo\n" +
      "- Explorez davantage d’événements historiques\n" +
      "- Accès au passé et au futur de l’histoire mondiale",
    cta: "Voir la publicité",
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
const UI_COL = {
  ko: "한국어",
  en: "English",
  ja: "日本語",
  sc: "简体中文",
  tc: "繁體中文",
  es: "Español",
  fr: "Français",
};
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

const REWARD_ICONS = {
  frame28: require("../../assets/reward-icon/Frame 28.png"),
  frame29: require("../../assets/reward-icon/Frame 29.png"),
  frame31: require("../../assets/reward-icon/Frame 31.png"),
  mask: require("../../assets/reward-icon/Mask group.png"),
};


// 나라별 헤더 배경 이미지 (각 7장씩)
const HERO_BG_IMAGES = {
  korea: [
    require("../../assets/bg-images/k-photo1(low).jpg"),
    require("../../assets/bg-images/k-photo2(low).jpg"),
    require("../../assets/bg-images/k-photo3(low).jpg"),
    require("../../assets/bg-images/k-photo4(low).jpg"),
    require("../../assets/bg-images/k-photo5(low).jpg"),
    require("../../assets/bg-images/k-photo6(low).jpg"),
    require("../../assets/bg-images/k-photo7(low).jpg"),
  ],
  japan: [
    require("../../assets/bg-images/j-photo1(low).jpg"),
    require("../../assets/bg-images/j-photo2(low).jpg"),
    require("../../assets/bg-images/j-photo3(low).jpg"),
    require("../../assets/bg-images/j-photo4(low).jpg"),
    require("../../assets/bg-images/j-photo5(low).jpg"),
    require("../../assets/bg-images/j-photo6(low).jpg"),
    require("../../assets/bg-images/j-photo7(low).jpg"),
  ],
  world: [
    require("../../assets/bg-images/uk-photo1(low).jpg"),
    require("../../assets/bg-images/uk-photo2(low).jpg"),
    require("../../assets/bg-images/uk-photo3(low).jpg"),
    require("../../assets/bg-images/uk-photo4(low).jpg"),
    require("../../assets/bg-images/uk-photo5(low).jpg"),
    require("../../assets/bg-images/uk-photo6(low).jpg"),
    require("../../assets/bg-images/uk-photo7(low).jpg"),
  ],
  china: [
    require("../../assets/bg-images/c-photo1(low).png"),
    require("../../assets/bg-images/c-photo2(low).png"),
    require("../../assets/bg-images/c-photo3(low).png"),
    require("../../assets/bg-images/c-photo4(low).png"),
    require("../../assets/bg-images/c-photo5(low).png"),
    require("../../assets/bg-images/c-photo6(low).png"),
    require("../../assets/bg-images/c-photo7(low).png"),
  ],
};

const DEFAULT_HERO_BG = require("../../assets/bg-images/k-photo1(low).jpg");
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

// 실제 광고 ID는 env로 주입합니다.
// - 개발 모드: Google 테스트 광고 사용
// - 릴리즈 모드: EXPO_PUBLIC_* 값 사용
const BANNER_AD_UNIT_ID = __DEV__
  ? TestIds.BANNER
  : Platform.select({
    android: process.env.EXPO_PUBLIC_ADMOB_BANNER_ANDROID || "ca-app-pub-3506417530430977/1617936328",
    ios: process.env.EXPO_PUBLIC_ADMOB_BANNER_IOS || "ca-app-pub-3506417530430977/9692555821",
  });

const REWARDED_AD_UNIT_ID = __DEV__
  ? TestIds.REWARDED
  : Platform.select({
    android: process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID || "ca-app-pub-3506417530430977/6711644622",
    ios: process.env.EXPO_PUBLIC_ADMOB_REWARDED_IOS || "ca-app-pub-3506417530430977/3270617708",
  });

const HAS_BANNER_AD = Boolean(BANNER_AD_UNIT_ID);
const HAS_REWARDED_AD = Boolean(REWARDED_AD_UNIT_ID);

//광고 테스트
// const HAS_BANNER_AD = ADS_ENABLED && Boolean(BANNER_AD_UNIT_ID);
// const HAS_REWARDED_AD = ADS_ENABLED && Boolean(REWARDED_AD_UNIT_ID);

if (!__DEV__) {
  if (!HAS_BANNER_AD) {
    console.warn(
      "[AD] Missing banner ad unit ID. Set EXPO_PUBLIC_ADMOB_BANNER_ANDROID / EXPO_PUBLIC_ADMOB_BANNER_IOS."
    );
  }
  if (!HAS_REWARDED_AD) {
    console.warn(
      "[AD] Missing rewarded ad unit ID. Set EXPO_PUBLIC_ADMOB_REWARDED_ANDROID / EXPO_PUBLIC_ADMOB_REWARDED_IOS."
    );
  }
}

function AppBannerAd({ size, requestOptions, ...rest }) {
  if (!HAS_BANNER_AD) return null;

  return (
    <BannerAd
      unitId={BANNER_AD_UNIT_ID}
      size={size}
      requestOptions={{
        requestNonPersonalizedAdsOnly: true,
        ...(requestOptions || {}),
      }}
      {...rest}
    />
  );
}

// 전역 보상형 광고 인스턴스
const rewardedAd = HAS_REWARDED_AD
  ? RewardedAd.createForAdRequest(REWARDED_AD_UNIT_ID, {
    requestNonPersonalizedAdsOnly: true,
  })
  : null;

function notifyRewardedAdUnavailable() {
  console.warn(
    "[AD] Rewarded ad is unavailable. Set EXPO_PUBLIC_ADMOB_REWARDED_ANDROID / EXPO_PUBLIC_ADMOB_REWARDED_IOS."
  );
  if (Platform.OS === "android") {
    ToastAndroid.show("광고 설정이 아직 완료되지 않았습니다.", ToastAndroid.SHORT);
  }
}

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
// 유틸
function resolveUiLangFromDevice() {
  try {
    const locales = Localization.getLocales?.();
    if (Array.isArray(locales) && locales.length > 0) {
      const l0 = locales[0] || {};
      const languageCode = String(l0.languageCode || "").toLowerCase(); // ko/ja/en/zh
      const scriptCode = String(l0.scriptCode || "").toLowerCase();     // hans/hant
      const languageTag = String(l0.languageTag || l0.localeIdentifier || "").toLowerCase(); // zh-hant, zh-tw...

      if (languageCode === "ko") return "ko";
      if (languageCode === "ja") return "ja";
      if (languageCode === "en") return "en";

      if (languageCode === "zh") {
        if (scriptCode === "hant") return "tc";
        if (scriptCode === "hans") return "sc";

        if (languageTag.includes("hant")) return "tc";
        if (languageTag.includes("hans")) return "sc";

        if (
          languageTag.includes("-tw") || languageTag.includes("_tw") ||
          languageTag.includes("-hk") || languageTag.includes("_hk") ||
          languageTag.includes("-mo") || languageTag.includes("_mo")
        ) return "tc";

        return "sc";
      }

      return "en";
    }
  } catch (e) {
    console.log("[LOCALIZATION] getLocales error:", e);
  }

  // fallback
  const raw = Localization.locale || "en";
  return normalizeUiLang(raw, "en");
}



function normalizeUiLang(value, fallback = "en") {
  const v = String(value || "").toLowerCase();
  if (!v) return fallback;

  // 1) 이미 우리가 쓰는 내부 코드면 그대로
  if (v === "ko") return "ko";
  if (v === "ja") return "ja";
  if (v === "en") return "en";
  if (v === "sc") return "sc";
  if (v === "tc") return "tc";
  if (v === "es") return "es";
  if (v === "fr") return "fr";
  if (v === "zh-hant") return "tc";
  if (v === "zh-hans") return "sc";

  // 2) 중국어 변형들: 값 전체에서 판단
  //   - zh-Hant / zh_TW / zh-HK 등 → 번체(tc)
  // 번체(tc)
  if (
    v.includes("zh-hant") ||
    v.includes("zh_tw") || v.includes("zh-tw") ||
    v.includes("zh_hk") || v.includes("zh-hk") ||
    v.includes("zh_mo") || v.includes("zh-mo")
  ) return "tc";

  // 간체(sc)
  if (
    v.includes("zh-hans") ||
    v.includes("zh_cn") || v.includes("zh-cn") ||
    v.includes("zh_sg") || v.includes("zh-sg")
  ) return "sc";

  //   - 그냥 zh 만 들어오면 기본은 간체(sc)
  if (v === "zh") return "sc";

  // 3) 언어코드 앞부분으로 대략 처리 (예: en-US, ko-KR, es-MX 등)
  const base = v.split(/[-_]/)[0];
  if (base === "ko") return "ko";
  if (base === "ja") return "ja";
  if (base === "en") return "en";
  if (base === "es") return "es";
  if (base === "fr") return "fr";

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
    year: parts.year,
    m: parts.month,
    month: parts.month,
    d: parts.day,
    day: parts.day,
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

  if (base === "tc") {
    order = ["tc", "sc", "English", "한국어", "日本語"];
  }
  else if (base === "sc" || base === "zh") {
    order = ["sc", "tc", "English", "한국어", "日本語"];
  }
  else if (base === "ko") {
    order = ["한국어", "English", "日本語", "sc", "tc"];
  }
  else if (base === "ja") {
    order = ["日本語", "English", "한국어", "sc", "tc"];
  }
  else {
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


async function pickYearEventSequential(poolsByCid, cid, isoDate, baseYear) {
  // 1) 이 나라의 year 모드 풀
  const pool = poolsByCid[cid] || [];
  if (!pool.length) return null;

  // 오늘/이 기준연도에서 실제로 쓰는 최대 개수 (하루에 볼 수 있는 리스트)
  const maxLen = Math.min(pool.length, YEAR_MAX_EVENTS_PER_COUNTRY);

  // 2) 나라 + 날짜 + 기준연도 기준으로 인덱스 관리
  const parts = [STORAGE_KEY_YEAR_ROT_INDEX, cid, isoDate];
  if (baseYear != null) {
    parts.push(String(baseYear));
  }
  const idxKey = parts.join(":");

  let curIdx = 0;
  try {
    const raw = await AsyncStorage.getItem(idxKey);
    const n = parseInt(raw || "0", 10);
    if (!Number.isNaN(n) && n >= 0) {
      curIdx = n;
    }
  } catch {
    // ignore
  }

  //  0 ~ maxLen-1 범위 안에서만 인덱스 사용
  const safeIdx = curIdx % maxLen;
  const pick = pool[safeIdx];

  // 다음 새로고침을 위해 인덱스 +1 저장 (역시 0 ~ maxLen-1만 순환)
  const nextIdx = (safeIdx + 1) % maxLen;
  try {
    await AsyncStorage.setItem(idxKey, String(nextIdx));
  } catch {
    // ignore
  }

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


function getCurrentFontColorOption(fontColor) {
  const option = fontColorOptions.find(opt => opt.value === fontColor);
  if (option) return option;

  // Fallback: if the saved color is a hex code that matches an outline option's fillColor
  // (for backward compatibility with old saved data)
  const legacyOption = fontColorOptions.find(opt =>
    opt.useStroke && opt.fillColor === fontColor
  );
  if (legacyOption) return legacyOption;

  return fontColorOptions[0]; // Default to Black
}

function renderHistoryText(text, fontSize, fontColor, fontFamily, lineHeight, customBgImage) {
  console.log('📝 [RENDER] fontColor received:', fontColor);

  const currentOption = getCurrentFontColorOption(fontColor);

  console.log('📝 [RENDER] currentOption:', {
    name: currentOption.name,
    value: currentOption.value,
    useStroke: currentOption.useStroke,
    strokeColor: currentOption.strokeColor,
    strokeWidth: currentOption.strokeWidth
  });

  if (currentOption.useStroke) {
    console.log('✅ [RENDER] Using StrokeText');
    return (
      <StrokeText
        text={text}
        strokeColor={currentOption.strokeColor}
        strokeWidth={currentOption.strokeWidth}
        style={[{
          marginTop: 4,
          marginBottom: 14,
          fontSize: fontSize,
          lineHeight: lineHeight,
          fontFamily: fontFamily,
          color: currentOption.fillColor || currentOption.value, // ⭐ Use fillColor
          textAlign: 'left',
        }]}
      />
    );
  }

  console.log('❌ [RENDER] Using regular Text');
  return (
    <Text
      style={{
        marginTop: 4,
        marginBottom: 14,
        fontSize: fontSize,
        lineHeight: lineHeight,
        fontFamily: fontFamily,
        color: fontColor,
        textAlign: 'left',
      }}
    >
      {text}
    </Text>
  );
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
  value,
  onChange,
  fixedHeight = 38,
}) {
  const { scale } = useUIScale();

  const BIG_W = 323;
  const BIG_H = 37;
  const BIG_RADIUS = 80;

  const COUNT = Math.min(4, ordered.length);

  // ✅ GAP 선언을 먼저 (기존엔 GAP을 선언 전에 써서 위험)
  const GAP = 10;

  // (폭 계산을 유지하고 싶으면 그대로 둬도 됨)
  const BTN_W = Math.floor((BIG_W - GAP * (COUNT - 1)) / COUNT);
  const BTN_H = 38;
  const BTN_RADIUS = 100;

  const ICON = 16;

  const selectedId = value && value.size ? [...value][0] : null;

  const handlePress = (id) => {
    if (selectedId === id) return;
    onChange(new Set([id]));
    emitCountriesChanged(id);
  };

  const fontFamily = Platform.OS === "ios" ? "Arial" : "sans-serif";

  return (
    <View
      style={{
        width: scale(BIG_W),
        height: scale(BIG_H),
        borderRadius: BIG_RADIUS,
        overflow: "hidden",
        backgroundColor: "rgba(255,255,255,0.6)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.5)",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 4,
        shadowOpacity: 0.25,
        elevation: 4,
      }}
    >
      <BlurView intensity={15} tint="light" style={StyleSheet.absoluteFillObject} />

      <View
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: scale(4),
          gap: 4,
        }}
      >
        {ordered.slice(0, 4).map((id, idx) => {
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

                // ✅ 가운데 정렬로 변경 (짧은 글자일 때 오른쪽이 남아보이는 문제 해결)
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",

                // ✅ 기존 paddingLeft/Right로 “왼쪽 박힘” 만들던 걸 제거/축소
                paddingHorizontal: scale(6),

                backgroundColor: active ? "#FFFFFF" : "transparent",
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
                  fontSize: 13,
                  fontWeight: "600",
                  color: "#000",
                  // (선택) 글자만이라도 중앙 느낌 강화
                  textAlign: "center",
                }}
                numberOfLines={1}
              >
                {label}
              </Text>
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
  const [bgSettingsLoaded, setBgSettingsLoaded] = useState(false);
  const [webViewLoaded, setWebViewLoaded] = useState(false);
  const [adHeight, setAdHeight] = useState(50); // Reduced default height
  const [showContent, setShowContent] = useState(true);

  // Reset states when modal opens
  useEffect(() => {
    if (visible && url) {
      setAdLoaded(false);
      setBgSettingsLoaded(false);
      setWebViewLoaded(false);
      setShowContent(false);
      loadBackgroundSettings();
    }
  }, [visible, url]);

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
    } finally {
      setBgSettingsLoaded(true);
    }
  };

  // Show content immediately when background settings are loaded
  // Don't wait for ad or webview
  useEffect(() => {
    if (bgSettingsLoaded) {
      setShowContent(true);
    }
  }, [bgSettingsLoaded]);

  if (!visible || !url) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: bgImage ? 'transparent' : bgColor, paddingTop: 0 }}>
        {/* Hidden preloader for ad */}
        <View
          style={{
            position: 'absolute',
            top: -9999,
            left: -9999,
            width: 320,
            opacity: 0,
            zIndex: -1,
          }}
        >
          <View onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            if (h > 0) setAdHeight(h);
          }}>
            <AppBannerAd
              size={BannerAdSize.BANNER}
              requestOptions={{
                requestNonPersonalizedAdsOnly: true,
              }}
              onAdLoaded={() => {
                console.log("[WEBVIEW AD PRELOAD] Ad loaded");
                setAdLoaded(true);
              }}
              onAdFailedToLoad={(error) => {
                console.warn("[WEBVIEW AD PRELOAD] Failed to load:", error);
                setAdLoaded(true);
              }}
            />
          </View>
        </View>

        {/* Actual content */}
        <View style={{
          flex: 1,
          // opacity: showContent ? 1 : 0 
        }}>
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

          {/* Header with Ad Banner - Fixed height with reduced padding */}
          <View
            style={{
              height: adHeight,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 0,
              paddingVertical: 0,
              margin: 0,
              backgroundColor: bgImage ? 'rgba(255,255,255,0.9)' : bgColor,
              borderBottomWidth: 1,
              borderBottomColor: "#E5E7EB",
            }}
          >
            <View style={{ margin: 0, padding: 0 }}>
              <AppBannerAd
                size={BannerAdSize.BANNER}
                requestOptions={{
                  requestNonPersonalizedAdsOnly: true,
                }}
              />
            </View>
          </View>

          {/* Page Title with close button */}
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

            <View style={{ width: scale(8) + scale(16) }} />
          </View>

          {/* WebView */}
          <WebView
            source={{ uri: url }}
            style={{ flex: 1 }}
            startInLoadingState={false}
            onLoad={() => {
              console.log("[WEBVIEW] Loaded");
              setWebViewLoaded(true);
            }}
            onError={() => {
              console.log("[WEBVIEW] Error");
              setWebViewLoaded(true);
            }}
          />
        </View>
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
  status,
  imageUrl,
  maxWidth = 340,
  screenWidth,
  cardBg = "none",
  customBgColor = null,
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const [imageSize, setImageSize] = useState(null);
  const [displayUrl, setDisplayUrl] = useState(null);
  const [loading, setLoading] = useState(status === "loading");
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const prevUrlRef = useRef(null);

  const BG_MAP = {
    none: "#FFFFFF",
    bg1: "#F9FAFB",
    bg2: "#FFF7ED",
    bg3: "#ECFEFF",
  };

  const bgColor = isValidColorString(customBgColor)
    ? customBgColor.trim()
    : BG_MAP[cardBg] ?? "#FFFFFF";

  useEffect(() => {
    // 1) 로딩
    if (status === "loading") {
      setLoading(true);
      setImageFailed(false);
      setImageSize(null);
      setDisplayUrl(null);
      prevUrlRef.current = null;
      fadeAnim.setValue(0);
      return;
    }

    // 2) 이미지 없음 → 광고
    if (status === "no-image") {
      setLoading(false);
      setImageFailed(false);
      setImageSize(null);
      setDisplayUrl(null);
      prevUrlRef.current = null;
      fadeAnim.setValue(0);
      return;
    }

    // 3) ready (이미지 표시)
    if (status === "ready" && imageUrl) {
      setLoading(true);
      setImageFailed(false);
      setImageSize(null);
      setDisplayUrl(null);

      prevUrlRef.current = imageUrl;
      fadeAnim.setValue(0);

      const timer = setTimeout(() => {
        if (prevUrlRef.current !== imageUrl) return;

        if (Platform.OS === "ios") {
          RNImage.getSize(
            imageUrl,
            (width, height) => {
              if (prevUrlRef.current !== imageUrl) return;
              setImageSize({ width, height });
              setDisplayUrl(imageUrl);
              setLoading(false); // ⭐ 추가
            },
            () => {
              if (prevUrlRef.current !== imageUrl) return;
              setImageFailed(true);
              setLoading(false);
            }
          );
        } else {
          setImageSize({ width: maxWidth, height: maxWidth * 0.6 });
          setDisplayUrl(imageUrl);
          setLoading(false); // ⭐ 추가
        }
      }, 50);

      return () => clearTimeout(timer);
    }
  }, [status, imageUrl, maxWidth, fadeAnim]);

  const handleImageLoad = useCallback(
    (e) => {
      setLoading(false);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      if (Platform.OS === "android" && e?.source) {
        const { width, height } = e.source;
        if (width && height) setImageSize({ width, height });
      }
    },
    [fadeAnim]
  );

  const handleImageError = useCallback(() => {
    console.log('❌ [BANNER] Image failed to load');
    setImageFailed(true);
    setLoading(false);
  }, []);

  // ✅ 1) 로딩
  if (status === "loading") {
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
        <Text style={{ marginTop: 8, fontSize: 12, color: "#999" }}>
          Loading...
        </Text>
      </View>
    );
  }

  // ✅ 2) 이미지 없음 → 광고
  if (status === "no-image") {
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
        <AppBannerAd
          size={BannerAdSize.MEDIUM_RECTANGLE}
          requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        />
      </View>
    );
  }

  // ✅ 3) ready인데 imageFailed면 광고로 전환
  if (status === "ready" && imageFailed) {
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
        <AppBannerAd
          size={BannerAdSize.MEDIUM_RECTANGLE}
          requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        />
      </View>
    );
  }

  // ✅ 4) ready인데 아직 준비 중
  if (status === "ready" && (!imageSize || !displayUrl)) {
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

  if (!imageSize) {
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

  // ✅ 5) 이미지 렌더
  const { width: imgWidth, height: imgHeight } = imageSize;
  const aspectRatio = imgWidth / imgHeight;
  const isLandscape = aspectRatio > 1;

  if (isLandscape) {
    const displayWidth = screenWidth;
    const displayHeight = displayWidth / aspectRatio;

    return (
      <View style={{ position: "relative" }}>
        {loading && (
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: bgColor,
              zIndex: 10,
            }}
          >
            <ActivityIndicator size="small" color="#999" />
          </View>
        )}

        <ScrollView
          horizontal={false}
          showsVerticalScrollIndicator={true}
          style={{ width: displayWidth, maxHeight: screenWidth * 1.2 }}
          contentContainerStyle={{ alignItems: "center" }}
        >
          <Animated.View
            style={{
              width: displayWidth,
              height: displayHeight,
              backgroundColor: bgColor,
              opacity: fadeAnim,
            }}
          >
            <ExpoImage
              key={displayUrl}
              source={{
                uri: displayUrl,
                headers: {
                  "User-Agent": "Histree/1.0 (Educational History App)",
                  Referer: "https://en.wikipedia.org/",
                },
              }}
              style={{ width: "100%", height: "100%" }}
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

  // portrait
  const displayWidth = Math.min(maxWidth, imgWidth);
  const displayHeight = displayWidth / aspectRatio;

  return (
    <View style={{ position: "relative" }}>
      {loading && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: bgColor,
            zIndex: 10,
            borderRadius: 12,
          }}
        >
          <ActivityIndicator size="small" color="#999" />
        </View>
      )}

      <ScrollView
        horizontal={false}
        showsVerticalScrollIndicator={true}
        style={{
          width: displayWidth,
          maxHeight: maxWidth * 1.5,
          alignSelf: "center",
        }}
        contentContainerStyle={{ alignItems: "center" }}
      >
        <Animated.View
          style={{
            width: displayWidth,
            height: displayHeight,
            borderRadius: 12,
            backgroundColor: bgColor,
            overflow: "hidden",
            opacity: fadeAnim,
          }}
        >
          <ExpoImage
            key={displayUrl}
            source={{
              uri: displayUrl,
              headers: {
                "User-Agent": "Histree/1.0 (Educational History App)",
                Referer: "https://en.wikipedia.org/",
              },
            }}
            style={{ width: "100%", height: "100%" }}
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
  } else if (uiLang === "sc" || uiLang === "tc") {
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
  // storageSafe로 JSON/에러 처리를 통일
  await setJSON(key, {
    t: Date.now(),
    rows,
  });
}

async function loadCache(mode, parts) {
  const key = cacheKey(mode, parts);
  // parse 실패/키 없음은 null로 처리
  const obj = await getJSON(key, null);
  if (!obj?.t || !Array.isArray(obj?.rows)) return null;
  if (Date.now() - obj.t > DATA_CACHE_TTL_MS) return null;
  return obj.rows;
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
        sc: it.sc || it["简体中文"] || it["zh-Hans"] || it["zh-hans"] || "",
        tc: it.tc || it["繁體中文"] || it["zh-Hant"] || it["zh-hant"] || "",

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

  const FS = fontSize || 12;
  const R = 21;

  // 폰트 커질수록 pill도 커지게
  const padV = Math.max(6, Math.round(FS * 0.45));      // 세로 패딩
  const minH = Math.max(24, Math.round(FS * 2.0));      // 최소 높이

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
              minHeight: minH,              // ✅ 고정 height 대신 minHeight
              borderRadius: R,
              backgroundColor: "#242424",
              borderWidth: 1,
              borderColor: "#FFFFFF",
              paddingHorizontal: 12,
              paddingVertical: padV,        // ✅ 폰트에 따라 박스도 커짐
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
// home.js의 computeBannerUrlForPick 함수 수정

// async function computeBannerUrlForPick(pick, uiLang) {
//   const nativeLang = COUNTRY_CFG[pick.cid]?.lang || "en";

//   const anchors = getAnchorsForLang(pick.row, nativeLang);
//   console.log('🔍 [IMAGE] Found anchors:', anchors.length);

//   let imageUrl = null;

//   // ✅ 각 앵커를 순차적으로 시도 (최대 2개)
//   for (let i = 0; i < Math.min(anchors.length, 2); i++) {
//     const anchorText = anchors[i]?.text;
//     if (!anchorText) continue;

//     console.log(`🔍 [IMAGE] Trying anchor ${i + 1}:`, anchorText);

//     try {
//       const result = await withTimeout(
//         fetchWikipediaImageFromAnchors([anchorText], nativeLang),
//         3000 // 각 앵커당 3초
//       );

//       if (result) {
//         console.log(`✅ [IMAGE] Found image from anchor ${i + 1}`);
//         imageUrl = result;
//         break; // 성공하면 즉시 종료
//       }
//     } catch (e) {
//       console.warn(`⚠️ [IMAGE] Anchor ${i + 1} failed:`, e.message);
//       // 다음 앵커 시도
//     }
//   }



//   // ✅ 이미지 최적화
//   if (imageUrl) {
//     try {
//       const best = await bestWikiThumb(imageUrl, 640);
//       imageUrl = best || sanitizeImageUrl(imageUrl);
//       console.log('✅ [IMAGE] Final optimized URL:', imageUrl ? 'success' : 'failed');
//     } catch (e) {
//       console.warn('⚠️ [IMAGE] Optimization failed:', e.message);
//       imageUrl = sanitizeImageUrl(imageUrl);
//     }
//   }

//   return imageUrl || null;
// }

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
        // ✅ 풀(pool)은 언어와 무관하게 "row 기준"으로 유지해야 함
        // (언어 변경 시에도 playlist key 매칭이 깨지지 않도록)
        const bodyPrimary = bodyOfRowByLang(r, uiLang, cid);

        // 번역이 비어있어도 row는 유지하고, 표시용 body만 fallback
        const bodyFallback = trimHtml(
          r?.English ||
          r?.["한국어"] ||
          r?.["日本語"] ||
          r?.["简体中文"] ||
          r?.["繁體中文"] ||
          ""
        );

        const body = hasAnyText(bodyPrimary) ? bodyPrimary : bodyFallback;
        if (!hasAnyText(body)) continue;

        const y = String(r?.Year ?? r?.year ?? "");
        const d = String(r?.Date ?? r?.date ?? "");

        // ✅ key는 절대 언어 텍스트를 섞지 말기 (언어 바뀌어도 동일 key 유지)
        const unique = hash32(`${cid}|${y}|${d}|${JSON.stringify(r)}`);

        pool.push({
          cid,
          row: r,
          key: `${cid}|${y}|${d}|h${unique}`,
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



  const toast = useCapsuleToast();



  // ✅ Pull-to-refresh로 화면이 내려간 채로 남는 문제 방지용
  const mainScrollRef = useRef(null);
  const scrollMainToTop = useCallback((animated = false) => {
    try {
      mainScrollRef.current?.scrollTo?.({ y: 0, animated });
    } catch {
      // noop
    }
  }, []);

  const normalizeScrollAfterAdPrompt = useCallback(() => {
    // 광고 모달이 뜨거나 닫힐 때, 아래로 내려간 상태(갭)에서 로딩이 끼는 현상 방지
    scrollMainToTop(false);
    setIsRefreshing(false);
    setSoftRefreshing(false);
    scrollMainToTop(false);
  }, [scrollMainToTop]);




  // 연도 모드 시청 카운트 & 패스
  // 나라별로 몇 개 봤는지 저장
  const [yearSeenGroups, setYearSeenGroups] = useState({
    korea: 0,
    japan: 0,
    china: 0,
  });
  // ✅ World/Year 공통 리워드 패스 (광고를 어디서 보든 동일하게 적용)
  //광고 테스트
  const [rewardPassUntil, setRewardPassUntil] = useState(0);
  //const [rewardPassUntil, setRewardPassUntil] = useState(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const [yearAdPromptVisible, setYearAdPromptVisible] = useState(false);
  const [notificationEventKey, setNotificationEventKey] = useState(null);



  // 초기 데이터 복원 (패스, 본 횟수, +보고 있던 연도)
  useEffect(() => {
    // 오늘 날짜 기준 isoDate
    const today = startOfDayInTz(new Date(), tz);
    const { y, m, d } = getDayPartsFrom(today, tz);
    const isoDate = `${y}-${m}-${d}`;

    (async () => {
      try {
        const [worldPassRaw, yearPassRaw, seenRaw, cursorRaw] = await AsyncStorage.multiGet([
          STORAGE_KEY_REWARD_PASS_UNTIL,
          STORAGE_KEY_YEAR_PASS_UNTIL, // 구버전(마이그레이션용)
          STORAGE_KEY_YEAR_SEEN_GROUPS,
          STORAGE_KEY_YEAR_CURSOR_SAVED,
        ]);

        // ✅ 리워드 패스 통합: World/Year 어디서 광고를 봐도 동일한 패스 사용
        // 구버전 Year 패스가 남아있으면 더 큰 값으로 통합해서 저장
        const now = Date.now();
        const worldTs = worldPassRaw?.[1] ? parseInt(worldPassRaw[1], 10) : 0;
        const yearTs = yearPassRaw?.[1] ? parseInt(yearPassRaw[1], 10) : 0;
        const merged = Math.max(Number.isFinite(worldTs) ? worldTs : 0, Number.isFinite(yearTs) ? yearTs : 0);
        if (merged && merged > now) {
          setRewardPassUntil(merged);
        }
        // (선택) 한 번이라도 합쳐졌으면 통합 키로 다시 저장
        if (merged && merged > 0) {
          AsyncStorage.setItem(STORAGE_KEY_REWARD_PASS_UNTIL, String(merged)).catch(() => { });
        }

        if (seenRaw?.[1]) {
          const obj = JSON.parse(seenRaw[1]);

          if (obj?.isoDate === isoDate) {
            // v1: 예전 버전 { isoDate, count: number } 일 때 → 3개 나라에 공통으로 적용
            if (typeof obj.count === "number") {
              setYearSeenGroups({
                korea: obj.count,
                japan: obj.count,
                china: obj.count,
              });
            }
            // v2: 새 버전 { isoDate, countByCid: { korea, japan, china } }
            else if (obj.countByCid && typeof obj.countByCid === "object") {
              setYearSeenGroups({
                korea: obj.countByCid.korea ?? 0,
                japan: obj.countByCid.japan ?? 0,
                china: obj.countByCid.china ?? 0,
              });
            }
          }
        }

        // 보고 있던 연도 복원 (날짜가 같을 때만)
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


  // 나라별 무료 새로고침 횟수
  const YEAR_FREE_REFRESH_LIMIT_BY_CID = {
    korea: 2,
    japan: 2,
    china: 2,
  };

  // 광고 한 번 시청 시 추가로 볼 수 있는 개수
  const YEAR_EXTRA_EVENTS_AFTER_AD = 10; // 지금은 설명용, 필요하면 나중에 계산에 쓸 수 있음


  // 연도 모드: 오늘의 플레이리스트(12개) 상태
  const [currentYearPlaylist, setCurrentYearPlaylist] = useState([]);
  const [yearCurrentIndex, setYearCurrentIndex] = useState(0);

  // 한/중/일 연도 모드에서 "더 보기" 가능 여부
  const canSeeMoreYearEvents = useMemo(() => {
    if (!isYearMode) return false;
    if (!currentCid || currentCid === "world") return false;
    if (!yearYears || !yearYears.length) return false;

    const hasPass = rewardPassUntil && rewardPassUntil > Date.now();
    const seenForCid = yearSeenGroups[currentCid] ?? 0;
    const freeLimit = YEAR_FREE_REFRESH_LIMIT_BY_CID[currentCid] ?? 0;

    // 패스 없을 때: 무료 새로고침 횟수까지만 허용
    if (!hasPass) {
      return seenForCid < freeLimit;
    }

    // 패스 있을 때: 12개를 다 봤어도 계속 새로고침 가능
    return true;
  }, [
    isYearMode,
    currentCid,
    yearYears,
    rewardPassUntil,
    yearSeenGroups,
  ]);

  // yesterday,tomorrow toast

  const ANDROID_EXTRA_BOTTOM =
    Platform.OS === "android" ? (insets?.bottom ?? 20) : 0;

  const [navToast, setNavToast] = useState({
    visible: false,
    text: "",
    side: null,
  });

  const navToastTimerRef = useRef(null);




  const latestUiLangRef = useRef(uiLang);
  const latestCidRef = useRef(currentCid);

  useEffect(() => {
    latestUiLangRef.current = uiLang;
  }, [uiLang]);

  useEffect(() => {
    latestCidRef.current = currentCid;
  }, [currentCid]);

  const NAV_POPUP_TEXT = {
    prev: { ko: "어제", en: "Yesterday", ja: "昨日", sc: "昨天", tc: "昨天" },
    next: { ko: "내일", en: "Tomorrow", ja: "明日", sc: "明天", tc: "明天" },
  };

  function getPopupLangByCountry(_cid, uiLang) {
    return uiLang || "en";
  }

  const showNavToast = async (side) => {
    const now = Date.now();

    // 광고 이미 봤으면 토스트 안 띄움
    if (rewardPassUntil && rewardPassUntil > now) {
      setNavToast((prev) => ({ ...prev, visible: false }));
      return;
    }

    let storedLang = "en";
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY_UI_LANG);
      storedLang = normalizeUiLang(raw, latestUiLangRef.current || "en");
    } catch {
      storedLang = normalizeUiLang(latestUiLangRef.current, "en");
    }

    const lang = storedLang || "en";

    const text =
      side === "left"
        ? (NAV_POPUP_TEXT.prev[lang] || NAV_POPUP_TEXT.prev.en)
        : (NAV_POPUP_TEXT.next[lang] || NAV_POPUP_TEXT.next.en);

    if (navToastTimerRef.current) {
      clearTimeout(navToastTimerRef.current);
      navToastTimerRef.current = null;
    }

    setNavToast({
      visible: true,
      text,
      side,
    });

    navToastTimerRef.current = setTimeout(() => {
      setNavToast((prev) => ({ ...prev, visible: false }));
      navToastTimerRef.current = null;
    }, 1200);
  };




  //연도가 바뀔 때마다 저장 (앱 강제종료 대비)
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

  async function persistYearIndex(cid, newIndex) {
    const today = startOfDayInTz(new Date(), tz);
    const { y, m, d } = getDayPartsFrom(today, tz);
    const isoDate = `${y}-${m}-${d}`;
    const key = getYearPlaylistKey(cid);

    try {
      const raw = await AsyncStorage.getItem(key);
      if (raw) {
        const state = JSON.parse(raw);
        if (state.isoDate === isoDate) {
          state.currentIndex = newIndex;
          await AsyncStorage.setItem(key, JSON.stringify(state));
        }
      }
    } catch (e) {
      console.warn("[YEAR] Update index failed", e);
    }
  }
  const applyYearIndex = useCallback(
    (cid, newIndex) => {
      const playlist = currentYearPlaylist;
      const pool = yearPoolRef.current[cid] || [];
      if (!playlist || !playlist.length) return;
      if (!pool || !pool.length) return;

      const max = playlist.length;
      const safeIdx = ((newIndex % max) + max) % max; // 음수 방지

      const keyToFind = playlist[safeIdx];
      const pick = pool.find((p) => p.key === keyToFind);
      if (!pick) return;

      setYearCurrentIndex(safeIdx);
      setOnePick([pick]);
      setHeaderImageUrl(null);

      const pickYear = parseInt(getYearFromRow(pick.row), 10) || null;
      setYearCursor(pickYear);
      baseYearRef.current = pickYear;
    },
    [currentYearPlaylist]
  );


  const handlePressYearMore = useCallback(async () => {
    if (!isYearMode) return;
    if (!currentCid || currentCid === "world") return;
    if (!currentYearPlaylist || !currentYearPlaylist.length) return;

    const now = Date.now();
    const hasPass = rewardPassUntil && rewardPassUntil > now;

    const currentIdx = yearCurrentIndex;
    const maxLimit = currentYearPlaylist.length;

    // 1) 패스 있는 경우: 그냥 계속 순환
    if (hasPass) {
      const nextIdx = (currentIdx + 1) % maxLimit;
      applyYearIndex(currentCid, nextIdx);
      await persistYearIndex(currentCid, nextIdx);
      return;
    }

    // 2) 패스 없는 경우: 0→1 까지는 허용, 그 다음은 광고 모달
    if (currentIdx < 2) {
      const nextIdx = currentIdx + 1;
      applyYearIndex(currentCid, nextIdx);
      await persistYearIndex(currentCid, nextIdx);
    } else {
      // iOS에서 모달 거절/닫기 시 스크롤이 내려간 채로 남아 갭이 생기는 현상 방지
      normalizeScrollAfterAdPrompt();
      setYearAdPromptVisible(true);
    }
  }, [
    isYearMode,
    currentCid,
    currentYearPlaylist,
    yearCurrentIndex,
    rewardPassUntil,
    applyYearIndex,
  ]);


  const handleCloseYearAdPrompt = useCallback(async () => {
    // 모달 닫기
    setYearAdPromptVisible(false);

    // 스크롤/리프레시 상태 정리 (특히 iOS에서 거절 시 내려간 채로 남는 문제 방지)
    normalizeScrollAfterAdPrompt();

    // 이미 패스(광고 시청) 있으면 아무 것도 안 함
    const now = Date.now();
    const hasPass = rewardPassUntil && rewardPassUntil > now;
    if (hasPass) return;

    // 연도 모드가 아니거나, 나라/플레이리스트가 없으면 패스
    if (!isYearMode) return;
    if (!currentCid || currentCid === "world") return;
    if (!currentYearPlaylist || !currentYearPlaylist.length) return;

    // 2번째 이벤트(index=1)에 그대로 머물기 (화면 + 저장 모두 1)
    applyYearIndex(currentCid, 2);
    await persistYearIndex(currentCid, 2);
  }, [
    isYearMode,
    currentCid,
    currentYearPlaylist,
    rewardPassUntil,
    applyYearIndex,
    persistYearIndex,
  ]);





  function showNextYearGroup() {
    // Year 모드에서 "한 번 더 보기" = refreshTick 올려서 로딩 useEffect 다시 돌리기
    setIsRefreshing(true);
    setRefreshTick((t) => t + 1);
  }
  async function updateYearSeenCount(cid, nextCountForCid) {
    const today = startOfDayInTz(new Date(), tz);
    const { y, m, d } = getDayPartsFrom(today, tz);
    const isoDate = `${y}-${m}-${d}`;

    setYearSeenGroups((prev) => {
      const nextMap = {
        ...prev,
        [cid]: nextCountForCid,
      };

      // v2 구조로 저장: { isoDate, countByCid: { korea, japan, china } }
      AsyncStorage.setItem(
        STORAGE_KEY_YEAR_SEEN_GROUPS,
        JSON.stringify({ isoDate, countByCid: nextMap })
      ).catch((e) => {
        console.warn("[YEAR] save count failed", e);
      });

      return nextMap;
    });
  }


  // // ✅ ads init을 한 번만 하도록 보장
  // const adsInitRef = useRef(false);
  // const adsInitPromiseRef = useRef(null);

  // function ensureAdsInitialized() {
  //   if (adsInitRef.current) return Promise.resolve(true);
  //   if (adsInitPromiseRef.current) return adsInitPromiseRef.current;

  //   adsInitPromiseRef.current = mobileAds()
  //     .initialize()
  //     .then(() => {
  //       adsInitRef.current = true;
  //       return true;
  //     })
  //     .catch((e) => {
  //       adsInitRef.current = false;
  //       adsInitPromiseRef.current = null;
  //       throw e;
  //     });

  //   return adsInitPromiseRef.current;
  // }


  // // 광고 보상 처리 (연도 모드)
  // async function onRewardedForYear() {
  //   const now = Date.now();
  //   const until = now + REWARD_PASS_DURATION_MS;

  //   setYearAdUnlockedUntil(until);
  //   try {
  //     await AsyncStorage.setItem(STORAGE_KEY_YEAR_PASS_UNTIL, String(until));
  //   } catch (e) { }

  //   setYearAdPromptVisible(false);

  //   if (!currentCid || currentCid === "world") return;
  //   if (!currentYearPlaylist || !currentYearPlaylist.length) return;

  //   const nextIdx = (yearCurrentIndex + 1) % currentYearPlaylist.length;
  //   applyYearIndex(currentCid, nextIdx);
  //   await persistYearIndex(currentCid, nextIdx);
  // }


  // // 보상형 광고가 로드될 때까지 기다렸다가 show() (로드 전 show 에러 방지)
  // function waitForRewardedLoaded(timeoutMs = 8000) {
  //   return new Promise((resolve, reject) => {
  //     if (rewardedAd.loaded) {
  //       resolve(true);
  //       return;
  //     }

  //     let done = false;
  //     let unsubLoaded = null;
  //     let unsubErr = null;

  //     const finish = (ok, val) => {
  //       if (done) return;
  //       done = true;
  //       try { unsubLoaded && unsubLoaded(); } catch { }
  //       try { unsubErr && unsubErr(); } catch { }
  //       if (ok) resolve(val);
  //       else reject(val);
  //     };

  //     const timer = setTimeout(() => {
  //       clearTimeout(timer);
  //       finish(false, new Error("rewarded_load_timeout"));
  //     }, timeoutMs);

  //     unsubLoaded = rewardedAd.addAdEventListener(
  //       RewardedAdEventType.LOADED,
  //       () => {
  //         clearTimeout(timer);
  //         finish(true, true);
  //       }
  //     );

  //     unsubErr = rewardedAd.addAdEventListener(
  //       AdEventType.ERROR,
  //       (e) => {
  //         clearTimeout(timer);
  //         finish(false, e);
  //       }
  //     );

  //     try {
  //       rewardedAd.load();
  //     } catch (e) {
  //       clearTimeout(timer);
  //       finish(false, e);
  //     }
  //   });
  // }

  // ... 기존 코드 ...

  async function showRewardedAdForYear() {
    console.log("📺 [AD] showRewardedAdForYear called");

    if (!rewardedAd) {
      notifyRewardedAdUnavailable();
      return;
    }

    if (adShowLockRef.current) return;

    if (!rewardedAd.loaded) {
      rewardedAd.load();
      if (Platform.OS === "android") {
        ToastAndroid.show("광고를 준비 중입니다. 잠시 후 다시 시도해주세요.", ToastAndroid.SHORT);
      }
      return;
    }

    adShowLockRef.current = true;

    // 1. 연도 보상임을 명시
    pendingNavRef.current = "year_reward";

    // 2. 플래그를 true로 설정
    shouldShowAdRef.current = true;

    // 3. 연도 전용 모달 닫기
    setYearAdPromptVisible(false);

    // // 3️⃣ [중요] 모달이 완전히 사라질 시간을 준 뒤 광고를 실행합니다.
    // setTimeout(() => {
    //   console.log("🎬 [AD] Showing rewarded ad now (after delay)");
    //   try {
    //     rewardedAd.show();
    //   } catch (e) {
    //     console.error("❌ [AD] Show failed:", e);
    //     adShowLockRef.current = false;
    //     pendingNavRef.current = null;
    //   }
    // }, 1000); // 0.5초 지연


    // ✅ 안드로이드는 onDismiss 믿지 말고 여기서 show()까지 실행
    if (Platform.OS === "android") {
      InteractionManager.runAfterInteractions(() => {
        setTimeout(() => {
          try {
            console.log("🎬 [AD] Showing year reward ad (android)");
            rewardedAd.show();
          } catch (e) {
            console.error("❌ [AD] Show failed:", e);
            adShowLockRef.current = false;
            pendingNavRef.current = null;
          }
        }, 250);
      });
    }
  }


  async function showRewardedAdForWorld() {
    console.log("📺 [AD] showRewardedAdForWorld called");

    if (!rewardedAd) {
      notifyRewardedAdUnavailable();
      return;
    }

    if (adShowLockRef.current) return;

    if (!rewardedAd.loaded) {
      rewardedAd.load();
      if (Platform.OS === "android") {
        ToastAndroid.show("광고를 준비 중입니다. 잠시 후 다시 시도해주세요.", ToastAndroid.SHORT);
      }
      return;
    }
    // 작업 시작: 락(Lock) 걸기
    adShowLockRef.current = true;

    // 1. 보상 타입 설정 (이미 이전에 설정되었다면 생략 가능하지만 명시하면 안전함)
    // 예: pendingNavRef.current = "world_today_more"; 

    // 2. 플래그를 true로 설정 (onDismiss에서 광고를 띄우게 함)
    shouldShowAdRef.current = true;

    // 3. 모달 닫기
    setAdPromptVisible(false);

    // 2️⃣ pendingNavRef는 이미 설정됨 (-1, 1, 'world_today_more')

    // 3️⃣ [중요] 모달이 완전히 사라질 시간을 준 뒤 광고를 실행합니다.
    // setTimeout(() => {
    //   console.log("🎬 [AD] Showing rewarded ad for:", pendingNavRef.current);
    //   try {
    //     rewardedAd.show();
    //   } catch (e) {
    //     console.error("❌ [AD] Show failed:", e);
    //     adShowLockRef.current = false;
    //     pendingNavRef.current = null;
    //   }
    // }, 1000); // 0.5초 지연
    if (Platform.OS === "android") {
      InteractionManager.runAfterInteractions(() => {
        setTimeout(() => {
          try {
            console.log("🎬 [AD] Showing world reward ad (android)");
            rewardedAd.show();
          } catch (e) {
            console.error("❌ [AD] Show failed:", e);
            adShowLockRef.current = false;
            pendingNavRef.current = null;
          }
        }, 250);
      });
    }
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

  // =========================
  // Year Session (24h) + 17세기(1600) 기준 로직
  //  - uiLang별로 24시간 동안 baseYear 고정
  //  - baseYear < 1600: 한/중/일 각각 "1600 미만" 랜덤 year 선택
  //  - baseYear >= 1600: 한/중/일이 baseYear와 같거나 가장 가까운 year 선택
  //  - 각 나라별로 선택된 year에서부터 pool을 정렬한 뒤 12개를 순차 playlist로 저장
  // =========================

  // 🇰🇷🇯🇵🇨🇳 Year 모드: 나라별 '랜덤 시작 연도'를 뽑고, 그 연도부터 최대 11개를 순차로 보여줍니다.
  // - 자정이 지나도 화면은 그대로 유지
  // - 새로고침(또는 탭 전환 등으로 로딩이 다시 돌 때) isoDate가 바뀌어 있으면 새로운 11개로 갱신

  const STORAGE_KEY_YEAR_LAST_START_YEAR_PREFIX = "@year_last_start_year_v1:";

  function getYearListFromPool(pool) {
    const ys = [];
    const seen = new Set();
    for (const it of pool || []) {
      const y = parseInt(getYearFromRow(it.row), 10);
      if (!Number.isNaN(y) && y > 0 && !seen.has(y)) {
        seen.add(y);
        ys.push(y);
      }
    }
    return ys;
  }

  function buildSequentialPlaylistFromPool(pool, startYear, count) {
    if (!Array.isArray(pool) || pool.length === 0) return [];

    const sorted = pool
      .slice()
      .sort((a, b) => {
        const ya = parseInt(getYearFromRow(a.row), 10) || 0;
        const yb = parseInt(getYearFromRow(b.row), 10) || 0;
        if (ya !== yb) return ya - yb;
        // 안정적 정렬
        return String(a.key || "").localeCompare(String(b.key || ""));
      });

    // start index: startYear가 있으면 그 year의 첫 번째, 없으면 0
    let startIdx = 0;
    if (startYear != null) {
      for (let i = 0; i < sorted.length; i++) {
        const y = parseInt(getYearFromRow(sorted[i].row), 10) || 0;
        if (y === startYear) {
          startIdx = i;
          break;
        }
      }
    }

    const max = Math.min(sorted.length, count);
    const keys = [];
    for (let i = 0; i < max; i++) {
      const idx = (startIdx + i) % sorted.length;
      keys.push(sorted[idx].key);
    }
    return keys;
  }

  async function pickRandomStartYearForDay(pool, isoDate, cid) {
    const years = getYearListFromPool(pool);
    if (!years.length) return null;

    // 날짜 + 나라 기준으로 '하루에 한 번 고정되는' 랜덤
    const rnd = xorshift(hash32(`yday:${isoDate}:${cid}`));
    let idx = Math.floor(rnd() * years.length);
    if (idx < 0) idx = 0;
    if (idx >= years.length) idx = years.length - 1;

    let picked = years[idx];

    // 전날과 같은 연도면(가능하면) 한 칸 밀어서 다른 연도 선택
    try {
      const lastRaw = await AsyncStorage.getItem(`${STORAGE_KEY_YEAR_LAST_START_YEAR_PREFIX}${cid}`);
      const last = parseInt(lastRaw || "", 10);
      if (!Number.isNaN(last) && years.length > 1 && last === picked) {
        picked = years[(idx + 1) % years.length];
      }
    } catch { }

    try {
      await AsyncStorage.setItem(`${STORAGE_KEY_YEAR_LAST_START_YEAR_PREFIX}${cid}`, String(picked));
    } catch { }

    return picked;
  }

  const STORAGE_KEY_YEAR_EVT_IDX = "@year_evt_idx_v1:";

  async function pickYearEventRotate(pool, targetYear, isoDate, cid) {
    if (!Array.isArray(pool) || !pool.length) return null;

    const yearStr = String(targetYear || "").trim();
    const targetYearNum = parseInt(yearStr || "", 10);

    // 1) 기본 후보: 전체 pool
    let candidates = pool;

    if (yearStr) {
      // 1-1) 먼저 targetYear와 "연도가 정확히 같은" 것만 필터
      const sameYear = pool.filter(
        (it) => getYearFromRow(it.row) === yearStr
      );

      if (sameYear.length) {
        // 같은 연도가 하나라도 있으면 → 그 안에서만 순차 회전
        candidates = sameYear;
      } else if (!Number.isNaN(targetYearNum)) {
        // 1-2) 같은 연도가 없으면 → targetYear와 "가까운 연도" 순으로 정렬해서 사용
        const withMeta = pool.map((it, idx) => {
          const yStr = getYearFromRow(it.row);
          const yNum = parseInt(yStr || "", 10);
          const diff = Number.isNaN(yNum)
            ? Number.POSITIVE_INFINITY
            : Math.abs(yNum - targetYearNum);
          return { it, idx, diff };
        });

        withMeta.sort((a, b) => {
          if (a.diff !== b.diff) return a.diff - b.diff; // 연도 차이 작은 것부터
          return a.idx - b.idx; // 같은 diff면 원래 데이터 순서
        });

        candidates = withMeta.map((x) => x.it);
      }
      // yearStr 는 있는데 parseInt 실패하면 → 그냥 전체 pool 그대로 사용
    }

    if (!candidates.length) return null;

    // 2) 나라 + 날짜 + 연도 기준 회전 인덱스 키
    const idxKey = `${STORAGE_KEY_YEAR_ROT_INDEX}${cid}:${isoDate}:${yearStr || "all"
      }`;

    let curIdx = 0;
    try {
      const raw = await AsyncStorage.getItem(idxKey);
      const n = parseInt(raw || "0", 10);
      if (!Number.isNaN(n) && n >= 0) {
        curIdx = n;
      }
    } catch {
      // ignore
    }

    // 3) 현재 인덱스로 하나 선택 (완전 "순차")
    const pick = candidates[curIdx % candidates.length];

    // 4) 다음 새로고침을 위해 인덱스 +1 저장
    const nextIdx = (curIdx + 1) % candidates.length;
    try {
      await AsyncStorage.setItem(idxKey, String(nextIdx));
    } catch {
      // ignore
    }

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

  // --- 날짜(자정) 변경 감지용 ---
  // 앱을 켜둔 채로 자정을 넘기면 useMemo(screenDate)가 자동으로 다시 계산되지 않습니다.
  // 그래서 focus / refresh / AppState(active) 시점에 dayAnchor를 올려 화면 날짜를 갱신합니다.
  const [dayAnchor, setDayAnchor] = useState(0);
  const lastIsoRef = useRef(null);

  const getIsoTodayNow = useCallback(() => {
    const todayStart = startOfDayInTz(new Date(), tz);
    const p = safeFormatParts(todayStart, tz);
    return `${p.year}-${p.month}-${p.day}`;
  }, [tz]);

  const bumpDayAnchorIfMidnightPassed = useCallback(() => {
    const isoNow = getIsoTodayNow();
    if (lastIsoRef.current == null) {
      lastIsoRef.current = isoNow;
      return false;
    }
    if (lastIsoRef.current !== isoNow) {
      lastIsoRef.current = isoNow;
      setDayAnchor((x) => x + 1);
      return true;
    }
    return false;
  }, [getIsoTodayNow]);

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
  }, [tz, dayOffset, dayAnchor]);

  const today0 = screenDate.date;
  const todayParts = screenDate.parts;
  const isoDate = screenDate.iso;

  // isoDate가 갱신되면 기준값도 같이 갱신
  useEffect(() => {
    if (isoDate) lastIsoRef.current = isoDate;
  }, [isoDate]);

  const bannerHeight = Math.max(
    60,
    Math.round(Math.min(AD_TARGET.h, Math.min(width, 340) / AD_RATIO))
  );

  const deviceLang = useMemo(
    () => normalizeUiLang(resolveUiLangFromDevice(), "en"),
    []
  );

  const [uiLang, setUiLang] = useState(resolveUiLangFromDevice());

  const clearBadge = async () => {
    try {
      await Notifications.setBadgeCountAsync(0);
      console.log("[BADGE] cleared");
    } catch (e) {
      console.warn("[BADGE] clear failed:", e);
    }
  };



  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      async (response) => {

        await clearBadge();

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
    clearBadge(); // 앱 처음 화면 들어왔을 때

    const sub = AppState.addEventListener("change", async (state) => {
      if (state === "active") {
        await clearBadge();
      }
    });

    return () => sub.remove();
  }, []);

  useEffect(() => {
    console.log("[LANG DEBUG] deviceLang =", deviceLang);
    console.log("[LANG DEBUG] uiLang     =", uiLang);
    console.log("[TZ DEBUG]    tz =", tz);
  }, [deviceLang, uiLang, tz]);

  const [selectedCountries, setSelectedCountries] =
    useState(new Set());



  const [focusedCid, setFocusedCid] = useState(null);

  // 선택 Set이 바뀌면 포커스도 동기화 (탭 UI는 단일 선택이지만 안전장치)
  useEffect(() => {
    const only = getOnlyCountryId(selectedCountries);
    if (only && only !== focusedCid) {
      setFocusedCid(only);
    }
  }, [selectedCountries, focusedCid]);
  // 선택된 나라 1개만 사용 (다중 선택 없음 전제)
  const selectedArr = Array.from(selectedCountries); // Set → 배열
  const currentCid = focusedCid || (selectedArr[0] ?? null);;

  // world만 선택된 경우 → World 모드
  const isWorldMode = currentCid === "world";

  // korea / japan / china 중 하나 선택된 경우 → Year 모드
  const isYearMode = currentCid != null && currentCid !== "world";


  // ✅ Year Mode(한/중/일) 진입 시 어제/내일(dayOffset) 상태를 즉시 초기화
  // - 앱이 꺼졌다 켜져도(복원) 바로 "오늘" 화면으로 맞춰서 네비게이션(어제/내일)이 꼬이지 않게 함
  useEffect(() => {
    if (!hydrated) return;
    if (isYearMode && dayOffset !== 0) {
      setDayOffset(0);
    }
  }, [hydrated, isYearMode, dayOffset]);




  const [softRefreshing, setSoftRefreshing] = useState(false); // iOS에서 화면 안 흔들리게(RefreshControl 미사용)

  const [yearCursor, setYearCursor] = useState(null); // number | null
  const [yearNav, setYearNav] = useState({ canPrev: false, canNext: false });

  const [yearYears, setYearYears] = useState([]);
  const [showYearAdModal, setShowYearAdModal] = useState(false);

  const baseYearRef = useRef(null);


  // 보상형 광고 show() 중복 호출 방지
  const adShowLockRef = useRef(false);
  const yearPoolRef = useRef({
    korea: [],
    japan: [],
    china: [],
  });



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
  const [bannerStatus, setBannerStatus] = useState("loading");
  const [bannerImageUrl, setBannerImageUrl] = useState(undefined);

  const bannerReqIdRef = useRef(0);

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


  // useEffect(() => {
  //   mobileAds()
  //     .initialize()
  //     .then(() => {
  //       console.log("[AD] mobileAds initialized");
  //     });
  // }, []);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      mobileAds()
        .initialize()
        .then(() => console.log("[AD] mobileAds initialized"))
        .catch(() => { });
    });

    return () => task.cancel();
  }, []);


  const bodyLineHeight = Math.round(
    (customFontSize || 18) * 1.45
  );

  const baseFontSize = customFontSize || 18;
  const locationFontSize = baseFontSize;
  const dateFontSize = baseFontSize;

  const anchorFontSize = Math.max(10, baseFontSize - 2);

  const amplitudeReadyRef = useRef(false);
  const lastBackPressRef = useRef(0);
  const lastPickKeyRef = useRef(null);

  const [adPromptVisible, setAdPromptVisible] = useState(false); // "광고 시청 후 이용 가능" 알림창
  const [rewardedLoaded, setRewardedLoaded] = useState(false);   // 광고 로딩 여부
  const pendingNavRef = useRef(null); // -1(어제), +1(내일) 저장
  const rewardEarnedRef = useRef(false);
  const shouldShowAdRef = useRef(false); // ✅ 이 줄을 추가하세요
  const [worldTodayFreeCount, setWorldTodayFreeCount] = useState(0);
  const worldTodayFreeKeyRef = useRef(null);



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
  // ⭐ goBy를 ref로 감싸기
  const goByRef = useRef(goBy);
  useEffect(() => {
    goByRef.current = goBy;
  }, [goBy]);



  // [확인/교체] 어제 보기
  const handlePrevDay = useCallback(() => {
    if (isYearMode) return;

    showNavToast("left");

    const now = Date.now();
    if (rewardPassUntil && rewardPassUntil > now) {
      goBy(-1);
      return;
    }

    pendingNavRef.current = -1;
    normalizeScrollAfterAdPrompt();
    setAdPromptVisible(true);
  }, [rewardPassUntil, goBy, isYearMode, normalizeScrollAfterAdPrompt]);

  // [확인/교체] 내일 보기
  const handleNextDay = useCallback(() => {
    if (isYearMode) return;

    showNavToast("right");

    const now = Date.now();
    if (rewardPassUntil && rewardPassUntil > now) {
      goBy(+1);
      return;
    }

    pendingNavRef.current = +1;
    normalizeScrollAfterAdPrompt();
    setAdPromptVisible(true);
  }, [rewardPassUntil, goBy, isYearMode, normalizeScrollAfterAdPrompt]);


  // World 모드: 오늘(isoDate) 기준 무료 새로고침 카운트 복원
  useEffect(() => {
    if (isYearMode) return;
    // dayOffset은 오늘/어제/내일 UI 이동용이지만, 무료 카운트는 '오늘' 날짜 기준으로만 관리
    const isoToday = `${todayParts?.y}-${todayParts?.m}-${todayParts?.d}`;
    const key = `${STORAGE_KEY_WORLD_TODAY_FREE_COUNT_PREFIX}${isoToday}`;
    worldTodayFreeKeyRef.current = key;

    let alive = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(key);
        const n = parseInt(raw || "0", 10);
        if (!alive) return;
        setWorldTodayFreeCount(Number.isFinite(n) && n >= 0 ? n : 0);
      } catch {
        if (!alive) return;
        setWorldTodayFreeCount(0);
      }
    })();

    return () => {
      alive = false;
    };
  }, [isYearMode, todayParts?.y, todayParts?.m, todayParts?.d]);

  useEffect(() => {
    if (!rewardedAd) {
      console.warn("[AD] Rewarded listener skipped: rewarded ad unit ID is missing.");
      setRewardedLoaded(false);
      return;
    }

    console.log("[AD] Setting up rewarded listener");

    rewardedAd.load();

    const unsubLoaded = rewardedAd.addAdEventListener(
      RewardedAdEventType.LOADED,
      () => {
        console.log("[AD] ✅ Rewarded ad loaded");
        setRewardedLoaded(true);
      }
    );

    // 1️⃣ EARNED_REWARD: 여기서는 무거운 UI 작업(setState, fetch)을 하지 않고 플래그만 세웁니다.
    const unsubEarn = rewardedAd.addAdEventListener(
      RewardedAdEventType.EARNED_REWARD,
      async () => {
        console.log("===========================================");
        console.log("[AD] 🎁 REWARD EARNED! (Flag set)");
        console.log("===========================================");

        // 보상을 받았음을 표시
        rewardEarnedRef.current = true;

        // AsyncStorage 저장은 UI 스레드를 막지 않으므로 여기서 해도 괜찮습니다.
        const pending = pendingNavRef.current;
        const now = Date.now();
        const duration = 12 * 60 * 60 * 1000; // REWARD_PASS_DURATION_MS

        if (pending === -1 || pending === 1 || pending === "world_today_more") {
          const until = now + duration;
          setRewardPassUntil(until); // State 업데이트는 예약되지만 렌더링은 광고 뒤로 밀릴 수 있음
          AsyncStorage.setItem(STORAGE_KEY_REWARD_PASS_UNTIL, String(until)).catch(() => { });
        } else if (pending === "year_reward") {
          // ✅ Year/World 공통 패스
          const until = now + duration;
          setRewardPassUntil(until);
          AsyncStorage.setItem(STORAGE_KEY_REWARD_PASS_UNTIL, String(until)).catch(() => { });
          // (마이그레이션) 구버전 키는 굳이 유지할 필요 없음
          AsyncStorage.removeItem(STORAGE_KEY_YEAR_PASS_UNTIL).catch(() => { });
        }
        setNavToast((prev) => ({ ...prev, visible: false }));

        if (navToastTimerRef.current) {
          clearTimeout(navToastTimerRef.current);
          navToastTimerRef.current = null;
        }
      }
    );

    // 2️⃣ CLOSED: 광고가 닫힌 후, UI를 업데이트하고 화면을 이동합니다. (Freeze 방지 핵심)
    const unsubClose = rewardedAd.addAdEventListener(
      AdEventType.CLOSED,
      () => {
        console.log("[AD] 🚪 Ad closed");

        // 광고가 닫힌 직후 안전하게 실행
        InteractionManager.runAfterInteractions(() => {

          // 보상을 받은 상태라면 여기서 실제 네비게이션/새로고침 수행
          if (rewardEarnedRef.current) {
            console.log("[AD] ⚡ Executing deferred action for:", pendingNavRef.current);
            const pending = pendingNavRef.current;

            if (pending === -1 || pending === 1) {
              goByRef.current(pending);
            }
            else if (pending === "world_today_more") {
              setIsRefreshing(true);
              setRefreshTick((t) => t + 1);
            }
            else if (pending === "year_reward") {
              if (currentCid && currentCid !== "world" && currentYearPlaylist?.length) {
                const nextIdx = (yearCurrentIndex + 1) % currentYearPlaylist.length;
                applyYearIndex(currentCid, nextIdx);
                persistYearIndex(currentCid, nextIdx);
              }
            }

            // 플래그 초기화
            rewardEarnedRef.current = false;
          }

          // 상태 초기화 및 다음 광고 로드
          setRewardedLoaded(false);
          setAdPromptVisible(false);
          setYearAdPromptVisible(false);
          pendingNavRef.current = null;
          adShowLockRef.current = false;

          console.log("[AD] 🔄 Loading next ad");
          rewardedAd.load();
        });
      }
    );

    const unsubError = rewardedAd.addAdEventListener(
      AdEventType.ERROR,
      (error) => {
        console.error("[AD] ❌ Error:", error);
        setRewardedLoaded(false);
        setAdPromptVisible(false);
        setYearAdPromptVisible(false);
        pendingNavRef.current = null;
        adShowLockRef.current = false;
        rewardEarnedRef.current = false; // 에러 시 플래그 초기화

        // 재시도 로직
        setTimeout(() => {
          rewardedAd.load();
        }, 2000);
      }
    );

    return () => {
      console.log("[AD] Cleanup");
      unsubLoaded();
      unsubEarn();
      unsubClose();
      unsubError();
    };
  }, []);



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
    [handlePrevDay, handleNextDay]
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

    // const historyTitle = getHistoryTitle(
    //   lang,
    //   dayOffset,
    //   selectedCountries,
    //   yearDeltaForTitle // 
    // );


    // 최상단 헤더: 예) "Histree: 오늘의 역사"
    const header = `${appName}`;

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
        `*${downloadLabel} - ${APP_DOWNLOAD_URL}`,
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

    const dateLabel =
      p.cid === "world"
        ? formatEventDateLabel(eventYear, todayParts, lang, tz)
        : (() => {
          const yNum = parseInt(String(eventYear || ""), 10);
          if (Number.isNaN(yNum) || yNum <= 0) return "";

          const yOnly = formatOnlyYearLabel(yNum, lang);
          const baseYear = parseInt(String(todayParts?.y || ""), 10);
          const diff = !Number.isNaN(baseYear) ? (baseYear - yNum) : 0;
          const ago = formatYearsAgo(diff, lang);

          return ago ? `${yOnly} ${ago}` : yOnly;
        })();


    const downloadLabel =
      lang === "ko"
        ? "히스트리 앱 다운로드 링크"
        : lang === "ja"
          ? "Histreeアプリのダウンロードリンク"
          : lang === "sc"
            ? "Histree 应用下载链接"
            : lang === "tc"
              ? "Histree 應用下載連結"
              : "Download Histree app";

    const bodyText = (p.body || "").trim();

    const lines = [
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
      const text = [header, payload].filter(Boolean).join("\n").trim();

      const message =
        text || "Histree - 오늘의 역사에서 오늘의 사건을 확인해 보세요.";

      await NativeShare.share({
        message,
        title: header || "Histree",
        url: APP_DOWNLOAD_URL,
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
  const loadBannerImage = useCallback(async ({ row, uiLang, reqId }) => {
    // ✅ 최신 요청 아니면 시작도 안 함
    if (reqId !== bannerReqIdRef.current) return;

    setBannerStatus("loading");
    setBannerImageUrl(null);

    // ✅ debounce: 연속 effect 실행 시 마지막 요청만 실제 HTTP 요청 보내도록
    await new Promise(r => setTimeout(r, 300));
    if (reqId !== bannerReqIdRef.current) return;

    try {
      const cid = row?.cid || 'world';
      const nativeLang = COUNTRY_CFG[cid]?.lang || 'en';

      const anchors = getAnchorsForLang(row, nativeLang);

      let imageUrl = null;

      // ✅ Step 1: Try Wikipedia with anchors 1, 2
      console.log('📚 [IMAGE] Trying Wikipedia...');
      for (let i = 0; i < Math.min(anchors.length, 2); i++) {
        if (reqId !== bannerReqIdRef.current) return;

        const anchor = anchors[i];
        if (!anchor || !anchor.text) continue;

        try {
          const result = await withTimeout(
            fetchWikipediaImageFromAnchors([anchor.text], nativeLang),
            5000
          );

          if (reqId !== bannerReqIdRef.current) return;

          if (result) {
            imageUrl = result;
            console.log(`✅ [IMAGE] Wikipedia succeeded with anchor ${i + 1}`);
            break;
          }
        } catch (e) {
          console.warn(`⚠️ [IMAGE] Wikipedia anchor ${i + 1} failed:`, e.message);
        }
      }

      if (imageUrl) {
        if (reqId !== bannerReqIdRef.current) return;

        try {
          const best = await bestWikiThumb(imageUrl, 640);
          imageUrl = best || sanitizeImageUrl(imageUrl);
          console.log('✅ [IMAGE] Optimization complete');
        } catch (e) {
          console.warn('⚠️ [IMAGE] Optimization failed:', e.message);
          imageUrl = sanitizeImageUrl(imageUrl);
        }
      }

      if (reqId !== bannerReqIdRef.current) return;

      if (imageUrl) {
        setBannerImageUrl(imageUrl);
        setBannerStatus("ready");
        console.log('[IMAGE] Final image set:', imageUrl.substring(0, 50) + '...');
      } else {
        setBannerImageUrl(null);
        setBannerStatus("no-image");
        console.log('[IMAGE] No image found from any source');
      }
    } catch (e) {
      if (reqId !== bannerReqIdRef.current) return;
      console.error('[IMAGE] Fatal error:', e);
      setBannerStatus("no-image");
      setBannerImageUrl(null);
    }
  }, []);



  const handlePullToRefresh = useCallback((source = "button") => {
    const fromPull = source === "pull";

    const triggerRefresh = () => {
      setLoading(true);

      // ✅ iOS에서 버튼/자동 리프레시는 RefreshControl을 켜지 않음(화면 안 내려가게)
      if (Platform.OS === "ios" && !fromPull) {
        setSoftRefreshing(true);
        setIsRefreshing(false);
      } else {
        // Android + iOS pull은 기존대로
        setSoftRefreshing(false);
        setIsRefreshing(true);
      }

      setRefreshTick((t) => t + 1);
    };

    // 자정 지난 경우
    const midnightPassed = bumpDayAnchorIfMidnightPassed();
    if (midnightPassed) {
      toast.show(
        {
          ko: "새로운 데이터를 불러오는 중…",
          en: "Loading new data…",
          ja: "新しいデータを読み込み中…",
          sc: "正在加载新数据…",
          tc: "正在載入新資料…",
        }[uiLang] || "Loading new data…",
        { duration: 1500 }
      );
      triggerRefresh();
      return;
    }

    // World 모드
    if (!isYearMode) {
      const now = Date.now();

      if (rewardPassUntil && rewardPassUntil > now) {
        triggerRefresh();
        return;
      }

      if (dayOffset === 0) {
        if (worldTodayFreeCount < WORLD_TODAY_FREE_LIMIT) {
          const next = worldTodayFreeCount + 1;
          setWorldTodayFreeCount(next);
          const key = worldTodayFreeKeyRef.current;
          if (key) AsyncStorage.setItem(key, String(next)).catch(() => { });
          triggerRefresh();
          return;
        }

        pendingNavRef.current = "world_today_more";
        normalizeScrollAfterAdPrompt();
        setAdPromptVisible(true);
        return;
      }

      pendingNavRef.current = dayOffset < 0 ? -1 : +1;
      normalizeScrollAfterAdPrompt();
      setAdPromptVisible(true);
      return;
    }

    // Year 모드
    handlePressYearMore();
  }, [
    uiLang,
    isYearMode,
    bumpDayAnchorIfMidnightPassed,
    rewardPassUntil,
    dayOffset,
    worldTodayFreeCount,
    handlePressYearMore,
  ]);

  // ✅ 광고 모달이 뜨는 순간(또는 닫히는 순간)에 화면이 아래로 내려간 상태를 정리
  useEffect(() => {
    if (adPromptVisible) {
      normalizeScrollAfterAdPrompt();
    }
  }, [adPromptVisible, normalizeScrollAfterAdPrompt]);


  useEffect(() => {
    if (yearAdPromptVisible) {
      normalizeScrollAfterAdPrompt();
    }
  }, [yearAdPromptVisible, normalizeScrollAfterAdPrompt]);







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

        // 3. 연도 모드 데이터 복원 (이 부분이 핵심)
        const today = startOfDayInTz(new Date(), tz);
        const { y, m, d } = getDayPartsFrom(today, tz);
        const isoDate = `${y}-${m}-${d}`;

        // 3-1. (마이그레이션) 구버전 연도 패스가 있으면 통합 패스로 흡수
        if (dict[STORAGE_KEY_YEAR_PASS_UNTIL]) {
          const n = parseInt(dict[STORAGE_KEY_YEAR_PASS_UNTIL], 10);
          if (!Number.isNaN(n) && n > Date.now()) {
            setRewardPassUntil((prev) => Math.max(prev || 0, n));
            AsyncStorage.setItem(STORAGE_KEY_REWARD_PASS_UNTIL, String(n)).catch(() => { });
          }
        }
        // 3-2. 본 횟수 (날짜가 같을 때만 복원)
        if (dict[STORAGE_KEY_YEAR_SEEN_GROUPS]) {
          try {
            const obj = JSON.parse(dict[STORAGE_KEY_YEAR_SEEN_GROUPS]);
            if (obj?.isoDate === isoDate) {
              // v1: { isoDate, count }
              if (typeof obj.count === "number") {
                setYearSeenGroups({ korea: obj.count, japan: obj.count, china: obj.count });
              }
              // v2: { isoDate, countByCid: { korea, japan, china } }
              else if (obj.countByCid && typeof obj.countByCid === "object") {
                setYearSeenGroups({
                  korea: obj.countByCid.korea ?? 0,
                  japan: obj.countByCid.japan ?? 0,
                  china: obj.countByCid.china ?? 0,
                });
              }
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
              const defaults = LANG_SWITCH_DEFAULT[nextLang] || LANG_SWITCH_DEFAULT.default;
              cur = new Set(defaults);
              setSelectedCountries(cur);
              AsyncStorage.setItem(STORAGE_KEY_SELECTED, JSON.stringify([...cur])).catch(() => { });
            }
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
    setSoftRefreshing(false);
    scrollMainToTop(false);
  }, []);

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
              const unique = hash32(`${y}|${d}|${JSON.stringify(r)}`); // 충돌 거의 없음

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
              const unique = hash32(`${y}|${d}|${JSON.stringify(r)}`); // 충돌 거의 없음

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

        if (isWorldMode) {
          if (notificationEventKey) {
            console.log(' [PICK] Looking for notification event:', notificationEventKey);

            let foundPick = null;
            for (const cid of chosen) {
              const pool = poolsByCid[cid];
              if (pool) {
                foundPick = pool.find(p => p.key === notificationEventKey);
                if (foundPick) {
                  console.log(' [PICK] Found notification event in', cid);
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

              AsyncStorage.setItem(
                `${STORAGE_KEY_WORLD_PICK_CACHE_PREFIX}${seedKey}`,
                String(foundPick.key)
              ).catch(() => { });


              setNotificationEventKey(null);
              await AsyncStorage.removeItem('@notification_event_key');

              endLoading();
              return;
            } else {
              console.warn('[PICK] Notification event not found, using random');
              setNotificationEventKey(null);
            }
          }


          // ✅ World 탭: 같은 seedKey(날짜+선택+refreshTick)에서는 이미 뽑아둔 이벤트를 그대로 유지
          try {
            const cachedKey = await AsyncStorage.getItem(
              `${STORAGE_KEY_WORLD_PICK_CACHE_PREFIX}${seedKey}`
            );
            if (cachedKey) {
              let cachedPick = null;
              for (const cid of chosen) {
                const pool = poolsByCid[cid];
                if (pool) {
                  cachedPick = pool.find((p) => p.key === cachedKey);
                  if (cachedPick) break;
                }
              }

              if (cachedPick && !canceled) {
                setHeaderImageUrl(null);
                setOnePick([cachedPick]);
                setYearYears([]);
                setYearCursor(null);
                setYearNav({ canPrev: false, canNext: false });
                lastPickKeyRef.current = cachedPick.key;

                endLoading();
                return;
              }
            }
          } catch (e) {
            // ignore
          }

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

              AsyncStorage.setItem(
                `${STORAGE_KEY_WORLD_PICK_CACHE_PREFIX}${seedKey}`,
                String(pick.key)
              ).catch(() => { });

            } else {
              setHeaderImageUrl(null);
              setOnePick([]);
              AsyncStorage.removeItem(
                `${STORAGE_KEY_WORLD_PICK_CACHE_PREFIX}${seedKey}`
              ).catch(() => { });

              setYearYears([]);
              setYearCursor(null);
              setYearNav({ canPrev: false, canNext: false });
            }
          }

          endLoading();
          return;
        }

        // Year 모드 (한/중/일) 로직
        if (isYearMode) {
          const cid = currentCid;
          if (!cid || cid === "world") {
            if (!canceled) { setOnePick([]); endLoading(); }
            return;
          }

          // 1. 해당 국가 데이터 가져오기
          let pool = poolsByCid[cid] || [];

          if (!pool.length) {
            if (!canceled) {
              setOnePick([]);
              setErr("표시할 역사가 없습니다.");
              endLoading();
            }
            return;
          }


          const isoDate = `${todayParts.y}-${todayParts.m}-${todayParts.d}`;
          const stateKey = getYearPlaylistKey(cid);


          // 3) 날짜(isoDate) 단위로 나라별 플레이리스트 로드/생성
          //    - isoDate가 바뀌면(자정 넘어감) 다음 "새로고침/탭 전환" 시점에 새로운 11개로 재생성
          let playlist = [];
          let currentIndex = 0;
          let startYearForCid = null;

          try {
            const rawState = await AsyncStorage.getItem(stateKey);
            const state = rawState ? JSON.parse(rawState) : null;

            const isValid =
              state &&
              state.isoDate === isoDate &&
              Array.isArray(state.playlist) &&
              state.playlist.length > 0;

            if (isValid) {
              playlist = state.playlist;
              currentIndex = state.currentIndex || 0;
              startYearForCid = state.startYear ?? null;
            } else {
              // 새 날짜(또는 처음) → 새로운 랜덤 시작 연도 + 순차 리스트 생성
              const countToPick = Math.min(pool.length, YEAR_MAX_EVENTS_PER_COUNTRY);
              startYearForCid = await pickRandomStartYearForDay(pool, isoDate, cid);
              playlist = buildSequentialPlaylistFromPool(pool, startYearForCid, countToPick);
              currentIndex = 0;

              await AsyncStorage.setItem(
                stateKey,
                JSON.stringify({
                  isoDate,
                  playlist,
                  currentIndex,
                  startYear: startYearForCid,
                  createdAt: Date.now(),
                })
              );
            }
          } catch (e) {
            console.warn("[YEAR] Playlist init error", e);
          }

          if (!canceled) {
            yearPoolRef.current[cid] = pool;

            setCurrentYearPlaylist(playlist);
            setYearCurrentIndex(currentIndex);

            if (playlist.length > 0) {
              if (currentIndex >= playlist.length) currentIndex = 0;

              const keyToFind = playlist[currentIndex];
              const pick = pool.find(p => p.key === keyToFind);

              if (pick) {
                setOnePick([pick]);
                setHeaderImageUrl(null);

                const pickYear = parseInt(getYearFromRow(pick.row), 10) || null;
                setYearCursor(pickYear);
                baseYearRef.current = pickYear;
              } else {
                setOnePick([pool[0]]);
              }
            } else {
              setOnePick([]);
            }

            setYearNav({ canPrev: false, canNext: false });
          }
          endLoading();
          return;
        }




        // 어느 모드도 아니면 (선택 없음)
        if (!canceled) {
          setHeaderImageUrl(null);
          setOnePick([]);
          setYearYears([]);
          setYearCursor(null);
          setYearNav({ canPrev: false, canNext: false });
        }
        endLoading();
        return;

      } catch (e) {
        if (!canceled) {
          setErr(String(e?.message || e));
          endLoading();
        }
      } finally {
        fetchingRef.current = false;
      }
    })();
  }, [
    hydrated,
    todayParts,
    selectedCountries,
    stableKey,
    seedKey,
    isoDate,
    endLoading,
    isWorldMode,
    isYearMode,
    yearCursor,
    notificationEventKey,
    refreshTick,
  ]);


  // 헤더 배너 이미지 로딩/캐시
  // useEffect(() => {
  //   console.log('🎯 [IMAGE EFFECT] Started', {
  //     onePick: onePick?.length,
  //     uiLang,
  //     hydrated,
  //     isoDate,
  //   });

  //   let alive = true;
  //   //추가
  //   const reqId = ++bannerReqIdRef.current;

  //   (async () => {
  //     try {
  //       const iso = isoDate;

  //       if (!onePick || !onePick.length) {
  //         console.log('❌ [IMAGE] No pick');
  //         if (alive) {
  //           setBannerStatus("loading");
  //           setBannerImageUrl(null);
  //         }
  //         return;
  //       }

  //       const first = onePick[0];
  //       const cid = first.cid;
  //       const pickKey = first.key;

  //       console.log('🔍 [IMAGE] Processing image for', { iso, cid, pickKey });

  //       // ✅ loadBannerImage만 호출 (상태 관리 포함)
  //       // ✅ loadBannerImage만 호출 (상태 관리 포함)
  //       if (alive) {
  //         await loadBannerImage({
  //           row: { ...first.row, cid: first.cid },  // ⭐ cid 추가
  //           uiLang: uiLang
  //         });
  //       }

  //     } catch (e) {
  //       console.error('❌ [IMAGE] Error:', e);
  //       if (alive) {
  //         setBannerStatus("no-image");
  //         setBannerImageUrl(null);
  //       }
  //     }
  //   })();

  //   return () => {
  //     console.log('🧹 [IMAGE EFFECT] Cleanup');
  //     alive = false;
  //   };
  // }, [onePick, uiLang, hydrated, isoDate, loadBannerImage]);


  useEffect(() => {
    let alive = true;

    // ✅ 새 요청 시작: reqId 발급
    const reqId = ++bannerReqIdRef.current;

    (async () => {
      try {
        if (!onePick || !onePick.length) {
          if (alive) {
            setBannerStatus("loading");
            setBannerImageUrl(null);
          }
          return;
        }

        const first = onePick[0];

        if (alive) {
          await loadBannerImage({
            row: { ...first.row, cid: first.cid },
            uiLang,
            reqId, // ✅ 이게 핵심!
          });
        }
      } catch (e) {
        if (alive) {
          setBannerStatus("no-image");
          setBannerImageUrl(null);
        }
      }
    })();

    return () => {
      alive = false;
      // ✅ (선택이지만 강추) 언마운트/탭이동 순간에 기존 요청 무효화
      bannerReqIdRef.current++;
    };
  }, [onePick, uiLang, hydrated, isoDate, loadBannerImage]);


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
        // 자정이 지났다면(유저가 앱으로 돌아온 순간) 날짜 기준 갱신 + 다음 로딩을 위해 refreshTick 올림
        const midnightPassed = bumpDayAnchorIfMidnightPassed();
        if (midnightPassed) {
          toast.show(
            {
              ko: "새로운 데이터를 불러오는 중…",
              en: "Loading new data…",
              ja: "新しいデータを読み込み中…",
              sc: "正在加载新数据…",
              tc: "正在載入新資料…",
            }[uiLang] || "Loading new data…",
            { duration: 1500 }
          );
          setLoading(true);
          setIsRefreshing(true);
          setRefreshTick((t) => t + 1);
        }
        const today = startOfDayInTz(new Date(), tz);

        // 앱으로 돌아오면 항상 "오늘(0)" 기준으로 맞춰주기
        setDayOffset(0);


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
  }, [tz, uiLang, selectedCountries, bumpDayAnchorIfMidnightPassed]);

  // 다른 탭을 눌렀다 돌아오는 "Focus" 타이밍에서도 자정 갱신 트리거
  useFocusEffect(
    useCallback(() => {
      const midnightPassed = bumpDayAnchorIfMidnightPassed();
      if (midnightPassed) {
        if (Platform.OS === "android") {
          try {
            ToastAndroid.show("데이터를 불러오는 중입니다…", ToastAndroid.SHORT);
          } catch { }
        }
        setLoading(true);
        setIsRefreshing(true);
        setRefreshTick((t) => t + 1);
      }

      return () => { };
    }, [bumpDayAnchorIfMidnightPassed])
  );

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

      // Year Mode(한/중/일)로 바뀌면, "어제/내일" 오프셋을 즉시 0(오늘)로 되돌림
      // (앱 재시작 시에도 바로 반영되도록)
      try {
        const onlyCid = getOnlyCountryId(ensured);
        if (onlyCid && onlyCid !== "world") {
          setDayOffset(0);
        }
      } catch {
        // noop
      }
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
      setFocusedCid(getOnlyCountryId(ensured));
      AsyncStorage.setItem(
        STORAGE_KEY_SELECTED,
        JSON.stringify([...ensured])
      ).catch(() => { });
    },
    [selectedCountries, uiLang]
  );

  const STORAGE_KEY_FOCUSED_CID = "@focused_cid_v1";

  useEffect(() => {
    if (!currentCid) return;

    // 나라 탭을 눌렀을 때도(유저 액션) 자정이 지났으면 새 날짜로 갱신 + 새 11개 로딩
    const midnightPassed = bumpDayAnchorIfMidnightPassed();
    if (midnightPassed) {
      toast.show(
        {
          ko: "새로운 데이터를 불러오는 중…",
          en: "Loading new data…",
          ja: "新しいデータを読み込み中…",
          sc: "正在加载新数据…",
          tc: "正在載入新資料…",
        }[uiLang] || "Loading new data…",
        { duration: 1500 }
      );
      setLoading(true);
      setIsRefreshing(true);
      setRefreshTick((t) => t + 1);
    }

    emitCountriesChanged(currentCid);

    AsyncStorage.setItem(STORAGE_KEY_FOCUSED_CID, String(currentCid)).catch(() => { });
  }, [currentCid, bumpDayAnchorIfMidnightPassed]);



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
              ref={mainScrollRef}
              style={{ flex: 1 }}
              contentContainerStyle={{
                flexGrow: 1,
                paddingHorizontal: 16,
                paddingBottom: 24 + tabBarHeight,
              }}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}     // softRefreshing은 여기 연결하지 않음
                  onRefresh={() => handlePullToRefresh("pull")}
                />
              }
            >
              <View
                style={{
                  width: CONTENT_W,
                  alignSelf: "center",
                }}
              >
                <View
                  style={{
                    paddingVertical: 10,
                    alignItems: "center",
                  }}
                >
                  {/* <Text
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
                  </Text> */}
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
                            {/* <Text
                              style={{
                                fontSize: locationFontSize,
                                fontWeight: "600",
                                color: customFontColor,
                              }}
                            >
                              {fieldLabels.location}:{" "}
                              <Text
                                style={{
                                  color: customFontColor, 
                                }}
                              >
                                {label}
                              </Text>
                            </Text> */}
                            {renderHistoryText(
                              `${fieldLabels.location}: ${label}`,
                              locationFontSize,
                              customFontColor,
                              getFontFamily(customFont),
                              locationFontSize * 1.3,
                              customBgImage
                            )}

                            {/* {!!dateLabel && (
                              <Text
                                style={{
                                  marginTop: 4,
                                  fontSize: dateFontSize,
                                  color: customFontColor, 
                                }}
                              >
                                {fieldLabels.date}:{" "}
                                {dateLabel}
                              </Text>
                            )}
                          </View> */}
                            {!!dateLabel && (
                              <View style={{ marginTop: 4 }}>
                                {renderHistoryText(
                                  `${fieldLabels.date}: ${dateLabel}`,
                                  dateFontSize,
                                  customFontColor,
                                  getFontFamily(customFont),
                                  dateFontSize * 1.3,
                                  customBgImage
                                )}
                              </View>
                            )}
                          </View>

                          {renderHistoryText(
                            bodyOfRowByLang(p.row, uiLang || "en", p.cid),
                            customFontSize,
                            customFontColor,
                            getFontFamily(customFont),
                            bodyLineHeight,
                            customBgImage
                          )}

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
                              status={bannerStatus}  // ✅ 추가
                              imageUrl={bannerStatus === "ready" ? bannerImageUrl : null}  // ✅ 수정
                              maxWidth={CONTENT_W}
                              screenWidth={screenW}
                              cardBg={cardBg}
                              customBgColor={customBgColor}
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

          {/* World 모드용 광고 모달 */}
          <Modal
            visible={adPromptVisible}
            onDismiss={() => {
              if (Platform.OS !== "ios") return;
              if (shouldShowAdRef.current) {
                shouldShowAdRef.current = false;
                if (!rewardedAd) {
                  notifyRewardedAdUnavailable();
                  adShowLockRef.current = false;
                  pendingNavRef.current = null;
                  return;
                }
                try {
                  rewardedAd.show();
                } catch (e) {
                  console.error("❌ [AD] Show failed:", e);
                  adShowLockRef.current = false;
                  pendingNavRef.current = null;
                }
              }
            }}
            transparent
            animationType="fade"
            onRequestClose={() => { setAdPromptVisible(false); normalizeScrollAfterAdPrompt(); }}
          >
            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center" }}>
              <View
                style={{
                  width: Math.min(width - 40, 360),
                  backgroundColor: "#FFFFFF",

                  // 공통 스타일
                  borderRadius: 30,
                  borderWidth: 1,
                  borderColor: "rgba(122,122,122,0.83)",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 10 },
                  shadowRadius: 20,
                  shadowOpacity: 0.1,
                  elevation: 10,

                  // Padding
                  paddingVertical: 28,
                  paddingHorizontal: 24,
                }}
              >
                {/* Close (유지) */}
                <View style={{ alignItems: "flex-end" }}>
                  <Pressable onPress={() => { setAdPromptVisible(false); normalizeScrollAfterAdPrompt(); }} hitSlop={10}>
                    <Text style={{ fontSize: 18, fontWeight: "700", color: "#9CA3AF" }}>✕</Text>
                  </Pressable>
                </View>

                {/* 1) mask + title */}
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                  <RNImage
                    source={REWARD_ICONS.mask} // Mask group.png
                    style={{ width: 12, height: 12, marginRight: 8 }}
                    resizeMode="contain"
                  />
                  <Text
                    style={{
                      fontFamily: Platform.OS === "ios" ? "Inter" : "sans-serif",
                      fontWeight: "900", // Inter Black
                      fontSize: 10,
                      color: "#000000",
                      textAlign: "left",
                      flexShrink: 1,
                    }}
                  >
                    {(AD_MODAL_TEXT[uiLang] || AD_MODAL_TEXT.en).title}
                  </Text>
                </View>

                {/* 2) subtitle */}
                <Text
                  style={{
                    fontFamily: Platform.OS === "ios" ? "Inter" : "sans-serif",
                    fontWeight: "900", // Inter Black (원하면 700으로 바꿔도 됨)
                    fontSize: 17,
                    color: "#000000",
                    textAlign: "left",
                    marginBottom: 14,
                  }}
                >
                  {(AD_MODAL_TEXT[uiLang] || AD_MODAL_TEXT.en).subTitle}
                </Text>

                {/* 3) icon + description 리스트 */}
                {(() => {
                  const modalCopy = (AD_MODAL_TEXT[uiLang] || AD_MODAL_TEXT.en);
                  const raw = String(modalCopy?.description || "");
                  const lines = raw.split("\n").filter(Boolean);
                  const bullets = lines.filter((l) => String(l).trim().startsWith("-"));

                  const icons = [
                    REWARD_ICONS.frame29,
                    REWARD_ICONS.frame31,
                    REWARD_ICONS.frame28,
                  ];

                  return (
                    <View style={{ marginBottom: 20 }}>
                      {bullets.map((line, idx) => {
                        const clean = String(line).replace(/^\-\s*/, "");
                        const iconSrc = icons[idx % icons.length];

                        return (
                          <View
                            key={`b-${idx}`}
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              marginBottom: 10, // 줄 간격 10
                            }}
                          >
                            {/* Icon Container 32x32 */}
                            <View
                              style={{
                                width: 32,
                                height: 32,
                                alignItems: "center",
                                justifyContent: "center",
                                marginRight: 10, // 아이콘-글자 간격 10
                              }}
                            >
                              <RNImage source={iconSrc} style={{ width: 32, height: 32 }} resizeMode="contain" />
                            </View>

                            {/* Description text */}
                            <Text
                              style={{
                                fontFamily: Platform.OS === "ios" ? "Inter" : "sans-serif",
                                fontWeight: "400", // Inter Regular
                                fontSize: 16,
                                color: "#616161",
                                textAlign: "left",
                                flex: 1,
                              }}
                            >
                              {clean}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  );
                })()}

                {/* 4) button */}
                <Pressable
                  onPress={showRewardedAdForWorld}
                  style={{
                    width: "100%",
                    height: 38,
                    backgroundColor: "#000000",
                    borderRadius: 9,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      fontFamily: Platform.OS === "ios" ? "Inter" : "sans-serif",
                      fontSize: 14,
                      fontWeight: "700",
                      color: "#FFFFFF",
                    }}
                  >
                    {(AD_MODAL_TEXT[uiLang] || AD_MODAL_TEXT.en).cta}
                  </Text>
                </Pressable>

              </View>
            </View>
          </Modal>



          {/* Year 모드용 광고 모달 */}
          <Modal
            visible={yearAdPromptVisible}
            onDismiss={() => {
              if (Platform.OS !== "ios") return;
              if (shouldShowAdRef.current) {
                shouldShowAdRef.current = false;
                if (!rewardedAd) {
                  notifyRewardedAdUnavailable();
                  adShowLockRef.current = false;
                  pendingNavRef.current = null;
                  return;
                }
                try {
                  rewardedAd.show();
                } catch (e) {
                  console.error("❌ [AD] Show failed:", e);
                  adShowLockRef.current = false;
                  pendingNavRef.current = null;
                }
              }
            }}
            transparent
            animationType="fade"
            onRequestClose={handleCloseYearAdPrompt}
          >
            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center" }}>
              <View
                style={{
                  width: Math.min(width - 40, 360),
                  backgroundColor: "#FFFFFF",

                  // 공통 스타일
                  borderRadius: 30,
                  borderWidth: 1,
                  borderColor: "rgba(122,122,122,0.83)",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 10 },
                  shadowRadius: 20,
                  shadowOpacity: 0.1,
                  elevation: 10,

                  // Padding
                  paddingVertical: 28,
                  paddingHorizontal: 24,
                }}
              >
                {/* Close */}
                <View style={{ alignItems: "flex-end" }}>
                  <Pressable onPress={handleCloseYearAdPrompt} hitSlop={10}>
                    <Text style={{ fontSize: 18, fontWeight: "700", color: "#9CA3AF" }}>✕</Text>
                  </Pressable>
                </View>

                {/* 1) mask + title (스펙: Inter Black 17px) */}
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                  <RNImage
                    source={REWARD_ICONS.mask} // Mask group.png
                    style={{ width: 12, height: 12, marginRight: 8 }}
                    resizeMode="contain"
                  />
                  <Text
                    style={{
                      fontFamily: Platform.OS === "ios" ? "Inter" : "sans-serif",
                      fontWeight: "900",
                      fontSize: 10,
                      color: "#000000",
                      textAlign: "left",
                      flexShrink: 1,
                    }}
                  >
                    {(AD_MODAL_TEXT[uiLang] || AD_MODAL_TEXT.en).title}
                  </Text>
                </View>

                {/* 2) subtitle (원하면 17 그대로, 더 작게 원하면 10으로 낮춰도 됨) */}
                <Text
                  style={{
                    fontFamily: Platform.OS === "ios" ? "Inter" : "sans-serif",
                    fontWeight: "900",
                    fontSize: 17,
                    color: "#000000",
                    textAlign: "left",
                    marginBottom: 14,
                  }}
                >
                  {(AD_MODAL_TEXT[uiLang] || AD_MODAL_TEXT.en).subTitle}
                </Text>

                {/* 3) icon + description 리스트 */}
                {(() => {
                  const modalCopy = (AD_MODAL_TEXT[uiLang] || AD_MODAL_TEXT.en);
                  const raw = String(modalCopy?.description || "");
                  const lines = raw.split("\n").filter(Boolean);
                  const bullets = lines.filter((l) => String(l).trim().startsWith("-"));

                  const icons = [
                    REWARD_ICONS.frame29,
                    REWARD_ICONS.frame31,
                    REWARD_ICONS.frame28,
                  ];

                  return (
                    <View style={{ marginBottom: 20 }}>
                      {bullets.map((line, idx) => {
                        const clean = String(line).replace(/^\-\s*/, "");
                        const iconSrc = icons[idx % icons.length];

                        return (
                          <View key={`b-${idx}`} style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                            <View style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center", marginRight: 10 }}>
                              <RNImage source={iconSrc} style={{ width: 32, height: 32 }} resizeMode="contain" />
                            </View>

                            <Text
                              style={{
                                fontFamily: Platform.OS === "ios" ? "Inter" : "sans-serif",
                                fontWeight: "400",
                                fontSize: 16,
                                color: "#616161",
                                textAlign: "left",
                                flex: 1,
                              }}
                            >
                              {clean}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  );
                })()}

                {/* 4) button */}
                <Pressable
                  onPress={showRewardedAdForYear}
                  style={{
                    width: "100%",
                    height: 38,
                    backgroundColor: "#000000",
                    borderRadius: 9,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      fontFamily: Platform.OS === "ios" ? "Inter" : "sans-serif",
                      fontSize: 14,
                      fontWeight: "700",
                      color: "#FFFFFF",
                    }}
                  >
                    {(AD_MODAL_TEXT[uiLang] || AD_MODAL_TEXT.en).cta}
                  </Text>
                </Pressable>
              </View>
            </View>
          </Modal>

          {navToast.visible && (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: navToast.side === "left" ? 10 : undefined,
                right: navToast.side === "right" ? 147 : undefined,
                bottom: 0,
                backgroundColor: "#343030",
                paddingHorizontal: 12,
                paddingVertical: 10,

                minHeight: 36,

                borderRadius: 20,
                zIndex: 9999,
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "700" }}>
                {navToast.text}
              </Text>
            </View>
          )}

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
            const unique = hash32(`${y}|${d}|${JSON.stringify(r)}`);

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