import React, { useEffect, useMemo, useState } from 'react';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonPage,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
  useIonToast,
} from '@ionic/react';
import { BluetoothSerial, BluetoothDevice } from '@e-is/capacitor-bluetooth-serial';
import {
  bluetoothOutline,
  checkmarkCircleOutline,
  chevronForwardOutline,
  printOutline,
  refreshOutline,
} from 'ionicons/icons';

const PRINTER_STORAGE_KEY = 'selected_printer_device';

type SavedPrinter = {
  name: string;
  id: string;
  address: string;
};

const Settings: React.FC = () => {
  const [toast] = useIonToast();
  const [showPrinterModal, setShowPrinterModal] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [connectingAddress, setConnectingAddress] = useState<string | null>(null);
  const [devices, setDevices] = useState<BluetoothDevice[]>([]);
  const [savedPrinter, setSavedPrinter] = useState<SavedPrinter | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(PRINTER_STORAGE_KEY);
    if (stored) {
      try {
        setSavedPrinter(JSON.parse(stored) as SavedPrinter);
      } catch {
        localStorage.removeItem(PRINTER_STORAGE_KEY);
      }
    }
  }, []);

  const sortedDevices = useMemo(() => {
    return [...devices].sort((left, right) => {
      const leftName = left.name?.trim() || left.address;
      const rightName = right.name?.trim() || right.address;
      return leftName.localeCompare(rightName);
    });
  }, [devices]);

  const savePrinter = (device: BluetoothDevice) => {
    const payload: SavedPrinter = {
      name: device.name?.trim() || device.address,
      id: device.id,
      address: device.address,
    };

    localStorage.setItem(PRINTER_STORAGE_KEY, JSON.stringify(payload));
    setSavedPrinter(payload);
  };

  const ensureBluetoothReady = async () => {
    const state = await BluetoothSerial.isEnabled();
    if (state.enabled) {
      return true;
    }

    const canEnable = await BluetoothSerial.canEnable();
    if (!canEnable.enabled) {
      toast({
        message: 'อุปกรณ์นี้ไม่รองรับการเปิด Bluetooth ผ่านแอป',
        duration: 2200,
        color: 'danger',
        position: 'top',
      });
      return false;
    }

    const enabled = await BluetoothSerial.enable();
    return enabled.enabled;
  };

  const scanBluetoothDevices = async () => {
    setScanning(true);
    try {
      const ready = await ensureBluetoothReady();
      if (!ready) {
        return;
      }

      const result = await BluetoothSerial.scan();
      setDevices(result.devices || []);
      if (!result.devices?.length) {
        toast({
          message: 'ไม่พบอุปกรณ์ Bluetooth',
          duration: 1800,
          color: 'medium',
          position: 'top',
        });
      }
    } catch (error) {
      console.error('Bluetooth scan failed', error);
      toast({
        message: 'สแกน Bluetooth ไม่สำเร็จ',
        duration: 2200,
        color: 'danger',
        position: 'top',
      });
    } finally {
      setScanning(false);
    }
  };

  const openPrinterModal = async () => {
    setShowPrinterModal(true);
    if (!devices.length) {
      await scanBluetoothDevices();
    }
  };

  const connectDevice = async (device: BluetoothDevice) => {
    setConnectingAddress(device.address);
    try {
      await BluetoothSerial.connect({ address: device.address });
      savePrinter(device);
      toast({
        message: `เชื่อมต่อกับ ${device.name?.trim() || device.address} แล้ว`,
        duration: 2200,
        color: 'success',
        position: 'top',
      });
    } catch (error) {
      console.error('Bluetooth connect failed', error);
      toast({
        message: 'เชื่อมต่ออุปกรณ์ไม่สำเร็จ',
        duration: 2200,
        color: 'danger',
        position: 'top',
      });
    } finally {
      setConnectingAddress(null);
    }
  };

  return (
    <IonPage>
      <IonHeader mode="md" className="ion-no-border">
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton color="dark" defaultHref="/profile" />
          </IonButtons>
          <IonTitle>Setting</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen className="ion-padding">
        <IonCard  >
          <IonCardHeader>
            <IonCardSubtitle>Printer</IonCardSubtitle>
            <IonCardTitle  style={{ fontSize: '1em' }} >ตั้งค่าเครื่องพิมพ์</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <IonText color="medium">
              <p>เลือกอุปกรณ์ Bluetooth ที่ใช้เป็น printer แล้วระบบจะบันทึกไว้ในเครื่องนี้</p>
            </IonText>

            <IonList lines="full" style={{ marginTop: 12 }}>
              <IonItem button mode="md" detail onClick={openPrinterModal}>
                <IonIcon slot="start" icon={printOutline} />
                <IonLabel>
                  <IonLabel>ตั้งค่า printer</IonLabel>
                  <p>{savedPrinter ? `${savedPrinter.name} (${savedPrinter.address})` : 'ยังไม่ได้เลือกอุปกรณ์'}</p>
                </IonLabel> 
              </IonItem>
            </IonList>
          </IonCardContent>
        </IonCard>

        <IonModal isOpen={showPrinterModal} onDidDismiss={() => setShowPrinterModal(false)} initialBreakpoint={0.9} breakpoints={[0, 0.9]}>
          <IonHeader>
            <IonToolbar>
              <IonButtons slot="start">
                <IonButton onClick={() => setShowPrinterModal(false)}>ปิด</IonButton>
              </IonButtons>
              <IonTitle>Bluetooth Printer</IonTitle>
              <IonButtons slot="end">
                <IonButton onClick={scanBluetoothDevices} disabled={scanning}  style={{fontSize: '.8em'}}>
                  <IonIcon slot="start" icon={refreshOutline} />
                  <IonLabel >สแกนใหม่</IonLabel>
                </IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>

          <IonContent className="ion-padding">
            <IonButton expand="block" onClick={scanBluetoothDevices} disabled={scanning}>
              {scanning ? <IonSpinner name="crescent" slot="start" /> : <IonIcon icon={bluetoothOutline} slot="start" />}
              {scanning ? 'กำลังสแกน Bluetooth...' : 'สแกนอุปกรณ์ Bluetooth'}
            </IonButton>

            {savedPrinter && (
              <IonCard style={{ marginTop: 16 }}>
                <IonCardContent>
                  <IonText color="success">
                    <p style={{ margin: 0 }}>
                      เครื่องที่บันทึกไว้: {savedPrinter.name} ({savedPrinter.address})
                    </p>
                  </IonText>
                </IonCardContent>
              </IonCard>
            )}

            <IonList style={{ marginTop: 16 }}>
              {sortedDevices.length === 0 && !scanning && (
                <IonItem lines="none">
                  <IonLabel>
                    <h2>ยังไม่พบอุปกรณ์</h2>
                    <p>กดสแกนเพื่อค้นหา Bluetooth printer รอบตัว</p>
                  </IonLabel>
                </IonItem>
              )}

              {sortedDevices.map((device) => {
                const label = device.name?.trim() || device.address;
                const subtitle = device.address === device.id ? device.address : `${device.address}`;
                const isConnecting = connectingAddress === device.address;
                const isSaved = savedPrinter?.address === device.address;

                return (
                  <IonItem key={device.address || device.id} button detail onClick={() => connectDevice(device)}>
                    <IonIcon slot="start" icon={bluetoothOutline} />
                    <IonLabel>
                      <h2>{label}</h2>
                      <p>{subtitle}</p>
                    </IonLabel>
                    {isSaved && <IonIcon slot="end" icon={checkmarkCircleOutline} color="success" />}
                    {isConnecting && <IonSpinner slot="end" name="crescent" />}
                  </IonItem>
                );
              })}
            </IonList>
          </IonContent>
        </IonModal>
      </IonContent>
    </IonPage>
  );
};

export default Settings;
