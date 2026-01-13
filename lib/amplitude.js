import { init, track, Identify, identify, setUserId } from '@amplitude/analytics-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';

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
      // 방법 1: Device ID 사용 (추천)
      userId = Application.androidId || await Application.getIosIdForVendorAsync() || `user_${Date.now()}`;
      
      // 또는 방법 2: 타임스탬프 기반
      // userId = `user_${Date.now()}`;
      
      await AsyncStorage.setItem(USER_ID_KEY, userId);
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