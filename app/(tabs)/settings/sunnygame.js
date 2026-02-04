// app/(tabs)/settings/sunnygame.js

import React, { useEffect, useMemo } from 'react';
import {View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Linking, Alert, useWindowDimensions} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from '../../../lib/translations';

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
      title: t('sunnyGames')
    });
  }, [navigation, t, currentLanguage]);

  const apps = useMemo(() => [
    {
        id: 1,
        name: t('skyPeacemaker'),
        icon: require('../../../assets/images/skypeacemaker.png'),
        url: 'https://skypeacemaker.onelink.me/YQxG/8s9sx66i',
    },
    {
        id: 2,
        name: t('worldMovieTrailer'),
        icon: require('../../../assets/images/worldmovietrailer.png'),
        url: 'https://wmt.onelink.me/YPN9/m428wgpq',
    },
    {
        id: 3,
        name: "Wisdom Qclock",
        icon: require('../../../assets/images/wisdomqclock.png'),
        url: 'https://wisdomqclock.onelink.me/SVr2/b7gs4og1',
    },
    {
        id: 4,
        name: t('findFour'),
        icon: require('../../../assets/images/findfour.png'),
        url: 'https://findfour.onelink.me/vurA/0tfteiuf',
    },
    {
        id: 5,
        name: t('dualFlashlight'),
        icon: require('../../../assets/images/dualflashlight.png'),
        url: 'https://dualflashlight.onelink.me/7gkq/qpbc8y65',

    },
    {
      id: 6,
      name: t('decibella'),
      icon: require('../../../assets/images/decibella.png'),
      url: 'https://decibella.onelink.me/Ve6i/vydwhkh4',

  },
  ], [t, currentLanguage]);

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
            <Text style={[styles.appName, { fontSize: scale(16) }]}>
              {app.name}
            </Text>
          </View>

          <View style={{ paddingHorizontal: scale(12) }}>
            <Text style={[styles.linkText, { fontSize: scale(14) }]}>
              {t('link')}
            </Text>
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
            paddingTop: scale(32),
            paddingBottom: scale(20),
            paddingHorizontal: scale(20),
          }
        ]}>
          <Image
            source={require('../../../assets/images/logo_mini.png')}
            style={{ 
              width: scale(180),
              height: scale(50),
              marginBottom: scale(16),
              tintColor: 'white',
            }}
            resizeMode="contain"
          />
          
          <View style={styles.footerLinksContainer}>
            <TouchableOpacity onPress={() => openExternalLink('https://marmalade-neptune-dbe.notion.site/Terms-Conditions-c18656ce6c6045e590f652bf8291f28b?pvs=74')}>
              <Text style={[
                styles.footerLink, 
                { 
                  fontSize: scale(14),
                  paddingHorizontal: scale(4),
                }
              ]}>
                {t('termsOfService')}
              </Text>
            </TouchableOpacity>
            
            <Text style={[
              styles.footerSeparator, 
              { 
                fontSize: scale(14),
                marginHorizontal: scale(8),
              }
            ]}>
              |
            </Text>
            
            <TouchableOpacity onPress={() => openExternalLink('https://marmalade-neptune-dbe.notion.site/Privacy-Policy-ced8ead72ced4d8791ca4a71a289dd6b')}>
              <Text style={[
                styles.footerLink, 
                { 
                  fontSize: scale(14),
                  paddingHorizontal: scale(4),
                }
              ]}>
                {t('privacyPolicy')}
              </Text>
            </TouchableOpacity>
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