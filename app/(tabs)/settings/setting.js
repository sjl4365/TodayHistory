// app/(tabs)/settings/index.js
// Main settings screen that replaces your settings.js
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView 
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { trackEvent, AMPLITUDE_EVENTS } from '../amplitude';

const LANGUAGE_STORAGE_KEY = '@app_language';

export default function SettingsIndex() {
  const router = useRouter();
  const [selectedTheme, setSelectedTheme] = useState('Dark');
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [isLanguageExpanded, setIsLanguageExpanded] = useState(false);

  const languages = [
    { name: 'English', code: 'en' },
    { name: '中文', code: 'zh' },
    { name: '日本語', code: 'ja' },
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
    const previousLanguage = selectedLanguage;
    setSelectedLanguage(language.name);
    setIsLanguageExpanded(false);
    
    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language.code);
      console.log(`Language changed to: ${language.name}`);
      
      // Amplitude 이벤트 트래킹 - 언어 변경
      trackEvent(AMPLITUDE_EVENTS.LANGUAGE_CHANGED, {
        from_language: previousLanguage,
        to_language: language.name,
        language_code: language.code,
        source: 'settings_page'
      });
    } catch (error) {
      console.error('Error saving language:', error);
    }
  };

  const handleLookAndFeelPress = () => {
    // Amplitude 이벤트 트래킹
    trackEvent(AMPLITUDE_EVENTS.SETTINGS_CLICKED, {
      setting_type: 'look_and_feel',
      current_theme: selectedTheme,
      current_language: selectedLanguage
    });
    
    router.push('/settings/look-and-feel');
  };

  const handleNotificationPress = () => {
    // Amplitude 이벤트 트래킹
    trackEvent(AMPLITUDE_EVENTS.SETTINGS_CLICKED, {
      setting_type: 'notification',
      current_language: selectedLanguage
    });
    
    router.push('/settings/notification');
  };


  const SettingItem = ({ title, onPress, rightComponent, showArrow = true }) => (
    <TouchableOpacity style={styles.settingItem} onPress={onPress}>
      <Text style={styles.settingTitle}>{title}</Text>
      <View style={styles.rightContainer}>
        {rightComponent}
        {showArrow && <Ionicons name="chevron-forward" size={20} color="grey" />}
      </View>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <SettingItem
          title="Look & Feel"
          onPress={handleLookAndFeelPress}
        />
      </View>
      
      <View style={styles.section}>
        <SettingItem
          title="Notification"
          onPress={handleNotificationPress}
        />
      </View>

      <View style={styles.section}>
        <TouchableOpacity 
          style={styles.settingItem} 
          onPress={handleLanguageExpandToggle}
        >
          <Text style={styles.settingTitle}>Language</Text>
          <View style={styles.rightContainer}>
            <Text style={styles.selectedLanguageText}>{selectedLanguage}</Text>
            <Ionicons 
              name={isLanguageExpanded ? "chevron-up" : "chevron-down"} 
              size={20} 
              color="grey" 
            />
          </View>
        </TouchableOpacity>

        {isLanguageExpanded && (
          <View style={styles.dropdownContainer}>
            {languages.map((language) => (
              <TouchableOpacity
                key={language.code}
                style={styles.languageOption}
                onPress={() => handleLanguageSelect(language)}
              >
                <Text style={styles.languageText}>{language.name}</Text>
                {selectedLanguage === language.name && (
                  <Ionicons name="checkmark" size={20} color="#007AFF" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  section: {
    backgroundColor: '#2a2a2a',
    marginHorizontal: 0,
    borderTopWidth: 1,
    borderColor: 'grey',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 16,
  },
  settingTitle: {
    fontSize: 16,
    color: 'white',
    flex: 1,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectedLanguageText: {
    fontSize: 15,
    color: 'white',
    marginRight: 4,
  },
  dropdownContainer: {
    backgroundColor: '#1a1a1a',
    borderTopWidth: 1,
    borderTopColor: '#3a3a3a',
  },
  languageOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#3a3a3a',
  },
  languageText: {
    fontSize: 15,
    color: 'white',
  },
  themeContainer: {
    flexDirection: 'row',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#3a3a3a',
  },
  themeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#3a3a3a',
  },
  themeButtonSelected: {
    backgroundColor: '#8B5CF6',
  },
  themeText: {
    fontSize: 14,
    color: '#ffffff',
  },
  themeTextSelected: {
    color: '#ffffff',
    fontWeight: '600',
  },
  bottomSpacing: {
    height: 100, // Space for tab bar
  },
});