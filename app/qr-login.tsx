import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  BarcodeScanningResult,
  CameraView,
  useCameraPermissions,
} from "expo-camera";
import { useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { useAuth } from "../src/auth/AuthContext";
import { useApp } from "../src/context/AppContext";
import { getDeviceInfoPayload } from "../src/device/deviceInfo";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;
const SCAN_COOLDOWN_MS = 1500;

const normalizeExpiry = (value: unknown) => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "number" && !Number.isNaN(value)) {
    if (value > 1e12) {
      return value;
    }
    return Date.now() + value * 1000;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const asNumber = Number(trimmed);
    if (!Number.isNaN(asNumber)) {
      if (asNumber > 1e12) {
        return asNumber;
      }
      return Date.now() + asNumber * 1000;
    }
    const parsed = Date.parse(trimmed);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return null;
};

export default function QrLoginScreen() {
  const router = useRouter();
  const { setQrSession } = useAuth();
  const { event, applyStatsFromResponse, setProfileFromUser } = useApp();
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanEnabled, setScanEnabled] = useState(true);
  const isFocused = useIsFocused();
  const isProcessingRef = useRef(false);
  const lastScanRef = useRef<{ value: string | null; at: number }>({
    value: null,
    at: 0,
  });
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    if (isFocused) {
      setError(null);
      lastScanRef.current = { value: null, at: 0 };
      if (!isProcessingRef.current) {
        setLoading(false);
        setScanEnabled(true);
      }
    } else {
      setScanEnabled(false);
    }
  }, [isFocused]);

  const handleLogin = useCallback(
    async (qrValue: string) => {
      if (isProcessingRef.current) {
        return false;
      }
      isProcessingRef.current = true;
      setLoading(true);
      setError(null);

      try {
        const deviceInfo = await getDeviceInfoPayload();
        console.log(deviceInfo);
        const response = await fetch(`${API_BASE_URL}/auth/qr`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            qr_code: qrValue,
            ...deviceInfo,
          }),
        });

        const payload = await response.json().catch(() => null);
        applyStatsFromResponse(payload);

        if (!response.ok) {
          const message =
            payload?.message ||
            payload?.error ||
            `Erro de autenticação. (${response.status})`;
          setError(message);
          return false;
        }

        const userId =
          payload?.user_id ?? payload?.userId ?? payload?.data?.user_id;
        const userName =
          payload?.nome ??
          payload?.name ??
          payload?.user_name ??
          payload?.data?.nome;
        const token =
          payload?.token ??
          payload?.access_token ??
          payload?.session_token ??
          payload?.auth_token ??
          payload?.data?.token ??
          payload?.data?.session_token ??
          payload?.data?.auth_token;
        const expiresValue =
          payload?.validade ??
          payload?.validade_sessao ??
          payload?.session_validity ??
          payload?.expires_in ??
          payload?.data?.validade;
        const expiresAt = normalizeExpiry(expiresValue);

        if (!userId || !userName || !token) {
          setError("Resposta inválida do servidor.");
          return false;
        }

        const user = { id: userId, name: String(userName) };
        await setQrSession(user, String(token), expiresAt);
        setProfileFromUser(user as Record<string, unknown>);

        if (event?.id) {
          router.replace("/(tabs)/scan");
        } else {
          router.replace("/(tabs)/logout");
        }
        return true;
      } catch {
        setError("Erro de rede. Tente novamente.");
        return false;
      } finally {
        setLoading(false);
        isProcessingRef.current = false;
      }
    },
    [
      applyStatsFromResponse,
      event?.id,
      router,
      setProfileFromUser,
      setQrSession,
    ],
  );

  const handleScan = useCallback(
    (result: BarcodeScanningResult) => {
      if (!scanEnabled || isProcessingRef.current) {
        return;
      }

      const now = Date.now();
      const lastScan = lastScanRef.current;
      if (
        lastScan.value === result.data &&
        now - lastScan.at < SCAN_COOLDOWN_MS
      ) {
        return;
      }

      lastScanRef.current = { value: result.data, at: now };
      setScanEnabled(false);

      void handleLogin(result.data).then((success) => {
        if (success) {
          return;
        }

        const elapsed = Date.now() - now;
        const delay = Math.max(0, SCAN_COOLDOWN_MS - elapsed);

        if (retryTimerRef.current) {
          clearTimeout(retryTimerRef.current);
        }

        retryTimerRef.current = setTimeout(() => {
          if (isFocused) {
            setScanEnabled(true);
            lastScanRef.current = { value: null, at: 0 };
          }
          retryTimerRef.current = null;
        }, delay);
      });
    },
    [handleLogin, isFocused, scanEnabled],
  );

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Permitir acesso à câmara</Text>
          <Text style={styles.subtitle}>
            A câmara é necessária para autenticar com QR Code.
          </Text>
          <Pressable style={styles.button} onPress={requestPermission}>
            <Text style={styles.buttonText}>Permitir</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Entrar com QR Code</Text>
      <Text style={styles.subtitle}>
        Aponte a câmara para o QR Code de autenticação.
      </Text>
      <View style={styles.cameraCard}>
        <View style={styles.cameraWrap}>
          <CameraView
            style={styles.camera}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={scanEnabled && !loading ? handleScan : undefined}
          />
          <View style={styles.frame} />
        </View>
      </View>
      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator color="#292929" />
          <Text style={styles.loadingText}>A validar sessão...</Text>
        </View>
      )}
      {error && <Text style={styles.errorText}>{error}</Text>}
      <Pressable style={styles.linkButton} onPress={() => router.back()}>
        <Text style={styles.linkText}>Voltar ao login</Text>
      </Pressable>
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
    textAlign: "center",
    fontSize: 24,
    fontWeight: "700",
    color: "#292929",
  },
  subtitle: {
    textAlign: "center",
    marginTop: 8,
    fontSize: 15,
    color: "#5A5A5A",
  },
  cameraCard: {
    marginTop: 24,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 12,
    shadowColor: "#292929",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  cameraWrap: {
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#292929",
    minHeight: 300,
  },
  camera: {
    flex: 1,
    minHeight: 300,
  },
  frame: {
    position: "absolute",
    top: 20,
    left: 20,
    right: 20,
    bottom: 24,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.75)",
    borderRadius: 18,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E2E2E2",
    marginTop: 40,
    shadowColor: "#292929",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  button: {
    textAlign: "center",
    marginTop: 16,
    backgroundColor: "#A5BF13",
    borderRadius: 5,
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonText: {
    textAlign: "center",
    color: "#292929",
    fontSize: 15,
    fontWeight: "600",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 16,
  },
  loadingText: {
    fontSize: 13,
    color: "#5A5A5A",
  },
  errorText: {
    marginTop: 10,
    fontSize: 13,
    textAlign: "center",
    color: "#B42318",
  },
  linkButton: {
    marginTop: 18,
    alignItems: "center",
  },
  linkText: {
    color: "#62929E",
    fontSize: 14,
    fontWeight: "600",
  },
});
