import { registerPlugin } from '@capacitor/core';

export interface BluetoothPermissionResult {
  granted: boolean;
}

export interface BluetoothPermissionPlugin {
  checkPermissions(): Promise<BluetoothPermissionResult>;
  requestPermissions(): Promise<BluetoothPermissionResult>;
}

export const BluetoothPermission =
  registerPlugin<BluetoothPermissionPlugin>(
    'BluetoothPermission'
  );