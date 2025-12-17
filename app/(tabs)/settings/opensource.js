// app/(tabs)/settings/opensource.js

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

function useUIScale() {
  const { width } = useWindowDimensions();
  const BASE = 393;
  const scale = (n) => Math.round((width / BASE) * n);
  return { scale, screenW: width };
}

export default function OpenSourceScreen() {
  const { scale } = useUIScale();

  const openLink = (url) => {
    Linking.openURL(url).catch((err) =>
      console.error('Failed to open URL:', err)
    );
  };

  const packages = [
    { name: 'example', version: '9.0.0' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.contentWrapper}>
        <ScrollView  
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={[styles.section, {
            paddingHorizontal: scale(20),
            paddingTop: scale(20),
          }]}>
            {packages.map((pkg, index) => (
              <View 
                key={pkg.name} 
                style={[
                  styles.packageRow,
                  {
                    paddingVertical: scale(16),
                    borderBottomWidth: index === packages.length - 1 ? 0 : 1,
                  }
                ]}
              >
                <Text style={[styles.packageName, { fontSize: scale(16) }]}>
                  {pkg.name}
                </Text>
                <Text style={[styles.packageVersion, { fontSize: scale(16) }]}>
                  {pkg.version}
                </Text>
              </View>
            ))}
          </View>

          {/* Footer with Logo */}
          <View style={[
            styles.footerContainer,
            {
              paddingTop: scale(12),
              paddingBottom: scale(16),
              paddingHorizontal: scale(20),
              marginTop: scale(20),
            }
          ]}>
            <Image
              source={require('../../../assets/images/logo_mini.png')}
              style={{ 
                width: scale(180),
                height: scale(50),
                marginBottom: scale(8),
                tintColor: 'white',
              }}
              resizeMode="contain"
            />
            
            <View style={styles.footerLinksContainer}>
              <TouchableOpacity onPress={() => openLink('https://marmalade-neptune-dbe.notion.site/Terms-Conditions-c18656ce6c6045e590f652bf8291f28b?pvs=74')}>
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
              
              <TouchableOpacity onPress={() => openLink('https://marmalade-neptune-dbe.notion.site/Privacy-Policy-ced8ead72ced4d8791ca4a71a289dd6b')}>
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
  packageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomColor: '#2c2c2e',
  },
  packageName: {
    color: '#fff',
    fontWeight: '500',
    flex: 1,
  },
  packageVersion: {
    color: '#999',
    fontWeight: '400',
    textAlign: 'right',
  },
  footerContainer: {
    alignItems: 'center',
    backgroundColor: '#000',
  },
  footerLinksContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerLink: {
    color: '#007AFF',
    fontWeight: '500',
  },
  footerSeparator: {
    color: '#666',
  },
  versionContainer: {
    alignItems: 'center',
  },
  versionText: {
    color: '#666',
  },
});