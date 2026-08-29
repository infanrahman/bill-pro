import { Capacitor } from '@capacitor/core';
import { Camera } from '@capacitor/camera';
import { Filesystem } from '@capacitor/filesystem';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';

export class PermissionService {
  static async requestAllPermissions() {
    if (!Capacitor.isNativePlatform()) return;
    try {
      if ((await Camera.checkPermissions()).camera !== 'granted') {
        await Camera.requestPermissions();
      }
    } catch (e) {}
    try {
      if ((await Filesystem.checkPermissions()).publicStorage !== 'granted') {
        await Filesystem.requestPermissions();
      }
    } catch (e) {}
    try {
      const barcodeStatus = await BarcodeScanner.checkPermissions();
      if (barcodeStatus.camera !== 'granted') {
        await BarcodeScanner.requestPermissions();
      }
    } catch (e) {}
  }
}
