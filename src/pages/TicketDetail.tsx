import { faArrowLeft, faBus, faCircleCheck, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton, IonGrid, IonRow, IonCol, IonButtons, IonIcon, IonText, IonLabel, IonList, IonItem, IonItemOptions, IonItemOption, IonItemSliding, useIonActionSheet, useIonAlert, useIonLoading, useIonToast, IonActionSheet, IonLoading } from '@ionic/react';
import { arrowBackCircleOutline, callOutline, checkmarkCircleOutline, thumbsUpOutline, thumbsDownOutline, helpCircleOutline } from 'ionicons/icons';
import moment from 'moment';
import { usePhoneCallFlow } from '../hooks/usePhoneCallFlow';
import React, { useEffect, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { BouceAnimation } from '../components/Animations';
import { Ticket } from '../types/Ticket';
import { checkInSelf, getDriverTripPassengers, getTripDetail, saveCallCustomer } from '../https/api';
import QRCode from "qrcode";
import './TicketDetail.css';

const TicketDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const history = useHistory();
  const [actionSheet] = useIonActionSheet();
  const [booking, setBooking] = useState<any | null>(null);
  const [ionalert, dimissIonAlert] = useIonAlert();
  const [iontoast] = useIonToast();
  const [isLoading, setIsLoading] = useState(false);

  const isToday = booking ? moment(booking.date).isSame(moment(), 'day') : false;

  const { startCall, showResultSheet, setShowResultSheet, submitCallResult, currentPhone, metadata } = usePhoneCallFlow();

  const calltoCustomer = (phone: string, ticketData: any) => {
    if (!phone) return;
    startCall(phone, ticketData);
  }

  const handlerCall = async (result: string) => {
    const sessionstr = localStorage.getItem("session")
    const session = JSON.parse(sessionstr || "{}")

    try {
      const saved = await saveCallCustomer({
        booking_id: metadata?.booking_id,
        call_time: moment().format(),
        user_id: session?.user?.id || session?.driver?.id,
        result: result,
        phone_number: currentPhone,
        ticket_number: metadata?.ticket_number
      });
      iontoast({
        message: saved?.skipped ? "ยังไม่มี API สำหรับบันทึกการโทร" : "บันทึกการโทรสำเร็จ",
        duration: 2000,
        color: saved?.skipped ? "warning" : "success",
        position: "top"
      });
    } catch (err) {
      console.error("Unexpected error in handlerCall:", err);
    }
  }

  const checkInSeat = async (ticket: any) => {
    if (!ticket) return;
    setIsLoading(true);
    const checkedAt = moment().format();
    try {
      // if (booking?.isLocalSale) {
      //   setBooking((prev: any) => {
      //     if (!prev) return prev;
      //     const updated = {
      //       ...prev,
      //       tickets: prev.tickets.map((t: any) => t.ticket_number === ticket.ticket_number ? { ...t, checked_in_at: checkedAt } : t)
      //     };
      //     localStorage.setItem(`driver_cash_sale_${prev.reference}`, JSON.stringify(updated));
      //     return updated;
      //   });
      //   iontoast({ message: 'เช็คอินสำเร็จ', color: 'success', duration: 2000 });
      //   return;
      // }

      const qrBookingCode = await QRCode.toDataURL(ticket.ticket_number);
      const rescheckin = await checkInSelf(ticket.ticket_number, qrBookingCode);

      if (rescheckin.error) {
        console.error('Error checking in ticket:', rescheckin.error);
        iontoast({ message: 'เช็คอินไม่สำเร็จ', color: 'danger', duration: 2000 });
        return;
      }

      setBooking((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          tickets: prev.tickets.map((t: any) => t.ticket_number === ticket.ticket_number ? { ...t, checked_in_at: checkedAt } : t)
        };
      });

      iontoast({ message: 'เช็คอินสำเร็จ', color: 'success', duration: 2000 });
    } catch (err) {
      console.error('Unexpected error during check-in:', err);
    } finally {
      setIsLoading(false);
    }
  }

  const checkInAll = async () => {
    if (!booking?.tickets) return;
    setIsLoading(true);
    const checkedAt = moment().format();

    try {
      // if (booking?.isLocalSale) {
      //   setBooking((prev: any) => {
      //     if (!prev) return prev;
      //     const updated = {
      //       ...prev,
      //       tickets: prev.tickets.map((t: any) => ({ ...t, checked_in_at: t.checked_in_at || checkedAt }))
      //     };
      //     localStorage.setItem(`driver_cash_sale_${prev.reference}`, JSON.stringify(updated));
      //     return updated;
      //   });
      //   iontoast({ message: 'ดำเนินการเช็คอินเรียบร้อยแล้ว', color: 'success', duration: 2000 });
      //   return;
      // }

      const promises = booking.tickets.map(async (ticket: any) => {
        if (ticket.checked_in_at) return;
        const qrBookingCode = await QRCode.toDataURL(ticket.ticket_number);
        const rescheckin = await checkInSelf(ticket.ticket_number, qrBookingCode);
        if (rescheckin.error) {
          iontoast({ message: 'เช็คอิน ' + ticket.passenger_name + ' ไม่สำเร็จ', color: 'danger', duration: 2000, position: "top" });
        } else {
          iontoast({ message: 'เช็คอิน ' + ticket.passenger_name + ' สำเร็จ', color: 'success', duration: 2000, position: "top" });
        }
      });

      await Promise.all(promises);

      setBooking((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          tickets: prev.tickets.map((t: any) => ({ ...t, checked_in_at: t.checked_in_at || checkedAt }))
        };
      });

      iontoast({ message: 'ดำเนินการเช็คอินเรียบร้อยแล้ว', color: 'success', duration: 2000 });
    } catch (err) {
      console.error('Unexpected error in checkInAll:', err);
    } finally {
      setIsLoading(false);
    }
  }

  const actionPassenger = (p: any) => {
    actionSheet({
      header: `ที่นั่ง ${p.seat_number} - ${p.passenger_name}`,
      cssClass: 'premium-action-sheet',
      buttons: [
        {
          text: "โทรติดต่อผู้โดยสาร",
          icon: callOutline,
          handler: () => {
            calltoCustomer(p.passenger_phone, p);
          }
        },
        {
          text: p.checked_in_at ? "เช็คอินแล้ว" : "เช็คอินผู้โดยสาร",
          icon: checkmarkCircleOutline,
          disabled: !!p.checked_in_at || !isToday,
          handler: () => { checkInSeat(p) }
        },
        { text: "ยกเลิก", role: "cancel" }
      ]
    })
  }

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const decoded = atob(id);
        const qrDetail = JSON.parse(decoded);
        console.log("Decoded QR Detail:", qrDetail);

        // if (qrDetail?.source === "driver_cash_sale" && qrDetail?.bookingReference) {
        //   const localBookingRaw = localStorage.getItem(`driver_cash_sale_${qrDetail.bookingReference}`);
        //   if (localBookingRaw) {
        //     setBooking(JSON.parse(localBookingRaw));
        //     return;
        //   }
        // }

        const passengers: any = await getDriverTripPassengers(qrDetail.trip)
        const tripData = await getTripDetail(qrDetail.trip)

        console.log("passengers. ", passengers)
        if (passengers?.error || !tripData) {
          ionalert({
            header: 'ไม่พบข้อมูลตั๋ว',
            message: passengers?.error,
            buttons: [
              {
                text: 'ตกลง',
                role: "cancel",
                handler: () => {
                  dimissIonAlert();
                  history.goBack();
                }
              }
            ]
          });
          throw new Error(passengers?.error || 'Trip not found');
        }

        const bookingPassengers = passengers.filter((e: any) => e.bookingReference === qrDetail.bookingReference);

        if (bookingPassengers.length === 0) {
          throw new Error('ไม่พบข้อมูลผู้โดยสารในสำรองที่นั่งนี้');
        }

        setBooking({
          reference: qrDetail.bookingReference,
          origin: tripData.route_id.origin,
          destination: tripData.route_id.destination,
          date: tripData.date,
          departureTime: tripData.departure_time,
          arrivalTime: tripData.arrival_time,
          boardingPoint: bookingPassengers[0].pickupStop,
          dropOffPoint: bookingPassengers[0].dropoffStop,
          busNumber: tripData.bus_number,
          tickets: bookingPassengers.map((p: any) => ({
            ticket_number: p.ticketNumber,
            passenger_name: p.passengerName,
            passenger_phone: p.phone,
            seat_number: p.seatNumber,
            checked_in_at: p.checkedInAt,
            status: p.status,
            passenger_type: p.passengerType
          }))
        });

      } catch (e: any) {
        console.error("Fetch error:", e);
        ionalert({
          header: 'ไม่พบข้อมูลตั๋ว',
          message: e.message,
          buttons: [
            {
              text: 'ตกลง',
              role: "cancel",
              handler: () => {
                dimissIonAlert();
                history.goBack();
              }
            }
          ]
        });
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [id]);

  return (
    <IonPage className="ticket-detail-page">
      <IonHeader className="ion-no-border">
        <div className="ticket-header">
          <div className="ticket-header-content">
            <IonButton fill="clear" style={{ color: '#FFF', '--padding-start': '0' }} onClick={() => history.goBack()}>
              <FontAwesomeIcon icon={faArrowLeft} /> &nbsp;&nbsp; รายละเอียดตั๋ว
            </IonButton>
          </div>
        </div>
      </IonHeader>

      <IonContent color="light">
        {booking && (
          <div className="ticket-card-container">
            <BouceAnimation duration={0.6} delay={0.1}>
              <div className="premium-ticket-card">
                {/* Trip Info Section */}
                <div className="ticket-section">
                  <div className="flex justify-between items-center ion-margin-bottom">
                    <div className="text-left">
                      <div className="text-xs opacity-60 uppercase font-bold">Booking ID</div>
                      <div className="text-sm font-bold text-primary">#{booking.reference}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs opacity-60 uppercase font-bold">ทะเบียนรถ</div>
                      <div className="text-sm font-bold">{booking.busNumber}</div>
                    </div>
                  </div>
                  <div className='ion-margin-bottom' style={{ borderBottom: "1px dashed #DDD" }}></div>
                  <div className="route-container-dark">
                    <div className="route-node">
                      <div className="label">Origin</div>
                      <h1 className="city">{booking.origin}</h1>
                      <div className="time">{booking.departureTime}</div>
                    </div>
                    <div className="route-path">
                      <div className="bus-icon-path-dark">
                        <FontAwesomeIcon icon={faBus} />
                      </div>
                    </div>
                    <div className="route-node text-right">
                      <div className="label">Destination</div>
                      <h1 className="city">{booking.destination}</h1>
                      <div className="time">{booking.arrivalTime}</div>
                    </div>
                  </div>

                  <div className="mt-4 flex justify-between items-center ">
                    <div className="text-left">
                      <div className="text-xs opacity-60 uppercase font-bold">วันที่เดินทาง</div>
                      <div className="text-sm font-bold">{moment(booking.date).format('DD MMMM YYYY')}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs opacity-60 uppercase font-bold">ที่นั่งรวม</div>
                      <div className="text-sm font-bold">{booking.tickets.length} ที่นั่ง</div>
                    </div>
                  </div>

                  <div className="ticket-section flex flex-row ion-margin-top ion-no-padding" style={{ justifyContent: "space-between" }}>
                    <div className="">
                      <div className="label">จุดขึ้นรถ</div>
                      <div className="text-sm font-semibold">{booking.boardingPoint}</div>
                    </div>
                    <div className=" text-right">
                      <div className="label">จุดลงรถ</div>
                      <div className="text-sm font-semibold">{booking.dropOffPoint}</div>
                    </div>
                  </div>
                </div>

                <div className="ticket-divider"></div>

                {/* Sub-details (Pick up / Drop off) */}


                <div className="ticket-divider"></div>

                {/* Passengers Selection */}
                <div className="ticket-section">
                  <div className="label" style={{ fontSize: '0.75rem', fontWeight: 600, color: '#888', marginBottom: '1rem' }}>
                    รายชื่อผู้โดยสาร
                  </div>


                  {booking.tickets.map((ticket: any) => (
                    <div
                      key={ticket.ticket_number}
                      className="passenger-item"
                      onClick={() => actionPassenger(ticket)}
                    >
                      <div className="passenger-info">
                        <div className="seat-badge">
                          <span className="seat-label">SEAT</span>
                          {ticket.seat_number}
                        </div>
                        <div className="passenger-details">
                          <div className="name">{ticket.passenger_name}</div>
                          <div className="sub">{ticket.passenger_phone}</div>
                        </div>
                      </div>

                      <div className={`status-indicator ${ticket.checked_in_at ? 'status-checked-in' : 'status-pending'}`}>
                        {ticket.checked_in_at ? (
                          <>
                            <FontAwesomeIcon icon={faCircleCheck} /> เช็คอินแล้ว
                          </>
                        ) : (
                          <>เช็คอิน</>
                        )}
                        <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: '0.6rem', marginLeft: '4px' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </BouceAnimation>
            <br />
            <BouceAnimation duration={0.6} delay={0.3}>
              <div className="mt-6 text-center">
                <IonText color="medium" style={{ fontSize: '0.8rem' }}>
                  โปรดตรวจสอบข้อมูล และบัตรประชาชนก่อนดำเนินการเช็คอิน
                </IonText>
              </div>
            </BouceAnimation>
          </div>
        )}

        <div style={{ height: '210px' }}></div>
      </IonContent>

      {booking && (<div className="action-footer "  >
        <IonButton
          expand="block"
          className="premium-button"
          onClick={checkInAll}
          disabled={booking.tickets.every((t: any) => !!t.checked_in_at) || !isToday}
        >
          {booking.tickets.every((t: any) => !!t.checked_in_at)
            ? 'เช็คอินครบทั้งหมดแล้ว'
            : 'เช็คอินผู้โดยสารทั้งหมด'
          }
        </IonButton>
        <IonButton
          expand="block"
          fill="outline"
          className="secondary-button"
          onClick={() => calltoCustomer(booking.tickets[0].passenger_phone, booking.tickets[0])}
        >
          <IonIcon icon={callOutline} /> &nbsp; โทรติดต่อผู้โดยสาร
        </IonButton>
        <IonButton
          expand="block"
          fill="clear"
          className="home-button"
          onClick={() => history.replace('/home')}
        >
          กลับหน้า Home
        </IonButton>
      </div>)}

      <IonActionSheet
        isOpen={showResultSheet}
        onDidDismiss={() => setShowResultSheet(false)}
        header={`สรุปผลการติดต่อ (${currentPhone})`}
        subHeader="กรุณาเลือกผลการสนทนาที่เกิดขึ้น"
        buttons={[
          {
            text: 'สำเร็จ (Successful)',
            icon: thumbsUpOutline,
            handler: () => {
              handlerCall("successful");
              submitCallResult('successful');
            },
          },
          {
            text: 'ไม่มีผู้รับสาย (No response)',
            icon: helpCircleOutline,
            handler: () => {
              handlerCall("no_reponse");
              submitCallResult('no response');
            },
          },
          {
            text: 'ลูกค้าปฏิเสธ (Customer deny)',
            icon: thumbsDownOutline,
            handler: () => {
              handlerCall("customer_deny");
              submitCallResult('customer deny');
            },
          },
          {
            text: 'บันทึกภายหลัง',
            role: 'cancel',
          },
        ]}
      />

      <IonLoading
        isOpen={isLoading}
        message="กำลังดำเนินการ..."
        className="custom-loading"
      />
    </IonPage>
  );
};

export default TicketDetail;
