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

          {/* Spacer to push footer down */}
          <View style={{ flex: 1, minHeight: scale(40) }} />

          {/* Footer - Same as Settings page */}
          <View style={[
            styles.footer,
            {
              paddingTop: scale(32),
              paddingBottom: scale(34),
              paddingHorizontal: scale(20),
            }
          ]}>
            {/* Logo */}
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
            
            {/* Footer Links */}
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
                    fontSize: scale(14),
                    paddingHorizontal: scale(4),
                  }
                ]}>
                  Terms of Service
                </Text>
              </TouchableOpacity>
              
              <Text style={[
                styles.separator, 
                { 
                  fontSize: scale(14),
                  marginHorizontal: scale(8),
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
                    fontSize: scale(14),
                    paddingHorizontal: scale(4),
                  }
                ]}>
                  Privacy Policy
                </Text>
              </TouchableOpacity>
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
    color: '#888',
    fontWeight: '500',
  },
  separator: {
    color: '#888',
  },
});