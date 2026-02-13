import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/auth/AuthContext";
import { useApp } from "../../src/context/AppContext";
import { useIsFocused } from "@react-navigation/native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import {
  RegistrationResource,
  useCheckin,
} from "../../src/checkin/CheckinContext";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

const SEARCH_OPTIONS = [
  { key: "bib_number", label: "Dorsal" },
  { key: "identification_number", label: "Nº Identificacao" },
  { key: "code", label: "Codigo" },
] as const;

type SearchParam = (typeof SEARCH_OPTIONS)[number]["key"];

export default function SearchScreen() {
  const [query, setQuery] = useState("");
  const [searchParam, setSearchParam] = useState<SearchParam>("bib_number");
  const [results, setResults] = useState<RegistrationResource[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { token, clearSession } = useAuth();
  const { event, applyStatsFromResponse } = useApp();
  const { setRegistration } = useCheckin();
  const isFocused = useIsFocused();
  const tabBarHeight = useBottomTabBarHeight();

  useEffect(() => {
    if (isFocused && token && !event?.id) {
      router.navigate("/(tabs)/logout");
    }
  }, [isFocused, token, event?.id, router]);

  useEffect(() => {
    setResults([]);
    setSearched(false);
    setError(null);
  }, [event?.id]);

  const handleSearch = async () => {
    if (loading) {
      return;
    }
    if (!token) {
      setError("Sessao expirada. Inicie sessao novamente.");
      return;
    }
    if (!event?.id) {
      router.navigate("/(tabs)/logout");
      return;
    }

    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setError("Introduza um valor para pesquisar.");
      setResults([]);
      setSearched(false);
      return;
    }

    setLoading(true);
    setError(null);
    setSearched(false);
    setResults([]);

    try {
      const response = await fetch(`${API_BASE_URL}/checkin/search/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          value: trimmedQuery,
          parameter: searchParam,
          event: event.id,
        }),
      });

      const payload = await response.json().catch(() => null);
      applyStatsFromResponse(payload);

      if (response.status === 403) {
        await clearSession();
        setRegistration(null);
        router.replace("/login");
        return;
      }

      if (!response.ok) {
        const message =
          payload?.message ||
          payload?.error ||
          `Erro ao pesquisar. (${response.status})`;
        setError(message);
        setSearched(true);
        return;
      }

      const data =
        payload?.registrations ?? payload?.data ?? payload?.results ?? payload;
      const list = Array.isArray(data) ? data : [];
      setResults(list as RegistrationResource[]);
      setSearched(true);
    } catch (err) {
      setError("Erro de rede. Tente novamente.");
      setSearched(true);
    } finally {
      setLoading(false);
    }
  };

  const handleAdvance = (registration: RegistrationResource) => {
    setRegistration(registration);
    router.push("/confirmation");
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: tabBarHeight + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Pesquisar atletas</Text>
        <Text style={styles.subtitle}>
          Pesquise atletas por nome, dorsal ou nº de identificação.
        </Text>

        <View style={styles.card}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder=""
          placeholderTextColor="#8A8A8A"
          keyboardType={
            searchParam === "bib_number" || searchParam === "code"
              ? "numeric"
              : "default"
          }
          style={styles.input}
        />

          <View style={styles.paramGroup}>
            {SEARCH_OPTIONS.map((option) => {
              const isSelected = option.key === searchParam;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => setSearchParam(option.key)}
                  style={[
                    styles.paramButton,
                    isSelected && styles.paramButtonActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.paramButtonText,
                      isSelected && styles.paramButtonTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.button,
              (pressed || loading) && styles.buttonPressed,
            ]}
            onPress={handleSearch}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#292929" />
            ) : (
              <Text style={styles.buttonText}>Pesquisar</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.resultsSection}>
          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#292929" />
              <Text style={styles.loadingText}>A pesquisar...</Text>
            </View>
          ) : searched && results.length === 0 ? (
            <Text style={styles.emptyText}>Sem resultados</Text>
          ) : results.length > 0 ? (
            results.map((result, index) => {
              const athlete = result.athlete;
              const name =
                athlete?.name ||
                [athlete?.firstname, athlete?.lastname]
                  .filter(Boolean)
                  .join(" ") ||
                "Atleta";
              const bibNumber = result.bib_number ?? "—";
              const identification = athlete?.identification_number ?? "—";

              return (
                <View key={result.id ?? `${index}`} style={styles.resultCard}>
                  <View style={styles.resultInfo}>
                    <Text style={styles.resultName}>{name}</Text>
                    <Text style={styles.resultMeta}>Dorsal: {bibNumber}</Text>
                    <Text style={styles.resultMeta}>
                      Nº Identificacao: {identification}
                    </Text>
                  </View>
                  <Pressable
                    style={styles.resultButton}
                    onPress={() => handleAdvance(result)}
                  >
                    <Text style={styles.resultButtonText}>
                      Check-in
                    </Text>
                  </Pressable>
                </View>
              );
            })
          ) : (
            <Text style={styles.emptyText}>
              Introduza um valor e pesquise para ver resultados.
            </Text>
          )}
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#292929",
    textAlign: "center",
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    color: "#5A5A5A",
    textAlign: "center",
  },
  card: {
    marginTop: 24,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 15,
    borderWidth: 1,
    borderColor: "#E2E2E2",
    shadowColor: "#292929",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
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
    borderRadius: 5,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: "#292929",
    marginBottom: 16,
    backgroundColor: "#F7F7F7",
  },
  paramGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  paramButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#D7D7D7",
    backgroundColor: "#F7F7F7",
  },
  paramButtonActive: {
    backgroundColor: "#292929",
    borderColor: "#292929",
  },
  paramButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#292929",
  },
  paramButtonTextActive: {
    color: "#FFFFFF",
  },
  button: {
    backgroundColor: "#292929",
    borderRadius: 5,
    paddingVertical: 12,
    alignItems: "center",
    height: 48,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  resultsSection: {
    marginTop: 20,
    gap: 12,
    paddingBottom: 24,
  },
  resultCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 15,
    borderWidth: 1,
    borderColor: "#E2E2E2",
    shadowColor: "#292929",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  resultInfo: {
    marginBottom: 12,
  },
  resultName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#292929",
  },
  resultMeta: {
    marginTop: 6,
    fontSize: 13,
    color: "#5A5A5A",
  },
  resultButton: {
    backgroundColor: "#A5BF13",
    borderRadius: 5,
    paddingVertical: 15,
    alignItems: "center",
  },
  resultButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E2E2",
  },
  loadingText: {
    fontSize: 13,
    color: "#5A5A5A",
  },
  errorText: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 15,
    backgroundColor: "#FEE4E2",
    borderWidth: 1,
    borderColor: "#FDA29B",
    color: "#B42318",
    fontSize: 13,
    fontWeight: "600",
  },
  emptyText: {
    fontSize: 14,
    color: "#5A5A5A",
    textAlign: "center",
    paddingVertical: 16,
  },
});
