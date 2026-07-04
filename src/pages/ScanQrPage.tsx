import React, { useRef, useState } from "react";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonButtons,
  IonContent,
  useIonViewDidEnter,
  useIonViewWillLeave,
  useIonAlert,
  IonButton,
  IonIcon,
  IonText,
} from "@ionic/react";
import { BarcodeScanner } from "@capacitor-mlkit/barcode-scanning";
import "./css/ScanQrPage.css";
import { arrowBackCircleOutline } from "ionicons/icons";
import { useHistory, useLocation, useParams } from "react-router";
import { getDriverTrips } from "../http/api";
import moment from "moment";

const setScanningUi = (on: boolean) => {
  const html = document.documentElement;
  const body = document.body;
  const app = document.querySelector("ion-app");
  const tabbar = document.querySelector("ion-tab-bar");

  if (on) {
    html.classList.add("scanning");
    body.classList.add("scanning");
    app?.classList.add("scanning");
    tabbar?.classList.add("scanning");
  } else {
    html.classList.remove("scanning");
    body.classList.remove("scanning");
    app?.classList.remove("scanning");
    tabbar?.classList.remove("scanning");
  }
};

const ScanQrPage: React.FC = () => {
  const { tripId } = useParams<{ tripId?: string }>();
  const [scanning, setScanning] = useState(false);
  const scannedOnce = useRef(false);
  const listenerRef = useRef<any>(null);
  const history = useHistory();
  const location = useLocation();
  const [ionalert, dimissIonAlert] = useIonAlert();

  const stop = async () => {
    try { await BarcodeScanner.stopScan(); } catch { }
    if (listenerRef.current) {
      try { listenerRef.current.remove(); } catch { }
      listenerRef.current = null;
    }
    document.querySelector("body")?.classList.remove("barcode-scanner-active");
    setScanningUi(false);
    setScanning(false);
  };

  /** Show an alert that resets scannedOnce so the user can scan again */
  const alertAndRetry = (header: string, message: string) => {
    ionalert({
      header,
      message,
      buttons: [{
        text: "ตกลง",
        role: "cancel",
        handler: () => {
          scannedOnce.current = false;
          dimissIonAlert();
        }
      }]
    });
  };

  const validateAndOpenTicket = async (code: string, shouldStopScanner = false) => {
    let qrDetail: any = null;
    try {
      qrDetail = JSON.parse(atob(code));
      console.log("[ScanQr] qrDetail:", JSON.stringify(qrDetail));
    } catch {
      alertAndRetry("QR ไม่ถูกต้อง", "ไม่สามารถอ่านข้อมูล QR ได้ กรุณาลองใหม่อีกครั้ง");
      return;
    }

    const scannedTripId: string = qrDetail?.trip ?? "";

    if (tripId != undefined && tripId !== null) {
      console.log("[ScanQr] tripId param exists, validating against it:", tripId, "scannedTripId:", scannedTripId);
      if (tripId) {
        if (tripId !== scannedTripId) {
          alertAndRetry("เที่ยวรถไม่ถูกต้อง", "QR ที่สแกนไม่ตรงกับเที่ยวนี้ กรุณาลองใหม่อีกครั้ง");
          return;
        }
        history.push(`/ticket/${code}`);
        if (shouldStopScanner) await stop();
        return;
      }
    }

    try {
      console.log("[ScanQr] no param tripId, checking against today's trips...");

      const sessionStr = localStorage.getItem("session");
      const token: string = sessionStr ? JSON.parse(sessionStr)?.access_token : "";
      const today = moment().format("YYYY-MM-DD");

      const trips = await getDriverTrips<any[]>(today, token);
      console.log("[ScanQr] getDriverTrips:", JSON.stringify(trips));
      const matched = Array.isArray(trips) && trips.find((t: any) => {
        console.log("t.tripId", t.tripId, " >< scannedTripId", scannedTripId);
        return t.tripId === scannedTripId;
      });
      console.log("[ScanQr] matched trip:", JSON.stringify(matched));
      if (matched) {
        history.push(`/ticket/${code}`);
        if (shouldStopScanner) await stop();
      } else {
        alertAndRetry("ไม่พบเที่ยวรถ", "QR นี้ไม่ตรงกับเที่ยวรถของคุณวันนี้ กรุณาตรวจสอบอีกครั้ง");
      }
    } catch (err) {
      console.error("[ScanQr] getDriverTrips error:", err);
      alertAndRetry("เกิดข้อผิดพลาด", "ไม่สามารถตรวจสอบข้อมูลเที่ยวรถได้ กรุณาลองใหม่");
    }
  };

  const start = async () => {
    scannedOnce.current = false;

    const perm = await BarcodeScanner.requestPermissions();
    if (perm.camera !== "granted") return;

    setScanningUi(true);
    setScanning(true);
    document.querySelector("body")?.classList.add("barcode-scanner-active");

    try {
      await BarcodeScanner.startScan();
    } catch {
      setScanningUi(false);
      setScanning(false);
      return;
    }

    listenerRef.current = await BarcodeScanner.addListener("barcodesScanned", async (event) => {
      if (scannedOnce.current) return;
      const code = event.barcodes?.[0]?.rawValue;
      if (!code) return;
      scannedOnce.current = true;
      await validateAndOpenTicket(code, true);
    });
  };

  useIonViewDidEnter(() => {
    const code = new URLSearchParams(location.search).get("code");
    if (code) {
      validateAndOpenTicket(code);
      return;
    }
    start();
  });
  useIonViewWillLeave(() => { stop(); });

  return (
    <IonPage className={scanning ? "scanning " : ""}>
      <IonHeader mode="md" className={scanning ? "scanning ion-no-border" : "ion-no-border"}>
        <IonToolbar className={scanning ? "scanning" : ""}>
          <IonButtons slot="start">
            <IonButton color="dark" onClick={() => history.goBack()}>
              <IonIcon icon={arrowBackCircleOutline} />&nbsp;&nbsp;&nbsp;&nbsp;
              <IonText className="text-lg">สแกน QR ตั๋ว</IonText>
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen className={scanning ? "scanning" : ""}>
        {scanning && (
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
            <div className="scan-frame" />
          </div>
        )}
      </IonContent>
    </IonPage>
  );
};

export default ScanQrPage;
