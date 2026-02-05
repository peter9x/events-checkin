import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SearchScreen() {
  const [query, setQuery] = useState("");

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
          placeholderTextColor="#94A3B8"
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
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0F172A",
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    color: "#475569",
  },
  card: {
    marginTop: 24,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#0F172A",
    marginBottom: 16,
    backgroundColor: "#F8FAFC",
  },
  button: {
    backgroundColor: "#0EA5E9",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonText: {
    color: "#F8FAFC",
    fontSize: 15,
    fontWeight: "600",
  },
  emptyState: {
    marginTop: 24,
    padding: 20,
    borderRadius: 16,
    backgroundColor: "rgba(14, 165, 233, 0.08)",
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 13,
    color: "#475569",
  },
});
