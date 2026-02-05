import { useEffect, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/auth/AuthContext";
import { useApp } from "../../src/context/AppContext";

export default function SearchScreen() {
  const [query, setQuery] = useState("");
  const router = useRouter();
  const { token } = useAuth();
  const { event } = useApp();

  useEffect(() => {
    if (token && !event?.id) {
      router.replace("/(tabs)/logout");
    }
  }, [token, event?.id, router]);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Search Athletes</Text>
      <Text style={styles.subtitle}>
        Find athletes by name or bib number.
      </Text>

      <View style={styles.card}>
        <Text style={styles.label}>Athlete name or bib number</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="e.g. Ana Costa or 245"
          placeholderTextColor="#8A8A8A"
          style={styles.input}
        />
        <Pressable style={styles.button}>
          <Text style={styles.buttonText}>Search</Text>
        </Pressable>
      </View>

      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>No results yet</Text>
        <Text style={styles.emptyText}>
          Run a search to see athlete details here.
        </Text>
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
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#292929",
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    color: "#5A5A5A",
  },
  card: {
    marginTop: 24,
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
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#292929",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#D7D7D7",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: "#292929",
    marginBottom: 16,
    backgroundColor: "#F7F7F7",
  },
  button: {
    backgroundColor: "#A5BF13",
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonText: {
    color: "#292929",
    fontSize: 15,
    fontWeight: "600",
  },
  emptyState: {
    marginTop: 24,
    padding: 20,
    borderRadius: 20,
    backgroundColor: "rgba(98, 146, 158, 0.14)",
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#292929",
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 13,
    color: "#5A5A5A",
  },
});
