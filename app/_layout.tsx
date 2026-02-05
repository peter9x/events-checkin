import { Stack } from "expo-router";
import { AuthProvider } from "../src/auth/AuthContext";
import { CheckinProvider } from "../src/checkin/CheckinContext";
import { AppProvider } from "../src/app/AppContext";

export default function RootLayout() {
  return (
    <AuthProvider>
      <AppProvider>
        <CheckinProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="login" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="confirmation" />
          </Stack>
        </CheckinProvider>
      </AppProvider>
    </AuthProvider>
  );
}
