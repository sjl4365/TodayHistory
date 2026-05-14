// app/(tabs)/settings/_layout.js

import React from 'react';
import { Stack } from 'expo-router';
import { TouchableOpacity, Image, Text } from 'react-native';
import { useTranslation } from '../../../lib/translations';
import { useFocusEffect } from '@react-navigation/native';

export default function SettingsLayout() {
  const { t, currentLanguage } = useTranslation();
  const [key, setKey] = React.useState(0);

  // Force re-render when language changes
  useFocusEffect(
    React.useCallback(() => {
      setKey(prev => prev + 1);
    }, [currentLanguage])
  );

  const renderHeaderTitle = (title) => (
    <Text
      style={{
        color: 'white',
        fontSize: 18,
        fontWeight: '600',
      }}
      maxFontSizeMultiplier={1}
    >
      {title}
    </Text>
  );

  return (
    <Stack
      key={key}
      screenOptions={{
        headerStyle: {
          backgroundColor: 'black',
        },
        headerTintColor: 'white',
        headerBackTitle: 'Back',
      }}
    >
      {/* Main settings screen */}
      <Stack.Screen
        name="setting"
        options={({ navigation }) => ({
          headerTitle: () => renderHeaderTitle(t('settings')),

          headerLeft: () => (
            <TouchableOpacity
              onPress={() => navigation.navigate('home')}
              style={{ marginRight: 15 }}
            >
              <Image
                source={require('../../../assets/images/prevv.png')}
                style={{
                  width: 24,
                  height: 24,
                  tintColor: 'white',
                }}
                resizeMode="contain"
              />
            </TouchableOpacity>
          ),
        })}
      />

      <Stack.Screen
        name="look-and-feel"
        options={{
          headerTitle: () => renderHeaderTitle(t('lookAndFeel')),
          presentation: 'card',
        }}
      />

      <Stack.Screen
        name="language"
        options={{
          headerTitle: () => renderHeaderTitle(t('language')),
          presentation: 'card',
        }}
      />

      <Stack.Screen
        name="credit"
        options={{
          headerTitle: () => renderHeaderTitle(t('credits')),
          presentation: 'card',
        }}
      />

      <Stack.Screen
        name="sunnygame"
        options={{
          headerTitle: () => renderHeaderTitle(t('sunnyGames')),
          presentation: 'card',
        }}
      />

      <Stack.Screen
        name="opensource"
        options={{
          headerTitle: () => renderHeaderTitle(t('openSource')),
          presentation: 'card',
        }}
      />
    </Stack>
  );
}