// lib/languageContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { translations } from './translations';

const LANGUAGE_STORAGE_KEY = '@app_language';

const LanguageContext = createContext();

// sc/tc → zh-Hans/zh-Hant 변환
function normalizeToTranslationKey(code) {
  const map = {
    sc: 'zh-Hans',
    tc: 'zh-Hant',
  };
  return map[code] || code;
}

export const LanguageProvider = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadLanguage = async () => {
    try {
      const savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (savedLanguage) {
        setCurrentLanguage(savedLanguage);
      } else {
        setCurrentLanguage('en');
      }
    } catch (error) {
      console.error('Error loading language:', error);
      setCurrentLanguage('en');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLanguage();

    // home.js가 앱 초기화 시 AsyncStorage에 언어를 저장하므로
    // AppState active 시점마다 다시 읽어서 동기화
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        loadLanguage();
      }
    });

    // 앱 시작 직후 home.js가 저장하는 타이밍을 잡기 위해
    // 짧은 딜레이 후 한 번 더 읽기
    const timer = setTimeout(() => {
      loadLanguage();
    }, 1000);

    return () => {
      sub.remove();
      clearTimeout(timer);
    };
  }, []);

  const changeLanguage = async (languageCode) => {
    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, languageCode);
      setCurrentLanguage(languageCode);
    } catch (error) {
      console.error('Error saving language:', error);
    }
  };

  const t = (key) => {
    if (!currentLanguage) return key;
    const translationKey = normalizeToTranslationKey(currentLanguage);
    return translations[translationKey]?.[key] || translations.en[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ t, currentLanguage, changeLanguage, isLoading }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};