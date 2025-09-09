//This page matches the root URL
//Redirects users to the main page

import { Redirect } from "expo-router";

export default function Index() {
  return <Redirect href="/home" />;
}
