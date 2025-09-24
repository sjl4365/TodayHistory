// Declare the layout of the ap
// Set the <Stack /> component to render the child routes.
// Header, Common Providers, etc. can be added here.
// Root layout

import { Stack } from 'expo-router';
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LangProvider } from "../lib/i18n";


export default function RootLayout() {
    return <LangProvider>
    <SafeAreaProvider>
      <Stack>
        <StatusBar style="dark" translucent backgroundColor="transparent" />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </SafeAreaProvider>
    </LangProvider>
  

}