const { AndroidConfig, withAndroidManifest } = require("@expo/config-plugins");

module.exports = function withAndroidCleartextTraffic(config) {
  return withAndroidManifest(config, (config) => {
    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(
      config.modResults,
    );

    mainApplication.$["android:usesCleartextTraffic"] = "true";

    return config;
  });
};
