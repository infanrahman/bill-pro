import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.billingapp.app',
  appName: 'Billing App',
  webDir: 'dist',
  server: {
    cleartext: true
  }
};

export default config;
