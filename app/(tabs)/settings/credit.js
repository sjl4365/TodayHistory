// app/(tabs)/settings/credit.js
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BASE_WIDTH = 390;
const BASE_HEIGHT = 844;
const scaleWidth =(size)=>(SCREEN_WIDTH/BASE_WIDTH)*size;
const scaleHeight =(size)=>(SCREEN_HEIGHT/BASE_HEIGHT)*size;
const resize = (size)=>(SCREEN_WIDTH/BASE_WIDTH)*size;
const moderateScale=(size,factor=0.5)=>{
  return size + (resize(size)-size)*factor;
};

export default function CreditScreen() {
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
          contentContainerStyle={styles.scrollContent}
        >
          {/* Credits List */}
          <View style={styles.section}>
            <View style={styles.creditRow}>
              <Text style={styles.roleLabel}>Producer</Text>
              <Text style={styles.nameValue}>R.S.</Text>
            </View>

            <View style={styles.creditRow}>
              <Text style={styles.roleLabel}>Programmers</Text>
              <Text style={styles.nameValue}>
                Kwanyeob Jung, Sam Lee, TK
              </Text>
            </View>

            <View style={styles.creditRow}>
              <Text style={styles.roleLabel}>UIUX Designer</Text>
              <Text style={styles.nameValue}>Chloe Kim</Text>
            </View>

            <View style={styles.creditRow}>
              <Text style={styles.roleLabel}>QA Testers</Text>
              <Text style={styles.nameValue}>YC</Text>
            </View>

            <View style={styles.creditRow}>
              <Text style={styles.roleLabel}>
                Localization Managers
              </Text>
              <Text style={styles.nameValue}>Mary, Carol</Text>
            </View>

            <View style={[styles.creditRow, styles.lastCreditRow]}>
              <Text style={styles.roleLabel}>Special Thanks</Text>
              <Text style={styles.nameValue}>
                Toronto Korean Developers, JA
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Footer - Fixed at bottom */}
        <View style={styles.footer}>
          <View style={styles.footerLinks}>
            <TouchableOpacity
              onPress={() =>
                openLink(
                  'https://sunnyinnolab.notion.site/Terms-and-Conditions-0601612ffa404317a4ddaf5a094e5471'
                )
              }
            >
              <Text style={styles.linkText}>
                Terms of Service
              </Text>
            </TouchableOpacity>
            <Text style={styles.separator}>|</Text>
            <TouchableOpacity
              onPress={() =>
                openLink(
                  'https://sunnyinnolab.notion.site/Privacy-Policy-2919720d6e7848669b9d5e1170c6cabc'
                )
              }
            >
              <Text style={styles.linkText}>
                Privacy Policy
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.versionContainer}>
            <Text style={styles.versionText}>
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
    paddingBottom: scaleHeight(20),
  },
  section: {
    flex: 1,
    paddingHorizontal: scaleWidth(20),
    paddingTop: scaleHeight(20),
  },
  creditRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: scaleHeight(16),
    borderBottomWidth: 1,
    borderBottomColor: '#2c2c2e',
    gap: scaleWidth(12),
  },
  lastCreditRow: {
    borderBottomWidth: 0,
  },
  roleLabel: {
    fontSize: moderateScale(16),
    color: '#999',
    fontWeight: '400',
    flex: 1,
    minWidth: scaleWidth(100),
  },
  nameValue: {
    fontSize: moderateScale(16),
    color: '#fff',
    fontWeight: '500',
    flex: 1.5,
    textAlign: 'right',
  },
  footer: {
    paddingTop: scaleHeight(20),
    paddingBottom: scaleHeight(20),
    borderTopWidth: 1,
    borderTopColor: '#2c2c2e',
    backgroundColor: '#000',
  },
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scaleWidth(20),
    gap: scaleWidth(12),
    flexWrap: 'wrap',
    marginBottom: scaleHeight(12),
  },
  linkText: {
    fontSize: moderateScale(14),
    color: '#007AFF',
    fontWeight: '500',
  },
  separator: {
    fontSize: moderateScale(14),
    color: '#666',
  },
  versionContainer: {
    alignItems: 'center',
  },
  versionText: {
    fontSize: moderateScale(13),
    color: '#666',
  },
});