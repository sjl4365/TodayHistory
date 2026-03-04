// app/(tabs)/settings/credit.js
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Image,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from '../../../lib/translations';
import { Stack } from 'expo-router';

function useUIScale() {
  const { width } = useWindowDimensions();
  const BASE = 393;
  const scale = (n) => Math.round((width / BASE) * n);
  return { scale, screenW: width };
}

export default function CreditScreen() {
  const { scale } = useUIScale();
  const { t } = useTranslation();
  
  const openLink = (url) => {
    Linking.openURL(url).catch((err) =>
      console.error('Failed to open URL:', err)
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: t('credits'),
          headerStyle: {
            backgroundColor: '#000',
          },
          headerTintColor: '#fff',
        }}
      />
      <View style={styles.contentWrapper}>
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          
          <View style={[
            styles.section,
            {
              paddingHorizontal: scale(20),
              paddingTop: scale(20),
            }
          ]}>
            <View style={[
              styles.creditRow,
              {
                paddingVertical: scale(16),
                gap: scale(12),
              }
            ]}>
              <Text style={[styles.roleLabel, { fontSize: scale(16) }]}>
                Producer
              </Text>
              <Text style={[styles.nameValue, { fontSize: scale(16) }]}>
                R.S.
              </Text>
            </View>

            <View style={[
              styles.creditRow,
              {
                paddingVertical: scale(16),
                gap: scale(12),
              }
            ]}>
              <Text style={[styles.roleLabel, { fontSize: scale(16) }]}>
                Programmers
              </Text>
              <Text style={[styles.nameValue, { fontSize: scale(16) }]}>
                Kwanyeob Jung, Sam Lee, TK
              </Text>
            </View>

            <View style={[
              styles.creditRow,
              {
                paddingVertical: scale(16),
                gap: scale(12),
              }
            ]}>
              <Text style={[styles.roleLabel, { fontSize: scale(16) }]}>
                UIUX Designer
              </Text>
              <Text style={[styles.nameValue, { fontSize: scale(16) }]}>
                Chloe Kim
              </Text>
            </View>

            <View style={[
              styles.creditRow,
              {
                paddingVertical: scale(16),
                gap: scale(12),
              }
            ]}>
              <Text style={[styles.roleLabel, { fontSize: scale(16) }]}>
                QA Testers
              </Text>
              <Text style={[styles.nameValue, { fontSize: scale(16) }]}>
                YC, SJ
              </Text>
            </View>

            <View style={[
              styles.creditRow,
              {
                paddingVertical: scale(16),
                gap: scale(12),
              }
            ]}>
              <Text style={[styles.roleLabel, { fontSize: scale(16) }]}>
                Localization Managers
              </Text>
              <Text style={[styles.nameValue, { fontSize: scale(16) }]}>
                Mary, Carol
              </Text>
            </View>

            <View style={[
              styles.creditRow,
              styles.lastCreditRow,
              {
                paddingVertical: scale(16),
                gap: scale(12),
              }
            ]}>
              <Text style={[styles.roleLabel, { fontSize: scale(16) }]}>
                Special Thanks
              </Text>
              <Text style={[styles.nameValue, { fontSize: scale(16) }]}>
                Toronto Korean Developers, JA
              </Text>
            </View>
          </View>

          <View style={{ flex: 1, minHeight: scale(40) }} />

          {/* Footer - unified with settings screen */}
          <View style={[
            styles.footer,
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
                onPress={() => openLink('https://marmalade-neptune-dbe.notion.site/Home-Page-7589a833b4f6482e90844b9fe49c8ae0')}
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

              <View style={styles.footerLinks}>
                <TouchableOpacity
                  onPress={() =>
                    openLink(
                      'https://marmalade-neptune-dbe.notion.site/Terms-Conditions-c18656ce6c6045e590f652bf8291f28b?pvs=74'
                    )
                  }
                >
                  <Text style={[
                    styles.linkText, 
                    { 
                      fontSize: scale(13),
                      paddingHorizontal: scale(4),
                    }
                  ]}>
                    Terms
                  </Text>
                </TouchableOpacity>
                
                <Text style={[
                  styles.separator, 
                  { 
                    fontSize: scale(13),
                    marginHorizontal: scale(4),
                  }
                ]}>
                  |
                </Text>
                
                <TouchableOpacity
                  onPress={() =>
                    openLink(
                      'https://marmalade-neptune-dbe.notion.site/Privacy-Policy-ced8ead72ced4d8791ca4a71a289dd6b'
                    )
                  }
                >
                  <Text style={[
                    styles.linkText, 
                    { 
                      fontSize: scale(13),
                      paddingHorizontal: scale(4),
                    }
                  ]}>
                    Privacy
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  contentWrapper: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  section: {
    flex: 1,
  },
  creditRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#2c2c2e',
  },
  lastCreditRow: {
    borderBottomWidth: 0,
  },
  roleLabel: {
    color: '#999',
    fontWeight: '400',
    flex: 1,
    minWidth: 100,
  },
  nameValue: {
    color: '#fff',
    fontWeight: '500',
    flex: 1.5,
    textAlign: 'right',
  },
  footer: {
    backgroundColor: '#000',
    alignItems: 'center',
  },
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  linkText: {
    color: '#999',
    textDecorationLine: 'underline',
  },
  separator: {
    color: '#666',
  },
});