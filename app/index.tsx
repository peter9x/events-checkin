import { useEffect } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useAuth } from "../src/auth/AuthContext";

export default function Index() {
  const router = useRouter();
  const { token, isRestoring } = useAuth();

  useEffect(() => {
    if (isRestoring) {
      return;
    }

    const timer = setTimeout(() => {
      router.replace(token ? "/(tabs)/scan" : "/login");
    }, 1400);

    return () => clearTimeout(timer);
  }, [router, token, isRestoring]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.orbOne} />
      <View style={styles.orbTwo} />
      <View style={styles.content}>
        <View style={styles.logoWrap}>
          <Image
            source={require("../assets/images/splash-icon.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.title}>CheckIn</Text>
        <Text style={styles.subtitle}>Smooth event access in seconds.</Text>
      </View>
      <Text style={styles.footer}>Loading your workspace...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B1220",
    justifyContent: "center",
    alignItems: "center",
  },
  orbOne: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "#2563EB",
    opacity: 0.35,
    top: -70,
    right: -60,
  },
  orbTwo: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "#06B6D4",
    opacity: 0.25,
    bottom: -60,
    left: -40,
  },
  content: {
    alignItems: "center",
    paddingHorizontal: 24,
  },
  logoWrap: {
    width: 110,
    height: 110,
    borderRadius: 34,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  logo: {
    width: 72,
    height: 72,
  },
  title: {
    fontSize: 30,
    color: "#F8FAFC",
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    color: "rgba(248,250,252,0.7)",
  },
  footer: {
    position: "absolute",
    bottom: 48,
    color: "rgba(248,250,252,0.6)",
    fontSize: 13,
  },
});
