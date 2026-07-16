import { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { BluetoothSerial } from '@e-is/capacitor-bluetooth-serial';
import { useIonToast } from '@ionic/react';

import {
  BluetoothPermission,
} from '../plugins/bluetooth-permission';

export interface BluetoothDevice {
  id?: string;
  address?: string;
  name?: string;
}

export function useBluetoothPrinter() {
  const [presentToast] = useIonToast();

  const [devices, setDevices] = useState<BluetoothDevice[]>([]);
  const [scanning, setScanning] = useState(false);
  const [connectedAddress, setConnectedAddress] =
    useState<string | null>(null);

  const showToast = async (
    message: string,
    color: 'success' | 'warning' | 'danger' = 'warning'
  ) => {
    await presentToast({
      message,
      duration: 2200,
      color,
      position: 'top',
    });
  };

  const requestPermission = async (): Promise<boolean> => {
    if (
      !Capacitor.isNativePlatform() ||
      Capacitor.getPlatform() !== 'android'
    ) {
      await showToast(
        'Bluetooth Printer ใช้งานได้เฉพาะแอป Android',
        'warning'
      );

      return false;
    }

    try {
      const current =
        await BluetoothPermission.checkPermissions();

      if (current.granted) {
        return true;
      }

      const result =
        await BluetoothPermission.requestPermissions();

      if (!result.granted) {
        await showToast(
          'กรุณาอนุญาตการเข้าถึงอุปกรณ์ใกล้เคียง',
          'warning'
        );

        return false;
      }

      return true;
    } catch (error) {
      console.error('Bluetooth permission error:', error);

      await showToast(
        'ไม่สามารถขอสิทธิ์ Bluetooth ได้',
        'danger'
      );

      return false;
    }
  };

  const checkBluetoothEnabled = async (): Promise<boolean> => {
    try {
      const result = await BluetoothSerial.isEnabled();

      if (!result.enabled) {
        await showToast(
          'กรุณาเปิด Bluetooth จากโทรศัพท์',
          'warning'
        );

        return false;
      }

      return true;
    } catch (error) {
      console.error('Bluetooth state error:', error);

      await showToast(
        'ไม่สามารถตรวจสอบสถานะ Bluetooth ได้',
        'danger'
      );

      return false;
    }
  };

  const scan = async (): Promise<void> => {
    setScanning(true);

    try {
      const granted = await requestPermission();

      if (!granted) {
        return;
      }

      const enabled = await checkBluetoothEnabled();

      if (!enabled) {
        return;
      }

      const result = await BluetoothSerial.scan();

      const foundDevices =
        result.devices?.map((device) => ({
          id: device.id,
          address: device.address ?? device.id,
          name: device.name ?? 'Unknown device',
        })) ?? [];

      setDevices(foundDevices);

      if (foundDevices.length === 0) {
        await showToast(
          'ไม่พบอุปกรณ์ Bluetooth',
          'warning'
        );
      }
    } catch (error) {
      console.error('Bluetooth scan error:', error);

      await showToast(
        'ค้นหาเครื่องพิมพ์ไม่สำเร็จ',
        'danger'
      );
    } finally {
      setScanning(false);
    }
  };

  const connect = async (address: string): Promise<boolean> => {
    try {
      const granted = await requestPermission();

      if (!granted) {
        return false;
      }

      const enabled = await checkBluetoothEnabled();

      if (!enabled) {
        return false;
      }

      try {
        await BluetoothSerial.connect({ address });
      } catch {
        await BluetoothSerial.connectInsecure({ address });
      }

      setConnectedAddress(address);
      localStorage.setItem('printerAddress', address);

      await showToast(
        'เชื่อมต่อเครื่องพิมพ์สำเร็จ',
        'success'
      );

      return true;
    } catch (error) {
      console.error('Bluetooth connect error:', error);

      await showToast(
        'เชื่อมต่อเครื่องพิมพ์ไม่สำเร็จ',
        'danger'
      );

      return false;
    }
  };

  const disconnect = async (): Promise<void> => {
    if (!connectedAddress) {
      return;
    }

    try {
      await BluetoothSerial.disconnect({
        address: connectedAddress,
      });

      setConnectedAddress(null);

      await showToast(
        'ยกเลิกการเชื่อมต่อแล้ว',
        'success'
      );
    } catch (error) {
      console.error('Bluetooth disconnect error:', error);

      await showToast(
        'ไม่สามารถยกเลิกการเชื่อมต่อได้',
        'danger'
      );
    }
  };

  return {
    devices,
    scanning,
    connectedAddress,
    scan,
    connect,
    disconnect,
    requestPermission,
  };
}