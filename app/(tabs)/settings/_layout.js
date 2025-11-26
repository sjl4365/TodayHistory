// app/(tabs)/settings/_layout.js
// Settings stack navigation within the settings tab
import React from 'react';
import {Stack} from 'expo-router';
import { TouchableOpacity, Image} from 'react-native';

export default function SettingsLayout(){
  return(
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
        options={({ navigation }) => ({ 
          title: 'Settings',
          headerLeft: () => (
            <TouchableOpacity 
              onPress={() => navigation.navigate('home')} // Navigate to home tab
              style={{ marginRight: 15 }}
            >
              <Image 
                source={require('../../../assets/images/prev.png')} // Correct path from settings folder
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
          title: 'Look & Feel',
          presentation: 'card',
        }} 
      />

      <Stack.Screen 
        name="language" 
        options={{ 
          title: 'Language',
          presentation: 'card',
        }} 
      />

      {/* <Stack.Screen
        name="instagram"
        options={{
          title: 'Instagram',
          presentation: 'card',
        }}
      /> */}
      
      <Stack.Screen 
        name="credit" 
        options={{ 
          title: 'Credit',
          presentation: 'card',
        }} 
      />

      <Stack.Screen
        name="sunnygame"
        options={{
          title: 'Sunny Games and Apps',
          presentation: 'card',
        }}
      />

      <Stack.Screen
        name="opensource"
        options={{
          title: 'Open Source Info',
          presentation: 'card',
        }}
      />
    </Stack>

    
  );
}