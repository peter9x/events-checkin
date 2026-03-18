import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../src/auth/AuthContext";
import { CheckinProvider } from "../src/checkin/CheckinContext";
import { AppProvider } from "../src/context/AppContext";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <AuthProvider>
          <CheckinProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="login" />
              <Stack.Screen name="qr-login" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="confirmation" />
            </Stack>
          </CheckinProvider>
        </AuthProvider>
      </AppProvider>
    </SafeAreaProvider>
  );
}
