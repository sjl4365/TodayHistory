// lib/translations.js
// Combined translation system with hook

import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LANGUAGE_STORAGE_KEY = '@app_language';

// All translations in one place
export const translations = {
  en: {
    // Settings Screen
    settings: 'Settings',
    lookAndFeel: 'Look & Feel',
    notification: 'Notification',
    language: 'Language',
    instagram: 'Instagram',
    xTwitter: 'X (Twitter)',
    sunnyGames: "Sunny's Games and Apps",
    credits: 'Credits',
    openSource: 'Open Source Info',
    appVersion: 'App Version',
    link: 'Link',
    termsOfService: 'Terms of Service',
    privacyPolicy: 'Privacy Policy',
    font: 'Font',
    fontSize: 'Font Size',
    fontColor: 'Font Color',
    backgroundColor: 'Background Color',
    selectFont: 'Select Font',
    fontAppliedNote: '*Only the English font is applied.',
    userData: 'User Data',
    startDate: 'Start Date',
    numberOfUses: 'Number of uses',
    shareTheApp: 'Share the App',
    writeAReview: 'Write a Review',
    skyPeacemaker: 'Sky Peacemaker',
    skyPeacemakerDesc: 'The Ultimate Fighter Jet Experience on Mobile',
    worldMovieTrailer: 'World Movie Trailer',
    worldMovieTrailerDesc: 'All your global movie trailers and box office rankings in one place!',
    findFour: 'Find Four',
    findFourDesc: 'Spot 4 differences and have fun anytime!',
    decibella: 'decibella',
    decibellaDesc: 'Your Pocket-Sized, Smart Sound Level Meter',
    dualFlashlight: 'Dual Flashlight',
    dualFlashlightDesc: 'Turn your smartphone into the ultimate flashlight',
    englishWangza: 'English Wangza',
    englishWangzaDesc: 'Have Fun Learning English with Games!',
    allow_notification: "Allow Notification",
  },
  ko: {
    // Settings Screen
    settings: '설정',
    lookAndFeel: '스타일',
    notification: '알림',
    language: '언어',
    instagram: '인스타그램',
    xTwitter: 'X (트위터)',
    sunnyGames: '써니의 게임과 앱',
    credits: '크레딧',
    openSource: '오픈 소스 정보',
    appVersion: '앱 버전',
    link: 'Link',
    termsOfService: 'Terms of Service',
    privacyPolicy: 'Privacy Policy',
    font: '폰트',
    fontSize: '폰트 크기',
    fontColor: '폰트 색',
    backgroundColor: '배경색',
    selectFont: '폰트 선택',
    fontAppliedNote: '*영어 폰트만 적용 됩니다.',
    userData: '사용자 데이터',
    startDate: '시작일',
    numberOfUses: '사용횟수',
    shareTheApp: '앱 공유하기',
    writeAReview: '리뷰 남기기',
    skyPeacemaker: '스카이 피스메이커',
    skyPeacemakerDesc: 'The Ultimate Fighter Jet Experience on Mobile',
    worldMovieTrailer: '월드 무비 트레일러',
    worldMovieTrailerDesc: 'All your global movie trailers and box office rankings in one place!',
    findFour: '파인드 포',
    findFourDesc: 'Spot 4 differences and have fun anytime!',
    decibella: '데시벨라',
    decibellaDesc: 'Your Pocket-Sized, Smart Sound Level Meter',
    dualFlashlight: '듀얼 플래시 라이트',
    dualFlashlightDesc: 'Turn your smartphone into the ultimate flashlight',
    englishWangza: '영어 왕자',
    englishWangzaDesc: 'Have Fun Learning English with Games!',
    allow_notification: "알림 허용",
  },
  ja: {
    // Settings Screen
    settings: '設定',
    lookAndFeel: 'スタイル',
    notification: '通知',
    language: '言語',
    instagram: 'インスタグラム',
    xTwitter: 'X (ツイッター)',
    sunnyGames: 'Sunnyのゲームとアプリ',
    credits: 'エンドロール',
    openSource: 'オープンソース情報',
    appVersion: 'バージョン',
    link: 'Link',
    termsOfService: 'Terms of Service',
    privacyPolicy: 'Privacy Policy',
    font: 'フォント',
    fontSize: 'フォントサイズ',
    fontColor: 'フォントカラー',
    backgroundColor: '背景色',
    selectFont: 'フォント選択',
    fontAppliedNote: '*英語のフォントだけが適用されます。',
    userData: 'ユーザーデータ',
    startDate: '開始日',
    numberOfUses: '使用回数',
    shareTheApp: 'このアプリを共有する',
    writeAReview: 'レビューを残す',
    skyPeacemaker: 'スカイピースメーカー',
    skyPeacemakerDesc: 'The Ultimate Fighter Jet Experience on Mobile',
    worldMovieTrailer: 'ワールドムービートレーラー',
    worldMovieTrailerDesc: 'All your global movie trailers and box office rankings in one place!',
    findFour: 'ファインドフォー',
    findFourDesc: 'Spot 4 differences and have fun anytime!',
    decibella: 'デシベラ',
    decibellaDesc: 'Your Pocket-Sized, Smart Sound Level Meter',
    dualFlashlight: 'デュアル・フラッシュライト',
    dualFlashlightDesc: 'Turn your smartphone into the ultimate flashlight',
    englishWangza: '英語の王子様',
    englishWangzaDesc: 'Have Fun Learning English with Games!',
    allow_notification: "通知を許可",
  },
  'zh-Hans' : {
    settings: '设置',
    lookAndFeel: '外观',
    notification: '通知',
    language: '语言',
    instagram: 'Instagram',
    xTwitter: 'X（推特）',
    sunnyGames: 'Sunny的游戏和应用',
    credits: '制作人员名单',
    openSource: '开源信息',
    appVersion: '应用版本',
    link: 'Link',
    termsOfService: 'Terms of Service',
    privacyPolicy: 'Privacy Policy',
    font: '字体',
    fontSize: '字号',
    fontColor: '字体颜色',
    backgroundColor: '背景颜色',
    selectFont: '选择字体',
    fontAppliedNote: '*仅应用英文字体。',
    userData: '用户数据',
    startDate: '开始日期',
    numberOfUses: '使用次数',
    // Share & Review
    shareTheApp: '分享应用',
    writeAReview: '评论',
    // Sunny's Apps
    skyPeacemaker: 'Sky Peacemaker',
    skyPeacemakerDesc: 'The Ultimate Fighter Jet Experience on Mobile',
    worldMovieTrailer: 'World Movie Trailer',
    worldMovieTrailerDesc: 'All your global movie trailers and box office rankings in one place!',
    findFour: 'Find Four',
    findFourDesc: 'Spot 4 differences and have fun anytime!',
    decibella: 'decibella',
    decibellaDesc: 'Your Pocket-Sized, Smart Sound Level Meter',
    dualFlashlight: 'Dual Flashlight',
    dualFlashlightDesc: 'Turn your smartphone into the ultimate flashlight',
    englishWangza: 'English Wangza',
    englishWangzaDesc: 'Have Fun Learning English with Games!',
    allow_notification: "允许通知",
  },
  'zh-Hant' : {
    // Settings Screen (Traditional Chinese)
    settings: '設定',
    lookAndFeel: '外觀',
    notification: '通知',
    language: '語言',
    instagram: 'Instagram',
    xTwitter: 'X（推特）',
    sunnyGames: 'Sunny的遊戲和應用',
    credits: '製作人員名單',
    openSource: '開源資訊',
    appVersion: '應用程式版本',
    link: 'Link',
    termsOfService: 'Terms of Service',
    privacyPolicy: 'Privacy Policy',
    // Look & Feel Screen
    font: '字體',
    fontSize: '字號',
    fontColor: '字體顏色',
    backgroundColor: '背景顏色',
    selectFont: '選擇字體',
    fontAppliedNote: '*僅應用英文字體。',
    shareTheApp: '分享應用程式',
    writeAReview: '評論',
    skyPeacemaker: 'Sky Peacemaker',
    skyPeacemakerDesc: 'The Ultimate Fighter Jet Experience on Mobile',
    worldMovieTrailer: 'World Movie Trailer',
    worldMovieTrailerDesc: 'All your global movie trailers and box office rankings in one place!',
    findFour: 'Find Four',
    findFourDesc: 'Spot 4 differences and have fun anytime!',
    decibella: 'decibella',
    decibellaDesc: 'Your Pocket-Sized, Smart Sound Level Meter',
    dualFlashlight: 'Dual Flashlight',
    dualFlashlightDesc: 'Turn your smartphone into the ultimate flashlight',
    englishWangza: 'English Wangza',
    englishWangzaDesc: 'Have Fun Learning English with Games!',
    allow_notification: "允許通知"
  },
};

// Helper function to get translated text
export const getTranslation = (languageCode, key) => {
  return translations[languageCode]?.[key] || translations.en[key] || key;
};

// Custom hook for translations
export const useTranslation = () => {
  const [currentLanguage, setCurrentLanguage] = useState('en');

  useEffect(() => {
    loadLanguage();
  }, []);

  const loadLanguage = async () => {
    try {
      const savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (savedLanguage) {
        setCurrentLanguage(savedLanguage);
      }
    } catch (error) {
      console.error('Error loading language:', error);
    }
  };

  const changeLanguage = async (languageCode) => {
    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, languageCode);
      setCurrentLanguage(languageCode);
    } catch (error) {
      console.error('Error saving language:', error);
    }
  };

  const t = (key) => {
    return getTranslation(currentLanguage, key);
  };

  return { t, currentLanguage, changeLanguage };
};