import { init, track, Identify, identify, setUserId } from '@amplitude/analytics-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import { Platform } from 'react-native';

const AMPLITUDE_API_KEY = '05ca83f7ddce5f424fb8d81e78884630'; 
const USER_ID_KEY = '@amplitude_user_id';

let isInitialized = false;

export async function initAmplitude() {
  if (isInitialized) return;
  
  try {
    await init(AMPLITUDE_API_KEY, undefined, {
      trackingOptions: {
        ipAddress: false,
      },
    });

    // ✅ User ID 설정
    let userId = await AsyncStorage.getItem(USER_ID_KEY);
    if (!userId) {
      try {
        if (Platform.OS === 'android') {
          userId = Application.androidId;
        } else if (Platform.OS === 'ios') {
          userId = await Application.getIosIdForVendorAsync();
        }
        
        // Device ID를 못 가져온 경우 fallback
        if (!userId) {
          userId = `${Platform.OS}_${Date.now()}`;
        }
        
        await AsyncStorage.setItem(USER_ID_KEY, userId);
      } catch (err) {
        console.error('Error getting device ID:', err);
        userId = `${Platform.OS}_${Date.now()}`;
        await AsyncStorage.setItem(USER_ID_KEY, userId);
      }
    }
    
    setUserId(userId);
    console.log('Amplitude initialized with User ID:', userId);
    
    isInitialized = true;
  } catch (error) {
    console.error('Failed to initialize Amplitude:', error);
  }
}

export function trackEvent(eventName, eventProperties = {}) {
  try {
    track(eventName, eventProperties);
    console.log(`Amplitude event tracked: ${eventName}`, eventProperties);
  } catch (error) {
    console.error(`Failed to track event ${eventName}:`, error);
  }
}

export function setUserProperties(properties) {
  try {
    const identifyObj = new Identify();
    Object.entries(properties).forEach(([key, value]) => {
      identifyObj.set(key, value);
    });
    identify(identifyObj);
    console.log('User properties set:', properties);
  } catch (error) {
    console.error('Failed to set user properties:', error);
  }
}

export const AMPLITUDE_EVENTS = {
  SCREEN_VIEW: 'Screen_View',
  COUNTRY_CLICKED: 'Country_Clicked',
  REFRESH_CLICKED: 'Refresh_Clicked',
  YESTERDAY_CLICKED: 'Yesterday_Clicked',
  TOMORROW_CLICKED: 'Tomorrow_Clicked',
  SHARE_CLICKED: 'Share_Clicked',
  SETTINGS_CLICKED: 'Settings_Clicked'
};