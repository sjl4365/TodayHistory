// app/(tabs)/settings/_layout.js
import React from 'react';
import { Stack } from 'expo-router';
import { TouchableOpacity, Image } from 'react-native';
import { useTranslation } from '../../../lib/translations';
import { useFocusEffect } from '@react-navigation/native';

export default function SettingsLayout() {
  const { t, currentLanguage } = useTranslation();
  const [key, setKey] = React.useState(0);

  // Force re-render when this screen is focused and language might have changed
  useFocusEffect(
    React.useCallback(() => {
      setKey(prev => prev + 1);
    }, [currentLanguage])
  );

  return (
    <Stack
      key={key}
      screenOptions={{
        headerStyle: {
          backgroundColor: 'black',
        },
        headerTintColor: 'white',
        headerTitleStyle: {
          fontWeight: 'bold',
          fontSize: 25,
        },
      }}
    >
      {/* Main settings screen */}
      <Stack.Screen 
        name="setting" 
        options={({ navigation }) => ({ 
          title: t('settings'),
          headerLeft: () => (
            <TouchableOpacity 
              onPress={() => navigation.navigate('home')}
              style={{ marginRight: 15 }}
            >
              <Image 
                source={require('../../../assets/images/prevv.png')}
                style={{ width: 24, height: 24, tintColor: 'white' }}
                resizeMode="contain"
              />
            </TouchableOpacity>
          ),
        })} 
      />
      
      <Stack.Screen 
        name="look-and-feel" 
        options={{ 
          title: t('lookAndFeel'),
          presentation: 'card',
        }} 
      />

      <Stack.Screen 
        name="language" 
        options={{ 
          title: t('language'),
          presentation: 'card',
        }} 
      />
      
      <Stack.Screen 
        name="credit" 
        options={{ 
          title: t('credits'),
          presentation: 'card',
        }} 
      />

      <Stack.Screen
        name="sunnygame"
        options={{
          title: t('sunnyGames'),
          presentation: 'card',
        }}
      />

      <Stack.Screen
        name="opensource"
        options={{
          title: t('openSource'),
          presentation: 'card',
        }}
      />
    </Stack>
  );
}