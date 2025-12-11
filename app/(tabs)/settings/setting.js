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
  Alert,
  Image,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LANGUAGE_STORAGE_KEY = '@app_language';

function useUIScale() {
  const { width } = useWindowDimensions();
  const BASE = 393;
  const scale = (n) => Math.round((width / BASE) * n);
  return { scale, screenW: width };
}

export default function SettingsIndex() {
  const router = useRouter();
  const { scale, screenW } = useUIScale();
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [isLanguageExpanded, setIsLanguageExpanded] = useState(false);

  const languages = [
    { name: 'English', code: 'en' },
    { name: '한국어', code: 'ko' },
    { name: '日本語', code: 'ja' },
  ];

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
    const instagramUrl = 'instagram://user?username=sunnyinnolab';
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
    const twitterUsername = 'Sunnyinnolab';
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

  const openExternalLink = async (url) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Unable to open link');
      }
    } catch (error) {
      Alert.alert('Error', 'Unable to open link');
      console.error(error);
    }
  };

  const SettingItem = ({ title, onPress, rightComponent, showArrow = true }) => (
    <TouchableOpacity 
      style={[
        styles.settingItem,
        {
          paddingVertical: scale(16),
          paddingHorizontal: scale(10),
        }
      ]} 
      onPress={onPress}
    >
      <Text style={[styles.settingTitle, { fontSize: scale(16) }]}>
        {title}
      </Text>
      <View style={styles.rightContainer}>
        {rightComponent}
        {showArrow && (
          <Ionicons 
            name="chevron-forward" 
            size={scale(20)} 
            color="grey" 
          />
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
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
            style={[
              styles.settingItem,
              {
                paddingVertical: scale(16),
                paddingHorizontal: scale(10),
              }
            ]} 
            onPress={() => setIsLanguageExpanded(!isLanguageExpanded)}
          >
            <Text style={[styles.settingTitle, { fontSize: scale(16) }]}>
              Language
            </Text>
            <View style={styles.rightContainer}>
              <Text style={[
                styles.selectedLanguageText, 
                { fontSize: scale(15) }
              ]}>
                {selectedLanguage}
              </Text>
              <Ionicons 
                name={isLanguageExpanded ? "chevron-up" : "chevron-down"} 
                size={scale(20)} 
                color="grey" 
              />
            </View>
          </TouchableOpacity>

          {isLanguageExpanded && (
            <View style={styles.dropdownContainer}>
              {languages.map((language) => (
                <TouchableOpacity
                  key={language.code}
                  style={[
                    styles.languageOption,
                    {
                      paddingVertical: scale(12),
                      paddingHorizontal: scale(20),
                    }
                  ]}
                  onPress={() => handleLanguageSelect(language)}
                >
                  <Text style={[
                    styles.languageText, 
                    { fontSize: scale(15) }
                  ]}>
                    {language.name}
                  </Text>
                  {selectedLanguage === language.name && (
                    <Ionicons 
                      name="checkmark" 
                      size={scale(20)} 
                      color="#007AFF" 
                    />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <SettingItem
            title="Instagram"
            onPress={openInstagram}
            rightComponent={
              <Text style={[styles.linkText, { fontSize: scale(14) }]}>
                Link
              </Text>
            }
            showArrow={false}
          />
        </View>

        <View style={styles.section}>
          <SettingItem
            title="X (Twitter)"
            onPress={openTwitter}
            rightComponent={
              <Text style={[styles.linkText, { fontSize: scale(14) }]}>
                Link
              </Text>
            }
            showArrow={false}
          />
        </View>
          
        <View style={styles.section}>
          <SettingItem
            title="Sunny's Game and Apps"
            onPress={() => router.push('/settings/sunnygame')}
          />
        </View>

        <View style={styles.section}>
          <SettingItem
            title="Credit"
            onPress={() => router.push('/settings/credit')}
          />
        </View>

        <View style={styles.section}>
          <SettingItem
            title="Open Source Info"
            onPress={() => router.push('/settings/opensource')}
          />
        </View>

        <View style={styles.section}>
          <SettingItem
            title="App Version"
            rightComponent={
              <Text style={[
                styles.selectedLanguageText, 
                { fontSize: scale(15) }
              ]}>
                v 1.3.3
              </Text>
            }
            showArrow={false}
          />
        </View>

        <View style={{ flex: 1, minHeight: scale(60) }} />
      </ScrollView>

      {/* Footer */}
      <View style={[
        styles.footerContainer,
        {
          paddingVertical: scale(20),
          paddingHorizontal: scale(20),
        }
      ]}>
        <Image
          source={require('../../../assets/images/logo_mini.png')}
          style={[
            styles.footerLogo, 
            { 
              width: Math.min(screenW * 0.5, scale(200)),
              height: Math.min(screenW * 0.5, scale(200)) * 0.3,
              marginBottom: scale(12),
            }
          ]}
          resizeMode="contain"
        />
        
        <View style={styles.footerLinksContainer}>
          <TouchableOpacity onPress={() => openExternalLink('https://example.com/terms')}>
            <Text style={[
              styles.footerLink, 
              { fontSize: scale(13) }
            ]}>
              Terms of Service
            </Text>
          </TouchableOpacity>
          
          <Text style={[
            styles.footerSeparator, 
            { 
              fontSize: scale(13),
              marginHorizontal: scale(8),
            }
          ]}>
            |
          </Text>
          
          <TouchableOpacity onPress={() => openExternalLink('https://example.com/privacy')}>
            <Text style={[
              styles.footerLink, 
              { fontSize: scale(13) }
            ]}>
              Privacy Policy
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
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
  },
  settingTitle: {
    color: 'white',
    flex: 1,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectedLanguageText: {
    color: 'white',
    marginRight: 4,
  },
  linkText: {
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
    borderBottomWidth: 1,
    borderBottomColor: '#3a3a3a',
  },
  languageText: {
    color: 'white',
  },
  footerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'black',
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  footerLogo: {
    // Dynamic sizing applied inline
  },
  footerLinksContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  footerLink: {
    color: '#999',
    textDecorationLine: 'underline',
    paddingHorizontal: 4,
  },
  footerSeparator: {
    color: '#666',
  },
});