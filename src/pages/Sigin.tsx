import { IonButton, IonCheckbox, IonContent, IonImg, IonInput, IonItem, IonLabel, IonList, IonPage, IonIcon, useIonAlert } from "@ionic/react";
import React, { useState, useEffect } from 'react';
import { personOutline, lockClosedOutline, eyeOutline, eyeOffOutline } from 'ionicons/icons';
import "./css/Signin.css";
import { driverLogin } from "../http/api";
import moment from "moment";

const Sigin: React.FC = () => {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [ionalert,dimissAlert] = useIonAlert();

    useEffect(() => {
        const savedUsername = localStorage.getItem('savedUsername');
        const savedPassword = localStorage.getItem('savedPassword'); // Caution: saving password in plain text is not ideal, but following common "remember me" pattern if requested
        const savedRememberMe = localStorage.getItem('rememberMe') === 'true';

        setRememberMe(savedRememberMe);
        if (savedRememberMe) {
            if (savedUsername) setUsername(savedUsername);
            if (savedPassword) setPassword(savedPassword);
        }
    }, []);

    const doLogin = async () => {
        if (!username || !password) {
            // Add validation toast or message if needed
            return;
        }

        setIsLoading(true);
        try {
            const body = {
                username: username,
                password: password
            }

            const loginres:any = await driverLogin(body)
            console.log("loginres", loginres);
            if(loginres?.error) {
                ionalert({
                    header: 'เข้าสู่ระบบไม่สำเร็จ',
                    message:  loginres?.error || 'กรุณาตรวจสอบชื่อผู้ใช้งานและรหัสผ่านของคุณอีกครั้ง',
                    buttons: ['ตกลง']
                });
                return;
            }
            if (rememberMe) {
                localStorage.setItem('savedUsername', username);
                localStorage.setItem('savedPassword', password);
                localStorage.setItem('rememberMe', 'true');
            } else {
                localStorage.removeItem('savedUsername');
                localStorage.removeItem('savedPassword');
                localStorage.setItem('rememberMe', 'false');
            }

            localStorage.setItem('isAuthenticated', "true");
            localStorage.setItem('role', 'driver');

            if (loginres?.token || loginres?.access_token) {
                const token = loginres.access_token || loginres.token;
                localStorage.setItem('session',
                    JSON.stringify({
                        access_token: token,
                        refresh_token: loginres.refresh_token,
                        expires_in: moment().add(1, 'hour').format(),
                        driver: loginres.driver || loginres.user
                    }));
                window.location.href = '/home';
            } else {
                localStorage.removeItem('session');
            }
        } catch (error) {
            console.error("Login error:", error);
            ionalert({
                header: 'เข้าสู่ระบบไม่สำเร็จ',
                message: 'กรุณาตรวจสอบชื่อผู้ใช้งานและรหัสผ่านของคุณอีกครั้ง',
                buttons: ['ตกลง']
            });
            // Show error message to user
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <IonPage>
            <IonContent scrollY={false} style={{ '--overflow': 'hidden', 'height': '100%' }}>
                <div className="signin-container">
                    <div className="signin-background-shape"></div>

                    <div className="signin-card">
                        <div className="logo-section">
                            <IonImg src="../assets/svg/logo.svg" className="logo-img" />
                            <span className="welcome-text">ยินดีต้อนรับ</span>
                            <span className="subtitle-text">เข้าสู่ระบบเพื่อจัดการเที่ยวการเดินทาง</span>
                        </div>

                        <IonList className="form-list" lines="none">
                            <IonItem className="modern-input-item">
                                <IonIcon icon={personOutline} slot="start" className="input-icon" />
                                <IonInput
                                    value={username}
                                    type="text" label="Username" labelPlacement="stacked"
                                    placeholder="ชื่อผู้ใช้งาน / เบอร์โทร"
                                    className="modern-input"
                                    onIonChange={e => setUsername(String(e.detail.value || ''))}
                                />
                            </IonItem>

                            <IonItem className="modern-input-item">
                                <IonIcon icon={lockClosedOutline} slot="start" className="input-icon" />
                                <IonInput
                                    value={password} label="Password" labelPlacement="stacked"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="รหัสผ่าน"
                                    className="modern-input"
                                    onIonChange={e => setPassword(String(e.detail.value || ''))}
                                />
                                <IonIcon
                                    icon={showPassword ? eyeOffOutline : eyeOutline}
                                    slot="end"
                                    className="input-icon cursor-pointer"
                                    onClick={() => setShowPassword(!showPassword)}
                                    style={{ cursor: 'pointer' }}
                                />
                            </IonItem>
                        </IonList>

                        <div className="remember-section">
                            <div className="flex items-center">
                                <IonCheckbox
                                    checked={rememberMe}
                                    onIonChange={e => setRememberMe(e.detail.checked)}
                                    className="remember-checkbox"
                                    mode="ios"
                                />
                                <IonLabel className="remember-label">จดจำฉันไว้</IonLabel>
                            </div>
                            <a href="#" className="forgot-link">ลืมรหัสผ่าน?</a>
                        </div>

                        <IonButton
                            expand="block"
                            onClick={doLogin} color={"primary"}
                            className="login-button"
                            disabled={isLoading}
                        >
                            {isLoading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
                        </IonButton>

                        <div className="mt-8 text-center">
                            <p className="text-sm text-gray-500">
                                ยังไม่มีบัญชี? <a href="#" className="text-blue-600 font-semibold">ติดต่อผู้ดูแล</a>
                            </p>
                        </div>
                    </div>
                </div>
            </IonContent>
        </IonPage>
    );
};

export default Sigin;