// app/(tabs)/settings/setting.js

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
import * as NavigationBar from 'expo-navigation-bar';
import { emitUiLangChanged } from '../../../lib/bus';

const LANGUAGE_STORAGE_KEY = '@app_language';

const BANNER_AD_UNIT_ID = __DEV__
  ? TestIds.ADAPTIVE_BANNER
  : Platform.select({
    android: "ca-app-pub-3506417530430977/1617936328",
    ios: "ca-app-pub-3506417530430977/9692555821",
  });

function useUIScale() {
  const { width } = useWindowDimensions();
  const BASE = 393;
  const scale = useMemo(() => (n) => Math.round((width / BASE) * n), [width]);
  return { scale, screenW: width };
}

const languages = [
  { name: 'English', code: 'en' },
  { name: '한국어', code: 'ko' },
  { name: '日本語', code: 'ja' },
  { name: '簡体中文', code: 'zh-Hans' },
  { name: '繁體中文', code: 'zh-Hant' },
];

// currentLanguage(내부 코드) → languages 배열의 표시 이름 변환
// home.js는 'sc'/'tc', languageContext는 'zh-Hans'/'zh-Hant' 혼용 → 둘 다 처리
function getDisplayName(langCode) {
  const codeMap = {
    en: 'en',
    ko: 'ko',
    ja: 'ja',
    sc: 'zh-Hans',
    tc: 'zh-Hant',
    'zh-Hans': 'zh-Hans',
    'zh-Hant': 'zh-Hant',
  };
  const normalized = codeMap[langCode] || 'en';
  return languages.find(l => l.code === normalized)?.name || 'English';
}

