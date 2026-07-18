import { IonChip, IonContent, IonHeader, IonLabel, IonLoading, IonPage, IonSearchbar, IonSegment, IonSegmentButton, IonText, IonToolbar, IonButton, IonProgressBar, IonBadge, IonRefresher, IonRefresherContent, IonSkeletonText, useIonViewWillEnter, IonModal, IonTitle, IonButtons } from '@ionic/react';
import React, { useCallback, useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBus, faCarSide, faClipboardList, faQrcode, faUser, faArrowsRotate, faBusSide, faCoins, faCircleExclamation } from '@fortawesome/free-solid-svg-icons'
import { faClock } from '@fortawesome/free-regular-svg-icons'
import { useHistory } from 'react-router-dom';

import './css/Home.css'; 
import { BouceAnimation } from '../components/Animations';

import { Trip } from '../types/trip';
import { getDriverTrips, getDriverMe, DriverMeResponse, getDriverRounds } from '../http/api'; 
import CardTrip from '../components/CardTrip';
import CardTripSkeleton from '../components/CardTripSkeleton';
import ActiveShiftSkeleton from '../components/ActiveShiftSkeleton';
import StatsSkeleton from '../components/StatsSkeleton'; 
import moment from 'moment-timezone';
import { t } from 'i18next';
import { supabase } from '../supabase/client';

// Set default timezone to Bangkok (Asia/Bangkok)
moment.tz.setDefault('Asia/Bangkok');
moment.locale('th');


