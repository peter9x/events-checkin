import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  BarcodeScanningResult,
  CameraView,
  useCameraPermissions,
} from "expo-camera";
import { useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { useAuth } from "../../src/auth/AuthContext";
import { useCheckin } from "../../src/checkin/CheckinContext";
import { useApp } from "../../src/context/AppContext";

const SCAN_COOLDOWN_MS = 1500;

export default function ScanScreen() {
  const router = useRouter();
  const { token, clearSession } = useAuth();
  const { setRegistration } = useCheckin();
  const { event, applyStatsFromResponse } = useApp();
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanEnabled, setScanEnabled] = useState(true);
  const isProcessingRef = useRef(false);
  const scanAllowedRef = useRef(true);
  const isFocused = useIsFocused();
  const lastScanRef = useRef<{ value: string | null; at: number }>({
    value: null,
    at: 0,
  });
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isFocused && token && !event?.id) {
      router.navigate("/(tabs)/logout");
    }

    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    if (isFocused) {
      setError(null);
      lastScanRef.current = { value: null, at: 0 };
      if (!isProcessingRef.current) {
        setLoading(false);
        scanAllowedRef.current = true;
        setScanEnabled(true);
      }
    } else {
      scanAllowedRef.current = false;
      setScanEnabled(false);
    }
  }, [isFocused, token, event?.id, router]);

  const validateRegistration = useCallback(
    async (registrationValue: string) => {
      if (!event?.id) {
        router.navigate("/(tabs)/logout");
        return false;
      }
      if (!token) {
        setError("Session expired. Please sign in again.");
        return false;
      }

      if (isProcessingRef.current) {
        return false;
      }
      isProcessingRef.current = true;
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `http://192.168.1.251:8000/api/v1/checkin/validation?event=${event.id}&registration=${encodeURIComponent(
            registrationValue,
          )}&event_id=${encodeURIComponent(String(event.id))}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        const payload = await response.json().catch(() => null);
        applyStatsFromResponse(payload);

        if (response.status === 403) {
          await clearSession();
          setRegistration(null);
          router.replace("/login");
          return false;
        }

        if (response.status === 404) {
          setError("Inscrição inválida");
          return false;
        }

        if (!response.ok) {
          setError("Não foi possível validar a inscrição");
          return false;
        }

        const data = payload?.data ?? payload;

        if (!data) {
          setError("Inscrição inválida.");
          return false;
        }

        setRegistration(data.registration ?? data);
        if (isFocused) {
          router.push("/confirmation");
        }
        return true;
      } catch (err) {
        setError("Erro de rede. Tente novamente.");
        return false;
      } finally {
        setLoading(false);
        isProcessingRef.current = false;
      }
    },
    [token, clearSession, router, setRegistration, isFocused, event?.id, applyStatsFromResponse],
  );

  const handleScan = useCallback(
    (result: BarcodeScanningResult) => {
      if (!scanAllowedRef.current || isProcessingRef.current) {
        return;
      }

      const now = Date.now();
      const lastScan = lastScanRef.current;
      if (lastScan.value === result.data && now - lastScan.at < SCAN_COOLDOWN_MS) {
        return;
      }

      lastScanRef.current = { value: result.data, at: now };
      scanAllowedRef.current = false;
      setScanEnabled(false);

      void validateRegistration(result.data).then((success) => {
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
            scanAllowedRef.current = true;
            setScanEnabled(true);
            lastScanRef.current = { value: null, at: 0 };
          }
          retryTimerRef.current = null;
        }, delay);
      });
    },
    [validateRegistration, isFocused],
  );

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Permitir acesso á camera</Text>
          <Text style={styles.subtitle}>
            Ative a câmara para ler os códigos QR no momento do check-in.
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
      <Text style={styles.title}>Ler QR Code</Text>
      <Text style={styles.subtitle}>
        Alinhe o QrCode dentro do quadro para melhor leitura.
      </Text>
      <View style={styles.cameraCard}>
        <View style={styles.cameraWrap}>
          <CameraView
            style={styles.camera}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={
              scanEnabled && !loading && !isProcessingRef.current
                ? handleScan
                : undefined
            }
          />
          <View style={styles.frame} />
        </View>
      </View>
      {loading && <Text style={styles.hint}>A validar...</Text>}
      {error && <Text style={styles.errorText}>{error}</Text>}
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
    borderRadius: 24,
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
  resultCard: {
    marginTop: 20,
    padding: 18,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E2E2",
    shadowColor: "#292929",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  resultLabel: {
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
    color: "#62929E",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  resultText: {
    textAlign: "center",
    fontSize: 14,
    color: "#292929",
    marginBottom: 12,
  },
  hint: {
    textAlign: "center",
    marginTop: 16,
    fontSize: 13,
    color: "#7A7A7A",
  },
  errorText: {
    marginTop: 10,
    fontSize: 13,
    textAlign: "center",
    color: "#B42318",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E2E2E2",
    marginTop: 40,
  },
  button: {
    textAlign: "center",
    marginTop: 16,
    backgroundColor: "#A5BF13",
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonText: {
    textAlign: "center",
    color: "#292929",
    fontSize: 15,
    fontWeight: "600",
  },
  secondaryButton: {
    textAlign: "center",
    backgroundColor: "#F0F0F0",
  },
  secondaryButtonText: {
    textAlign: "center",
    color: "#292929",
  },
});
