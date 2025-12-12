// app/(tabs)/settings/credit.js
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function useUIScale() {
  const { width } = useWindowDimensions();
  const BASE = 393;
  const scale = (n) => Math.round((width / BASE) * n);
  return { scale, screenW: width };
}

export default function CreditScreen() {
  const { scale } = useUIScale();
  const openLink = (url) => {
    Linking.openURL(url).catch((err) =>
      console.error('Failed to open URL:', err)
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.contentWrapper}>
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: scale(20) }
          ]}
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
        </ScrollView>

        {/* Footer - Fixed at bottom */}
        <View style={[
          styles.footer,
          {
            paddingTop: scale(20),
            paddingBottom: scale(20),
          }
        ]}>
          <View style={[
            styles.footerLinks,
            {
              paddingHorizontal: scale(20),
              gap: scale(12),
              marginBottom: scale(12),
            }
          ]}>
            <TouchableOpacity
              onPress={() =>
                openLink(
                  'https://sunnyinnolab.notion.site/Terms-and-Conditions-0601612ffa404317a4ddaf5a094e5471'
                )
              }
            >
              <Text style={[styles.linkText, { fontSize: scale(14) }]}>
                Terms of Service
              </Text>
            </TouchableOpacity>
            <Text style={[styles.separator, { fontSize: scale(14) }]}>
              |
            </Text>
            <TouchableOpacity
              onPress={() =>
                openLink(
                  'https://sunnyinnolab.notion.site/Privacy-Policy-2919720d6e7848669b9d5e1170c6cabc'
                )
              }
            >
              <Text style={[styles.linkText, { fontSize: scale(14) }]}>
                Privacy Policy
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.versionContainer}>
            <Text style={[styles.versionText, { fontSize: scale(13) }]}>
              Version 1.0.0
            </Text>
          </View>
        </View>
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
    borderTopWidth: 1,
    borderTopColor: '#2c2c2e',
    backgroundColor: '#000',
  },
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  linkText: {
    color: '#007AFF',
    fontWeight: '500',
  },
  separator: {
    color: '#666',
  },
  versionContainer: {
    alignItems: 'center',
  },
  versionText: {
    color: '#666',
  },
});