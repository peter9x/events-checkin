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
import { useApi } from "../../src/api/useApi";
import { useSessionReset } from "../../src/auth/useSessionReset";

type SearchParam = "bib_number" | "identification_number" | "code";

export default function SearchScreen() {
  const [bibQuery, setBibQuery] = useState("");
  const [identificationQuery, setIdentificationQuery] = useState("");
  const [codeQuery, setCodeQuery] = useState("");
  const [activeParam, setActiveParam] = useState<SearchParam>("bib_number");
  const [results, setResults] = useState<RegistrationResource[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { token } = useAuth();
  const { event, applyStatsFromResponse } = useApp();
  const { setRegistration } = useCheckin();
  const { request } = useApi();
  const resetSession = useSessionReset();
  const isFocused = useIsFocused();
  const tabBarHeight = useBottomTabBarHeight();

  useEffect(() => {
    if (isFocused && token && !event?.id) {
      void resetSession();
    }
  }, [isFocused, token, event?.id, resetSession]);

  useEffect(() => {
    setResults([]);
    setSearched(false);
    setError(null);
  }, [event?.id]);

  const handleFieldChange = (field: SearchParam, value: string) => {
    setActiveParam(field);
    if (field === "bib_number") {
      setBibQuery(value);
      if (identificationQuery) {
        setIdentificationQuery("");
      }
      if (codeQuery) {
        setCodeQuery("");
      }
      return;
    }
    if (field === "identification_number") {
      setIdentificationQuery(value);
      if (bibQuery) {
        setBibQuery("");
      }
      if (codeQuery) {
        setCodeQuery("");
      }
      return;
    }
    setCodeQuery(value);
    if (bibQuery) {
      setBibQuery("");
    }
    if (identificationQuery) {
      setIdentificationQuery("");
    }
  };

  const handleSearch = async () => {
    if (loading) {
      return;
    }
    if (!token) {
      await resetSession();
      return;
    }
    if (!event?.id) {
      await resetSession();
      return;
    }

    const fields = [
      { key: "bib_number", value: bibQuery },
      { key: "identification_number", value: identificationQuery },
      { key: "code", value: codeQuery },
    ] as const;
    const selectedField =
      fields.find((item) => item.value.trim()) ??
      fields.find((item) => item.key === activeParam);
    const trimmedQuery = selectedField?.value.trim() ?? "";
    const searchParam = selectedField?.key ?? activeParam;
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
      const { response, payload, unauthorized } = await request(
        "/checkin/search/",
        {
          method: "POST",
          body: {
            value: trimmedQuery,
            parameter: searchParam,
            event: event.id,
          },
        },
      );

      if (!response || unauthorized) {
        return;
      }

      applyStatsFromResponse(payload);

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
          Pesquise atletas por dorsal, nº de identificação ou código.
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>Dorsal</Text>
          <TextInput
            value={bibQuery}
            onChangeText={(value) => handleFieldChange("bib_number", value)}
            placeholder="Número do dorsal"
            placeholderTextColor="#8A8A8A"
            keyboardType="numeric"
            style={styles.input}
          />

          <Text style={styles.label}>Nº de identificação</Text>
          <TextInput
            value={identificationQuery}
            onChangeText={(value) =>
              handleFieldChange("identification_number", value)
            }
            placeholder="Documento de identificação"
            placeholderTextColor="#8A8A8A"
            keyboardType="default"
            style={styles.input}
          />

          <Text style={styles.label}>Código</Text>
          <TextInput
            value={codeQuery}
            onChangeText={(value) => handleFieldChange("code", value)}
            placeholder="Código de registo"
            placeholderTextColor="#8A8A8A"
            keyboardType="numeric"
            style={styles.input}
          />

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
