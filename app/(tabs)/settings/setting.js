// app/(tabs)/settings/index.js
// Main settings screen that replaces your settings.js
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView,
  Linking,
  Alert 
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LANGUAGE_STORAGE_KEY = '@app_language';

export default function SettingsIndex() {
  const router = useRouter();
  const [selectedTheme, setSelectedTheme] = useState('Dark');
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [isLanguageExpanded, setIsLanguageExpanded] = useState(false);

  const languages = [
    { name: 'English', code: 'en' },
    { name: '한국어', code: 'ko' },
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
    setSelectedLanguage(language.name);
    setIsLanguageExpanded(false);
    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language.code);
      console.log(`Language changed to: ${language.name}`);
    } catch (error) {
      console.error('Error saving language:', error);
    }
  };

  const openInstagram = async () => {
    const webUrl = 'https://www.instagram.com/sunnyinnolab/';

    try {
      const canOpen = await Linking.canOpenURL(instagramUrl);
      if (canOpen) {
        await Linking.openURL(instagramUrl);
      } else {
        await Linking.openURL(webUrl);
      }
    } catch (error) {
      Alert.alert('Error', 'Unable to open Instagram');
      console.error(error);
    }
  };

  const openTwitter = async () => {
    const twitterUsername = 'Sunnyinnolab'; // Replace with your X (Twitter) username
    const twitterUrl = `twitter://user?screen_name=${twitterUsername}`;
    const webUrl = `https://x.com/Sunnyinnolab`;

    try {
      const canOpen = await Linking.canOpenURL(twitterUrl);
      if (canOpen) {
        await Linking.openURL(twitterUrl);
      } else {
        await Linking.openURL(webUrl);
      }
    } catch (error) {
      Alert.alert('Error', 'Unable to open X (Twitter)');
      console.error(error);
    }
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
          onPress={() => router.push('/settings/look-and-feel')}
        />
      </View>
      
      <View style={styles.section}>
        <SettingItem
          title="Notification"
          onPress={() => router.push('/settings/notification')}
        />
      </View>

      <View style={styles.section}>
        <TouchableOpacity 
          style={styles.settingItem} 
          onPress={() => setIsLanguageExpanded(!isLanguageExpanded)}
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

      {/* Social Media Links Section */}
      <View style={styles.section}>
        <SettingItem
          title="Instagram"
          onPress={openInstagram}
          rightComponent={<Text style={styles.linkText}>Link</Text>}
          showArrow={false}
        />
      </View>

      <View style={styles.section}>
        <SettingItem
          title="X (Twitter)"
          onPress={openTwitter}
          rightComponent={<Text style={styles.linkText}>Link</Text>}
          showArrow={false}
        />
      </View>

      <View style={styles.bottomSpacing} />
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
  linkText: {
    fontSize: 14,
    color: 'grey',
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
    height: 100,
  },
});