import { useEffect } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useAuth } from "../src/auth/AuthContext";
import { useApp } from "../src/context/AppContext";

export default function Index() {
  const router = useRouter();
  const { token, isRestoring } = useAuth();
  const { event } = useApp();

  useEffect(() => {
    if (isRestoring) {
      return;
    }

    const timer = setTimeout(() => {
      if (!token) {
        router.replace("/login");
        return;
      }

      if (event?.id) {
        router.replace("/(tabs)/scan");
      } else {
        router.replace("/(tabs)/logout");
      }
    }, 1400);

    return () => clearTimeout(timer);
  }, [router, token, isRestoring, event?.id]);

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
        <Text style={styles.title}>Check In</Text>
        <Text style={styles.subtitle}>MUPY</Text>
      </View>
      <Text style={styles.footer}>Loading...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111111",
    justifyContent: "center",
    alignItems: "center",
  },
  orbOne: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "#333333",
    opacity: 0.35,
    top: -70,
    right: -60,
  },
  orbTwo: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "#323232",
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
    width: 110,
    height: 110,
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
