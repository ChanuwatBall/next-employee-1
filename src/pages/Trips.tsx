import { IonChip, IonContent, IonHeader, IonLabel, IonLoading, IonPage, IonSearchbar, IonSegment, IonSegmentButton, IonText, IonToolbar, IonButton, IonRefresher, IonRefresherContent } from '@ionic/react';
import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faClock } from '@fortawesome/free-regular-svg-icons'
import { useHistory } from 'react-router-dom';

import './css/Home.css';
import moment from 'moment';
import { BouceAnimation } from '../components/Animations';
moment.locale('th');

import { Trip } from '../types/trip';
import { getDriverTrips } from '../http/api';
import CardTrip from '../components/CardTrip';
import CardTripSkeleton from '../components/CardTripSkeleton';
import { t } from 'i18next';

const Trips: React.FC = () => {
  const history = useHistory();
  const [query, setQuery] = useState('');
  const [trips, setTrips] = useState<Trip[]>([]);
  const [segment, setSegment] = useState<'active' | 'ended'>('active');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(moment());
  const [driverMe, setDriverMe] = useState<any>(null);

  const getdriverTrips = async (date: moment.Moment) => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('session') ? JSON.parse(localStorage.getItem('session') || '{}').access_token : null;
      const tripsData: any[] = await getDriverTrips(date.format('YYYY-MM-DD'), token);
      console.log("tripsData ", tripsData)

      setTrips(tripsData);
    } catch (e) {
      console.error(e);
      setIsLoading(false);
    } finally {
      setIsLoading(false);
    }
  }

  const doRefresh = async (event: CustomEvent) => {
    await getdriverTrips(selectedDate);
    event.detail.complete();
  };

  useEffect(() => {
    const getDriver=()=>{ 
      const driverMe = localStorage.getItem('driver_me'); 
      if (driverMe) {  
        const meData = JSON.parse(driverMe);
        setDriverMe(meData);
      }
    }
    getDriver()
    getdriverTrips(selectedDate);
  }, [selectedDate]);

  const dates = Array.from({ length: 30 }, (_, i) => moment().startOf("month").add(i, 'days'));

   
  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar color="primary">
          <div className="ion-padding">
            <IonText color="light">
              <h2 className="text-xl font-bold" style={{ color: '#FFF' }}>เที่ยวรถทั้งหมด</h2>
            </IonText>
            <IonText color="light">
              <div className="text-sm" style={{ color: '#FFF' }}>จัดการเที่ยวการเดินทางของคุณ {driverMe?.user?.full_name }</div>
            </IonText>
          </div>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding dashboard-content">
        <IonRefresher slot="fixed" onIonRefresh={doRefresh}>
          <IonRefresherContent />
        </IonRefresher>
        <div className="tab-bar-padding" style={{ width: '100%', height: '100%' }}>
          <div className="flex overflow-x-auto  no-scrollbar " style={{ WebkitOverflowScrolling: 'touch', padding: "5px" }}>
            {dates.map((date, index) => {
              const isSelected = date.isSame(selectedDate, 'day');
              const isToday = date.isSame(moment(), 'day');
              return (
                <div
                  key={index}
                  onClick={() => setSelectedDate(date)} style={{ marginRight: "5px" }}
                  className={`flex flex-col items-center justify-center min-w-[60px] h-[80px] rounded-2xl transition-all duration-200 cursor-pointer ${isSelected ? 'bg-primary text-white shadow-lg scale-105' : 'bg-white text-gray-400'}`}
                >
                  <span className="text-[10px] font-medium uppercase mb-1">
                    {t(date.locale('th').format('ddd'))}
                  </span>
                  <span className={`text-xl font-bold ${isSelected ? 'text-white' : 'text-gray-800'}`}>
                    {date.format('D')}
                  </span>
                  {isToday && !isSelected && (
                    <div className="w-1 h-1 bg-primary rounded-full mt-1" />
                  )}
                </div>
              );
            })}
          </div>
          <br />
          <IonSearchbar
            mode="ios" style={{ backgroundColor: 'var(--ion-color-white)' }}
            placeholder="ค้นหาเที่ยวรถ..."
            className="ion-no-padding search-trip"
            value={query}
            onIonInput={(e: any) => setQuery(e.detail?.value ?? '')}
          />
          <br />

          <IonSegment mode="md" value={segment} onIonChange={(e) => setSegment(e.detail.value as any)} className="mb-4">
            <IonSegmentButton value="scheduled">
              <IonLabel color={"dark"} >เที่ยวปัจจุบัน</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="ended">
              <IonLabel color={"dark"} >สิ้นสุดแล้ว</IonLabel>
            </IonSegmentButton>
          </IonSegment>

          <div className="ion-padding-vertical">
            <IonText className="text-lg font-semibold">
              <strong>รายการเที่ยวรถ</strong>
            </IonText>
          </div>

          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <CardTripSkeleton key={i} />)
          ) : trips.length > 0 ? (
            trips.map((trip, index) => (
              <BouceAnimation duration={(index + 2) / 10} className="card-executive" key={trip.tripId}>
                <CardTrip
                  busNumber={trip.busNumber}
                  title={`${trip.origin} - ${trip.destination}`}
                  time={trip.departureTime}
                  arrive={trip.arrivalTime}
                  tripdate={trip.date}
                  passengerOnboard={trip.checkedIn}
                  totalPassenger={trip.totalSeats}
                  isOnBoard={moment(`${trip.date} ${trip?.departureTime}`).isBefore(moment()) && moment(`${trip.date} ${trip?.arrivalTime}`).isAfter(moment())}
                  isEnded={moment(`${trip.date} ${trip?.arrivalTime}`).isBefore(moment())}
                  select={() => {history.push(`/trip/${trip.tripId}`); localStorage.setItem('company', JSON.stringify(trip?.company));}}
                />
              </BouceAnimation>
            ))
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--ion-color-medium)' }}>
              ไม่มีข้อมูลเที่ยวรถในวันที่เลือก
            </div>
          )}
        </div>

      </IonContent>
    </IonPage>
  );
};

export default Trips;
