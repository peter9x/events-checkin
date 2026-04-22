export type MqttProtocol = "ws" | "wss";

export type MqttSettings = {
  protocol: MqttProtocol;
  server: string;
  port: number;
  user: string | null;
  pass: string | null;
  ssl: boolean;
};

export type MqttSettingsOverrides = {
  mqtt_protocol?: unknown;
  mqtt_server?: unknown;
  mqtt_port?: unknown;
  mqtt_user?: unknown;
  mqtt_pass?: unknown;
  mqtt_ssl?: unknown;
};

const DEFAULT_MQTT_PROTOCOL: MqttProtocol = "ws";
const DEFAULT_MQTT_SSL = false;
const DEFAULT_MQTT_WS_PORT = 80;
const DEFAULT_MQTT_WSS_PORT = 443;

const normalizeString = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
};

const normalizeBoolean = (value: unknown) => {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (["1", "true", "yes", "y", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "n", "off"].includes(normalized)) {
    return false;
  }

  return null;
};

const normalizeProtocol = (
  protocolValue: unknown,
  sslValue: unknown,
  fallback: MqttProtocol,
): MqttProtocol => {
  const protocolString = normalizeString(protocolValue)?.toLowerCase();
  if (protocolString === "wss") {
    return "wss";
  }
  if (protocolString === "ws") {
    return "ws";
  }

  const parsedSsl = normalizeBoolean(sslValue);
  if (parsedSsl === true) {
    return "wss";
  }
  if (parsedSsl === false) {
    return "ws";
  }

  return fallback;
};

const normalizePort = (value: unknown, fallback: number) => {
  if (value === null || value === undefined) {
    return fallback;
  }

  const rawNumber =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.trim())
        : Number.NaN;

  if (!Number.isFinite(rawNumber)) {
    return fallback;
  }

  const parsed = Math.trunc(rawNumber);
  if (parsed < 1 || parsed > 65535) {
    return fallback;
  }

  return parsed;
};

const normalizeServer = (value: unknown, fallback: string) =>
  normalizeString(value) ?? fallback;

const resolveSsl = (
  explicitSsl: unknown,
  protocol: MqttProtocol,
  fallback: boolean,
) => {
  const parsedSsl = normalizeBoolean(explicitSsl);
  if (parsedSsl !== null) {
    return parsedSsl;
  }
  if (protocol === "wss") {
    return true;
  }
  if (protocol === "ws") {
    return false;
  }
  return fallback;
};

export const getDefaultMqttSettings = (): MqttSettings => {
  const envProtocol = process.env.EXPO_PUBLIC_MQTT_PROTOCOL;
  const envSsl = process.env.EXPO_PUBLIC_MQTT_SSL;
  const protocol = normalizeProtocol(
    envProtocol,
    envSsl,
    DEFAULT_MQTT_PROTOCOL,
  );
  const ssl = resolveSsl(envSsl, protocol, DEFAULT_MQTT_SSL);
  const defaultPort =
    protocol === "wss" ? DEFAULT_MQTT_WSS_PORT : DEFAULT_MQTT_WS_PORT;

  return {
    protocol,
    server: normalizeServer(process.env.EXPO_PUBLIC_MQTT_SERVER, ""),
    port: normalizePort(process.env.EXPO_PUBLIC_MQTT_PORT, defaultPort),
    user: normalizeString(process.env.EXPO_PUBLIC_MQTT_USER),
    pass: normalizeString(process.env.EXPO_PUBLIC_MQTT_PASS),
    ssl,
  };
};

export const mergeMqttSettings = (
  current: MqttSettings,
  overrides?: MqttSettingsOverrides | null,
) => {
  if (!overrides) {
    return current;
  }

  const protocol = normalizeProtocol(
    overrides.mqtt_protocol,
    overrides.mqtt_ssl,
    current.protocol,
  );
  const ssl = resolveSsl(overrides.mqtt_ssl, protocol, current.ssl);
  const fallbackPort =
    protocol === "wss" ? DEFAULT_MQTT_WSS_PORT : DEFAULT_MQTT_WS_PORT;
  const hasPortOverride =
    overrides.mqtt_port !== undefined && overrides.mqtt_port !== null;

  return {
    protocol,
    server: normalizeServer(overrides.mqtt_server, current.server),
    port: normalizePort(
      overrides.mqtt_port,
      hasPortOverride ? fallbackPort : current.port,
    ),
    user:
      overrides.mqtt_user === undefined
        ? current.user
        : normalizeString(overrides.mqtt_user),
    pass:
      overrides.mqtt_pass === undefined
        ? current.pass
        : normalizeString(overrides.mqtt_pass),
    ssl,
  };
};

export const buildMqttBrokerUrl = (settings: MqttSettings) => {
  const server = settings.server.trim();
  if (!server) {
    return null;
  }

  let sufix = "";

  if (settings.protocol === "ws" || settings.protocol === "wss") {
    sufix = "/mqtt";
  }

  const candidate = /^wss?:\/\//i.test(server)
    ? server
    : `${settings.protocol}://${server}${sufix}`;

  console.log(candidate);
  try {
    const parsed = new URL(candidate);
    parsed.protocol = `${settings.protocol}:`;
    parsed.port = String(settings.port);
    return parsed.toString();
  } catch {
    return null;
  }
};
