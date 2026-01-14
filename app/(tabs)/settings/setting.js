// app/(tabs)/settings/setting.js
// Updated settings screen with notification time display

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
  Platform,
} from 'react-native';
import mobileAds, {
  BannerAd,
  BannerAdSize,
  TestIds,
} from "react-native-google-mobile-ads";
import { useRouter, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BackHandler } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from '../../../lib/translations';
import * as Notifications from 'expo-notifications';
import * as NavigationBar from 'expo-navigation-bar';

const LANGUAGE_STORAGE_KEY = '@app_language';
const TAG = 'DAILY_REMINDER';

function useUIScale() {
  const { width } = useWindowDimensions();
  const BASE = 393;
  const scale = useMemo(() => (n) => Math.round((width / BASE) * n), [width]);
  return { scale, screenW: width };
}

export default function SettingsIndex() {
  const router = useRouter();
  const navigation = useNavigation();
  const { scale, screenW } = useUIScale();
  const { t, currentLanguage, changeLanguage } = useTranslation();
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [isLanguageExpanded, setIsLanguageExpanded] = useState(false);
  const [notificationTime, setNotificationTime] = useState(null);

  useEffect(() => {
    navigation.setOptions({
      title: t('settings'),
      headerShown: true,
    });
    
    // Hide navigation bar on Android when this screen is shown
    if (Platform.OS === 'android') {
      NavigationBar.setVisibilityAsync('hidden');
      NavigationBar.setBehaviorAsync('overlay-swipe');
    }
    
    // Show navigation bar again when leaving this screen
    return () => {
      if (Platform.OS === 'android') {
        NavigationBar.setVisibilityAsync('visible');
      }
    };
  }, [currentLanguage, navigation, t]);

  // Load notification time when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadNotificationTime();
      
      const sub = BackHandler.addEventListener(
        'hardwareBackPress',
        () => {
          router.replace('/home');
          return true;
        },
      );
      return () => sub.remove();
    }, []),
  );  
  const languages = [
    { name: 'English', code: 'en' },
    { name: '한국어', code: 'ko' },
    { name: '日本語', code: 'ja' },
    { name: '簡体中文', code: 'zh' },
    { name: '繁體中文', code: 'ch' },
  ];

  useEffect(() => {
    loadLanguage();
  }, []);

  const loadNotificationTime = async () => {
    try {
      const all = await Notifications.getAllScheduledNotificationsAsync();
      const mine = all.find(n => n?.content?.data?.__tag === TAG);
      
      if (mine && mine.trigger && mine.trigger.hour !== undefined) {
        const hour = String(mine.trigger.hour).padStart(2, '0');
        const minute = String(mine.trigger.minute).padStart(2, '0');
        const timeStr = `${hour}:${minute}`;
        setNotificationTime(timeStr);
        return;
      }
      const savedTimeStr = await AsyncStorage.getItem('@last_notification_time');
      
      if (savedTimeStr) {
        const [hour, minute] = savedTimeStr.split(':').map(n => parseInt(n, 10));
        if (!isNaN(hour) && !isNaN(minute)) {
          const h = String(hour).padStart(2, '0');
          const m = String(minute).padStart(2, '0');
          const timeStr = `${h}:${m}`;
          setNotificationTime(timeStr);
          return;
        }
      }
      setNotificationTime(null);
    } catch (error) {
      setNotificationTime(null);
    }
  };

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
    await changeLanguage(language.code);
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
      } catch (webError) {}
    }
  };
 
  const openTwitter = async () => {
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
            title={t('lookAndFeel')}
            onPress={() => router.push('/settings/look-and-feel')}
          />
        </View>
        
        <View style={styles.section}>
          <SettingItem
            title={t('notification')}
            onPress={() => router.push('/settings/notification')}
            rightComponent={
              notificationTime && (
                <Text style={[styles.timeText, { fontSize: scale(16) }]}>
                  {notificationTime}
                </Text>
              )
            }
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
              {t('language')}
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
            title={t('instagram')}
            onPress={openInstagram}
            rightComponent={
              <Text style={[styles.linkText, { fontSize: scale(15) }]}>
                {t('link')}
              </Text>
            }
            showArrow={false}
          />
        </View>

        <View style={styles.section}>
          <SettingItem
            title={t('xTwitter')}
            onPress={openTwitter}
            rightComponent={
              <Text style={[styles.linkText, { fontSize: scale(15) }]}>
                {t('link')}
              </Text>
            }
            showArrow={false}
          />
        </View>
          
        <View style={styles.section}>
          <SettingItem
            title={t('sunnyGames')}
            onPress={() => router.push('/settings/sunnygame')}
          />
        </View>

        <View style={styles.section}>
          <SettingItem
            title={t('credits')}
            onPress={() => router.push('/settings/credit')}
          />
        </View>

        <View style={styles.section}>
          <SettingItem
            title={t('openSource')}
            onPress={() => router.push('/settings/opensource')}
          />
        </View>

        <View style={[styles.section, styles.lastSection]}>
          <SettingItem
            title={t('appVersion')}
            rightComponent={
              <Text style={[
                styles.selectedLanguageText, 
                { fontSize: scale(16) }
              ]}>
                v 1.0.4
              </Text>
            }
            showArrow={false}
          />
        </View>

        {/* Footer - Now inside ScrollView */}
        <View style={[
          styles.footerContainer,
          {
            paddingTop: scale(16),
            paddingBottom: scale(8),
            paddingHorizontal: scale(4),
          }
        ]}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: scale(12),
            width: '100%',
            paddingHorizontal: scale(4),
          }}>
            <Image
              source={require('../../../assets/images/logo_mini.png')}
              style={[
                styles.footerLogo, 
                { 
                  width: scale(120),
                  height: scale(35),
                }
              ]}
              resizeMode="contain"
            />
            
            <View style={styles.footerLinksContainer}>
              <TouchableOpacity onPress={() => openExternalLink('https://marmalade-neptune-dbe.notion.site/Terms-Conditions-c18656ce6c6045e590f652bf8291f28b?pvs=74')}>
                <Text style={[
                  styles.footerLink, 
                  { 
                    fontSize: scale(13),
                    paddingHorizontal: scale(4),
                  }
                ]}>
                  {t('termsOfService')}
                </Text>
              </TouchableOpacity>
              
              <Text style={[
                styles.footerSeparator, 
                { 
                  fontSize: scale(13),
                  marginHorizontal: scale(4),
                }
              ]}>
                |
              </Text>
              
              <TouchableOpacity onPress={() => openExternalLink('https://marmalade-neptune-dbe.notion.site/Privacy-Policy-ced8ead72ced4d8791ca4a71a289dd6b')}>
                <Text style={[
                  styles.footerLink, 
                  { 
                    fontSize: scale(13),
                    paddingHorizontal: scale(4),
                  }
                ]}>
                  {t('privacyPolicy')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={{ width: '100%', alignItems: 'center', justifyContent: 'center' }}>
            <BannerAd
              unitId={TestIds.BANNER}
              size={BannerAdSize.FULL_BANNER}
              requestOptions={{ requestNonPersonalizedAdsOnly: true }}
            />
          </View>
        </View>
      </ScrollView>
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
  timeText: {
    color: 'white',
    fontWeight: '500',
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
  footerLogo: {},
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