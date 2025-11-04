// app/(tabs)/settings/credit.js
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CreditScreen() {
  const openLink = (url) => {
    Linking.openURL(url).catch((err) =>
      console.error('Failed to open URL:', err)
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView}>

        {/* Credits List */}
        <View style={styles.section}>
          <View style={styles.creditRow}>
            <Text style={styles.roleLabel}>Producer</Text>
            <Text style={styles.nameValue}>R.S.</Text>
          </View>

          <View style={styles.creditRow}>
            <Text style={styles.roleLabel}>Programmer</Text>
            <Text style={styles.nameValue}>Kwanyeob, Sam, TK</Text>
          </View>

          <View style={styles.creditRow}>
            <Text style={styles.roleLabel}>Artist</Text>
            <Text style={styles.nameValue}>Chloe</Text>
          </View>

          <View style={styles.creditRow}>
            <Text style={styles.roleLabel}>QA Testers</Text>
            <Text style={styles.nameValue}> </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Localization Managers</Text>
          <Text style={styles.sectionContent}>
 
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Special Thanks</Text>
          <Text style={styles.sectionContent}>
 
          </Text>
        </View>

        {/* <View style={styles.logoContainer}>
          <View style={styles.logoPlaceholder}>
            <View style={styles.sunIcon}>
              <Text style={styles.sunText}>☀️</Text>
            </View>
            <Text style={styles.companyName}>SUNNY</Text>
            <Text style={styles.companySubtitle}>INNOVATION LAB</Text>
          </View>
        </View> */}

        {/* Footer Links */}
        <View style={styles.footerLinks}>
          <TouchableOpacity onPress={() => openLink('https://sunnyinnolab.notion.site/Terms-and-Conditions-0601612ffa404317a4ddaf5a094e5471')}>
            <Text style={styles.linkText}>Terms of Service</Text>
          </TouchableOpacity>
          <Text style={styles.separator}>|</Text>
          <TouchableOpacity onPress={() => openLink('https://sunnyinnolab.notion.site/Privacy-Policy-2919720d6e7848669b9d5e1170c6cabc')}>
            <Text style={styles.linkText}>Privacy Policy</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>Version 1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scrollView: {
    flex: 1,
  },
  headerContainer: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 30,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#1c1c1e',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconText: {
    fontSize: 32,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  creditRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2c2c2e',
  },
  roleLabel: {
    fontSize: 16,
    color: '#999',
    fontWeight: '400',
  },
  nameValue: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  sectionContent: {
    fontSize: 15,
    color: '#999',
    lineHeight: 24,
  },
  logoContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  logoPlaceholder: {
    alignItems: 'center',
  },
  sunIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1c1c1e',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  sunText: {
    fontSize: 40,
  },
  companyName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 2,
    marginBottom: 4,
  },
  companySubtitle: {
    fontSize: 12,
    color: '#999',
    letterSpacing: 1,
  },
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    gap: 12,
  },
  linkText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  separator: {
    fontSize: 14,
    color: '#666',
  },
  versionContainer: {
    alignItems: 'center',
    paddingBottom: 40,
  },
  versionText: {
    fontSize: 13,
    color: '#666',
  },
});