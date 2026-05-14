// app/(tabs)/settings/sunnygame.js

import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Linking, Alert, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from '../../../lib/translations';
import AppText from "../../../components/AppText";

function useUIScale() {
  const { width } = useWindowDimensions();
  const BASE = 393;
  const scale = (n) => Math.round((width / BASE) * n);
  return { scale, screenW: width };
}

export default function SunnyGame() {
  const { scale } = useUIScale();
  const { t, currentLanguage } = useTranslation();
  const navigation = useNavigation();

  useEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <AppText
          style={{
            color: 'white',
            fontSize: scale(19),
            fontWeight: '600',
          }}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {t('sunnyGames')}
        </AppText>
      ),
    });
  }, [navigation, t, currentLanguage, scale]);

  const apps = useMemo(() => [
    {
      id: 1,
      name: "Sky Peacemaker",
      icon: require('../../../assets/images/skypeacemaker.png'),
      url: 'https://skypeacemaker.onelink.me/YQxG/8s9sx66i',
    },
    {
      id: 2,
      name: "World Movie Trailer",
      icon: require('../../../assets/images/worldmovietrailer.png'),
      url: 'https://wmt.onelink.me/YPN9/m428wgpq',
    },
    {
      id: 3,
      name: "World Book Ranking",
      icon: require('../../../assets/images/worldbookranking.png'),
      url: 'https://worldbookranking.onelink.me/so3H/gftf32rq',
    },
    {
      id: 4,
      name: "Simply Multi Timer",
      icon: require('../../../assets/images/SimplyMultiTimerIcon.png'),
      url: 'https://simplymultitimer.onelink.me/6kU2/v7i9ke1m',
    },
    {
      id: 5,
      name: "Wisdom Qclock",
      icon: require('../../../assets/images/wisdomqclock.png'),
      url: 'https://wisdomqclock.onelink.me/SVr2/b7gs4og1',
    },
    {
      id: 6,
      name: "Play Memo",
      icon: require('../../../assets/images/PlayMemoIcon.png'),
      url: 'https://playmemo.onelink.me/LdOZ/6bbfoohf',
    },
    {
      id: 7,
      name: "Find Four",
      icon: require('../../../assets/images/findfour.png'),
      url: 'https://findfour.onelink.me/vurA/0tfteiuf',
    },
    {
      id: 8,
      name: "Dual Flashlight",
      icon: require('../../../assets/images/dualflashlight.png'),
      url: 'https://dualflashlight.onelink.me/7gkq/qpbc8y65',
    },
    {
      id: 9,
      name: "Decibella",
      icon: require('../../../assets/images/decibella.png'),
      url: 'https://decibella.onelink.me/Ve6i/vydwhkh4',
    },
    {
      id: 10,
      name: "Scanatory",
      icon: require('../../../assets/images/scanatory.png'),
      url: 'https://scanatory.onelink.me/zzpK/2tr21jtp',
    },
  ], []);

  const openAppLink = async (url, appName) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
      console.error(`Error opening ${appName}:`, error);
      Alert.alert(
        'Unable to Open Link',
        `Could not open ${appName}. Please check your internet connection.`,
        [{ text: 'OK' }]
      );
    }
  };

  const openExternalLink = async (url) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
      console.error('Error opening link:', error);
      Alert.alert(
        'Unable to Open Link',
        'Could not open the link. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const AppCard = ({ app, isLast }) => (
    <View>
      <TouchableOpacity
        style={styles.appCard}
        onPress={() => openAppLink(app.url, app.name)}
        activeOpacity={0.7}
      >
        <View style={[styles.appContent, {
          padding: scale(15),
          paddingVertical: scale(16),
        }]}>
          <Image
            source={app.icon}
            style={{
              width: scale(60),
              height: scale(60),
              borderRadius: scale(12),
              marginRight: scale(15),
            }}
            resizeMode="cover"
          />

          <View style={{ flex: 1, marginRight: scale(10) }}>
            <AppText style={[styles.appName, { fontSize: scale(16) }]}>
              {app.name}
            </AppText>
          </View>

          <View style={{ paddingHorizontal: scale(12) }}>
            <AppText style={[styles.linkText, { fontSize: scale(14) }]}>
              {t('link')}
            </AppText>
          </View>
        </View>
      </TouchableOpacity>

      {!isLast && <View style={{
        height: 1,
        backgroundColor: '#3a3a3a',
        marginLeft: scale(15)
      }} />}
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.appsContainer}>
          {apps.map((app, index) => (
            <AppCard
              key={app.id}
              app={app}
              isLast={index === apps.length - 1}
            />
          ))}
        </View>

        <View style={{ flex: 1 }} />

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
            width: '100%',
            paddingHorizontal: scale(4),
          }}>
            <TouchableOpacity
              onPress={() => openExternalLink('https://marmalade-neptune-dbe.notion.site/Home-Page-7589a833b4f6482e90844b9fe49c8ae0')}
              activeOpacity={0.7}
            >
              <Image
                source={require('../../../assets/images/logo_mini.png')}
                style={{
                  width: scale(120),
                  height: scale(35),
                }}
                resizeMode="contain"
              />
            </TouchableOpacity>

            <View style={styles.footerLinksContainer}>
              <TouchableOpacity onPress={() => openExternalLink('https://marmalade-neptune-dbe.notion.site/Terms-Conditions-c18656ce6c6045e590f652bf8291f28b?pvs=74')}>
                <AppText style={[styles.footerLink, { fontSize: scale(13), paddingHorizontal: scale(4) }]}>
                  {t('termsOfService')}
                </AppText>
              </TouchableOpacity>
              <AppText style={[styles.footerSeparator, { fontSize: scale(13), marginHorizontal: scale(4) }]}>
                |
              </AppText>
              <TouchableOpacity onPress={() => openExternalLink('https://marmalade-neptune-dbe.notion.site/Privacy-Policy-ced8ead72ced4d8791ca4a71a289dd6b')}>
                <AppText style={[styles.footerLink, { fontSize: scale(13), paddingHorizontal: scale(4) }]}>
                  {t('privacyPolicy')}
                </AppText>
              </TouchableOpacity>
            </View>
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
  appsContainer: {
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  appCard: {
    backgroundColor: 'black',
  },
  appContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appName: {
    fontWeight: '600',
    color: 'white',
  },
  linkText: {
    color: 'grey',
    fontWeight: '500',
  },
  footerContainer: {
    alignItems: 'center',
    backgroundColor: 'black',
  },
  footerLinksContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerLink: {
    color: '#888',
  },
  footerSeparator: {
    color: '#888',
  },
});