export default function SettingsIndex() {
  const router = useRouter();
  const navigation = useNavigation();
  const { scale, screenW } = useUIScale();
  const { t, currentLanguage, changeLanguage } = useTranslation();
  console.log('[SETTINGS] currentLanguage:', currentLanguage);

  const [selectedLanguage, setSelectedLanguage] = useState(() => getDisplayName(currentLanguage));
  const [isLanguageExpanded, setIsLanguageExpanded] = useState(false);
  const [notificationTime, setNotificationTime] = useState(null);

  useEffect(() => {
    setSelectedLanguage(getDisplayName(currentLanguage));
  }, [currentLanguage]);

  useEffect(() => {
    navigation.setOptions({
      title: t('settings'),
      headerShown: true,
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => router.replace('/home')}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{
            width: scale(44),
            height: scale(44),
            marginLeft: scale(-6),
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Ionicons name="chevron-back" size={scale(26)} color="white" />
        </TouchableOpacity>
      ),
    });

    if (Platform.OS === 'android') {
      NavigationBar.setVisibilityAsync('hidden');
      NavigationBar.setBehaviorAsync('overlay-swipe');
    }

    return () => {
      if (Platform.OS === 'android') {
        NavigationBar.setVisibilityAsync('visible');
      }
    };
  }, [currentLanguage, navigation, t, router, scale]);

  useFocusEffect(
    React.useCallback(() => {
      loadNotificationTime();

      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        router.replace('/home');
        return true;
      });
      return () => sub.remove();
    }, []),
  );

  useEffect(() => {
    loadLanguageFromStorage();
  }, []);

  const loadNotificationTime = async () => {
    try {
      const enabled = await AsyncStorage.getItem('@notification_enabled');
      if (enabled !== 'true') {
        setNotificationTime(null);
        return;
      }
      const savedTimeStr = await AsyncStorage.getItem('@last_notification_time');
      if (savedTimeStr) {
        const [hour, minute] = savedTimeStr.split(':').map(n => parseInt(n, 10));
        if (!isNaN(hour) && !isNaN(minute)) {
          setNotificationTime(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
          return;
        }
      }
    } catch { }
    setNotificationTime(null);
  };

  const loadLanguageFromStorage = async () => {
    try {
      const saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (saved) {
        const displayName = getDisplayName(saved);
        setSelectedLanguage(displayName);
      }
    } catch (error) {
      console.error('Error loading language:', error);
    }
  };

  const handleLanguageSelect = async (language) => {
    setSelectedLanguage(language.name);
    setIsLanguageExpanded(false);

    await changeLanguage(language.code);

    emitUiLangChanged(language.code);
  };

  const openInstagram = async () => {
    const instagramUrl = 'instagram://user?username=sunnyinnolab';
    const webUrl = 'https://www.instagram.com/sunnyinnolab/';
    try {
      const supported = await Linking.canOpenURL(instagramUrl);
      await Linking.openURL(supported ? instagramUrl : webUrl);
    } catch {
      try { await Linking.openURL(webUrl); } catch { }
    }
  };

  const openTwitter = async () => {
    const twitterAppUrl = 'twitter://user?screen_name=Sunnyinnolab';
    const webUrl = 'https://x.com/Sunnyinnolab';
    try {
      const supported = await Linking.canOpenURL(twitterAppUrl);
      await Linking.openURL(supported ? twitterAppUrl : webUrl);
    } catch {
      try { await Linking.openURL(webUrl); } catch {
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
    } catch {
      Alert.alert('Error', 'Unable to open link');
    }
  };

  const SettingItem = ({ title, onPress, rightComponent, showArrow = true }) => (
    <TouchableOpacity
      style={[styles.settingItem, { paddingVertical: scale(20), paddingHorizontal: scale(10) }]}
      onPress={onPress}
    >
      <Text style={[styles.settingTitle, { fontSize: scale(17) }]}>{title}</Text>
      <View style={[styles.rightContainer, { gap: scale(8) }]}>
        {rightComponent}
        {showArrow && <Ionicons name="chevron-forward" size={scale(22)} color="grey" />}
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
          <SettingItem title={t('lookAndFeel')} onPress={() => router.push('/settings/look-and-feel')} />
        </View>

        <View style={styles.section}>
          <SettingItem
            title={t('notification')}
            onPress={() => router.push('/settings/notification')}
            rightComponent={
              notificationTime && (
                <Text style={[styles.timeText, { fontSize: scale(16) }]}>{notificationTime}</Text>
              )
            }
          />
        </View>

        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.settingItem, { paddingVertical: scale(20), paddingHorizontal: scale(10) }]}
            onPress={() => setIsLanguageExpanded(!isLanguageExpanded)}
          >
            <Text style={[styles.settingTitle, { fontSize: scale(17) }]}>{t('language')}</Text>
            <View style={[styles.rightContainer, { gap: scale(8) }]}>
              <Text style={[styles.selectedLanguageText, { fontSize: scale(16), marginRight: scale(4) }]}>
                {selectedLanguage}
              </Text>
              <Ionicons name={isLanguageExpanded ? "chevron-up" : "chevron-down"} size={scale(22)} color="grey" />
            </View>
          </TouchableOpacity>

          {isLanguageExpanded && (
            <View style={styles.dropdownContainer}>
              {languages.map((language) => (
                <TouchableOpacity
                  key={language.code}
                  style={[styles.languageOption, { paddingVertical: scale(16), paddingHorizontal: scale(20) }]}
                  onPress={() => handleLanguageSelect(language)}
                >
                  <Text style={[styles.languageText, { fontSize: scale(16) }]}>{language.name}</Text>
                  {selectedLanguage === language.name && (
                    <Ionicons name="checkmark" size={scale(22)} color="#007AFF" />
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
            rightComponent={<Text style={[styles.linkText, { fontSize: scale(15) }]}>{t('link')}</Text>}
            showArrow={false}
          />
        </View>

        <View style={styles.section}>
          <SettingItem
            title={t('xTwitter')}
            onPress={openTwitter}
            rightComponent={<Text style={[styles.linkText, { fontSize: scale(15) }]}>{t('link')}</Text>}
            showArrow={false}
          />
        </View>

        <View style={styles.section}>
          <SettingItem title={t('sunnyGames')} onPress={() => router.push('/settings/sunnygame')} />
        </View>

        <View style={styles.section}>
          <SettingItem title={t('credits')} onPress={() => router.push('/settings/credit')} />
        </View>

        <View style={styles.section}>
          <SettingItem title={t('openSource')} onPress={() => router.push('/settings/opensource')} />
        </View>

        <View style={[styles.section, styles.lastSection]}>
          <SettingItem
            title={t('appVersion')}
            rightComponent={
              <Text style={[styles.selectedLanguageText, { fontSize: scale(16) }]}>v 1.0.19</Text>
            }
            showArrow={false}
          />
        </View>

        <View style={[styles.footerContainer, { paddingTop: scale(16), paddingBottom: scale(8), paddingHorizontal: scale(4) }]}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: scale(12),
            width: '100%',
            paddingHorizontal: scale(4),
          }}>
            <TouchableOpacity
              onPress={() => openExternalLink('https://marmalade-neptune-dbe.notion.site/Home-Page-7589a833b4f6482e90844b9fe49c8ae0')}
              activeOpacity={0.7}
            >
              <Image
                source={require('../../../assets/images/logo_mini.png')}
                style={{ width: scale(120), height: scale(35) }}
                resizeMode="contain"
              />
            </TouchableOpacity>

            <View style={styles.footerLinksContainer}>
              <TouchableOpacity onPress={() => openExternalLink('https://marmalade-neptune-dbe.notion.site/Terms-Conditions-c18656ce6c6045e590f652bf8291f28b?pvs=74')}>
                <Text style={[styles.footerLink, { fontSize: scale(13), paddingHorizontal: scale(4) }]}>
                  {t('termsOfService')}
                </Text>
              </TouchableOpacity>
              <Text style={[styles.footerSeparator, { fontSize: scale(13), marginHorizontal: scale(4) }]}>|</Text>
              <TouchableOpacity onPress={() => openExternalLink('https://marmalade-neptune-dbe.notion.site/Privacy-Policy-ced8ead72ced4d8791ca4a71a289dd6b')}>
                <Text style={[styles.footerLink, { fontSize: scale(13), paddingHorizontal: scale(4) }]}>
                  {t('privacyPolicy')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.bannerWrap}>
            <BannerAd
              unitId={BANNER_AD_UNIT_ID}
              size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
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
    paddingBottom: 20,
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
  bannerWrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});