import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, Switch, Alert
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Notifications from 'expo-notifications';
import { getLastHomeParams, loadOnePickForDay } from '../home';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function doWork() {
  const { today, selectedCountries, uiLang } = await getLastHomeParams();
  const picks = await loadOnePickForDay({ today, selectedCountries, uiLang });
  console.log(picks);
}

const CHANNEL_ID = 'default';
const TAG = 'DAILY_REMINDER';

export default function Notification() {
  const [isNotificationOn, setIsNotificationOn] = useState(false);
  const [date, setDate] = useState(new Date());
  const [savedTime, setSavedTime] = useState(null);

  const scheduledIdRef = useRef(null);
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    init();
  }, []);

  useEffect(() => {
    console.log("test")
    doWork().catch(console.error);
}, []);

  async function init() {
    const perm = await Notifications.getPermissionsAsync();
    let granted = perm.status === 'granted';
    if (!granted) {
      const req = await Notifications.requestPermissionsAsync();
      granted = req.status === 'granted';
    }
    setHasPermission(granted);

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        sound: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }


    try {
      const all = await Notifications.getAllScheduledNotificationsAsync();
      const mine = all.find(n => n?.content?.data?.__tag === TAG);
      if (mine) {
        scheduledIdRef.current = mine.identifier || null;
        setIsNotificationOn(true);
      }
    } catch {}
  }

  async function scheduleDailyAt(time) {
    if (!hasPermission) {
      Alert.alert('Permission Required', 'Please allow notifications first.');
      setIsNotificationOn(false);
      return false;
    }
    if (scheduledIdRef.current) {
      try {
        await Notifications.cancelScheduledNotificationAsync(scheduledIdRef.current);
      } catch {}
      scheduledIdRef.current = null;
    }

    const hours = time.getHours();
    const minutes = time.getMinutes();

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
        channelId: CHANNEL_ID,
      },
    });

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Daily Reminder',
        body: "It's time for your daily check-in!",
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
        data: { __tag: TAG },
      },
      trigger,
    });

    scheduledIdRef.current = id;
    return true;
  }

  async function cancelDaily() {
    if (scheduledIdRef.current) {
      try {
        await Notifications.cancelScheduledNotificationAsync(scheduledIdRef.current);
      } catch {}
      scheduledIdRef.current = null;
    }
  }


  const handleSaveTime = async () => {
    if (!isNotificationOn) return; 
    const ok = await scheduleDailyAt(date);
    if (ok) {
      setSavedTime(date);
      const timeString = date.toLocaleTimeString([], {
        hour: '2-digit', minute: '2-digit', hour12: false
      });
      Alert.alert('Notification Scheduled!', `Daily at ${timeString}`);
    } else {
      Alert.alert('Schedule Failed', 'Could not schedule the reminder.');
    }
  };

  const handleToggleNotification = async (value) => {
    if (value) {
      if (!hasPermission) {
        const req = await Notifications.requestPermissionsAsync();
        if (req.status !== 'granted') {
          Alert.alert('Permission Required', 'Notification permission is required.');
          return;
        }
        setHasPermission(true);
      }
      setIsNotificationOn(true);
    } else {
      setIsNotificationOn(false);
      await cancelDaily();
      setSavedTime(null);
      Alert.alert('Notification Disabled', 'Daily notifications have been turned off.');
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
                      display="clock" // or 'spinner'
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
