import { Redirect, Route } from 'react-router-dom';
import {
  IonApp,
  IonIcon,
  IonLabel,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonTabs,
  setupIonicReact
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { ellipse, home, square, triangle } from 'ionicons/icons';
import Home from './pages/Home';
import ScanQrPage from './pages/ScanQrPage';
import Profile from './pages/Profile';
import Trips from './pages/Trips';
import TripDetail from './pages/TripDetail';
import TicketDetail from './pages/TicketDetail';
import Sigin from './pages/Sigin';
import ShiftHistory from './pages/ShiftHistory';
import CustomTabBar from './components/CustomTabBar';
import React, { useEffect, useState } from 'react';
import { ForegroundService, ServiceType } from '@capawesome-team/capacitor-android-foreground-service';
import { Capacitor } from '@capacitor/core';
import { logoutApi } from './http/api';

/* Core CSS required for Ionic components to work properly */
import '@ionic/react/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

/* Optional CSS utils that can be commented out */
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

/**
 * Ionic Dark Mode
import PlanChair from './pages/PlanChair';
 * -----------------------------------------------------
 * For more info, please see:
 * https://ionicframework.com/docs/theming/dark-mode
 */

/* import '@ionic/react/css/palettes/dark.always.css'; */
/* import '@ionic/react/css/palettes/dark.class.css'; */
import '@ionic/react/css/palettes/dark.system.css';

/* Theme variables */
import './theme/variables.css';
import PlanChair from './pages/PlanChair';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBusSide, faClipboardList, faQrcode } from '@fortawesome/free-solid-svg-icons';
import { faHouse, faUser } from '@fortawesome/free-regular-svg-icons';

