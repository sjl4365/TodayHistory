import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, Switch, Alert
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Notifications from 'expo-notifications';
import { getLastHomeParams, loadOnePickForDay } from '../home';
import {PICK_RESULT_CACHE} from '../home';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function doWork() {
  const { today, selectedCountries, uiLang } = await getLastHomeParams();
  const picks = await loadOnePickForDay({ today, selectedCountries, uiLang });
  console.log(picks);
}

const CHANNEL_ID = 'daily-reminder-channel';
const TAG = 'DAILY_REMINDER';

export default function Notification() {
  const [isNotificationOn, setIsNotificationOn] = useState(false);
  // 기본 시간을 오후 3시 (15:00)로 설정
  const [date, setDate] = useState(() => {
    const defaultTime = new Date();
    defaultTime.setHours(15, 0, 0, 0);
    return defaultTime;
  });
  const [savedTime, setSavedTime] = useState(null);

  const scheduledIdRef = useRef(null);
  const [hasPermission, setHasPermission] = useState(false);

  const notificationListener = useRef(null);
  const responseListener = useRef(null);

  useEffect(() => {
    init();
  }, []);

  useEffect(() => {
    console.log("test")
    doWork().catch(console.error);
  }, []);

  useEffect(() => {
    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        console.log('NOTIFICATION RECEIVED:', notification);
      });

    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        console.log('NOTIFICATION RESPONSE:', response);
      });

    return () => {
      notificationListener.current?.remove?.();
      responseListener.current?.remove?.();
    };
  }, []);

  async function init() {
    console.log('Checking notification permissions...');
    
    const { granted } = await Notifications.getPermissionsAsync();
    console.log('Permission status:', { granted });
    
    if (granted) {
      console.log('Permissions already granted');
      setHasPermission(true);
      
      try {
        const { data } = await Notifications.getExpoPushTokenAsync();
        console.log('Push token:', data);
      } catch (error) {
        console.log('Push token error (can ignore):', error);
      }
    } else {
      console.log('Permissions not granted yet');
      setHasPermission(false);
      // 첫 진입 시에는 alert 띄우지 않음 - 토글 켤 때 권한 요청
    }

    if (Platform.OS === 'android') {
      try {
        console.log('Creating Android notification channel...');
        const channel = await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
          name: 'Daily Reminders',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
          sound: 'default',
          enableVibrate: true,
        });
        console.log('Notification channel created:', channel);
      } catch (error) {
        console.error('Failed to create notification channel:', error);
      }
    }

    try {
      console.log('Checking for existing scheduled notifications...');
      const all = await Notifications.getAllScheduledNotificationsAsync();
      console.log('All scheduled notifications:', all.length);
      
      const mine = all.find(n => n?.content?.data?.__tag === TAG);
      if (mine) {
        console.log('Found existing notification:', mine);
        scheduledIdRef.current = mine.identifier || null;
        setIsNotificationOn(true);
        if (mine.trigger && mine.trigger.hour !== undefined) {
          const savedDate = new Date();
          savedDate.setHours(mine.trigger.hour, mine.trigger.minute, 0, 0);
          setDate(savedDate);
          setSavedTime(savedDate);
          console.log('Restored saved time:', savedDate.toLocaleTimeString());
        }
      } else {
        console.log('No existing notifications found');
      }
    } catch (error) {
      console.error('Failed to get scheduled notifications:', error);
    }
  }

  async function scheduleDailyAt(time) {
    console.log('Starting scheduleDailyAt with time:', time);
    
    if (!hasPermission) {
      console.log('No permission, aborting schedule');
      Alert.alert('Permission Required', 'Please allow notifications first.');
      setIsNotificationOn(false);
      return false;
    }
    if (scheduledIdRef.current) {
      try {
        console.log('Cancelling existing notification:', scheduledIdRef.current);
        await Notifications.cancelScheduledNotificationAsync(scheduledIdRef.current);
        console.log('Successfully cancelled existing notification');
      } catch (error) {
        console.error('Failed to cancel notification:', error);
      }
      scheduledIdRef.current = null;
    }

    if (Platform.OS === 'android') {
      try {
        console.log('Recreating notification channel (Fix logic)...');
        
        try {
          await Notifications.deleteNotificationChannelAsync(CHANNEL_ID);
          console.log('Old channel deleted');
        } catch (e) {
          console.log('No channel to delete');
        }
        
        await new Promise(resolve => setTimeout(resolve, 200));
        
        const channel = await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
          name: 'Daily Reminders',
          description: 'Critical daily reminder notifications',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 500, 500, 500],
          lightColor: '#FF0000',
          sound: 'default',
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          enableVibrate: true,
          showBadge: true,
          enableLights: true,
          bypassDnd: false,
        });
        
        console.log('Channel recreated successfully:', JSON.stringify(channel));
        
        await new Promise(resolve => setTimeout(resolve, 300));
        console.log('Waited for channel to be fully registered');
      } catch (error) {
        console.error('Failed to recreate channel:', error);
        Alert.alert('채널 생성 실패', '다시 시도해주세요.');
        return false;
      }
    }

    const hours = time.getHours();
    const minutes = time.getMinutes();
    console.log(`Scheduling notification for ${hours}:${minutes}`);

    const trigger = Platform.select({
      ios: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: hours,
        minute: minutes,
        repeats: true,
      },
      android: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: hours,
        minute: minutes,
        repeats: true,
      },
    });

    console.log('Trigger configuration:', trigger);

    try {
      console.log('Attempting to schedule notification...');
      console.log(PICK_RESULT_CACHE.get('picks'))

      
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Today In History',
          body: PICK_RESULT_CACHE.get("notificationBody"),
          sound: 'default',
          channelId: CHANNEL_ID,
          data: { __tag: TAG },
        },
        trigger: {
          ...trigger,
          channelId: CHANNEL_ID,
        },
      });

      console.log('Notification scheduled successfully with ID:', id);
      
      if (!id) {
        console.error('Schedule returned null/undefined ID');
        Alert.alert('Schedule Failed', 'Notification ID is null');
        return false;
      }
      
      scheduledIdRef.current = id;

      console.log('Verifying scheduled notification...');
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      console.log('All scheduled notifications:', scheduled.length);
      
      const myNotification = scheduled.find(n => n.identifier === id);
      if (myNotification) {
        console.log('Found my notification in schedule:', myNotification);
      } else {
        console.error('My notification NOT found in schedule!');
        Alert.alert('Schedule Verification Failed', 'Notification was not properly scheduled');
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Failed to schedule notification:', error);
      Alert.alert('Schedule Error', `Failed: ${error.message}`);
      return false;
    }
  }

  async function cancelDaily() {
    if (scheduledIdRef.current) {
      try {
        await Notifications.cancelScheduledNotificationAsync(scheduledIdRef.current);
        console.log('Successfully cancelled notification');
      } catch (error) {
        console.error('Failed to cancel notification:', error);
      }
      scheduledIdRef.current = null;
    }
  }

  const handleSaveTime = async () => {
    if (!isNotificationOn) {
      console.log('Notification is off, not saving time');
      return;
    }
    
    console.log('Saving time:', date.toLocaleTimeString());
    console.log('Current state - hasPermission:', hasPermission, 'scheduledId:', scheduledIdRef.current);
    
    const ok = await scheduleDailyAt(date);
    console.log('Schedule result:', ok);
    
    if (ok) {
      setSavedTime(date);
      const timeString = date.toLocaleTimeString([], {
        hour: '2-digit', minute: '2-digit', hour12: false
      });
      console.log('Successfully saved time:', timeString);
      Alert.alert(
        '알림 설정 완료!', 
        `매일 ${timeString}에 알림이 울립니다.`
      );
    } else {
      console.log('Failed to save time');
      Alert.alert('Schedule Failed', 'Could not schedule the reminder.');
    }
  };

  const handleToggleNotification = async (value) => {
    console.log('Toggle notification:', value);
    
    if (value) {
      // 토글 켤 때 시간을 오후 3시로 리셋
      const defaultTime = new Date();
      defaultTime.setHours(15, 0, 0, 0);
      setDate(defaultTime);
      
      const { granted } = await Notifications.getPermissionsAsync();
      console.log('Current permission status:', { granted });
      
      if (!granted) {
        console.log('Permission not granted, requesting...');
        const req = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
          },
        });
        console.log('Permission request result:', req);
        
        if (req.granted) {
          setHasPermission(true);
          setIsNotificationOn(true);
          console.log('Permission granted after request');
        } else {
          console.log('Permission denied by user');
          // 권한 거부 시 토글 다시 끄기
          setIsNotificationOn(false);
          return;
        }
      } else {
        console.log('Permission already granted');
        setHasPermission(true);
        setIsNotificationOn(true);
      }
    } else {
      console.log('Turning off notifications');
      setIsNotificationOn(false);
      await cancelDaily();
      setSavedTime(null);
      Alert.alert('알림 비활성화', '일일 알림이 꺼졌습니다.');
    }
  };

  const handleChange = (evt, d) => {
    if (Platform.OS === 'android') {
      const ts = evt?.nativeEvent?.timestamp;
      const next = d ?? (typeof ts === 'number' ? new Date(ts) : null);
      if (evt?.type === 'set' && next) {
        requestAnimationFrame(() => {
          next.setSeconds(0, 0);
          setDate(next);
        });
      }
    } else {
      if (d) {
        const t = new Date(d);
        t.setSeconds(0, 0);
        setDate(t);
      }
    }
  };

  const NotificationItem = ({ title, value, onToggle }) => {
    const [showTimePicker, setShowTimePicker] = useState(Platform.OS === 'ios');

    useEffect(() => {
      if (!value && Platform.OS === 'android') setShowTimePicker(false);
    }, [value]);

    return (
      <View style={styles.notificationSection}>
        <View className="header" style={styles.notificationHeader}>
          <Text style={styles.notificationTitle}>{title}</Text>
          <Switch
            value={value}
            onValueChange={onToggle}
            trackColor={{ false: "#767577", true: "#8B5CF6" }}
            thumbColor={value ? "#ffffff" : "#f4f3f4"}
          />
        </View>

        {value && (
          <View style={styles.timePickerContainer}>
            <View style={styles.timePickerWrapper}>
              {Platform.OS === 'ios' ? (
                <DateTimePicker
                  value={date}
                  mode="time"
                  is24Hour
                  display="spinner"
                  onChange={handleChange}
                  style={styles.timePicker}
                  textColor="#000000"
                />
              ) : (
                <>
                  <TouchableOpacity
                    style={{ paddingVertical: 12 }}
                    onPress={() => setShowTimePicker(true)}
                  >
                    <Text style={{ fontSize: 16 }}>
                      {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                    </Text>
                    <Text style={{ color: '#8B5CF6', marginTop: 6 }}>Change time</Text>
                  </TouchableOpacity>

                  {showTimePicker && (
                    <DateTimePicker
                      value={date}
                      mode="time"
                      is24Hour
                      display="clock"
                      onChange={(e, d) => {
                        setShowTimePicker(false);
                        handleChange(e, d);
                      }}
                    />
                  )}
                </>
              )}
            </View>

            <TouchableOpacity style={styles.doneButton} onPress={handleSaveTime}>
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <NotificationItem
          title="Allow Notification"
          value={isNotificationOn}
          onToggle={handleToggleNotification}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  section: {
    backgroundColor: '#2a2a2a',
    marginHorizontal: 0,
    marginBottom: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'grey',
  },
  notificationSection: { paddingHorizontal: 10, paddingVertical: 10 },
  notificationHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 6, minHeight: 50,
  },
  notificationTitle: { fontSize: 16, color: 'white', flex: 1 },
  timePickerContainer: { marginTop: 15, position: 'relative' },
  timePickerWrapper: {
    backgroundColor: 'white', borderRadius: 12,
    padding: Platform.OS === 'ios' ? 10 : 5, alignItems: 'center',
    ...Platform.select({
      ios: { height: 200, justifyContent: 'center' },
      android: { minHeight: 60, justifyContent: 'center' },
    }),
  },
  timePicker: {
    ...Platform.select({
      ios: { height: 180, width: '100%' },
      android: { height: 50, width: 150 },
    }),
  },
  doneButton: {
    position: 'absolute', bottom: Platform.OS === 'ios' ? 15 : 10, right: 15,
    backgroundColor: '#8B5CF6', paddingHorizontal: 20, paddingVertical: 8,
    borderRadius: 8, elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 3.84,
  },
  doneButtonText: { color: 'white', fontSize: 14, fontWeight: '600' },
});