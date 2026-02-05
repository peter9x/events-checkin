import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  BarcodeScanningResult,
  CameraView,
  useCameraPermissions,
} from "expo-camera";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/auth/AuthContext";
import { useCheckin } from "../../src/checkin/CheckinContext";

export default function ScanScreen() {
  const router = useRouter();
  const { token, clearSession } = useAuth();
  const { setRegistration } = useCheckin();
  const [permission, requestPermission] = useCameraPermissions();
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateRegistration = useCallback(
    async (registrationValue: string) => {
      if (!token) {
        setError("Session expired. Please sign in again.");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `http://192.168.1.251:8000/api/v1/checkin/validation?registration=${encodeURIComponent(
            registrationValue
          )}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.status === 403) {
          await clearSession();
          setRegistration(null);
          router.replace("/login");
          return;
        }

        if (response.status === 404) {
          setError("Invalid Registration");
          return;
        }

        if (!response.ok) {
          setError("Unable to validate registration.");
          return;
        }

        const payload = await response.json().catch(() => null);
        const registration = payload?.data ?? payload;

        if (!registration) {
          setError("Invalid registration response.");
          return;
        }

        console.log(registration);

        setRegistration(registration);
        router.push("/confirmation");
      } catch (err) {
        console.log(err);
        setError("Network error. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [token, clearSession, router, setRegistration]
  );

  const handleScan = useCallback(
    (result: BarcodeScanningResult) => {
      if (!scannedCode && !loading) {
        setScannedCode(result.data);
        validateRegistration(result.data);
      }
    },
    [scannedCode, loading, validateRegistration]
  );

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Camera access needed</Text>
          <Text style={styles.subtitle}>
            Enable the camera to scan QR codes at check-in.
          </Text>
          <Pressable style={styles.button} onPress={requestPermission}>
            <Text style={styles.buttonText}>Allow camera</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Scan QR Code</Text>
      <Text style={styles.subtitle}>
        Align the code inside the frame to check in quickly.
      </Text>
      <View style={styles.cameraWrap}>
        <CameraView
          style={styles.camera}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={scannedCode ? undefined : handleScan}
        />
        <View style={styles.frame} />
      </View>
      {scannedCode ? (
        <View style={styles.resultCard}>
          <Text style={styles.resultLabel}>Scanned code</Text>
          <Text style={styles.resultText}>{scannedCode}</Text>
          {loading && <Text style={styles.hint}>Validating...</Text>}
          {error && <Text style={styles.errorText}>{error}</Text>}
          <Pressable
            style={[styles.button, styles.secondaryButton]}
            onPress={() => {
              setScannedCode(null);
              setError(null);
            }}
          >
            <Text style={[styles.buttonText, styles.secondaryButtonText]}>
              Scan another
            </Text>
          </Pressable>
        </View>
      ) : (
        <Text style={styles.hint}>Waiting for a QR code...</Text>
      )}
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
  cameraWrap: {
    marginTop: 24,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#0F172A",
    minHeight: 320,
  },
  camera: {
    flex: 1,
    minHeight: 320,
  },
  frame: {
    position: "absolute",
    top: 24,
    left: 24,
    right: 24,
    bottom: 24,
    borderWidth: 2,
    borderColor: "rgba(248,250,252,0.7)",
    borderRadius: 20,
  },
  resultCard: {
    marginTop: 20,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  resultLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  resultText: {
    fontSize: 14,
    color: "#0F172A",
    marginBottom: 12,
  },
  hint: {
    marginTop: 16,
    fontSize: 13,
    color: "#94A3B8",
  },
  errorText: {
    marginTop: 10,
    fontSize: 13,
    color: "#DC2626",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginTop: 40,
  },
  button: {
    marginTop: 16,
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
  secondaryButton: {
    backgroundColor: "#E0F2FE",
  },
  secondaryButtonText: {
    color: "#0284C7",
  },
});
