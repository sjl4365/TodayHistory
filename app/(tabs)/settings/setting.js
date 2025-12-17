// app/(tabs)/settings/index.js
// Main settings screen that replaces your settings.js
import React, { useState, useEffect, useMemo } from 'react';
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
// BackHandler
import { BackHandler } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

const LANGUAGE_STORAGE_KEY = '@app_language';

function useUIScale() {
  const { width } = useWindowDimensions();
  const BASE = 393;
  const scale = useMemo(() => (n) => Math.round((width / BASE) * n), [width]);
  return { scale, screenW: width };
}

export default function SettingsIndex() {
  const router = useRouter();
  const { scale, screenW } = useUIScale();
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [isLanguageExpanded, setIsLanguageExpanded] = useState(false);

    // back button handler
  useFocusEffect(
    React.useCallback(() => {
      const sub = BackHandler.addEventListener(
        'hardwareBackPress',
        () => {
          // 세팅 루트에서 기기 뒤로가기 누르면 무조건 홈으로
          router.replace('/home');
          return true;
        },
      );

      return () => sub.remove();
    }, [router]),
   );


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
      const supported = await Linking.canOpenURL(instagramUrl);
      if (supported) {
        await Linking.openURL(instagramUrl);
      } else {
        await Linking.openURL(webUrl);
      }
    } catch (error) {
      try {
        await Linking.openURL(webUrl);
      } catch (webError) {
      }
    }
  };
 

  const openTwitter = async () => {
    // Twitter/X app URLs
    const twitterAppUrl = 'twitter://user?screen_name=Sunnyinnolab';
    const webUrl = 'https://x.com/Sunnyinnolab';
   
    try {
      const supported = await Linking.canOpenURL(twitterAppUrl);
     
      if (supported) {
        await Linking.openURL(twitterAppUrl);
      } else {
        await Linking.openURL(webUrl);
      }
    } catch (error) {
      try {
        await Linking.openURL(webUrl);
      } catch (webError) {
        Alert.alert('Error', 'Unable to open X (Twitter)');
        console.error('Twitter error:', webError);
      }
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
          paddingVertical: scale(20),
          paddingHorizontal: scale(10),
        }
      ]} 
      onPress={onPress}
    >
      <Text style={[styles.settingTitle, { fontSize: scale(17) }]}>
        {title}
      </Text>
      <View style={[styles.rightContainer, { gap: scale(8) }]}>
        {rightComponent}
        {showArrow && (
          <Ionicons 
            name="chevron-forward" 
            size={scale(22)} 
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
                paddingVertical: scale(20),
                paddingHorizontal: scale(10),
              }
            ]} 
            onPress={() => setIsLanguageExpanded(!isLanguageExpanded)}
          >
            <Text style={[styles.settingTitle, { fontSize: scale(17) }]}>
              Language
            </Text>
            <View style={[styles.rightContainer, { gap: scale(8) }]}>
              <Text style={[
                styles.selectedLanguageText, 
                { fontSize: scale(16), marginRight: scale(4) }
              ]}>
                {selectedLanguage}
              </Text>
              <Ionicons 
                name={isLanguageExpanded ? "chevron-up" : "chevron-down"} 
                size={scale(22)} 
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
                      paddingVertical: scale(16),
                      paddingHorizontal: scale(20),
                    }
                  ]}
                  onPress={() => handleLanguageSelect(language)}
                >
                  <Text style={[
                    styles.languageText, 
                    { fontSize: scale(16) }
                  ]}>
                    {language.name}
                  </Text>
                  {selectedLanguage === language.name && (
                    <Ionicons 
                      name="checkmark" 
                      size={scale(22)} 
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
              <Text style={[styles.linkText, { fontSize: scale(15) }]}>
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
              <Text style={[styles.linkText, { fontSize: scale(15) }]}>
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

      {/* Credit */}
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

        <View style={[styles.section, styles.lastSection]}>
          <SettingItem
            title="App Version"
            rightComponent={
              <Text style={[
                styles.selectedLanguageText, 
                { fontSize: scale(16) }
              ]}>
                v 0.0.11
              </Text>
            }
            showArrow={false}
          />
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={[
        styles.footerContainer,
        {
          paddingTop: scale(12),
          paddingBottom: scale(16),
          paddingHorizontal: scale(20),
        }
      ]}>
        <Image
          source={require('../../../assets/images/logo_mini.png')}
          style={[
            styles.footerLogo, 
            { 
              width: scale(180),
              height: scale(50),
              marginBottom: scale(8),
            }
          ]}
          resizeMode="contain"
        />
        
        <View style={styles.footerLinksContainer}>
          <TouchableOpacity onPress={() => openExternalLink('https://marmalade-neptune-dbe.notion.site/Terms-Conditions-c18656ce6c6045e590f652bf8291f28b?pvs=74')}>
            <Text style={[
              styles.footerLink, 
              { 
                fontSize: scale(12),
                paddingHorizontal: scale(4),
              }
            ]}>
              Terms of Service
            </Text>
          </TouchableOpacity>
          
          <Text style={[
            styles.footerSeparator, 
            { 
              fontSize: scale(12),
              marginHorizontal: scale(6),
            }
          ]}>
            |
          </Text>
          
          <TouchableOpacity onPress={() => openExternalLink('https://marmalade-neptune-dbe.notion.site/Privacy-Policy-ced8ead72ced4d8791ca4a71a289dd6b')}>
            <Text style={[
              styles.footerLink, 
              { 
                fontSize: scale(12),
                paddingHorizontal: scale(4),
              }
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
  },
  section: {
    backgroundColor: '#2a2a2a',
    marginHorizontal: 0,
    borderTopWidth: 1,
    borderColor: 'grey',
  },
  lastSection: {
    borderBottomWidth: 1,
    borderBottomColor: 'grey',
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
  },
  selectedLanguageText: {
    color: 'white',
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
  },
  footerSeparator: {
    color: '#666',
  },
});