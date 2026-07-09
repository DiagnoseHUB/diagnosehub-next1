import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "de.diagnosehub.app",
  appName: "DiagnoseHUB",
  webDir: "capacitor-www",
  server: {
    url: process.env.CAPACITOR_SERVER_URL ?? "https://diagnosehub.de",
    cleartext: false,
  },
  backgroundColor: "#020617",
  loggingBehavior: "production",
  android: {
    backgroundColor: "#020617",
  },
  ios: {
    backgroundColor: "#020617",
  },
};

export default config;
