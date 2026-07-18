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
  chevronBackOutline,
  chevronForwardOutline,
  closeCircleOutline,
  printOutline,
  refreshOutline,
} from 'ionicons/icons';
import { useBluetoothPrinter, BluetoothDevice } from '../hooks/useBluetoothPrinter';
import "./css/Setting.css"
import { useHistory } from 'react-router';

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
  const history = useHistory();

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
      <IonContent fullscreen className="ion-padding">
      <IonHeader mode="md" className="ion-no-border">
         <IonToolbar color={"transparent"} style={{  display:"flex" , flexDirection:"row" ,  justifyContent:"flex-start" , }}>
             <IonButton color="dark" fill='clear' onClick={() => history.goBack()} style={{marginLeft: -10}}>
              <IonIcon icon={chevronBackOutline} />
              <IonLabel>Setting</IonLabel>
             </IonButton>  
        </IonToolbar>
      </IonHeader>

        <IonCard mode="ios" className='printer-card ion-no-margin ion-margin-vertical'   >
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

        <IonModal mode='ios' isOpen={showPrinterModal} onDidDismiss={() => setShowPrinterModal(false)} initialBreakpoint={0.9} breakpoints={[0, 0.9]}>
          <IonHeader mode='md' className='ion-no-border' >
            <IonToolbar>
              <IonTitle>Bluetooth Printer</IonTitle>
               
              <IonButtons slot="end">
                <IonButton onClick={() => setShowPrinterModal(false)}>ปิด</IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>

          <IonContent className="ion-padding">
            

             
              <div style={{width:"100%", display:"flex",flexDirection:"row",justifyContent:"space-between"}} >
                <IonLabel>อุปกรณ์ที่จับคู่</IonLabel>
                <IonButton fill='clear' size="small" onClick={scan} disabled={scanning}>
                  {scanning ? <IonSpinner name="crescent" slot="start" /> : <IonIcon icon={bluetoothOutline} slot="start" />}
                  {scanning ? ' Scanning..' : 'Scan'}
                </IonButton>
              </div>
              <IonCard className='ion-no-margin' mode="ios" style={{ marginTop: 16 }}>
                <IonCardContent>
                   {savedPrinter ? (<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1 }} onClick={disconnectPrinter}>
                      <IonText color="dark">
                        <p style={{ margin: 0 }}>
                          เครื่องที่บันทึกไว้: {savedPrinter.name} ({savedPrinter.address})
                        </p>
                      </IonText>
                    </div> 
                  </div> ):
                   <IonText style={{fontSize: '.9em'}} > ไม่พบอุปกรณ์ที่บันทึกไว้ </IonText>  
                  }
                </IonCardContent>
              </IonCard>

            <IonList style={{ marginTop: 16 }}>
              {sortedDevices.length === 0 && !scanning && (
                <IonItem lines="none">
                  <IonLabel>
                    <h2>ยังไม่พบอุปกรณ์</h2>
                    <p>กดสแกนเพื่อค้นหา Bluetooth printer รอบตัว</p>
                  </IonLabel>
                </IonItem>
              )}

             <div style={{width:"100%", display:"flex",flexDirection:"row",justifyContent:"space-between"}} >
                <IonLabel>อุปกรณ์ที่พบ</IonLabel>
                <IonButton fill='clear' size="small" onClick={scan} disabled={scanning}>
                  {scanning ? <IonSpinner name="crescent" slot="start" /> : <IonIcon icon={bluetoothOutline} slot="start" />}
                  {scanning ? ' Scanning..' : 'Scan'}
                </IonButton>
              </div>
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

