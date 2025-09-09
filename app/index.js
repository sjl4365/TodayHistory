//This page matches the root URL
//Redirects users to the main page

<<<<<<< HEAD
import { Redirect } from "expo-router";

export default function Index() {
  return <Redirect href="/home" />;
}
=======
import { useEffect } from 'react';
import { router } from 'expo-router';
import { View, Text } from 'react-native';

// export default function Index() {
//   useEffect(() => {
//     // Redirect to the tabs (let Expo Router pick the first tab)
//     router.replace('/(tabs)');
//   }, []);

//   // Show a brief loading screen while redirecting
//   return (
//     <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'white' }}>
//       <Text style={{ fontSize: 20 }}>Loading...</Text>
//     </View>
//   );
// }
import { Redirect } from 'expo-router';

export default function Index() {
  return <Redirect href="/(tabs)/refresh" />;
}
>>>>>>> 6b6eeaab8fbdc92be66cf9e4815f45ebccbd0be4
