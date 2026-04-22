## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

3. Configure API and MQTT endpoints (optional but recommended)

   ```bash
   EXPO_PUBLIC_API_URL=http://192.168.1.251:8000/api/v1
   EXPO_PUBLIC_LOCAL_API_URL=http://10.10.5.10/api/v1
   EXPO_PUBLIC_API_TIMEOUT_MS=5000
   EXPO_PUBLIC_MQTT_PROTOCOL=ws
   EXPO_PUBLIC_MQTT_SERVER=192.168.1.251
   EXPO_PUBLIC_MQTT_PORT=9001
   EXPO_PUBLIC_MQTT_USER=
   EXPO_PUBLIC_MQTT_PASS=
   EXPO_PUBLIC_MQTT_SSL=false
   ```

   If `EXPO_PUBLIC_LOCAL_API_URL` is not set, the app falls back to `http://10.10.5.10` and keeps the same path suffix from `EXPO_PUBLIC_API_URL` (for example `/api/v1`).
   The app always uses a single API mode per session (online or local), without automatic fallback between modes.
   Login QR can override `endpoint` and MQTT keys (`mqtt_protocol`, `mqtt_server`, `mqtt_port`, `mqtt_user`, `mqtt_pass`, `mqtt_ssl`). Those overrides are persisted until changed by another login QR.

```
Primary color: #A5BF13
Contrast color: #292929
Secondary color: #F0F0F0
Accent/Highlight color: #62929E
```


Unpack the .aab APP
```
java -jar bundletool.jar build-apks --bundle=app.aab --output=app.apks --mode=universal

```
the resulted .apks, change to .zip, extract
