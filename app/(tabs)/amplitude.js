import { init, track, Identify, identify } from '@amplitude/analytics-react-native';

const AMPLITUDE_API_KEY = '05ca83f7ddce5f424fb8d81e78884630'; 

let isInitialized = false;

export async function initAmplitude() {
  if (isInitialized) return;
  
  try {
    await init(AMPLITUDE_API_KEY, undefined, {
      trackingOptions: {
        ipAddress: false,
      },
    });
    isInitialized = true;
    console.log('Amplitude initialized successfully');
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
  COUNTRY_CLICKED: 'Country_Clicked',
  REFRESH_CLICKED: 'Refresh_Clicked',
  YESTERDAY_CLICKED: 'Yesterday_Clicked',
  TOMORROW_CLICKED: 'Tomorrow_Clicked',
  SHARE_CLICKED: 'Share_Clicked',
  SETTINGS_CLICKED: 'Settings_Clicked'
};