setupIonicReact();

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(typeof window !== 'undefined' && localStorage.getItem('isAuthenticated') === 'true');

  const logout = async () => {
    try {
      const sessionRaw = localStorage.getItem('session');
      const session = sessionRaw ? JSON.parse(sessionRaw) : null;
      await logoutApi(session?.refresh_token);
    } catch (err) {
      console.warn('Logout API error', err);
    } finally {
      localStorage.removeItem('isAuthenticated');
      localStorage.removeItem('username');
      localStorage.removeItem('role');
      localStorage.removeItem('user');
      localStorage.removeItem('session');
      window.location.href = '/signin';
    }
  };

  const getExpiryFromSession = (session: any): number | null => {
    if (!session) return null;

    // 1. Try to find an absolute expiration time
    const expiry = session.expires_at || session.expires_in;
    if (expiry) {
      // Handle ISO strings (like moment().format())
      if (typeof expiry === 'string') {
        const parsed = Date.parse(expiry);
        if (!isNaN(parsed)) return parsed;
      }

      // Handle numbers
      const val = Number(expiry);
      if (!isNaN(val)) {
        if (val > 1000000000000) return val; // Already in ms
        if (val > 1000000000) return val * 1000; // Seconds timestamp -> ms
        // Small numbers are likely durations in seconds; risky without issued_at, 
        // but fallback to current time + duration.
        return Date.now() + val * 1000;
      }
    }

    // 2. Fallback: try decode access_token (JWT) to get 'exp' claim
    try {
      const token = session.access_token || session.token;
      if (token) {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          if (payload && payload.exp) {
            return Number(payload.exp) * 1000;
          }
        }
      }
    } catch (e) {
      // ignore decoding errors
    }

    return null;
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let timeoutId: number | null = null;

    const clearExistingTimeout = () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    const setupTimeoutFromSession = () => {
      clearExistingTimeout();
      const sessionRaw = localStorage.getItem('session');
      let expiry = null as number | null;
      try {
        const sessionObj = sessionRaw ? JSON.parse(sessionRaw) : null;
        expiry = getExpiryFromSession(sessionObj);
      } catch (e) {
        expiry = null;
      }

      if (expiry) {
        const ms = expiry - Date.now();
        // console.log(`[Session] Expires in ${Math.round(ms / 1000 / 60)} minutes (${new Date(expiry).toLocaleTimeString()})`);

        if (ms <= 0) {
          console.log('[Session] Session expired, logging out...');
          logout();
          return;
        }

        // Set a timer for exact expiry
        timeoutId = window.setTimeout(() => {
          console.log('[Session] Timer reached, logging out...');
          logout();
        }, ms) as unknown as number;
      } else {
        console.log('[Session] No active session expiry found');
      }
    };

    // initial setup
    setupTimeoutFromSession();

    // Request permissions and restore service on launch for Android
    if (Capacitor.getPlatform() === 'android') {
      // 1. Check/Request Permissions
      ForegroundService.checkPermissions().then((status) => {
        if (status.display !== 'granted') {
          ForegroundService.requestPermissions().catch(console.error);
        }
      });

      // 2. Restore Foreground Service if an active shift is detected
      const activeShiftId = localStorage.getItem('active_shift_id');
      if (activeShiftId) {
        console.log(`[ForegroundService] Active shift detected (${activeShiftId}), restoring service...`);

        ForegroundService.createNotificationChannel({
          id: "service_channel",
          name: "ระบบติดตามเที่ยวรถ",
          description: "ใช้สำหรับการแจ้งเตือนเมื่อกำลังอยู่ในกะ",
          importance: 3
        }).then(() => {
          ForegroundService.startForegroundService({
            id: 12345,
            title: "กำลังอยู่ในกะ",
            body: "ระบบติดตามพิกัดรถกำลังทำงานในเบื้องหลัง",
            smallIcon: "ic_launcher_foreground",
            notificationChannelId: "service_channel",
            serviceType: ServiceType.Location,
          }).catch(console.error);
        }).catch(console.error);
      }
    }

    // Periodic check every 60 seconds (backup for throttled timers on mobile)
    const intervalId = window.setInterval(() => {
      setupTimeoutFromSession();
    }, 60000);

    // storage event to sync logout/login across tabs
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      if (e.key === 'isAuthenticated') {
        const auth = localStorage.getItem('isAuthenticated') === 'true';
        setIsAuthenticated(auth);
        if (!auth) {
          logout();
        }
      }
      if (e.key === 'session') {
        setupTimeoutFromSession();
      }
    };

    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.clearInterval(intervalId);
      clearExistingTimeout();
    };
  }, []);
  return (
    <IonApp>
      <IonReactRouter>
        <IonTabs>
          <IonRouterOutlet>
            <Route path="/plan/:id" exact>
              {isAuthenticated ? <PlanChair /> : <Redirect to="/signin" />}
            </Route>
            <Route exact path="/signin">
              <Sigin />
            </Route>
            <Route exact path="/home">
              {isAuthenticated ? <Home /> : <Redirect to="/signin" />}
            </Route>
            <Route exact path="/scanQrPage">
              {isAuthenticated ? <ScanQrPage /> : <Redirect to="/signin" />}
            </Route>
            <Route path="/profile">
              {isAuthenticated ? <Profile /> : <Redirect to="/signin" />}
            </Route>
            <Route exact path="/trips">
              {isAuthenticated ? <Trips /> : <Redirect to="/signin" />}
            </Route>
            <Route path="/trip/:id">
              {isAuthenticated ? <TripDetail /> : <Redirect to="/signin" />}
            </Route>
            <Route path="/ticket/:id">
              {isAuthenticated ? <TicketDetail /> : <Redirect to="/signin" />}
            </Route>
            <Route path="/shift-history">
              {isAuthenticated ? <ShiftHistory /> : <Redirect to="/signin" />}
            </Route>
            <Route path="/scan-qr/:tripId">
              {isAuthenticated ? <ScanQrPage /> : <Redirect to="/signin" />}
            </Route>
            <Route exact path="/">
              <Redirect to={isAuthenticated ? '/home' : '/signin'} />
            </Route>
          </IonRouterOutlet>
          {isAuthenticated && <CustomTabBar />}
        </IonTabs>
      </IonReactRouter>
    </IonApp>
  );
};

export default App;
