// app/(tabs)/settings/_layout.js
// Settings stack navigation within the settings tab
import React from 'react';
import { Stack } from 'expo-router';

export default function SettingsLayout() {
  return (
    <Stack
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
        options={{ 
          title: 'Settings',
        }} 
      />
      
      <Stack.Screen 
        name="look-and-feel" 
        options={{ 
          title: 'Look & Feel',
          presentation: 'card',
        }} 
      />

    </Stack>
  );
}