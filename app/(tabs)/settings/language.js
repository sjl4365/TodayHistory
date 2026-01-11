// //app/(tab)/settings/language.js
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LANGUAGE_STORAGE_KEY = '@app_language';

export default function Language() {
  const [selectedLanguage, setSelectedLanguage] = useState('English');

  const languages = [
    { name: 'English', code: 'en' },
    { name: '한국어', code: 'ko' },
    { name: '日本語', code: 'ja' },
    { name: '简体中文', code: 'zh' }, 
    { name: '繁體中文', code: 'ch' },
    // {name:'Français',code:'fr'},
    // {name:'Español',code:'sp'},
    // {name:'हिन्दी',code:'hin'},
    // {name:'แบบไทย',code:'th'},
  ];

  // Load saved language on mount
  useEffect(() => {
    loadLanguage();
  }, []);

  const loadLanguage = async () => {
    try {
      const savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (savedLanguage) {
        const language = languages.find(lang => lang.code === savedLanguage);
        if (language) {
          setSelectedLanguage(language.name);
        }
      }
    } catch (error) {
      console.error('Error loading language:', error);
    }
  };

  const handleLanguageSelect = async (language) => {
    setSelectedLanguage(language.name);
    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language.code);
      console.log(`Language changed to: ${language.name}`);
      // You can add a toast or alert here to confirm the change
    } catch (error) {
      console.error('Error saving language:', error);
    }
  };

  return (
    <View style={styles.container}>
      {languages.map((language) => (
        <TouchableOpacity
          key={language.code}
          style={[
            styles.languageOption,
            selectedLanguage === language.name && styles.selectedOption,
          ]}
          onPress={() => handleLanguageSelect(language)}
        >
          <Text style={styles.languageText}>{language.name}</Text>
          {selectedLanguage === language.name && (
            <Text style={styles.checkmark}>✓</Text>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
    padding: 20,
  },
  languageOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    marginBottom: 12,
  },
  selectedOption: {
    backgroundColor: '#2a2a2a',
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  languageText: {
    fontSize: 16,
    color: 'white',
  },
  checkmark: {
    fontSize: 18,
    color: '#007AFF',
    fontWeight: 'bold',
  },
});