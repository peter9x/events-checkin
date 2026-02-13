import React, { useEffect, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "../src/auth/AuthContext";
import { useCheckin } from "../src/checkin/CheckinContext";
import { useApp } from "../src/context/AppContext";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

export default function ConfirmationPage() {
  const router = useRouter();
  const { token, clearSession } = useAuth();
  const { registration, setRegistration } = useCheckin();
  const { event, applyStatsFromResponse } = useApp();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token && !event?.id) {
      router.replace("/(tabs)/logout");
    }
  }, [token, event?.id, router]);

  if (!registration || !registration.allow_check_in) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Inscrição invalida</Text>
          <Pressable
            style={styles.button}
            onPress={() => router.replace("/(tabs)/scan")}
          >
            <Text style={styles.buttonText}>Voltar ao Scan</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const handleConfirm = async () => {
    if (!token || loading) {
      return;
    }

    if (!event?.id) {
      router.replace("/(tabs)/logout");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/checkin/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          registration: registration.id,
          event_id: event.id,
        }),
      });

      const payload = await response.json().catch(() => null);
      applyStatsFromResponse(payload);

      if (response.status === 403) {
        await clearSession();
        setRegistration(null);
        router.replace("/login");
        return;
      }

      if (!response.ok) {
        setError("Unable to confirm check-in.");
        return;
      }

      setRegistration(null);
      router.replace("/(tabs)/scan");
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Confirmar Check-In</Text>

        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.avatarWrap}>
              {registration.athlete.avatar ? (
                <Image
                  source={{ uri: registration.athlete.avatar }}
                  style={styles.avatar}
                />
              ) : (
                <Text style={styles.avatarFallback}>
                  {registration.athlete.firstname?.[0] || "A"}
                </Text>
              )}
            </View>
            <View style={styles.rowInfo}>
              <Text style={styles.name}>
                {registration.athlete.firstname} {registration.athlete.lastname}
              </Text>
              <Text style={styles.meta}>
                Nº Ident.: {registration.athlete.identification_number}
              </Text>
              <Text style={styles.meta}>
                Dorsal: {registration.bib_number ?? "N/A"}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Evento</Text>
          <Text style={styles.sectionValue}>{registration.event.name}</Text>

          <Text style={styles.sectionTitle}>Percurso</Text>
          <Text style={styles.sectionValue}>{registration.course.name}</Text>

          {registration.extras && registration.extras.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Extras</Text>
              {registration.extras.map((extra, index) => (
                <Text key={`${extra.type}-${index}`} style={styles.sectionValue}>
                  {extra.type}: {extra.value}
                </Text>
              ))}
            </>
          )}
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleConfirm}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? "A confirmar..." : "Confirmar Check-In"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#F0F0F0",
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 120,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#292929",
    marginBottom: 20,
    textAlign: "center",
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    color: "#5A5A5A",
  },
  card: {
    marginTop: 20,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 22,
    borderWidth: 1,
    borderColor: "#E2E2E2",
    shadowColor: "#292929",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#F0F0F0",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 20,
  },
  avatarFallback: {
    fontSize: 22,
    fontWeight: "700",
    color: "#5A5A5A",
  },
  rowInfo: {
    flex: 1,
  },
  name: {
    fontSize: 18,
    fontWeight: "700",
    color: "#292929",
  },
  meta: {
    marginTop: 4,
    fontSize: 13,
    color: "#62929E",
  },
  divider: {
    height: 1,
    backgroundColor: "#E2E2E2",
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#62929E",
    marginTop: 12,
  },
  sectionValue: {
    fontSize: 15,
    color: "#292929",
    marginTop: 6,
  },
  errorText: {
    marginTop: 16,
    color: "#B42318",
    fontSize: 13,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 20,
    backgroundColor: "rgba(240,240,240,0.98)",
    borderTopWidth: 1,
    borderTopColor: "#E2E2E2",
  },
  button: {
    backgroundColor: "#A5BF13",
    borderRadius: 5,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#292929",
    fontSize: 16,
    fontWeight: "600",
  },
});
