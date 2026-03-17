## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

3. Configure API endpoints (optional but recommended)

   ```bash
   EXPO_PUBLIC_API_URL=http://192.168.1.251:8000/api/v1
   EXPO_PUBLIC_LOCAL_API_URL=http://10.10.1.5/api/v1
   EXPO_PUBLIC_API_TIMEOUT_MS=5000
   ```

   If `EXPO_PUBLIC_LOCAL_API_URL` is not set, the app falls back to `http://10.10.1.5` and keeps the same path suffix from `EXPO_PUBLIC_API_URL` (for example `/api/v1`).
   For each new QR login, the app starts by trying online endpoints first. If network access fails, it falls back to local and stays in local mode for the rest of that session. If the QR payload contains a custom `endpoint`, that value is stored and used as the session endpoint preference.

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
