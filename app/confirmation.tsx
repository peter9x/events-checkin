import { useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "../src/auth/AuthContext";
import { useCheckin } from "../src/checkin/CheckinContext";
import { buildRecentCheckin } from "../src/checkin/checkinHelpers";
import { useApp } from "../src/context/AppContext";
import { useApi } from "../src/api/useApi";
import { useSessionReset } from "../src/auth/useSessionReset";
import { getDeviceId, getDeviceInfoPayload } from "../src/device/deviceInfo";
import { buildCheckinTopic, publishMqttJson } from "../src/mqtt/mqttClient";

export default function ConfirmationPage() {
  const router = useRouter();
  const { token, user } = useAuth();
  const {
    registration,
    registrationSourcePayload,
    setRegistration,
    addRecentCheckin,
  } = useCheckin();
  const { event, applyStatsFromResponse, mqttSettings } = useApp();
  const { request } = useApi();
  const resetSession = useSessionReset();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [didConfirm, setDidConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const publishedReadRegistrationRef = useRef<string | null>(null);
  const footerInset = Math.max(insets.bottom, 12);
  const footerHeight = 82 + footerInset;
  const hasMqttServer = Boolean(mqttSettings.server.trim());

  useEffect(() => {
    if (token && !event?.id) {
      void resetSession();
    }
  }, [token, event?.id, resetSession]);

  const registrationIdKey = registration ? String(registration.id ?? "") : "";

  useEffect(() => {
    setDidConfirm(false);
    setError(null);
  }, [registrationIdKey]);

  useEffect(() => {
    if (!registration) {
      return;
    }
    if (!event?.id) {
      return;
    }
    if (!registrationSourcePayload) {
      return;
    }
    if (!hasMqttServer) {
      return;
    }
    if (publishedReadRegistrationRef.current === registrationIdKey) {
      return;
    }

    publishedReadRegistrationRef.current = registrationIdKey;

    void (async () => {
      const deviceId = await getDeviceId();
      const topic = buildCheckinTopic(event.id, deviceId, "read");
      const published = await publishMqttJson(
        mqttSettings,
        topic,
        registrationSourcePayload,
      );
      if (!published) {
        console.warn("[MQTT][ConfirmationPage] read:publish-failed", { topic });
      }
    })();
  }, [
    event?.id,
    hasMqttServer,
    mqttSettings,
    registration,
    registrationIdKey,
    registrationSourcePayload,
  ]);

  const canConfirm = Boolean(
    registration &&
    registration.allow_check_in &&
    !registration.check_in &&
    !didConfirm,
  );

  const backgroundColor = useMemo(() => {
    if (!registration) {
      return "#e9e9e9";
    }
    if (didConfirm) {
      return "#5CB85C";
    }
    if (registration.check_in) {
      return "#5CB85C";
    }
    if (!registration.allow_check_in) {
      return "#CD2923";
    }
    return "#e9e9e9";
  }, [didConfirm, registration]);

  const titleText = useMemo(() => {
    if (!registration) {
      return "";
    }
    if (didConfirm) {
      return "Check-In Confirmado";
    }
    if (registration.check_in) {
      return "Check-In Concluído";
    }
    if (!registration.allow_check_in) {
      return "Check-In Inválido";
    }
    return "Confirmar Check-In";
  }, [didConfirm, registration]);

  const handleConfirm = async () => {
    if (!registration) {
      return;
    }
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
    if (!user?.id) {
      await resetSession();
      return;
    }
    if (!canConfirm) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const deviceInfoPayload = await getDeviceInfoPayload();
      const confirmPayload = {
        registration: registration.id,
        user_id: user.id,
        event_id: event.id,
        ...deviceInfoPayload,
        battery_percentage: deviceInfoPayload.battery_percentage,
      };
      const confirmTopic = buildCheckinTopic(
        event.id,
        deviceInfoPayload.device_id,
        "confirm",
      );

      const { response, payload, unauthorized } = await request(
        "checkinConfirm",
        {
          method: "POST",
          body: confirmPayload,
          includeContext: false,
          includeDeviceInfo: false,
        },
      );

      if (!response || unauthorized) {
        return;
      }

      if (hasMqttServer && payload.registration) {
        void publishMqttJson(
          mqttSettings,
          confirmTopic,
          payload.registration,
        ).then((mqttConfirmPublished) => {
          if (!mqttConfirmPublished) {
            console.warn("[MQTT][ConfirmationPage] confirm:publish-failed", {
              topic: confirmTopic,
            });
          }
        });
      }

      applyStatsFromResponse(payload);

      if (!response.ok) {
        setError("Unable to confirm check-in.");
        return;
      }

      setDidConfirm(true);
      addRecentCheckin(buildRecentCheckin(registration));
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setRegistration(null);
      router.replace("/(tabs)/scan");
    } catch (err) {
      console.error(err);
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!registration) {
    return null;
  }

  return (
    <SafeAreaView
      style={{
        ...styles.container,
        backgroundColor,
      }}
    >
      <ScrollView
        contentContainerStyle={{
          ...styles.scrollContent,
          paddingBottom: footerHeight,
        }}
      >
        {registration.check_in ? (
          <View
            style={{
              padding: 10,
              borderRadius: 10,
              backgroundColor: "#ffffff",
              marginTop: 10,
            }}
          >
            <Text style={styles.title}>{titleText}</Text>
          </View>
        ) : (
          <Text style={styles.title}>{titleText}</Text>
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

          <Text
            style={{
              ...styles.sectionTitle,
            }}
          >
            Box
          </Text>
          <Text
            style={{
              ...styles.sectionValue,
              padding: 10,
              backgroundColor: registration.box?.color ?? "transparent",
            }}
          >
            {registration.box?.name ?? "N/A"}
          </Text>

          {registration.extras && registration.extras.length > 0 && (
            <>
              {registration.extras.map((extra, index) => {
                if (extra.type === "shirt") {
                  return (
                    <View key={`shirt-${extra.type}-${index}`}>
                      <Text style={styles.sectionTitle}>T-Shirt</Text>
                      <Text style={styles.sectionValue}>{extra.value}</Text>
                    </View>
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
          <Text style={styles.sectionValue}>
            {registration.team?.name ?? "—"}
          </Text>
        </View>
        {error && <Text style={styles.errorText}>{error}</Text>}
      </ScrollView>

      <View
        style={{
          ...styles.footer,
          paddingBottom: footerInset,
        }}
      >
        {canConfirm ? (
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
    shadowColor: "#ffffff",
    shadowOffset: { width: 0, height: 0 },
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
