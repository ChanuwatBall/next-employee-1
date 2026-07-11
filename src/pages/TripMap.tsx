import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { IonBackButton, IonButtons, IonContent, IonHeader, IonPage, IonSpinner, IonTitle, IonToolbar } from '@ionic/react';
import { useParams } from 'react-router-dom';
import { MapContainer, Marker, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet';
import L, { type LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './css/TripMap.css';
import { Geolocation } from '@capacitor/geolocation'; 
import { TripPassengerLocationItem, getTripDetail, getTripPassengerLocations, getBusStops } from '../http/api';
 
type Position = {
  lat: number;
  lng: number;
};

type BusStopMarker = {
  id: string;
  name: string;
  type: string;
  stopOrder: number;
  lat: number;
  lng: number;
};

const driverIcon = L.divIcon({
  className: 'driver-marker',
  html: '<div class="driver-marker-bus" aria-label="driver-bus-marker"> <img src="/assets/svg/bus.svg" alt="bus" /></div>',
  iconAnchor: [26, 26], iconSize: [34, 34],
});

const busStopIcon = L.divIcon({
  className: 'bus-stop-marker',
  html: '<div><img src="/assets/svg/bus-stop.svg" alt="bus stop" /></div>',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

const passengerIcon = L.divIcon({
  className: 'passenger-marker',
  html: `<div class=" " aria-label="passenger-marker"><img src="/assets/svg/passenger.svg" alt="passenger" /></div>`,
  iconAnchor: [26, 52],
});

const isValidCoordinate = (value: unknown) => typeof value === 'number' && Number.isFinite(value);

const parseCoordinate = (value: unknown) => {
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  return null;
};

const MapAutoCenter: React.FC<{ position: Position | null }> = ({ position }) => {
  const map = useMap();

  useEffect(() => {
    if (!position) {
      return;
    }

    map.setView([position.lat, position.lng], Math.max(map.getZoom(), 13), {
      animate: true,
      duration: 0.8,
    });
  }, [map, position]);

  return null;
};

const TripMap: React.FC = () => {
  const { tripId } = useParams<{ tripId: string }>();
  const [driverPosition, setDriverPosition] = useState<Position | null>(null);
  const [busStops, setBusStops] = useState<BusStopMarker[]>([]);
  const [passengers, setPassengers] = useState<TripPassengerLocationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadBusStopsAndPassengers = useCallback(async () => {
    try {
      const [tripData, passengersData] = await Promise.all([
        getTripDetail(tripId),
        getTripPassengerLocations(tripId),
      ]);

      const routeId = tripData?.route_id?.id || tripData?.routeId;
      const fetchedBusStops = routeId
        ? await getBusStops(routeId, {
            originProvinceId: tripData?.origin_province_id,
            destinationProvinceId: tripData?.destination_province_id,
            origin: tripData?.route_id?.origin,
            destination: tripData?.route_id?.destination,
          })
        : [];

      const mappedBusStops = Array.isArray(fetchedBusStops)
        ? fetchedBusStops
            .map((stop: any) => {
              const lat = parseCoordinate(stop.lat);
              const lng = parseCoordinate(stop.lng);

              if (!isValidCoordinate(lat) || !isValidCoordinate(lng)) {
                return null;
              }

              return {
                id: stop.id,
                name: stop.name,
                type: stop.type,
                stopOrder: Number(stop.stopOrder ?? stop.order ?? 0),
                lat,
                lng,
              } as BusStopMarker;
            })
            .filter((stop: BusStopMarker | null): stop is BusStopMarker => stop !== null)
        : [];
     console.log("mappedBusStops ", mappedBusStops)
      const mappedPassengers = (passengersData?.passengers || []).filter(
        (passenger:any) =>
          isValidCoordinate(passenger.latitude) &&
          isValidCoordinate(passenger.longitude),
      );

      setBusStops(mappedBusStops);
      setPassengers(mappedPassengers);
      setErrorMessage(null);
    } catch (error) {
      console.error(error);
      setErrorMessage('ไม่สามารถโหลดข้อมูลแผนที่ได้');
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    const getDriverCurrentPosition = async () => {
      try {
        const currentPermission = await Geolocation.checkPermissions();
        const hasPermission =
          currentPermission.location === 'granted' ||
          currentPermission.coarseLocation === 'granted';

        if (!hasPermission) {
          const requestedPermission = await Geolocation.requestPermissions();
          const grantedAfterRequest =
            requestedPermission.location === 'granted' ||
            requestedPermission.coarseLocation === 'granted';

          if (!grantedAfterRequest) {
            setErrorMessage('ไม่สามารถเข้าถึงตำแหน่งปัจจุบันของคนขับ');
            return;
          }
        }

        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 2000,
        });

        setDriverPosition({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      } catch (error) {
        console.error(error);
        setErrorMessage('ดึงตำแหน่งปัจจุบันของคนขับไม่สำเร็จ');
      }
    };

    void getDriverCurrentPosition();
  }, []);

  useEffect(() => {
    void loadBusStopsAndPassengers();

    const interval = window.setInterval(() => {
      void loadBusStopsAndPassengers();
    }, 15000);

    return () => {
      window.clearInterval(interval);
    };
  }, [loadBusStopsAndPassengers]);

  const mapCenter = useMemo<LatLngExpression>(() => {
    if (driverPosition) {
      return [driverPosition.lat, driverPosition.lng];
    }

    if (passengers.length > 0) {
      return [passengers[0].latitude, passengers[0].longitude];
    }

    if (busStops.length > 0) {
      return [busStops[0].lat, busStops[0].lng];
    }

    return [13.7563, 100.5018];
  }, [busStops, driverPosition, passengers]);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonButtons slot="start">
            <IonBackButton defaultHref={`/trip/${tripId}`} />
          </IonButtons>
          <IonTitle>แผนที่เที่ยวรถ</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen>
        {loading ? (
          <div className="trip-map-loading">
            <IonSpinner name="crescent" />
            <p>กำลังโหลดข้อมูลแผนที่...</p>
          </div>
        ) : (
          <MapContainer center={mapCenter} zoom={13} className="trip-map-container">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MapAutoCenter position={driverPosition} />

            {driverPosition && (
              <Marker position={[driverPosition.lat, driverPosition.lng]} icon={driverIcon}>
                <Popup>
                  ตำแหน่งปัจจุบันของคนขับ
                  <br />
                  lat: {driverPosition.lat.toFixed(6)}
                  <br />
                  lng: {driverPosition.lng.toFixed(6)}
                </Popup>
              </Marker>
            )}

            {busStops.map((stop) => (
              <Marker key={stop.id} position={[stop.lat, stop.lng]} icon={busStopIcon}>
                <Tooltip className="marker-tooltip" direction="top" offset={[0, -10]} opacity={1} permanent>
                  {stop.stopOrder} {stop.name}
                </Tooltip> 
              </Marker>
            ))}

            {passengers.map((passenger) => (
              <Marker
                key={passenger.booking_id}
                position={[passenger.latitude, passenger.longitude]}
                icon={passengerIcon}
              >
                <Popup>
                  ผู้โดยสาร: {passenger.passenger_name}
                  <br />
                  booking: {passenger.booking_reference}
                  <br />
                  seats: {(passenger.seats || []).join(', ') || '-'}
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}

        {errorMessage && <div className="trip-map-error">{errorMessage}</div>}
      </IonContent>
    </IonPage>
  );
};

export default TripMap;
