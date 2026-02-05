import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/auth/AuthContext";
import { useCheckin } from "../../src/checkin/CheckinContext";

export default function LogoutScreen() {
  const router = useRouter();
  const { user, clearSession } = useAuth();
  const { setRegistration } = useCheckin();

  const handleLogout = async () => {
    await clearSession();
    setRegistration(null);
    router.replace("/login");
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Account</Text>
        <Text style={styles.subtitle}>
          Signed in as {user?.name || user?.email || "team member"}.
        </Text>
        <Pressable style={styles.button} onPress={handleLogout}>
          <Text style={styles.buttonText}>Log out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F0F0F0",
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  card: {
    marginTop: 32,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: "#E2E2E2",
    shadowColor: "#292929",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#292929",
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    color: "#5A5A5A",
  },
  button: {
    marginTop: 20,
    backgroundColor: "#292929",
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonText: {
    color: "#F0F0F0",
    fontSize: 15,
    fontWeight: "600",
  },
});
