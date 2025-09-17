// app/(tabs)/settings/index.js
// Main settings screen that replaces your settings.js
import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 

  ScrollView 
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function SettingsIndex() {
  const router = useRouter();
  const [selectedTheme, setSelectedTheme] = useState('Dark');

  const SettingItem = ({ title, onPress, rightComponent, showArrow = true }) => (
    <TouchableOpacity style={styles.settingItem} onPress={onPress}>
      <Text style={styles.settingTitle}>{title}</Text>
      <View style={styles.rightContainer}>
        {rightComponent}
        {showArrow && <Ionicons name="chevron-forward" size={20} color="grey" />}
      </View>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container}>
      {/* First Section */}
      <View style={styles.section}>

        <SettingItem
          title="Look & Feel"
          onPress={() => router.push('/settings/look-and-feel')}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  section: {
    backgroundColor: '#2a2a2a',
    marginHorizontal: 0,
    marginBottom: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'grey',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 16,
  },
  settingTitle: {
    fontSize: 16,
    color: 'white',
    flex: 1,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  themeContainer: {
    flexDirection: 'row',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#3a3a3a',
  },
  themeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#3a3a3a',
  },
  themeButtonSelected: {
    backgroundColor: '#8B5CF6',
  },
  themeText: {
    fontSize: 14,
    color: '#ffffff',
  },
  themeTextSelected: {
    color: '#ffffff',
    fontWeight: '600',
  },
  bottomSpacing: {
    height: 100, // Space for tab bar
  },
});