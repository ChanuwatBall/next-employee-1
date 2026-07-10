import { IonBackButton, IonBadge, IonButtons, IonContent, IonHeader, IonLabel, IonLoading, IonPage, IonText, IonToolbar, IonProgressBar, IonRefresher, IonRefresherContent, IonSpinner } from '@ionic/react';
import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClock, faGasPump, faBatteryThreeQuarters, faCircleInfo, faChevronRight, faWallet, faClipboardList, faCoins } from '@fortawesome/free-solid-svg-icons';
import moment from 'moment';
import { getDriverRounds } from '../http/api';
import { BouceAnimation } from '../components/Animations';
import ActivityItemSkeleton from '../components/ActivityItemSkeleton';
import StatsSkeleton from '../components/StatsSkeleton';
import './css/Home.css';
import './css/ShiftHistory.css';
import { t } from 'i18next';
// set locale without side-effect import to avoid missing type declarations for the locale module
moment.locale('th'); 

const ShiftHistory: React.FC = () => {
  const [rounds, setRounds] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [avgEarning, setAvgEarning] = useState(0);
  const [isScrolled, setIsScrolled] = useState(false);

  const handleScroll = (ev: CustomEvent<any>) => {
    if (ev.detail.scrollTop > 40) {
      if (!isScrolled) setIsScrolled(true);
    } else {
      if (isScrolled) setIsScrolled(false);
    }
  };

  const fetchRounds = async () => {
    setIsLoading(true);
    try {
      const data = await getDriverRounds(50);
      setRounds(data.data || []);
      setAvgEarning(data.earning_per_round || 0);
      setTotalEarnings(data.earnings_total || 0);
    } catch (error) {
      console.error('Error fetching shift history:', error);
    } finally {
      setIsLoading(false);
    }
    
  };

  const doRefresh = async (event: CustomEvent) => {
    await fetchRounds();
    event.detail.complete();
  };

  useEffect(() => {
    fetchRounds();
  }, []);

  const traslateTime = (time: string) => {
    return `${moment(time).format("DD ")} ${t(moment().format("MMMM"))} ${moment().format("YYYY")}`;
  }

  return (
    <IonPage>
      <IonHeader className="ion-no-border header-sticky">
        <IonToolbar className="ion-no-padding dashboard-header" color="primary">
          <div className={`dashboard-hero ion-padding ${isScrolled ? 'scrolled' : ''}`}>
            <div className="flex items-center gap-2 mb-4 greeting-container">
              <IonButtons slot="start" className="ion-no-margin">
                <IonBackButton defaultHref="/home" text="" className='text-white' />
              </IonButtons>
              <IonText color="light">
                <h2 className="text-xl font-bold ion-no-margin text-white">ประวัติรอบการวิ่ง</h2>
              </IonText>
            </div>

            {isLoading ? (
              <StatsSkeleton />
            ) : (
              <div className="stats-dashboard grid grid-cols-2 ion-margin-top" style={{ gap: 10 }}>
                <div className="stat-card glass shadow-sm">
                  <div className="stat-label larger flex items-center gap-2 text-white">
                    <FontAwesomeIcon icon={faWallet} size="sm" /> &nbsp;
                    รายได้ทั้งหมด
                  </div>
                  <div className="stat-value larger text-white">
                    {totalEarnings.toLocaleString()} <span className="text-lg font-medium opacity-80">฿</span>
                  </div>
                </div>
                <div className="stat-card glass shadow-sm">
                  <div className="stat-label larger flex items-center gap-2 text-white">
                    <FontAwesomeIcon icon={faCoins} size="sm" />&nbsp;
                    เฉลี่ยต่อรอบ
                  </div>
                  <div className="stat-value larger text-white">
                    {avgEarning.toLocaleString()} <span className="text-lg font-medium opacity-80">฿</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </IonToolbar>
      </IonHeader>

      <IonContent className="dashboard-content" scrollEvents={true} onIonScroll={handleScroll}>
        <IonRefresher slot="fixed" onIonRefresh={doRefresh}>
          <IonRefresherContent />
        </IonRefresher>
        <div className="ion-padding tab-bar-padding">
          <div className="section-header flex justify-between items-center mb-4">
            <h3 className="font-bold ion-no-margin" style={{ color: "var(--ion-color-dark)" }}>กิจกรรมย้อนหลัง</h3>
            <div className="text-xs text-slate-400">เรียงตามวันที่ล่าสุด</div>
          </div>
          <br />
          <div className="history-list">
            {isLoading ? (
              <div className="skeleton-list">
                {[1, 2, 3, 4, 5].map(i => <ActivityItemSkeleton key={i} />)}
              </div>
            ) : rounds.length > 0 ? (
              rounds.map((round, index) => (
                <BouceAnimation key={round.id} duration={(index + 2) / 10}>
                  <div className="activity-item">
                    <div className="activity-header">
                      <div className="activity-info-group">
                        <div className="activity-icon-container">
                          <FontAwesomeIcon icon={faClock} />
                        </div>
                        <div className="activity-meta">
                          <div className="activity-date">
                            {traslateTime(round.started_at)}
                          </div>
                          <div className="activity-time-range">
                            เวลาทำงาน: {moment(round.started_at).format('HH:mm') + " น."} - {round.stopped_at ? moment(round.stopped_at).format('HH:mm') + " น." : 'ปัจจุบัน'}
                          </div>
                        </div>
                      </div>
                      <div className="activity-earning-group">
                        {
                          round.stop_mileage && round.stopped_at ?
                            <IonBadge color="success" mode="ios" className='text-white' style={{ fontSize: '.8rem', borderRadius: '6px', fontWeight: 400 }}>สำเร็จ</IonBadge>
                            : <IonBadge color="warning" mode="ios" className='text-white' style={{ fontSize: '.8rem', borderRadius: '6px', fontWeight: 400 }}>ยังไม่สิ้นสุด</IonBadge>
                        }
                      </div>
                    </div>

                    <div className="activity-stats-grid">
                      <div className="stat-box">
                        <span className="stat-box-label">ระยะทาง</span>
                        <span className="stat-box-value">{round.stop_mileage ? round.stop_mileage - round.start_mileage + " กม." : "ยังไม่สิ้นสุด"} </span>
                      </div>
                      <div className="stat-box">
                        <span className="stat-box-label">แบตเตอรี่</span>
                        <span className="stat-box-value">{round.start_battery}% → {round.stop_battery ? round.stop_battery : '?'}%</span>
                      </div>
                      <div className="stat-box">
                        <span className="stat-box-label">เวลาที่ใช้</span>
                        <span className="stat-box-value">
                          {round.stopped_at ? (() => {
                            const min = moment.duration(moment(round.stopped_at).diff(moment(round.started_at))).asMinutes();
                            return min >= 60 ? (min / 60).toFixed(1) + " ชั่วโมง" : min.toFixed(0) + " นาที";
                          })() : "ยังไม่สิ้นสุด"}
                        </span>
                      </div>
                    </div>

                    {round.notes && round.notes !== '-' && (
                      <div className="activity-notes">
                        <FontAwesomeIcon icon={faCircleInfo} className="note-icon" />
                        <span>หมายเหตุ: {round.notes}</span>
                      </div>
                    )}
                  </div>
                </BouceAnimation>
              ))
            ) : (
              <div className="empty-state-container">
                <FontAwesomeIcon icon={faClipboardList} className="empty-state-icon" />
                <p className="empty-state-text">ยังไม่มีประวัติการเดินรถ</p>
              </div>
            )}
          </div>
        </div>

      </IonContent>
    </IonPage>
  );
};

export default ShiftHistory;
