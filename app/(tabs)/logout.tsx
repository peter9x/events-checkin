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
import { useCheckin } from "../../src/checkin/CheckinContext";
import { useApp } from "../../src/context/AppContext";
import { useSessionReset } from "../../src/auth/useSessionReset";
import { useIsFocused } from "@react-navigation/native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import {
  DeviceInfoSnapshot,
  getDeviceInfoSnapshot,
} from "../../src/device/deviceInfo";

const DEFAULT_VISIBLE_CHECKINS = 6;

export default function LogoutScreen() {
  const resetSession = useSessionReset();
  const { recentCheckins } = useCheckin();
  const { profile, event, apiMode, activeApiBaseUrl } = useApp();
  const [visibleCheckins, setVisibleCheckins] = useState(
    DEFAULT_VISIBLE_CHECKINS,
  );
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfoSnapshot | null>(null);
  const [deviceInfoError, setDeviceInfoError] = useState<string | null>(null);
  const isFocused = useIsFocused();
  const tabBarHeight = useBottomTabBarHeight();

  const handleLogout = async () => {
    await resetSession();
  };

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

  useEffect(() => {
    if (recentCheckins.length < visibleCheckins) {
      setVisibleCheckins(
        Math.max(DEFAULT_VISIBLE_CHECKINS, recentCheckins.length),
      );
    }
  }, [recentCheckins.length, visibleCheckins]);

  const visibleRecentCheckins = useMemo(
    () => recentCheckins.slice(0, visibleCheckins),
    [recentCheckins, visibleCheckins],
  );
  const canLoadMore = recentCheckins.length > visibleRecentCheckins.length;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: tabBarHeight + 24 },
        ]}
        scrollIndicatorInsets={{ right: 0 }}
      >
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Info do Posto</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Nome</Text>
            <Text style={styles.infoValue}>
              {profile?.name || profile?.email || "Team Member"}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Modo API</Text>
            <Text style={styles.infoValue}>
              {apiMode === "local" ? "Local" : "Online"}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Base URL</Text>
            <Text style={styles.infoValue}>{activeApiBaseUrl || "—"}</Text>
          </View>
          {deviceInfoError ? (
            <Text style={styles.infoError}>{deviceInfoError}</Text>
          ) : !deviceInfo ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#292929" />
              <Text style={styles.loadingText}>A obter dados...</Text>
            </View>
          ) : (
            <>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>IP</Text>
                <Text style={styles.infoValue}>
                  {deviceInfo?.ipAddress || "—"}
                </Text>
              </View>
              {deviceInfo?.macAddress ? (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>MAC</Text>
                  <Text style={styles.infoValue}>{deviceInfo.macAddress}</Text>
                </View>
              ) : null}
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Device ID</Text>
                <Text style={styles.infoValue}>
                  {deviceInfo?.deviceId || "—"}
                </Text>
              </View>
              {deviceInfo?.wifiName ? (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Rede WiFi</Text>
                  <Text style={styles.infoValue}>{deviceInfo.wifiName}</Text>
                </View>
              ) : null}
            </>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Evento</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Nome</Text>
            <Text style={styles.infoValue}>{event?.name || "—"}</Text>
          </View>
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
                  Math.min(
                    current + DEFAULT_VISIBLE_CHECKINS,
                    recentCheckins.length,
                  ),
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
  infoRow: {
    marginTop: 10,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#62929E",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  infoValue: {
    marginTop: 4,
    fontSize: 15,
    color: "#292929",
  },
  infoError: {
    marginTop: 10,
    fontSize: 13,
    color: "#B42318",
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#62929E",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  loadingText: {
    fontSize: 13,
    color: "#7A7A7A",
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
