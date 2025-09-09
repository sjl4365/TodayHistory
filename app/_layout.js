// Declare the layout of the ap
// Set the <Stack /> component to render the child routes.
// Header, Common Providers, etc. can be added here.
// Root layout

import { Stack } from 'expo-router';

export default function RootLayout() {
  return <Stack>
    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
  </Stack>

}