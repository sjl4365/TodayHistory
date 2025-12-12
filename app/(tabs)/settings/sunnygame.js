// app/(tabs)/settings/sunnygame.js

import React from 'react';
import {View, Text, StyleSheet, ScrollView, TouchableOpacity,Image,Linking,Alert,
} from 'react-native';

export default function SunnyGame() {
  const apps = [
    {
        id: 1,
        name: 'Sky Peacemaker',
        icon: require('../../../assets/images/skypeacemaker.png'),
        url: 'https://skypeacemaker.onelink.me/YQxG/8s9sx66i',
    },
    {
        id: 2,
        name: 'World Move Trailer',
        icon: require('../../../assets/images/worldmovietrailer.png'),
        url: 'https://wmt.onelink.me/YPN9/m428wgpq',
    },
    {
        id: 3,
        name: 'Dual Flashlight',
        icon: require('../../../assets/images/dualflashlight.png'),
        url: 'https://dualflashlight.onelink.me/7gkq/qpbc8y65',
    },
    {
        id: 4,
        name: 'Decibella',
        icon: require('../../../assets/images/decibella.png'),
        url: 'https://decibella.onelink.me/Ve6i/vydwhkh4',
      },
    {
        id: 5,
        name: 'Find Four',
        icon: require('../../../assets/images/findfour.png'),
        url: 'https://findfour.onelink.me/vurA/0tfteiuf',
    },
  ];

  const openAppLink = async (url,appName) =>{
    try {
        await Linking.openURL(url);
      } catch (error) {
        console.error(`Error opening ${appName}:`, error);
        Alert.alert(
          'Unable to Open Link', 
          `Could not open ${appName}. Please check your internet connection.`,
          [{ text: 'OK' }]
        );
      }
  };

  const openTwitter = async () => {
    const twitterUsername = 'Sunnyinnolab';
    const twitterUrl = `twitter://user?screen_name=${twitterUsername}`;
    const webUrl = `https://x.com/Sunnyinnolab`;

    try {
      const canOpen = await Linking.canOpenURL(twitterUrl);
      if (canOpen) {
        await Linking.openURL(twitterUrl);
      } else {
        await Linking.openURL(webUrl);
      }
    } catch (error) {
      Alert.alert('Error', 'Unable to open X (Twitter)');
      console.error(error);
    }
  };

  const AppCard = ({ app,isLast }) =>(
    <View>
      <TouchableOpacity
        style={styles.appCard}
        onPress={() => openAppLink(app.url, app.name)}
        activeOpacity={0.7}
      >
        <View style={styles.appContent}>
          <Image source={app.icon} style={styles.appIcon} resizeMode="cover" />
          
          <View style={styles.appInfo}>
            <Text style={styles.appName}>{app.name}</Text>
          </View>

          <View style={styles.linkContainer}>
            <Text style={styles.linkText}>Link</Text>
          </View>
        </View>
      </TouchableOpacity>

      {!isLast && <View style={styles.divider} />}
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.appsContainer}>
          {apps.map((app,index)=>(
            <AppCard 
              key={app.id} 
              app={app} 
              isLast={index === apps.length - 1}
            />
          ))}
        </View>
        <View style={styles.bottomSpacing} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:{
    flex: 1,
    backgroundColor: 'black',
  },
  scrollView:{
    flex: 1,
  },
  appsContainer:{
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  appCard:{
    backgroundColor: 'black',
  },
  appContent:{
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    paddingVertical: 16,
  },
  appIcon:{
    width: 60,
    height: 60,
    borderRadius: 12,
    marginRight: 15,
  },
  appInfo:{
    flex: 1,
    marginRight: 10,
  },
  appName:{
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  linkContainer:{
    paddingHorizontal: 12,
  },
  linkText:{
    fontSize:14,
    color: 'grey',
    fontWeight: '500',
  },
  divider:{
    height: 1,
    backgroundColor:'#3a3a3a',
    marginLeft: 15,
  },
  bottomSpacing:{
    height: 50,
  },
});