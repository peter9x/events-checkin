import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../src/auth/AuthContext";
import { useRouter } from "expo-router";
import { useCheckin } from "../../src/checkin/CheckinContext";
import { AppEvent, useApp } from "../../src/context/AppContext";
import { useIsFocused } from "@react-navigation/native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import {
  DeviceInfoSnapshot,
  getDeviceInfoSnapshot,
} from "../../src/device/deviceInfo";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;
const DEFAULT_VISIBLE_CHECKINS = 6;

export default function LogoutScreen() {
  const router = useRouter();
  const { token, clearSession } = useAuth();
  const { setRegistration, recentCheckins, clearRecentCheckins } = useCheckin();
  const { profile, event, setEvent, applyStatsFromResponse } = useApp();
  const [eventOptions, setEventOptions] = useState<AppEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [visibleCheckins, setVisibleCheckins] = useState(
    DEFAULT_VISIBLE_CHECKINS
  );
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfoSnapshot | null>(null);
  const [deviceInfoError, setDeviceInfoError] = useState<string | null>(null);
  const isFocused = useIsFocused();
  const tabBarHeight = useBottomTabBarHeight();

  const handleLogout = async () => {
    await clearSession();
    setRegistration(null);
    clearRecentCheckins();
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

  useEffect(() => {
    if (!isFocused) {
      return;
    }
    let isActive = true;
    const loadDeviceInfo = async () => {
      setDeviceInfoError(null);
      try {
        const snapshot = await getDeviceInfoSnapshot();
        if (isActive) {
          setDeviceInfo(snapshot);
        }
      } catch {
        if (isActive) {
          setDeviceInfoError("Não foi possível obter dados do posto.");
        }
      }
    };

    loadDeviceInfo();
    return () => {
      isActive = false;
    };
  }, [isFocused]);

  const eventLabel = useMemo(() => {
    if (event?.name) {
      return event.name;
    }
    return eventsLoading ? "A carregar eventos..." : "Selecionar evento";
  }, [event?.name, eventsLoading]);

  useEffect(() => {
    if (recentCheckins.length < visibleCheckins) {
      setVisibleCheckins(Math.max(DEFAULT_VISIBLE_CHECKINS, recentCheckins.length));
    }
  }, [recentCheckins.length, visibleCheckins]);

  const visibleRecentCheckins = useMemo(
    () => recentCheckins.slice(0, visibleCheckins),
    [recentCheckins, visibleCheckins]
  );
  const canLoadMore = recentCheckins.length > visibleRecentCheckins.length;

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + 24 }]}
        scrollIndicatorInsets={{ right: 0 }}
      >
        <View style={styles.card}>
          <Text style={styles.title}>A minha conta</Text> 
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Nome</Text>
            <Text style={styles.infoValue}>
              {profile?.name || profile?.email || "Team Member"}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Posto</Text>
          {deviceInfoError ? (
            <Text style={styles.dropdownError}>{deviceInfoError}</Text>
          ) : (
            <>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>IP</Text>
                <Text style={styles.infoValue}>
                  {deviceInfo?.ipAddress || "—"}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>MAC</Text>
                <Text style={styles.infoValue}>
                  {deviceInfo?.macAddress || "—"}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Device ID</Text>
                <Text style={styles.infoValue}>
                  {deviceInfo?.deviceId || "—"}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Rede WiFi</Text>
                <Text style={styles.infoValue}>
                  {deviceInfo?.wifiName || "—"}
                </Text>
              </View>
            </>
          )}
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

        <View style={styles.card}>
          <View style={styles.recentHeader}>
            <Text style={styles.sectionLabel}>Últimas ações</Text>
            <Text style={styles.recentCount}>{recentCheckins.length}</Text>
          </View>
          {visibleRecentCheckins.length === 0 ? (
            <Text style={styles.emptyText}>Sem ações recentes.</Text>
          ) : (
            visibleRecentCheckins.map((item, index) => (
              <View
                key={item.id}
                style={[
                  styles.recentItem,
                  index === 0 && styles.recentItemFirst,
                ]}
              >
                <Text style={styles.recentName}>{item.athleteName}</Text>
                <View style={styles.recentMetaRow}>
                  <Text style={styles.recentMeta}>
                    Dorsal: {item.bibNumber ?? "N/A"}
                  </Text>
                  <Text style={styles.recentMeta}>
                    T-Shirt: {item.shirt ?? "—"}
                  </Text>
                  <Text style={styles.recentMeta}>Box: {item.box ?? "—"}</Text>
                </View>
              </View>
            ))
          )}
          {canLoadMore && (
            <Pressable
              style={styles.loadMoreButton}
              onPress={() =>
                setVisibleCheckins((current) =>
                  Math.min(current + DEFAULT_VISIBLE_CHECKINS, recentCheckins.length)
                )
              }
            >
              <Text style={styles.loadMoreText}>Carregar mais</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.footer}>
          <Pressable style={styles.button} onPress={handleLogout}>
            <Text style={styles.buttonText}>Terminar sessão</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F0F0F0",
  },
  content: {
    gap: 16,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  card: {
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
    borderRadius: 5,
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
    borderRadius: 5,
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
  footer: {
    paddingBottom: 50,
  },
  recentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  recentCount: {
    fontSize: 12,
    color: "#7A7A7A",
  },
  recentItem: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  recentItemFirst: {
    marginTop: 10,
    paddingTop: 0,
    borderTopWidth: 0,
  },
  recentName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#292929",
  },
  recentMetaRow: {
    marginTop: 6,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  recentMeta: {
    fontSize: 13,
    color: "#5A5A5A",
  },
  emptyText: {
    marginTop: 12,
    fontSize: 13,
    color: "#7A7A7A",
  },
  loadMoreButton: {
    marginTop: 14,
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  loadMoreText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#292929",
  },
  button: {
    marginTop: 12,
    backgroundColor: "#292929",
    borderRadius: 5,
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
