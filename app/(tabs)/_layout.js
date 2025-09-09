// This file defines the tab navigation layout 
// Declare the <Tabs> and register the screens to display
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';


export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: 'black',
        tabBarStyle: {
          backgroundColor: 'white',
          borderTopWidth: 1,
          borderTopColor: 'black',
        },
      }}
    >
      <Tabs.Screen
  name="back"
  options={{
    title: 'Back',
    tabBarIcon: ({ color, size }) => (
      <Ionicons name="chevron-back" size={size} color={color} />
    ),
  }}
/>

      
      <Tabs.Screen
  name="refresh"
  options={{
    title: 'Refresh',
    tabBarIcon: ({ color, size }) => (
      <Ionicons name="refresh" size={size} color={color} />
    ),
  }}
/> 
      
      <Tabs.Screen
  name="forward"
  options={{
    title: 'Forward',
    tabBarIcon: ({ color, size }) => (
      <Ionicons name="chevron-forward" size={size} color={color} />
    ),
  }}
/>
<Tabs.Screen
  name="share"
  options={{
    title: 'Share',
    tabBarIcon: ({ color, size }) => (
      <Ionicons name="share-social" size={size} color={color} />
    ),
  }}
/>
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings" size={size} color={color} />
          ),
        }}
      /> 
    </Tabs>
  );
}
