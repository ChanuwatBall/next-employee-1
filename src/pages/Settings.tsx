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
} from '@ionic/react';
import {
  bluetoothOutline,
  checkmarkCircleOutline,
  chevronForwardOutline,
  closeCircleOutline,
  printOutline,
  refreshOutline,
} from 'ionicons/icons';
import { useBluetoothPrinter, BluetoothDevice } from '../hooks/useBluetoothPrinter';

const PRINTER_STORAGE_KEY = 'selected_printer_device';

type SavedPrinter = {
  name: string;
  id: string;
  address: string;
};

const Settings: React.FC = () => {
  const { devices, scanning, connectedAddress, scan, connect, disconnect, requestPermission } = useBluetoothPrinter();
  const [showPrinterModal, setShowPrinterModal] = useState(false);
  const [connectingAddress, setConnectingAddress] = useState<string | null>(null);
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
      const leftName = left.name?.trim() || left.address || '';
      const rightName = right.name?.trim() || right.address || '';
      return leftName.localeCompare(rightName);
    });
  }, [devices]);

  const savePrinter = (device: BluetoothDevice) => {
    const payload: SavedPrinter = {
      name: device.name?.trim() || device.address || '',
      id: device.id || '',
      address: device.address || '',
    };

    localStorage.setItem(PRINTER_STORAGE_KEY, JSON.stringify(payload));
    setSavedPrinter(payload);
  };

  const openPrinterModal = async () => {
    // ขอ permission ก่อนเปิด modal
    const granted = await requestPermission();
    if (!granted) {
      return;
    }

    setShowPrinterModal(true);
    if (!devices.length) {
      await scan();
    }
  };

  const connectDevice = async (device: BluetoothDevice) => {
    if (!device.address) return;
    
    setConnectingAddress(device.address);
    try {
      const success = await connect(device.address);
      if (success) {
        savePrinter(device);
      }
    } finally {
      setConnectingAddress(null);
    }
  };

  const disconnectPrinter = async () => {
    await disconnect();
    localStorage.removeItem(PRINTER_STORAGE_KEY);
    setSavedPrinter(null);
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
                <IonButton onClick={scan} disabled={scanning}  style={{fontSize: '.8em'}}>
                  <IonIcon slot="start" icon={refreshOutline} />
                  <IonLabel >สแกนใหม่</IonLabel>
                </IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>

          <IonContent className="ion-padding">
            <IonButton expand="block" onClick={scan} disabled={scanning}>
              {scanning ? <IonSpinner name="crescent" slot="start" /> : <IonIcon icon={bluetoothOutline} slot="start" />}
              {scanning ? 'กำลังสแกน Bluetooth...' : 'สแกนอุปกรณ์ Bluetooth'}
            </IonButton>

            {savedPrinter && (
              <IonCard style={{ marginTop: 16 }}>
                <IonCardContent>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <IonText color="success">
                        <p style={{ margin: 0 }}>
                          เครื่องที่บันทึกไว้: {savedPrinter.name} ({savedPrinter.address})
                        </p>
                      </IonText>
                    </div>
                    <IonButton size="small" color="danger" onClick={disconnectPrinter}>
                      <IonIcon slot="start" icon={closeCircleOutline} />
                      ยกเลิก
                    </IonButton>
                  </div>
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

