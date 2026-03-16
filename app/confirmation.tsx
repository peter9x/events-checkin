import { useEffect, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "../src/auth/AuthContext";
import { RecentCheckin, useCheckin } from "../src/checkin/CheckinContext";
import { useApp } from "../src/context/AppContext";
import { useApi } from "../src/api/useApi";
import { useSessionReset } from "../src/auth/useSessionReset";

export default function ConfirmationPage() {
  const router = useRouter();
  const { token } = useAuth();
  const { registration, setRegistration, addRecentCheckin } = useCheckin();
  const { event, applyStatsFromResponse } = useApp();
  const { request } = useApi();
  const resetSession = useSessionReset();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token && !event?.id) {
      void resetSession();
    }
  }, [token, event?.id, resetSession]);

  if (!registration) {
    return null;
  }

  const handleConfirm = async () => {
    if (!token) {
      await resetSession();
      return;
    }
    if (loading) {
      return;
    }

    if (!event?.id) {
      await resetSession();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { response, payload, unauthorized } = await request(
        "/checkin/confirm",
        {
          method: "POST",
          body: {
            registration: registration.id,
          },
        },
      );

      if (!response || unauthorized) {
        return;
      }

      applyStatsFromResponse(payload);

      if (!response.ok) {
        setError("Unable to confirm check-in.");
        return;
      }

      const now = Date.now();
      const shirtExtra = registration.extras?.find(
        (extra) => extra.type === "shirt" && extra.value
      );
      const athleteName =
        [registration.athlete.firstname, registration.athlete.lastname]
          .filter(Boolean)
          .join(" ")
          .trim() || registration.athlete.name;
      const recentCheckin: RecentCheckin = {
        id: `${registration.id}-${now}`,
        athleteName: athleteName || "—",
        bibNumber: registration.bib_number ?? null,
        shirt: shirtExtra?.value ?? null,
        box: registration.box?.name ?? null,
        createdAt: now,
      };

      addRecentCheckin(recentCheckin);
      setRegistration(null);
      router.replace("/(tabs)/scan");
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView
      style={{
        ...styles.container,
        backgroundColor: registration.allow_check_in ? "#5cb85c" : "#cd2923",
      }}
    >
      <ScrollView
        contentContainerStyle={{
          ...styles.scrollContent,
          paddingBottom: styles.scrollContent.paddingBottom + insets.bottom,
        }}
      >
        {registration.check_in ? (
          <View
            style={{
              padding: 16,
              borderRadius: 10,
              backgroundColor: "#ea988c",
              marginTop: 10,
            }}
          >
            <Text style={styles.title}>Check In Concluido</Text>
          </View>
        ) : (
          <Text style={styles.title}>Confirmar Check-In</Text>
        )}

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
                IDGS: {registration.code ?? "N/A"}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Dorsal</Text>
          <Text
            style={{ ...styles.sectionValue, fontSize: 22, fontWeight: "700" }}
          >
            {registration.bib_number ?? "N/A"}
          </Text>

          <Text style={styles.sectionTitle}>Evento</Text>
          <Text style={styles.sectionValue}>{registration.event.name}</Text>

          <Text style={styles.sectionTitle}>Percurso</Text>
          <Text style={styles.sectionValue}>{registration.course.name}</Text>

          <Text style={{...styles.sectionTitle, backgroundColor: registration.box?.color ?? "transparent"}}>Box</Text>
          <Text style={{...styles.sectionValue, backgroundColor: registration.box?.color ?? "transparent"}}>{registration.box?.name ?? "N/A"}</Text>

          {registration.extras && registration.extras.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Extras</Text>
              {registration.extras.map((extra, index) => {
                if (extra.type === "shirt") {
                  return (
                    <Text
                      key={`shirt-${extra.type}-${index}`}
                      style={styles.sectionValue}
                    >
                      T-Shirt: {extra.value}
                    </Text>
                  );
                }

                if (extra.type === "transport") {
                  return (
                    <Text
                      key={`transport-${extra.type}-${index}`}
                      style={styles.sectionValue}
                    >
                      Transporte: {extra.value}
                    </Text>
                  );
                }

                return null;
              })}
            </>
          )}

          <Text style={styles.sectionTitle}>Equipa</Text>
          <Text style={styles.sectionValue}>{registration.team.name}</Text>

        </View>
        {error && <Text style={styles.errorText}>{error}</Text>}
      </ScrollView>

      <View
        style={{
          ...styles.footer,
          paddingBottom: Math.max(insets.bottom, 12),
        }}
      >
        {!registration ||
        (registration.allow_check_in && !registration.check_in) ? (
          <Pressable
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleConfirm}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? "A confirmar..." : "Confirmar Check-In"}
            </Text>
          </Pressable>
        ) : (
          <>
            <Pressable
              style={{
                backgroundColor: "#292929",
                paddingVertical: 25,
                alignItems: "center",
              }}
              onPress={() => router.replace("/(tabs)/scan")}
            >
              <Text
                style={{
                  color: "#E2E2E2",
                  fontSize: 16,
                  fontWeight: "600",
                }}
              >
                Voltar ao Scan
              </Text>
            </Pressable>
          </>
        )}
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
    paddingBottom: 120,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#292929",
    textAlign: "center",
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
    borderRadius: 10,
    backgroundColor: "#F0F0F0",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 10,
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
    fontSize: 18,
    fontWeight: "600",
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
    padding: 0,
  },
  button: {
    backgroundColor: "#376e37",
    paddingVertical: 25,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#E2E2E2",
    fontSize: 16,
    fontWeight: "600",
  },
});
