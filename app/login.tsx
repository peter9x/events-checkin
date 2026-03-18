import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.background}>
        <View style={styles.topGlow} />
      </View>

      <View style={styles.container}>
        <Text style={styles.title}>Login</Text>
        <Text style={styles.subtitle}>
          Use o QR Code para iniciar sessão no posto.
        </Text>

        <Pressable
          onPress={() => router.push("/qr-login")}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          <Text style={styles.buttonText}>Entrar com QR Code</Text>
        </Pressable>
      </View>

      <Text
        style={[
          styles.copyright,
          { bottom: Math.max(insets.bottom, 12) + 8 },
        ]}
      >
        MUPY
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F0F0F0",
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  topGlow: {
    position: "absolute",
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: "#A5BF13",
    opacity: 0.2,
    top: -150,
    left: -80,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    color: "#292929",
  },
  subtitle: {
    marginTop: 12,
    fontSize: 15,
    color: "#5A5A5A",
    lineHeight: 22,
    textAlign: "center",
  },
  button: {
    marginTop: 32,
    backgroundColor: "#A5BF13",
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: "#292929",
    fontSize: 16,
    fontWeight: "600",
  },
  copyright: {
    fontSize: 13,
    fontWeight: "600",
    color: "#62929E",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
    position: "absolute",
    textAlign: "center",
    right: 0,
    left: 0,
  },
});
