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
import Settings from './pages/Settings';
import Trips from './pages/Trips';
import TripDetail from './pages/TripDetail';
import TripMap from './pages/TripMap';
import TicketDetail from './pages/TicketDetail';
import SellTicket from './pages/SellTicket';
import Sigin from './pages/Sigin';
import ShiftHistory from './pages/ShiftHistory';
import CustomTabBar from './components/CustomTabBar';
import React, { useEffect, useState } from 'react';
import { ForegroundService, ServiceType } from '@capawesome-team/capacitor-android-foreground-service';
import { Capacitor } from '@capacitor/core';
import { getPreferences, logoutApi } from './http/api';

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

const normalizeHexColor = (value: string) => {
  const trimmed = value.trim();

  if (/^#([0-9a-fA-F]{3})$/.test(trimmed)) {
    return `#${trimmed.slice(1).split('').map((character) => character + character).join('')}`;
  }

  return /^#([0-9a-fA-F]{6})$/.test(trimmed) ? trimmed : null;
};

const hexToRgb = (value: string) => {
  const normalized = normalizeHexColor(value);

  if (!normalized) {
    return null;
  }

  const red = Number.parseInt(normalized.slice(1, 3), 16);
  const green = Number.parseInt(normalized.slice(3, 5), 16);
  const blue = Number.parseInt(normalized.slice(5, 7), 16);

  return { red, green, blue };
};

const rgbToHex = (red: number, green: number, blue: number) => {
  const toHex = (channel: number) => channel.toString(16).padStart(2, '0');
  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
};

const mixColor = (value: string, target: [number, number, number], ratio: number) => {
  const rgb = hexToRgb(value);

  if (!rgb) {
    return null;
  }

  const blend = (channel: number, targetChannel: number) =>
    Math.round(channel + (targetChannel - channel) * ratio);

  return rgbToHex(blend(rgb.red, target[0]), blend(rgb.green, target[1]), blend(rgb.blue, target[2]));
};

const getContrastColor = (value: string) => {
  const rgb = hexToRgb(value);

  if (!rgb) {
    return '#ffffff';
  }

  const luminance = (rgb.red * 299 + rgb.green * 587 + rgb.blue * 114) / 1000;
  return luminance > 150 ? '#111111' : '#ffffff';
};

const applyThemeFromPreferences = (preferences: { colorPrimary?: string; colorSecondary?: string }) => {
  if (typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;
  const { colorPrimary, colorSecondary } = preferences;

  const applyColor = (prefix: 'primary' | 'secondary', color?: string) => {
    const normalized = color ? normalizeHexColor(color) : null;

    if (!normalized) {
      return;
    }

    const rgb = hexToRgb(normalized);
    if (!rgb) {
      return;
    }

    const shade = mixColor(normalized, [0, 0, 0], 0.12) ?? normalized;
    const tint = mixColor(normalized, [255, 255, 255], 0.12) ?? normalized;
    const contrast = getContrastColor(normalized);
    const contrastRgb = hexToRgb(contrast);

    root.style.setProperty(`--ion-color-${prefix}`, normalized);
    root.style.setProperty(`--ion-color-${prefix}-rgb`, `${rgb.red}, ${rgb.green}, ${rgb.blue}`);
    root.style.setProperty(`--ion-color-${prefix}-shade`, shade);
    root.style.setProperty(`--ion-color-${prefix}-tint`, tint);
    root.style.setProperty(`--ion-color-${prefix}-contrast`, contrast);

    if (contrastRgb) {
      root.style.setProperty(`--ion-color-${prefix}-contrast-rgb`, `${contrastRgb.red}, ${contrastRgb.green}, ${contrastRgb.blue}`);
    }
  };

  applyColor('primary', colorPrimary);
  applyColor('secondary', colorSecondary);
};

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

    const fetchPreferences = async () => {
      try {
        const preferences = await getPreferences();
        console.log('Fetched app preferences', preferences);
        applyThemeFromPreferences(preferences);
      } catch (error) {
        console.warn('Failed to load app preferences', error);
      }
    };

    void fetchPreferences();

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
            <Route path="/plan/:id/sell" exact>
              {isAuthenticated ? <SellTicket /> : <Redirect to="/signin" />}
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
            <Route exact path="/settings">
              {isAuthenticated ? <Settings /> : <Redirect to="signin" />}
            </Route>
            <Route exact path="/trips">
              {isAuthenticated ? <Trips /> : <Redirect to="/signin" />}
            </Route>
            <Route path="/trip/:tripId/map" exact>
              {isAuthenticated ? <TripMap /> : <Redirect to="/signin" />}
            </Route>
            <Route path="/trip/:id" exact>
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
