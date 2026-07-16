import {
  IonAvatar,
  IonBackButton,
  IonBadge,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonSpinner,
  IonTitle,
  IonToolbar,
  useIonLoading,
  useIonToast,
  IonProgressBar,
  IonRefresher,
  IonRefresherContent,
} from '@ionic/react';
import React, { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import {
  callOutline,
  cardOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  cashOutline,
  layersOutline,
  logOutOutline,
  personOutline,
  lockClosedOutline,
  eyeOutline,
  eyeOffOutline,
  mailOutline,
  timeOutline,
  trendingUpOutline,
  alertCircleOutline,
  chevronForwardOutline,
  headsetOutline,
  shieldCheckmarkOutline,
  settingsOutline, 
} from 'ionicons/icons';
import { getDriverMe, DriverMeResponse, updateDriverMe } from '../http/api';
import './css/Profile.css';
import { Edit } from 'lucide-react';
import { faBus, faCoins } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

const Profile: React.FC = () => {
  const history = useHistory();
  const [data, setData] = useState<DriverMeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [ionloading, dimissIonloading] = useIonLoading();
  const [iontoast, dismissIonToast] = useIonToast();

  const fetchProfile = async () => {
    try {
      const sessionStr = localStorage.getItem('session');
      if (!sessionStr) {
        setError('ไม่พบข้อมูล Session กรุณาเข้าสู่ระบบใหม่');
        setLoading(false);
        return;
      }
      const session = JSON.parse(sessionStr);
      const token: string = session.access_token;
      if (!token) {
        setError('ไม่พบ Token กรุณาเข้าสู่ระบบใหม่');
        setLoading(false);
        return;
      }
      const result = await getDriverMe(token);
      console.log("result ", result)
      setData(result);
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError('โหลดข้อมูลโปรไฟล์ไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchProfile();
  }, []);

  const doLogout = () => {
    localStorage.removeItem('session');
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    localStorage.removeItem('driver_elapsed');
    window.location.href = '/signin';
  };

  const avatarLetter = data?.user?.full_name?.charAt(0) || data?.driver?.name?.charAt(0) || '?';

  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formCurrentPassword, setFormCurrentPassword] = useState('');
  const [formNewPassword, setFormNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (data) {
      setFormName(data.driver?.name || data.user?.full_name || '');
      setFormPhone(data.driver?.phone || data.user?.phone || '');
    }
  }, [data]);

  const updateProfile = async () => {
    ionloading({ message: 'กำลังบันทึกข้อมูล...', spinner: 'crescent' });
    setSaving(true); setMessage(null); setError(null);
    try {
      const sessionStr = localStorage.getItem('session');
      if (!sessionStr) throw new Error('ไม่พบ session');
      const session = JSON.parse(sessionStr);
      const token: string = session.access_token;
      if (!token) throw new Error('ไม่พบ token');
      const payload: any = { name: formName, phone: formPhone };
      if (formCurrentPassword && formNewPassword) {
        payload.current_password = formCurrentPassword;
        payload.new_password = formNewPassword;
      }
      const updated = await updateDriverMe(payload, token);
      // console.log('Updated profile:', updated); 
      if (updated) {
        fetchProfile();
        iontoast({
          message: 'บันทึกข้อมูลเรียบร้อยแล้ว',
          duration: 2000, color: 'success',
          icon: checkmarkCircleOutline,
          position: 'top',
        });
      }
      // setData(updated);
      setShowEditModal(false);
      setMessage('บันทึกข้อมูลเรียบร้อยแล้ว');
    } catch (err) {
      console.error(err);
      setError('บันทึกข้อมูลไม่สำเร็จ');
    } finally {
      setSaving(false);
      dimissIonloading();
    }
  }

  return (
    <IonPage>
      <IonHeader mode="md" className="ion-no-border profile-header">
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton color="dark" defaultHref="/home" />
          </IonButtons>
          <IonTitle>โปรไฟล์</IonTitle>
          <IonButton fill="clear" slot="end" color={"dark"} onClick={() => history.push('/settings')}>
             <IonIcon icon={settingsOutline} />
          </IonButton>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen className="ion-padding profile-content dashboard-content" >
        <IonRefresher slot="fixed" onIonRefresh={(e) => fetchProfile().then(() => e.detail.complete())}>
          <IonRefresherContent />
        </IonRefresher>
        {loading && (
          <div className="profile-loading">
            <IonSpinner name="crescent" color="primary" />
            <p className="large">กำลังโหลดข้อมูล...</p>
          </div>
        )}

        {error && !loading && (
          <div className="profile-error simple-card">
            <IonIcon icon={closeCircleOutline} />
            <p className="large">{error}</p>
          </div>
        )}

        {!loading && (
          <div className="profile-container tab-bar-padding">
            {data && <header className="hero">
              <div className="avatar-wrap">
                {data?.user?.avatar_url ? (
                  <IonAvatar className="avatar-img" style={{ fontSize: '2.2rem' }}>
                    <img src={data.user.avatar_url} alt="avatar" />
                  </IonAvatar>
                ) : (
                  <div className="avatar-letter">{avatarLetter}</div>
                )}
                <div className={`status ${data?.driver.is_active ? 'active' : 'inactive'}`}>
                  {data?.driver.is_active ? 'ใช้งานอยู่' : 'ไม่ได้ใช้งาน'}
                </div>
              </div>

              {data && <div className="hero-text">
                <h1 className="name large">{data?.user?.full_name || data?.driver?.name}</h1>
                <p className="username">@{data?.user.username}</p>
              </div>}
              <div style={{ marginLeft: 'auto' }}>
                <IonButton size="small" fill='clear' onClick={() => { setShowEditModal(true); setMessage(null); }}>
                  <Edit />
                </IonButton>
              </div>
            </header>}

            {data && <section className="stats-row">
              <div className="stat trip" style={{ paddingBottom: ".5rem" }} >
                <small style={{ fontSize: ".7em" }}> <FontAwesomeIcon icon={faBus} size="sm" />&nbsp; รอบวันนี้</small>
                <div className="stat-value xlarge">{(data.today_rounds_count ?? 0)}/4</div>
                <IonProgressBar mode='ios' value={(data.today_rounds_count ?? 0) / 4} color="primary" />
              </div>
              <div className="stat earning">
                <small style={{ fontSize: ".7em" }}> <FontAwesomeIcon icon={faCoins} size="sm" />&nbsp; รายได้วันนี้</small>
                <div className="stat-value xlarge">{(data.today_earnings ?? 0).toLocaleString('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 })}</div>
                {/* <div className="stat-label">รายได้วันนี้</div> */}
              </div>
            </section>}
            {message && (
              <div className="simple-card" style={{ padding: 10, fontSize: 16 }}>{message}</div>
            )}

            {data && <section className="info simple-card">
              <div className="info-row">
                <div className="label">ชื่อ-สกุล</div>
                <div className="value">{data.driver.name}</div>
              </div>
              <div className="info-row">
                <div className="label">เลขประจำตัวประชาชน</div>
                <div className="value">{data.user.national_id || '-'}</div>
              </div>
              <div className="info-row">
                <div className="label">ใบขับขี่</div>
                <div className="value">{data.driver.license_number}</div>
              </div>
              <div className="info-row">
                <div className="label">เบอร์โทร</div>
                <div className="value">{data.driver.phone}</div>
              </div>
              <div className="info-row">
                <div className="label">บัญชี</div>
                <div className="value">{data.user.username}</div>
              </div>
              <div className="info-row">
                <div className="label">อีเมล</div>
                <div className="value">{data.user.email || '-'}</div>
              </div>  
            </section>}

            <IonModal isOpen={showEditModal} initialBreakpoint={0.8} onDidDismiss={() => setShowEditModal(false)}>
              <IonHeader className='ion-no-border' >
                <IonToolbar>
                  <IonTitle>แก้ไขโปรไฟล์</IonTitle>
                  <IonButtons slot="end">
                    <IonButton onClick={() => setShowEditModal(false)}>ปิด</IonButton>
                  </IonButtons>
                </IonToolbar>
              </IonHeader>
              <IonContent className="ion-padding">
                <IonList>
                  <IonItem lines="none" className="modern-input-item">
                    {/* <IonLabel position="stacked" className="form-label">ชื่อ-สกุล</IonLabel> */}
                    <IonIcon icon={personOutline} slot="start" className="input-icon" />
                    <IonInput value={formName} label='ชื่อ-สกุล' labelPlacement='stacked'
                      className="modern-input" placeholder='ชื่อ-สกุล' onIonChange={(e) => setFormName((e.detail.value as string) || '')} />
                  </IonItem>

                  <IonItem lines="none" className="modern-input-item">
                    {/* <IonLabel position="stacked" className="form-label">เบอร์โทร</IonLabel> */}
                    <IonIcon icon={callOutline} slot="start" className="input-icon" />
                    <IonInput className="modern-input" label='เบอร์โทร' labelPlacement='stacked' value={formPhone} placeholder='เบอร์โทร' onIonChange={(e) => setFormPhone((e.detail.value as string) || '')} />
                  </IonItem>

                  <IonItem className="modern-input-item">
                    <IonIcon icon={lockClosedOutline} slot="start" className="input-icon" />
                    <IonInput
                      value={formCurrentPassword}
                      type={showPassword ? 'text' : 'password'}
                      placeholder="รหัสผ่านเดิม (ถ้าจะแก้)" labelPlacement='stacked'
                      className="modern-input" mode='ios'
                      onIonChange={(e) => setFormCurrentPassword((e.detail.value as string) || '')}
                    />
                    <IonIcon
                      icon={showPassword ? eyeOffOutline : eyeOutline}
                      slot="end"
                      className="input-icon cursor-pointer"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{ cursor: 'pointer' }}
                    />
                  </IonItem>

                  <IonItem className="modern-input-item">
                    <IonIcon icon={lockClosedOutline} slot="start" className="input-icon" />
                    <IonInput
                      value={formNewPassword} mode='ios'
                      type={showPassword ? 'text' : 'password'}
                      placeholder="รหัสผ่านใหม่" labelPlacement='stacked'
                      className="modern-input"
                      onIonChange={(e) => setFormNewPassword((e.detail.value as string) || '')}
                    />
                    <IonIcon
                      icon={showPassword ? eyeOffOutline : eyeOutline}
                      slot="end"
                      className="input-icon cursor-pointer"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{ cursor: 'pointer' }}
                    />
                  </IonItem>

                  <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                    <IonButton expand="block" color="primary" disabled={saving} onClick={() => updateProfile()}>
                      {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                    </IonButton>
                    <IonButton expand="block" color="medium" onClick={() => { setShowEditModal(false); setMessage(null); }}>
                      ยกเลิก
                    </IonButton>
                  </div>
                </IonList>
              </IonContent>
            </IonModal>

            {/* Help Menu */}
            <section className="menu-section">
              <div className="menu-section-title">ช่วยเหลือ</div>
              <a href="tel:1669" className="menu-item emergency-call-item">
                <div className="menu-item-icon emergency">
                  <IonIcon icon={callOutline} />
                </div>
                <div className="menu-item-content">
                  <div className="menu-item-label">โทรฉุกเฉิน</div>
                  <div className="menu-item-sub">1669 · บริการการแพทย์ฉุกเฉิน</div>
                </div>
                <IonIcon icon={chevronForwardOutline} className="menu-item-arrow" />
              </a>
              <a href="tel:0800000000" className="menu-item admin-support-item">
                <div className="menu-item-icon support">
                  <IonIcon icon={headsetOutline} />
                </div>
                <div className="menu-item-content">
                  <div className="menu-item-label">ติดต่อ Admin Support</div>
                  <div className="menu-item-sub">080-000-0000 · แจ้งปัญหาการใช้งาน</div>
                </div>
                <IonIcon icon={chevronForwardOutline} className="menu-item-arrow" />
              </a>
              <a href="tel:0801234567" className="menu-item insurance-item">
                <div className="menu-item-icon insurance">
                  <IonIcon icon={shieldCheckmarkOutline} />
                </div>
                <div className="menu-item-content">
                  <div className="menu-item-label">ติดต่อ Insurance</div>
                  <div className="menu-item-sub">080-123-4567 · ข้อมูลประกันภัย</div>
                </div>
                <IonIcon icon={chevronForwardOutline} className="menu-item-arrow" />
              </a>
            </section>

            <div className="logout-wrap">
              <IonButton mode='ios' expand="block" color="danger" size="large" onClick={doLogout} className="logout-btn">
                <IonIcon icon={logOutOutline} slot="start" />
                ออกจากระบบ
              </IonButton>
            </div>
            <br/><br/>
          </div>
        )}
      </IonContent>
    </IonPage>
  );
};

export default Profile;
