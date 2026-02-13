import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../src/auth/AuthContext";
import { useRouter } from "expo-router";
import { useCheckin } from "../../src/checkin/CheckinContext";
import { AppEvent, useApp } from "../../src/context/AppContext";

const API_BASE_URL = "http://192.168.1.251:8000/api/v1";

export default function LogoutScreen() {
  const router = useRouter();
  const { token, clearSession } = useAuth();
  const { setRegistration } = useCheckin();
  const { profile, event, setEvent, applyStatsFromResponse } = useApp();
  const [eventOptions, setEventOptions] = useState<AppEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleLogout = async () => {
    await clearSession();
    setRegistration(null);
    router.replace("/login");
  };

  useEffect(() => {
    if (!token) {
      return;
    }

    let isActive = true;
    const loadEvents = async () => {
      setEventsLoading(true);
      setEventsError(null);
      try {
        const eventIdQuery = event?.id
          ? `?event_id=${encodeURIComponent(String(event.id))}`
          : "";
        const response = await fetch(
          `${API_BASE_URL}/checkin/event-list${eventIdQuery}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        const payload = await response.json().catch(() => null);
        applyStatsFromResponse(payload);

        if (!response.ok) {
          const message =
            payload?.message ||
            payload?.error ||
            `Unable to load events (${response.status})`;
          if (isActive) {
            setEventsError(message);
          }
          return;
        }

        const data = payload?.data ?? payload?.events ?? payload;
        const list = Array.isArray(data) ? data : [];
        const normalized = list
          .map((item) => {
            if (!item || typeof item !== "object") {
              return null;
            }
            const record = item as Record<string, unknown>;
            const idValue =
              record.id ?? record.event_id ?? record.value ?? record.code;
            const nameValue =
              record.name ?? record.title ?? record.label ?? record.event;
            if (idValue === undefined || idValue === null) {
              return null;
            }
            return {
              id: idValue as string | number,
              name: String(nameValue ?? idValue),
            } satisfies AppEvent;
          })
          .filter((item): item is AppEvent => Boolean(item));

        if (isActive) {
          setEventOptions(normalized);
        }
      } catch {
        if (isActive) {
          setEventsError("Network error. Please try again.");
        }
      } finally {
        if (isActive) {
          setEventsLoading(false);
        }
      }
    };

    loadEvents();
    return () => {
      isActive = false;
    };
  }, [token, event?.id, applyStatsFromResponse]);

  const eventLabel = useMemo(() => {
    if (event?.name) {
      return event.name;
    }
    return eventsLoading ? "A carregar eventos..." : "Selecionar evento";
  }, [event?.name, eventsLoading]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>A minha conta</Text> 
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Nome</Text>
            <Text style={styles.infoValue}>
              {profile?.name || profile?.email || "Team Member"}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{profile?.email || "—"}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Log</Text>
          <View style={styles.statsRow}>
            <Text style={styles.statsLabel}>Total check-ins</Text>
            <Text style={styles.statsValue}>128</Text>
          </View>
          <View style={styles.statsRow}>
            <Text style={styles.statsLabel}>Media de tempo check-in</Text>
            <Text style={styles.statsValue}>14s</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Evento</Text>
          <Pressable
            style={styles.dropdown}
            onPress={() => setDropdownOpen((open) => !open)}
          >
            <Text style={styles.dropdownText}>{eventLabel}</Text>
          </Pressable>
          {dropdownOpen && (
            <View style={styles.dropdownList}>
              {eventsLoading ? (
                <View style={styles.dropdownRow}>
                  <ActivityIndicator color="#292929" />
                  <Text style={styles.dropdownHint}>A obter eventos...</Text>
                </View>
              ) : eventsError ? (
                <Text style={styles.dropdownError}>{eventsError}</Text>
              ) : eventOptions.length === 0 ? (
                <Text style={styles.dropdownHint}>Sem eventos disponíveis</Text>
              ) : (
                eventOptions.map((option) => {
                  const isSelected = event?.id === option.id;
                  return (
                    <Pressable
                      key={`${option.id}`}
                      style={[
                        styles.dropdownOption,
                        isSelected && styles.dropdownOptionSelected,
                      ]}
                      onPress={() => {
                        setEvent(option);
                        setDropdownOpen(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.dropdownOptionText,
                          isSelected && styles.dropdownOptionTextSelected,
                        ]}
                      >
                        {option.name}
                      </Text>
                    </Pressable>
                  );
                })
              )}
            </View>
          )}
        </View>

        <View style={styles.footer}>
          <Pressable style={styles.button} onPress={handleLogout}>
            <Text style={styles.buttonText}>Terminar sessão</Text>
          </Pressable>
        </View>
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
  content: {
    flex: 1,
    gap: 16,
    paddingBottom: 16,
  },
  card: {
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
  infoRow: {
    marginTop: 14,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#62929E",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  infoValue: {
    marginTop: 6,
    fontSize: 15,
    color: "#292929",
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#62929E",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  dropdown: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E2E2",
    backgroundColor: "#F8F8F8",
  },
  dropdownText: {
    fontSize: 14,
    color: "#292929",
  },
  dropdownList: {
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E2E2",
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  dropdownRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dropdownOption: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  dropdownOptionSelected: {
    backgroundColor: "#F0F7D4",
  },
  dropdownOptionText: {
    fontSize: 14,
    color: "#292929",
  },
  dropdownOptionTextSelected: {
    fontWeight: "600",
  },
  dropdownHint: {
    fontSize: 13,
    color: "#7A7A7A",
  },
  dropdownError: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
    color: "#B42318",
  },
  statsRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statsLabel: {
    fontSize: 13,
    color: "#5A5A5A",
  },
  statsValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#292929",
  },
  footer: {
    paddingBottom: 50,
  },
  button: {
    marginTop: 12,
    backgroundColor: "#292929",
    borderRadius: 25,
    height: 50,
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonText: {
    color: "#F0F0F0",
    backgroundColor: "#292929",
    fontSize: 15,
    fontWeight: "600",
  },
});
