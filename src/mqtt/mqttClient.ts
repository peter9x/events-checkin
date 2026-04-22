import mqtt from "mqtt";
import type { IClientOptions, MqttClient } from "mqtt";
import { buildMqttBrokerUrl, MqttSettings } from "./mqttConfig";
import { getDeviceInfoPayload } from "../device/deviceInfo";

const MQTT_CONNECT_TIMEOUT_MS = 3500;
const MQTT_DEBUG_PREFIX = "[MQTT]";

let sharedClient: MqttClient | null = null;
let sharedClientKey: string | null = null;
let pendingConnectPromise: Promise<MqttClient | null> | null = null;

const getDebugSettings = (settings: MqttSettings) => ({
  protocol: settings.protocol,
  server: settings.server,
  port: settings.port,
  ssl: settings.ssl,
  hasUser: Boolean(settings.user),
  hasPass: Boolean(settings.pass),
});

const createClientKey = (settings: MqttSettings) =>
  JSON.stringify({
    protocol: settings.protocol,
    server: settings.server,
    port: settings.port,
    user: settings.user,
    ssl: settings.ssl,
  });

const createClientId = () =>
  `checkin-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const buildPublishPayload = async (payload: unknown) => {
  const deviceInfoPayload = await getDeviceInfoPayload().catch(() => null);

  if (!deviceInfoPayload) {
    return payload ?? null;
  }

  const metadata = {
    device_id: deviceInfoPayload.device_id,
    battery_percentage: deviceInfoPayload.battery_percentage,
  };

  if (isPlainObject(payload)) {
    return {
      ...payload,
      ...metadata,
    };
  }

  if (payload === null || payload === undefined) {
    return metadata;
  }

  return {
    payload,
    ...metadata,
  };
};

const closeSharedClient = () => {
  if (!sharedClient) {
    return;
  }
  try {
    sharedClient.end(true);
  } catch {
    // Ignore close errors.
  } finally {
    sharedClient = null;
    sharedClientKey = null;
  }
};

const waitForConnection = async (settings: MqttSettings) => {
  const clientKey = createClientKey(settings);
  console.log(`${MQTT_DEBUG_PREFIX} waitForConnection:start`, {
    clientKey,
    settings: getDebugSettings(settings),
  });

  if (sharedClient && sharedClientKey === clientKey && sharedClient.connected) {
    console.log(`${MQTT_DEBUG_PREFIX} waitForConnection:reusing-shared-client`, {
      clientKey,
    });
    return sharedClient;
  }

  if (pendingConnectPromise && sharedClientKey === clientKey) {
    console.log(`${MQTT_DEBUG_PREFIX} waitForConnection:awaiting-pending-connection`, {
      clientKey,
    });
    return pendingConnectPromise;
  }

  closeSharedClient();
  sharedClientKey = clientKey;

  const brokerUrl = buildMqttBrokerUrl(settings);
  if (!brokerUrl) {
    console.warn(`${MQTT_DEBUG_PREFIX} waitForConnection:invalid-broker-url`, {
      clientKey,
      settings: getDebugSettings(settings),
    });
    pendingConnectPromise = null;
    return null;
  }

  pendingConnectPromise = new Promise<MqttClient | null>((resolve) => {
    const options: IClientOptions = {
      clean: true,
      connectTimeout: MQTT_CONNECT_TIMEOUT_MS,
      reconnectPeriod: 0,
      clientId: createClientId(),
      username: settings.user ?? undefined,
      password: settings.pass ?? undefined,
      protocolVersion: 4,
    };

    console.log(`${MQTT_DEBUG_PREFIX} waitForConnection:connecting`, {
      clientKey,
      brokerUrl,
      clientId: options.clientId,
      hasUser: Boolean(options.username),
      timeoutMs: MQTT_CONNECT_TIMEOUT_MS,
    });

    const client = mqtt.connect(brokerUrl, options);
    let settled = false;

    const finish = (result: MqttClient | null) => {
      if (settled) {
        return;
      }
      settled = true;
      pendingConnectPromise = null;

      client.removeAllListeners("connect");
      client.removeAllListeners("error");
      client.removeAllListeners("close");
      client.removeAllListeners("offline");

      if (!result) {
        try {
          client.end(true);
        } catch {
          // Ignore close errors.
        }
      }

      resolve(result);
    };

    const timeoutId = setTimeout(() => {
      console.warn(`${MQTT_DEBUG_PREFIX} waitForConnection:timeout`, {
        clientKey,
        timeoutMs: MQTT_CONNECT_TIMEOUT_MS + 500,
      });
      finish(null);
    }, MQTT_CONNECT_TIMEOUT_MS + 500);

    client.once("connect", () => {
      clearTimeout(timeoutId);
      sharedClient = client;
      console.log(`${MQTT_DEBUG_PREFIX} waitForConnection:connect-success`, {
        clientKey,
      });
      finish(client);
    });

    client.once("error", (error: Error) => {
      clearTimeout(timeoutId);
      console.error(`${MQTT_DEBUG_PREFIX} waitForConnection:error`, {
        clientKey,
        message: error.message,
      });
      finish(null);
    });

    client.once("offline", () => {
      clearTimeout(timeoutId);
      console.warn(`${MQTT_DEBUG_PREFIX} waitForConnection:offline`, {
        clientKey,
      });
      finish(null);
    });

    client.once("close", () => {
      console.log(`${MQTT_DEBUG_PREFIX} waitForConnection:close`, {
        clientKey,
      });
      if (sharedClient === client) {
        sharedClient = null;
        sharedClientKey = null;
      }
    });
  });

  return pendingConnectPromise;
};

export const buildCheckinTopic = (
  eventId: string | number,
  deviceId: string,
  action: "read" | "confirm",
) => {
  const normalizedEventId = encodeURIComponent(String(eventId));
  return `/event/${normalizedEventId}/checkin/${deviceId}/${action}`;
};

export const publishMqttJson = async (
  settings: MqttSettings,
  topic: string,
  payload: unknown,
) => {
  console.log(`${MQTT_DEBUG_PREFIX} publish:start`, {
    topic,
    settings: getDebugSettings(settings),
  });
  const client = await waitForConnection(settings);
  if (!client || !client.connected) {
    console.warn(`${MQTT_DEBUG_PREFIX} publish:missing-connected-client`, {
      topic,
    });
    return false;
  }

  const messagePayload = await buildPublishPayload(payload);
  const message = JSON.stringify(messagePayload);

  return new Promise<boolean>((resolve) => {
    client.publish(topic, message, { qos: 0, retain: false }, (error?: Error) => {
      if (error) {
        console.error(`${MQTT_DEBUG_PREFIX} publish:error`, {
          topic,
          message: error.message,
        });
      } else {
        console.log(`${MQTT_DEBUG_PREFIX} publish:success`, {
          topic,
          bytes: message.length,
        });
      }
      resolve(!error);
    });
  });
};

export const checkMqttConnection = async (settings: MqttSettings) => {
  console.log(`${MQTT_DEBUG_PREFIX} check:start`, {
    settings: getDebugSettings(settings),
  });
  const client = await waitForConnection(settings);
  const isConnected = Boolean(client && client.connected);
  console.log(`${MQTT_DEBUG_PREFIX} check:result`, { isConnected });
  return isConnected;
};
