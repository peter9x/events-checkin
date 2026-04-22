import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useApp } from "../../src/context/AppContext";
import { useSessionReset } from "../../src/auth/useSessionReset";
import { useApi } from "../../src/api/useApi";
import {
  DeviceInfoSnapshot,
  getDeviceInfoSnapshot,
} from "../../src/device/deviceInfo";
import { useIsFocused } from "@react-navigation/native";
import { checkMqttConnection } from "../../src/mqtt/mqttClient";

type MqttConnectionState = "checking" | "ok" | "error" | "not-configured";

export default function LogoutScreen() {
  const resetSession = useSessionReset();
  const { request } = useApi();
  const { apiMode, profile, event, mqttSettings } = useApp();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfoSnapshot | null>(null);
  const [deviceInfoError, setDeviceInfoError] = useState<string | null>(null);
  const [mqttState, setMqttState] = useState<MqttConnectionState>("checking");
  const tabBarHeight = useBottomTabBarHeight();
  const isFocused = useIsFocused();

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
          setDeviceInfo(null);
          setDeviceInfoError("Não foi possível obter dados do dispositivo.");
        }
      }
    };

    void loadDeviceInfo();
    return () => {
      isActive = false;
    };
  }, [isFocused]);

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    const hasMqttServer = Boolean(mqttSettings.server.trim());
    console.log("[MQTT][LogoutScreen] check:start", {
      hasMqttServer,
      protocol: mqttSettings.protocol,
      server: mqttSettings.server,
      port: mqttSettings.port,
      ssl: mqttSettings.ssl,
      hasUser: Boolean(mqttSettings.user),
      hasPass: Boolean(mqttSettings.pass),
    });

    if (!hasMqttServer) {
      console.warn("[MQTT][LogoutScreen] check:missing-server");
      setMqttState("not-configured");
      return;
    }

    let isActive = true;
    setMqttState("checking");

    void (async () => {
      try {
        const isConnected = await checkMqttConnection(mqttSettings);
        if (!isActive) {
          return;
        }
        console.log("[MQTT][LogoutScreen] check:result", { isConnected });
        setMqttState(isConnected ? "ok" : "error");
      } catch (error) {
        if (!isActive) {
          return;
        }
        console.error("[MQTT][LogoutScreen] check:exception", {
          message: error instanceof Error ? error.message : String(error),
        });
        setMqttState("error");
      }
    })();

    return () => {
      isActive = false;
    };
  }, [isFocused, mqttSettings]);

  const mqttStatusLabel =
    mqttState === "ok"
      ? "OK"
      : mqttState === "error"
        ? "Falhou"
        : mqttState === "not-configured"
          ? "Não configurado"
          : "A validar...";

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }
    setIsLoggingOut(true);

    try {
      await request("authLogout", {
        method: "POST",
        includeContext: false,
      });
    } catch {
      // Ignore API logout failures and always clear local session.
    } finally {
      await resetSession();
      setIsLoggingOut(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + 24 }]}
      >
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Info do Posto</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Nome</Text>
            <Text style={styles.infoValue}>
              {profile?.name || profile?.email || "—"}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Modo</Text>
            <Text style={styles.infoValue}>
              {apiMode === "local" ? "Local" : "Online"}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>IP</Text>
            <Text style={styles.infoValue}>
              {deviceInfo?.ipAddress || (deviceInfoError ? "—" : "A obter...")}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Device ID</Text>
            <Text style={styles.infoValue}>
              {deviceInfo?.deviceId || (deviceInfoError ? "—" : "A obter...")}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Evento</Text>
            <Text style={styles.infoValue}>{event?.name || "—"}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>MQTT</Text>
            <Text
              style={[
                styles.infoValue,
                mqttState === "ok"
                  ? styles.statusOk
                  : mqttState === "error"
                    ? styles.statusError
                    : undefined,
              ]}
            >
              {mqttStatusLabel}
            </Text>
          </View>
          {deviceInfoError ? (
            <Text style={styles.infoError}>{deviceInfoError}</Text>
          ) : null}
        </View>

        <Pressable
          style={[styles.button, isLoggingOut && styles.buttonDisabled]}
          onPress={handleLogout}
          disabled={isLoggingOut}
        >
          <Text style={styles.buttonText}>
            {isLoggingOut ? "A terminar sessão..." : "Terminar sessão"}
          </Text>
        </Pressable>
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
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#62929E",
    textTransform: "uppercase",
    letterSpacing: 1,
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
    marginTop: 12,
    fontSize: 13,
    color: "#B42318",
  },
  statusOk: {
    color: "#2E7D32",
    fontWeight: "700",
  },
  statusError: {
    color: "#B42318",
    fontWeight: "700",
  },
  button: {
    marginTop: 4,
    backgroundColor: "#292929",
    borderRadius: 5,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#F0F0F0",
    fontSize: 15,
    fontWeight: "600",
  },
});
