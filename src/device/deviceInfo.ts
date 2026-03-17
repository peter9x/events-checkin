import * as SecureStore from "expo-secure-store";
import * as Network from "expo-network";
import * as Location from "expo-location";
import { PermissionsAndroid, Platform } from "react-native";

const DEVICE_ID_KEY = "checkin.deviceId";

export type DeviceInfoSnapshot = {
  deviceId: string;
  ipAddress: string | null;
  macAddress: string | null;
  wifiName: string | null;
};

export type DeviceInfoPayload = {
  device_id: string;
  ip_address: string | null;
  mac_address: string | null;
  wifi_ssid: string | null;
};

const createFallbackId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

let deviceInfoSnapshotPromise: Promise<DeviceInfoSnapshot> | null = null;

export async function getDeviceId(): Promise<string> {
  try {
    const stored = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    if (stored) {
      return stored;
    }
  } catch {
    // Ignore read errors and create a new id.
  }

  const nextId = createFallbackId();
  try {
    await SecureStore.setItemAsync(DEVICE_ID_KEY, nextId);
  } catch {
    // Ignore write errors; the id will be regenerated next time.
  }
  return nextId;
}

export async function getDeviceInfoSnapshot(): Promise<DeviceInfoSnapshot> {
  if (Platform.OS === "android" && Platform.Version >= 33) {
    try {
      const hasNearbyWifi = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES,
      );
      if (!hasNearbyWifi) {
        await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES,
        );
      }
    } catch {
      // Ignore permission errors; network details may still resolve.
    }
  }

  try {
    const existing = await Location.getForegroundPermissionsAsync();
    if (existing.status !== "granted") {
      await Location.requestForegroundPermissionsAsync();
    }
  } catch {
    // Ignore permission errors; network details may still resolve.
  }

  const [deviceId, ipAddress, networkState] = await Promise.all([
    getDeviceId(),
    Network.getIpAddressAsync().catch(() => null),
    Network.getNetworkStateAsync().catch(() => null),
  ]);

  const details =
    networkState && typeof networkState === "object"
      ? (networkState as { details?: Record<string, unknown> }).details ?? null
      : null;

  const wifiName =
    details && typeof details.ssid === "string" ? details.ssid : null;
  const macAddress =
    details && typeof details.macAddress === "string"
      ? details.macAddress
      : details && typeof details.bssid === "string"
        ? details.bssid
        : null;

  return {
    deviceId,
    ipAddress,
    macAddress,
    wifiName,
  };
}

export async function getCachedDeviceInfoSnapshot(): Promise<DeviceInfoSnapshot> {
  if (!deviceInfoSnapshotPromise) {
    deviceInfoSnapshotPromise = getDeviceInfoSnapshot().catch((error) => {
      deviceInfoSnapshotPromise = null;
      throw error;
    });
  }

  return deviceInfoSnapshotPromise;
}

export async function getDeviceInfoPayload(): Promise<DeviceInfoPayload> {
  const snapshot = await getCachedDeviceInfoSnapshot();
  return {
    device_id: snapshot.deviceId,
    ip_address: snapshot.ipAddress,
    mac_address: snapshot.macAddress,
    wifi_ssid: snapshot.wifiName,
  };
}