const Home: React.FC = () => {
  const history = useHistory();
  const [query, setQuery] = useState('');
  const [trips, setTrips] = useState<Trip[]>([]);
  const [driverMe, setDriverMe] = useState<DriverMeResponse | null>(null);
  const [segment, setSegment] = useState<any>('active');
  const [isLoading, setIsLoading] = useState(false);
  const [totalStats, setTotalStats] = useState<any>({ alerts: [], total_earnings: 0, earning_per_round: 0 });
  const [selectedDate, setSelectedDate] = useState(moment());
  const [isScrolled, setIsScrolled] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);

  const handleScroll = (ev: CustomEvent<any>) => {
    if (ev.detail.scrollTop > 40) {
      if (!isScrolled) setIsScrolled(true);
    } else {
      if (isScrolled) setIsScrolled(false);
    }
  };

  const doRefresh = async (event: CustomEvent) => {
    await fetchData(selectedDate);
    event.detail.complete();
  };

  const fetchData = async (date: moment.Moment) => {
    setIsLoading(true);
    try {
      const sessionStr = localStorage.getItem('session');
      const session = sessionStr ? JSON.parse(sessionStr) : null;
      const token = session?.access_token;

      if (!token) return;
      const { data: bks } = await supabase.from("bookings").select("*");
      console.log("bks", bks);

      const [tripsData, meData, roundsData] = await Promise.all([
        getDriverTrips(date.format('YYYY-MM-DD'), token),
        getDriverMe(token),
        getDriverRounds(10),
      ]);
      console.log("roundsData ", roundsData);
      setTrips(tripsData as any[]);
      setDriverMe(meData);
      console.log("meData ", meData);
      localStorage.setItem('driver_me', JSON.stringify(meData));

      // Sync active_shift_id with real-time status from API
      if (meData?.current_shift) {
        localStorage.setItem('active_shift_id', (meData.current_shift as any).trip_id || (meData.current_shift as any).id);
      } else {
        localStorage.removeItem('active_shift_id');
      }

      setTotalStats({
        alerts: roundsData?.data.filter((round: any) => round.alert_message != null),
        total_earnings: roundsData?.earnings_total || 0,
        earning_per_round: roundsData?.earning_per_round || meData.driver.earning_per_round || 0
      });
    } catch (e) {
      console.error(e);
      setIsLoading(false);
    } finally {
      setIsLoading(false);
    }
  }

  useIonViewWillEnter(() => {
    fetchData(selectedDate);
  });

  useEffect(() => {
    fetchData(selectedDate);
  }, [selectedDate]);

  const timecounter= `${moment().format("DD ")} ${t(moment().format("MMMM"))} ${moment().format("YYYY")}`;
  
  return (
    <IonPage>
      <IonHeader className="ion-no-border header-sticky">
        <IonToolbar className="ion-no-padding dashboard-header" color="primary">
          <div className={`dashboard-hero ion-padding ${isScrolled ? 'scrolled' : ''}`}>
            <div className="flex justify-between items-start greeting-container">
              <div>
                <IonText color="light">
                  <h2 className="text-2xl font-bold ion-no-margin greeting-text text-white">
                    {isLoading ? (
                      <IonSkeletonText animated style={{ width: '150px', height: '28px', background: 'rgba(255,255,255,0.2)' }} />
                    ) : (
                      ` ${driverMe?.user.full_name }`
                    )}
                  </h2>
                </IonText>
                <IonText color="light">
                  <p className="text-sm opacity-80 ion-no-margin subtitle-text text-white">
                    {timecounter}
                  </p>
                </IonText>
              </div>
              <div className="avatar-mini" onClick={() => history.push('/profile')}>
                {driverMe?.user.avatar_url ? (
                  <img src={driverMe.user.avatar_url} alt="avatar" />
                ) : (
                  <div className="avatar-placeholder ">
                    {driverMe?.user.full_name.charAt(0) || 'U'}
                  </div>
                )}
              </div>
            </div>
            <br />
            <div>
              {/* Section Alert */}
              {!isScrolled && totalStats.alerts && totalStats.alerts.length > 0 && (
                <div
                  onClick={() => { if (totalStats.alerts && totalStats.alerts.length > 0) setShowAlertModal(true); }}
                  style={{ color: '#ffc409', width: "100%", marginBottom: ".5rem", backgroundColor: "rgba(255, 255, 255, 0.3)", padding: ".5rem", borderRadius: "1rem" }}>
                  <FontAwesomeIcon icon={faCircleExclamation} size="sm" /> &nbsp;
                  <IonLabel className="text-white larger">{totalStats.alerts[0].alert_message} </IonLabel>
                </div>
              )}
            </div>
            {isLoading ? (
              <StatsSkeleton />
            ) : (
              <div className="stats-dashboard grid grid-cols-2" style={{ gap: 10 }}>

                <div
                  className="stat-card glass shadow-sm text-white relative"
                  onClick={() => { if (driverMe?.alerts && driverMe.alerts.length > 0) setShowAlertModal(true); }}
                  style={{ cursor: driverMe?.alerts && driverMe?.alerts.length > 0 ? 'pointer' : 'default', position: 'relative' }}
                >

                  <div className="stat-label  text-white larger" ><IonText  >
                    <FontAwesomeIcon icon={faBus} size="sm" />&nbsp;
                    รอบวันนี้</IonText></div>
                  <div className="stat-value text-white larger">
                    <IonText >{driverMe?.today_rounds_count || 0}/4</IonText></div>
                  <div className="stat-progress">
                    <IonProgressBar mode="ios" value={(driverMe?.today_rounds_count || 0) / 4} />
                  </div>
                </div>
                <div className="stat-card glass shadow-sm text-white">
                  <div className="stat-label text-white larger" >
                    <IonText >
                      <FontAwesomeIcon icon={faCoins} size="sm" />&nbsp;รายได้วันนี้</IonText></div>
                  <div className="stat-value text-white larger">
                    <IonText >{(driverMe?.today_earnings || 0).toLocaleString()} ฿</IonText>
                  </div>
                </div>
              </div>
            )}
          </div>
        </IonToolbar>
      </IonHeader>

      <IonContent className="dashboard-content" scrollEvents={true} onIonScroll={handleScroll}>
        <IonRefresher slot="fixed" onIonRefresh={doRefresh} >
          <IonRefresherContent />
        </IonRefresher>
        <div className="ion-padding tab-bar-padding" style={{ minHeight: "105vh" }}>
          {/* Active Round Info if exists or loading */}
          {isLoading ? (
            <ActiveShiftSkeleton />
          ) : !!driverMe?.current_shift && (
            <div className="active-shift-card">
              <IonToolbar color="success" className="active-shift-header">
                <div slot="start" className="active-shift-header-content">
                  <div className="status-dots">
                    <span>.</span><span>.</span><span>.</span>
                  </div>
                  <FontAwesomeIcon icon={faBusSide} className="text-white" />
                  <IonText color="light" style={{ fontSize: '0.85rem', fontWeight: '500', marginRight: "1rem" }}>
                    กำลังเข้ากะ
                  </IonText>
                </div>
              </IonToolbar>
              <div className="active-shift-body">
                <div className="active-shift-info">
                  <div>
                    <h3 className="active-shift-title">เที่ยวปัจจุบันของคุณ</h3>
                    <p className="active-shift-timestamp">เริ่มเมื่อ {moment((driverMe.current_shift as any).started_at).format('HH:mm')} น.</p>
                  </div>
                  <IonButton size="small" mode="ios" fill="outline" color="success" onClick={() => history.push('/trips')}>
                    ดูรายละเอียด
                  </IonButton>
                </div>
              </div>
            </div>
          )}



          {/* Main Actions */}
          <div className="grid grid-cols-2 ion-margin-vertical"  >
            <div className="action-button-card highlight" style={{ margin: "0 .2rem" }} onClick={() => history.push('/trips')}>
              <div className="action-icon">
                <FontAwesomeIcon icon={faBus} />
              </div>
              <div className="action-text">
                <span className="action-title">ดูเที่ยวรถ</span>
                <span className="action-sub">ผู้โดยสาร/Checkin</span>
              </div>
            </div>
            <div className="action-button-card" onClick={() => history.push('/shift-history')}>
              <div className="action-icon bg-purple-50 text-purple-600">
                <FontAwesomeIcon icon={faClipboardList} />
              </div>
              <div className="action-text">
                <span className="action-title" >ประวัติรอบ</span>
                <span className="action-sub">รายได้ย้อนหลัง</span>
              </div>
            </div>
          </div>

          <div className="section-header flex justify-between items-center mb-2">
            <h3 className="font-bold ion-no-margin " style={{ color: "var(--ion-color-dark)" }} >เที่ยวรถวันนี้</h3>
            <div className="flex gap-1">
              <IonButton size="small" fill="clear" color="medium" onClick={() => fetchData(selectedDate)}>
                <FontAwesomeIcon icon={faArrowsRotate} style={{ marginRight: '5px' }} /> รีโหลด
              </IonButton>
              <IonButton size="small" fill="clear" onClick={() => history.push('/trips')}>ดูทั้งหมด</IonButton>
            </div>
          </div>

          {isLoading ? (
            <div className="skeleton-container">
              {[1, 2, 3].map(i => <CardTripSkeleton key={i} />)}
            </div>
          ) : trips.length > 0 ? (
            trips.map((trip, index) => (
              <BouceAnimation duration={(index + 2) / 10} className="card-executive" key={trip.tripId}>
                <CardTrip
                  title={`${trip.origin} - ${trip.destination}`}
                  time={trip.departureTime}
                  arrive={trip.arrivalTime}
                  tripdate={trip.date}
                  passengerOnboard={trip.checkedIn}
                  totalPassenger={trip.totalSeats}
                  isOnBoard={moment(`${trip.date} ${trip?.departureTime}`).isBefore(moment()) && moment(`${trip.date} ${trip?.arrivalTime}`).isAfter(moment())}
                  isEnded={moment(`${trip.date} ${trip?.arrivalTime}`).isBefore(moment())}
                  select={() => {history.push(`/trip/${trip.tripId}` ) ; localStorage.setItem('company', JSON.stringify(trip?.company));}}
                  busNumber={trip.busNumber}
                />
              </BouceAnimation>
            ))
          ) : (
            <div className="empty-trips-container">
              <FontAwesomeIcon icon={faBus} className="empty-trips-icon" />
              <p className="empty-trips-text">ไม่มีเที่ยวรถในวันที่เลือก</p>
              <IonButton size="small" mode="ios" fill="outline" onClick={() => fetchData(selectedDate)}>
                <FontAwesomeIcon icon={faArrowsRotate} style={{ marginRight: '5px' }} /> กดรีโหลดข้อมูล
              </IonButton>
            </div>
          )}
        </div>
      </IonContent>
      {/* <IonLoading
        isOpen={isLoading && trips.length === 0}
        onDidDismiss={() => setIsLoading(false)}
        message="กำลังโหลดข้อมูลเที่ยวรถ..."
      /> */}

      <IonModal isOpen={showAlertModal} onDidDismiss={() => setShowAlertModal(false)} initialBreakpoint={0.75} breakpoints={[0, 0.75, 1]}>
        <IonHeader className="ion-no-border">
          <IonToolbar>
            <IonTitle className="font-bold" style={{ fontSize: '1.1rem' }}>การแจ้งเตือนรอบวิ่ง</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={() => setShowAlertModal(false)}>ปิด</IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <div className="alerts-section mt-2">
            {totalStats.alerts.map((alert: any) => (
              <div key={alert.id} className="alert-card">
                <div className="alert-icon-container">
                  <FontAwesomeIcon icon={faCircleExclamation} />
                </div>
                <div className="alert-content">
                  <h4 className="alert-title">
                    {alert.alert_message || 'แจ้งเตือน'}
                  </h4>
                  {alert.notes && (
                    <p className="alert-note">
                      {alert.notes}
                    </p>
                  )}
                  <p className="alert-time">
                    <FontAwesomeIcon icon={faClock} /> {moment(alert.started_at).format('HH:mm')} - {moment(alert.stopped_at).format('HH:mm')} น.
                  </p>
                </div>
              </div>
            ))}
          </div>
        </IonContent>
      </IonModal>
    </IonPage>
  );
};

export default Home;
