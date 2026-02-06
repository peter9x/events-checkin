import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { useAuth } from "../src/auth/AuthContext";
import { useApp } from "../src/context/AppContext";

export default function LoginScreen() {
  const router = useRouter();
  const { setSession, rememberMe, setRememberMe } = useAuth();
  const { event, applyStatsFromResponse, setProfileFromUser } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleLogin = async () => {
    if (loading) {
      return;
    }

    setError(null);
    setSuccess(null);

    if (!email.trim() || !password) {
      setError("Por favor, preencher email e password");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("http://192.168.1.251:8000/api/v1/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
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
        return;
      }

      const token =
        payload?.token || payload?.access_token || payload?.data?.token;
      const user = payload?.user || payload?.data?.user;

      if (!token || !user) {
        setError("Erro de autenticação.");
        return;
      }

      await setSession(user, token);
      setProfileFromUser(user as Record<string, unknown>);
      setSuccess("Autenticação com sucesso.");
      if (event?.id) {
        router.replace("/(tabs)/scan");
      } else {
        router.replace("/(tabs)/logout");
      }
    } catch (err) {
      console.log(err);
      setError("Erro de conexão.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.background}>
        <View style={styles.topGlow} />
      </View>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Login</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="hello@mupy.io"
            placeholderTextColor="#8A8A8A"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor="#8A8A8A"
            secureTextEntry
            style={styles.input}
          />

          <Pressable
            onPress={() => setRememberMe(!rememberMe)}
            style={styles.rememberRow}
          >
            <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
              {rememberMe && <View style={styles.checkboxDot} />}
            </View>
            <Text style={styles.rememberText}>Manter sessão iniciada</Text>
          </Pressable>

          {(error || success) && (
            <Text
              style={[
                styles.feedback,
                success ? styles.successText : styles.errorText,
              ]}
            >
              {success ?? error}
            </Text>
          )}

          <Pressable
            onPress={handleLogin}
            disabled={loading}
            style={({ pressed }) => [
              styles.button,
              (pressed || loading) && styles.buttonPressed,
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#F8FAFC" />
            ) : (
              <Text style={styles.buttonText}>Entrar</Text>
            )}
          </Pressable>
        </View>
        

      </KeyboardAvoidingView>

      <Text style={styles.copyright}>MUPY</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F0F0F0",
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  topGlow: {
    position: "absolute",
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: "#A5BF13",
    opacity: 0.2,
    top: -150,
    left: -80,
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  header: {
    marginBottom: 24,
  },
  copyright: {
    fontSize: 13,
    fontWeight: "600",
    color: "#62929E",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
    position:"absolute",
    bottom: 20,
    textAlign:"center",
    right:0,
    left:0
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    color: "#292929",
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    color: "#5A5A5A",
    lineHeight: 22,
  },
  card: {
    //backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 16,
    //shadowColor: "#292929",
    //shadowOffset: { width: 0, height: 12 },
    //shadowOpacity: 0.12,
    //shadowRadius: 18,
    //elevation: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#292929",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#D7D7D7",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: "#292929",
    marginBottom: 16,
    backgroundColor: "#F7F7F7",
  },
  feedback: {
    marginBottom: 12,
    fontSize: 13,
    lineHeight: 18,
  },
  errorText: {
    color: "#DC2626",
  },
  successText: {
    color: "#16A34A",
  },
  button: {
    backgroundColor: "#A5BF13",
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: "#292929",
    fontSize: 16,
    fontWeight: "600",
  },
  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#C9C9C9",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    backgroundColor: "#FFFFFF",
  },
  checkboxChecked: {
    borderColor: "#A5BF13",
    backgroundColor: "rgba(165,191,19,0.18)",
  },
  checkboxDot: {
    width: 11,
    height: 11,
    borderRadius: 4,
    backgroundColor: "#A5BF13",
  },
  rememberText: {
    fontSize: 13,
    color: "#5A5A5A",
    fontWeight: "500",
  },
  footer: {
    marginTop: 18,
    fontSize: 12,
    color: "#64748B",
  },
});
