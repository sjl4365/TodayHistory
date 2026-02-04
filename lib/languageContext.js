// lib/languageContext.js
// Language Context Provider to preload language

import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations } from './translations';

const LANGUAGE_STORAGE_KEY = '@app_language';

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadLanguage();
  }, []);

  const loadLanguage = async () => {
    try {
      const savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
      setCurrentLanguage(savedLanguage || 'en');
    } catch (error) {
      console.error('Error loading language:', error);
      setCurrentLanguage('en');
    } finally {
      setIsLoading(false);
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
    if (!currentLanguage) return key;
    return translations[currentLanguage]?.[key] || translations.en[key] || key;
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