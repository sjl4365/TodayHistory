//This page matches the root URL
//Redirects users to the main page

import { Redirect } from "expo-router";
import { useEffect } from 'react';
import { router } from 'expo-router';
import { View, Text } from 'react-native';

export default function Index() {
  return <Redirect href="/home" />;
}

// import { Redirect } from 'expo-router';

// export default function Index() {
//   return <Redirect href="/(tabs)/refresh" />;
// }
