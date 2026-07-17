import React, { useMemo, useState, useCallback, useEffect } from "react";
import { checkInSelf, getTripSeats, getDriverTripPassengers, getTripDetail, getCallCustomerHistory, saveCallCustomer, getRouteTierPrices, getBookingDetail } from "../http/api";
import { useParams, useHistory } from "react-router-dom";
import {
    IonPage,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButtons,
    IonBackButton,
    IonButton,
    IonLabel,
    IonText,
    IonModal,
    IonCol,
    IonRow,
    useIonToast,
    useIonActionSheet,
    IonLoading,
    IonActionSheet,
    IonRefresher,
    IonRefresherContent,
} from "@ionic/react";
import { CircleDot, DoorOpen, Toilet, TriangleAlert, MoveDown, User, Armchair, X } from "lucide-react";
import { TripDetail } from "../types/trip";
import moment from "moment";
import "./css/PlanChair.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleCheck, faClock } from "@fortawesome/free-solid-svg-icons";
import { callOutline, thumbsDownOutline, thumbsUpOutline, helpCircleOutline } from "ionicons/icons";
import { usePhoneCallFlow } from "../hooks/usePhoneCallFlow";
import QRCode from "qrcode";
import { supabase } from "../supabase/client";
import { downloadReceiptPdf, type ReceiptPdfData } from "../utils/receiptPdf";
import { printReceipt } from "../utils/receiptPrinter";
import { Capacitor } from "@capacitor/core";
import ReceiptModal from "../components/Receipt";

// printing helpers moved to utils/receiptPrinter

// --- Types ---
type SeatStatus = "available" | "booked" | "unavailable" | "selected";

interface Seat {
    id: string;
    number: string;
    row: number;
    col: number;
    status: SeatStatus;
    floor: number;
    price?: number;
    ticket_id: null | {
        "id": string
        "price": number
        "status": string
        "qr_code": string
        "booking_id": string | null,
        "created_at": string | Date
        "seat_number": string
        "checked_in_at": string | null
        "ticket_number": string
        "passenger_name": string
        "passenger_type": string
        "passenger_phone": string
        "passenger_id_card": string
    }
}

interface BusLayout {
    id: string;
    name: string;
    rows: (string | null)[][];
}

interface TicketDetail {
    id: string;
    price: number;
    status: string;
    qr_code: string;
    booking_id: string | null;
    created_at: string;
    seat_number: string;
    checked_in_at: string | null;
    ticket_number: string;
    passenger_name: string;
    passenger_type: string;
    passenger_phone: string;
    passenger_id_card: string;
}

interface SeatDetail {
    id: string;
    trip_id: string;
    seat_number: string;
    seat_type: string;
    price: number;
    is_available: boolean;
    created_at: string;
    ticket_id: TicketDetail | null;
}

const SPECIAL_CELLS = ['DRIVER', 'DOOR1', 'DOOR2', 'TOILET', 'EMERGENCY', 'STAIRS'];

const statusClasses: Record<SeatStatus, string> = {
    available: "seat-available",
    booked: "seat-booked",
    unavailable: "seat-unavailable",
    selected: "seat-selected",
};

const specialCellLabels: Record<string, string> = {
    DRIVER: "พขร.",
    DOOR1: "ประตู 1",
    DOOR2: "ประตู 2",
    TOILET: "ห้องน้ำ",
    EMERGENCY: "ทางออกฉุกเฉิน",
    STAIRS: "บันได",
};

// --- Layouts ---
export const layout7m: BusLayout = {
    id: '7m',
    name: 'รถตู้ 7.3 เมตร',
    rows: [
        ['DOOR1', null, null, 'DRIVER'],
        ['1A', '1B', null, null],
        ['2A', '2B', null, null],
        ['3A', '3B', null, '3D'],
        ['4A', '4B', null, '4D'],
        ['5A', '5B', null, '5D'],
        ['6A', '6B', null, '6D'],
        ['7A', '7B', '7C', '7D'],
    ],
};

export const layout12m: BusLayout = {
    id: '12m',
    name: 'รถบัส 12 เมตร',
    rows: [
        ['DOOR1', null, null, 'DRIVER'],
        ['1A', '1B', '1C', '1D'],
        ['2A', '2B', '2C', '2D'],
        ['3A', '3B', '3C', '3D'],
        ['4A', '4B', '4C', '4D'],
        ['TOILET', null, '5C', '5D'],
        ['DOOR2', null, '6C', '6D'],
        ['5A', '5B', '7C', '7D'],
        ['6A', '6B', null, 'EMERGENCY'],
        ['7A', '7B', '8C', '8D'],
        ['8A', '8B', '9C', '9D'],
    ],
};

export function isSpecialCell(label: string | null): boolean {
    return label !== null && SPECIAL_CELLS.includes(label);
}

// --- Main Page ---
const PlanChair: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const history = useHistory();
    const [trip, setTrip] = useState<TripDetail | null>(null);
    const [seats, setSeats] = useState<Seat[]>([]);
    const [showSeatModal, setShowSeatModal] = useState(false);
    const [selectedSeatData, setSelectedSeatData] = useState<any | null>(null);
    const [iontoast] = useIonToast();
    const [presentActionSheet] = useIonActionSheet();
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [receiptData, setReceiptData] = useState<any>(null);
    const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

    const { startCall, showResultSheet, setShowResultSheet, submitCallResult, currentPhone, metadata } = usePhoneCallFlow<SeatDetail>();

    const selectedSeats = useMemo(
        () => seats.filter((seat) => seat.status === "selected").sort((a, b) => a.number.localeCompare(b.number)),
        [seats]
    );
    useEffect(() => {
        if (metadata) {
            setSelectedSeatData(metadata);
            setShowSeatModal(true);
        }
    }, [metadata]);

    const [layout, setLayout] = useState<BusLayout>(layout12m);

    const fetchTripAndSeats = async () => {
        setIsLoading(true);
        try {
            const passengers: any[] = await getDriverTripPassengers(id);
            console.log("passengers ", passengers);

            // Fetch Trip
            const tripData = await getTripDetail(id);
            if (tripData) setTrip(tripData as any);

            // Fetch Layout and Seats from Nex API
            const apiData = await getTripSeats(id);
            if (apiData) {
                console.log("apiData ", apiData)
                if (apiData.layout) setLayout(apiData.layout);
                if (apiData.seats) {
                    const mappedSeats: Seat[] = apiData.seats.map((s: any) => ({
                        id: s.number,
                        number: s.number,
                        row: s.row,
                        col: s.col,
                        status: s.status as SeatStatus,
                        floor: s.floor,
                        price: s.price,
                        ticket_id: null
                    }));

                    for (const ms of mappedSeats) {
                        const match = passengers.find((p: any) => p.seatNumber === ms.number);
                        if (match) {
                            // Remap camelCase to snake_case for UI compatibility
                            ms.ticket_id = {
                                id: match.id,
                                ticket_number: match.ticketNumber,
                                passenger_name: match.passengerName,
                                passenger_phone: match.phone,
                                passenger_type: match.passengerType,
                                seat_number: match.seatNumber,
                                status: match.status,
                                checked_in_at: match.checkedInAt,
                                booking_id: match.bookingId,
                                price: match.price,
                                qr_code: match.qrCode || '',
                                created_at: match.createdAt || new Date().toISOString()
                            } as any;
                        }
                    }
                    setSeats(mappedSeats);
                }
            }
        } catch (error) {
            console.error("Error in fetchTripAndSeats:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchTierPrices =async()=>{
       const prices = await getRouteTierPrices(id)
       console.log("tier prices: ", prices)
    }

    const handlePullToRefresh = async (event: any) => {
        try {
            await Promise.all([fetchTripAndSeats(), fetchTierPrices()]);
        } finally {
            event.detail.complete();
        }
    }
    
    useEffect(() => {
        fetchTripAndSeats();
        fetchTierPrices();
    }, [id]);

    const openSaleModal = () => {
        if (selectedSeats.length === 0) {
            iontoast({ message: "กรุณาเลือกที่นั่งว่างก่อนขายตั๋ว", duration: 2000, color: "warning", position: "top" });
            return;
        }

        history.push({
            pathname: `/plan/${id}/sell`,
            search: `?seats=${encodeURIComponent(selectedSeats.map((seat) => seat.number).join(","))}`,
            state: {
                seats: selectedSeats.map((seat) => ({
                    id: seat.id,
                    number: seat.number,
                    price: seat.price,
                })),
                trip,
            },
        });
    };

    const toggleSeat = useCallback(async (seat: Seat) => {
        if (seat.status === "booked" || seat.status === "unavailable") {
            console.log("seat ", seat)
        //     try {
        //         const callHistory = await getCallCustomerHistory({
        //             booking_id: seat?.ticket_id?.booking_id,
        //             phone_number: seat.ticket_id?.passenger_phone,
        //             ticket_number: seat?.ticket_id?.ticket_number
        //         });
        //         console.log("callHistory ", callHistory)

        //         const seatupdate: any = { ...seat, call_record: callHistory || [] };
                setSelectedSeatData(seat);
                setShowSeatModal(true);
        //     } catch (error) {
        //         console.error("Error fetching call info:", error);
        //     }
        //     return;
        }else{
        setSeats((prev) =>
            prev.map((s) => {
                if (s.id !== seat.id) return s;
                if (s.status === "selected") return { ...s, status: "available" };
                return { ...s, status: "selected" };
            })
        ); 
        }

    }, [id]);

    const handleContinue = () => history.goBack();

    const calltoCustomer = () => {
        if (!selectedSeatData?.ticket_id?.passenger_phone) return;
        startCall(selectedSeatData.ticket_id.passenger_phone, selectedSeatData);
    };

    const handlerCall = async (result: string) => {
        const sessionstr = localStorage.getItem("session");
        const session = JSON.parse(sessionstr || "{}");
        try {
            const saved = await saveCallCustomer({
                booking_id: metadata?.ticket_id?.booking_id,
                call_time: moment().format(),
                user_id: session?.user?.id || session?.driver?.id,
                result: result,
                phone_number: currentPhone,
                ticket_number: metadata?.ticket_id?.ticket_number
            });
            iontoast({
                message: saved?.skipped ? "ยังไม่มี API สำหรับบันทึกการโทร" : "บันทึกการโทรสำเร็จ",
                duration: 2000,
                color: saved?.skipped ? "warning" : "success",
                position: "top"
            });
        } catch (err) {
            console.error("Error saving call log:", err);
        }
    };

    const checkInSeat = async () => {
        if (!selectedSeatData?.ticket_id) return;
        setIsSaving(true);
        const checkedAt = moment().format();
        try {
            console.log("selectedSeatData ", selectedSeatData)
            const qrBookingCode = await QRCode.toDataURL(selectedSeatData?.ticket_id?.ticket_number);
            const rescheckin = await checkInSelf(selectedSeatData?.ticket_id?.ticket_number, qrBookingCode);
            if (rescheckin.error) {
                iontoast({ message: "เช็คอินไม่สำเร็จ", duration: 2000, color: "danger", position: "top" });
                return;
            }
            setSelectedSeatData((prev: any) => ({
                ...prev,
                ticket_id: { ...prev.ticket_id, checked_in_at: checkedAt }
            }));

            await fetchTripAndSeats();
            iontoast({ message: "เช็คอินสำเร็จ", duration: 2000, color: "success", position: "top" });
        } catch (err) {
            console.error('Error during check-in:', err);
        } finally {
            setIsSaving(false);
        }
    };

    const printTicket = async (seatData: any) => {
       if (!seatData) return;
    //    setIsSaving(true);
       try {
           const ticket_number = seatData?.ticket_id?.ticket_number;
           if (!ticket_number) {
               throw new Error('ไม่พบหมายเลขตั๋ว');
           }

           const { data: ticket } = await supabase.from('tickets').select('*').eq('ticket_number', ticket_number).single();
           if (!ticket?.booking_id) {
               throw new Error('ไม่พบ booking สำหรับตั๋วนี้');
           }
           console.log("ticket ", ticket)
           // prefer API helper to get full booking detail
           const bookingDetail = await getBookingDetail(ticket.booking_id);

           // build receipt payload
           const passengers = (bookingDetail?.passengers && bookingDetail.passengers.length)
               ? bookingDetail.passengers.map((p: any) => ({ fullName: p.fullName, phone: p.phone, seatNumber: p.seatNumber, passengerType: p.passengerType }))
               : [{ fullName: ticket?.passenger_name , phone: ticket?.passenger_phone || seatData?.ticket_id?.passenger_phone || '-', seatNumber: ticket?.seat_number  , passengerType: ticket?.passenger_type}];

           const seats = bookingDetail?.seats?.length ? bookingDetail.seats : [seatData?.seat_number || seatData?.ticket_id?.seat_number];
           const total = bookingDetail?.total ?? Number(seatData?.ticket_id?.price || 0);

           
           const qrPayload = JSON.stringify({ trip: bookingDetail?.tripId || id, bookingReference: bookingDetail?.bookingReference || bookingDetail?.id || '' });
           const qrImage = await QRCode.toDataURL(btoa(qrPayload));

           const receiptData: ReceiptPdfData = {
               bookingDetail: bookingDetail || null,
               trip,
               passengers,
               seats,
               qrCodeImage: qrImage,
               bookingReference: bookingDetail?.bookingReference || bookingDetail?.id || ticket.booking_id,
               paymentMethod: bookingDetail?.paymentMethod || '-',
               paymentStatus: bookingDetail?.paymentStatus || '-',
               total: total,
               pricePerSeat: bookingDetail?.pricePerSeat || Math.round(total / Math.max(passengers.length, 1)),
           };
            console.log("receiptData ", receiptData)
            setReceiptData(receiptData);
            setIsReceiptModalOpen(true);
           // use shared printReceipt which handles Bluetooth ESC/POS on Android and PDF fallback
        //    await printReceipt(receiptData, iontoast);

       } catch (err: any) {
           console.error('Error printing ticket receipt:', err);
           iontoast({ message: err?.message || 'พิมพ์ใบเสร็จไม่สำเร็จ', duration: 2200, color: 'danger', position: 'top' });
       } finally {
        //    setIsSaving(false);
       }
       
    }

    return (
        <IonPage>
            <IonHeader className="ion-no-border">
                <IonToolbar color="primary">
                    <IonButtons slot="start">
                        <IonBackButton defaultHref={`/trip/${id}`} text="" />
                    </IonButtons>
                    <IonTitle style={{ color: "#FFF" }}>แผงที่นั่ง</IonTitle>
                </IonToolbar>
            </IonHeader>

            <IonContent className="bg-slate-50">
                <IonRefresher slot="fixed" onIonRefresh={handlePullToRefresh}>
                    <IonRefresherContent pullingText="ดึงลงเพื่อรีโหลด" refreshingSpinner="circles" refreshingText="กำลังรีโหลด..." />
                </IonRefresher>
                <div className="planchair-container p-4 flex flex-col items-center">
                    {trip && (
                        <div className="planchair-header w-full mb-6 text-center">
                            <h2 className="text-xl font-black text-slate-800">
                                {trip.route_id?.origin} → {trip.route_id?.destination}
                            </h2>
                            <p className="text-slate-500 text-sm">
                                {moment(trip.date).format('DD MMM YYYY')} | {trip.departure_time} - {trip.arrival_time}
                            </p>
                            <div className="bus-type-badge mt-2 inline-block px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-semibold">
                                {layout.name}
                            </div>
                        </div>
                    )}

                    <div className="planchair-legend w-full max-w-md">
                        <div className="legend-item">
                            <div className="legend-box available" />
                            <span>ว่าง</span>
                        </div>
                        <div className="legend-item">
                            <div className="legend-box booked relative">
                                <FontAwesomeIcon icon={faClock} style={{ position: "absolute", right: "-30%", top: "-30%", color: "#f5cb42", fontSize: "10px" }} />
                            </div>
                            <span>รอเช็คอิน</span>
                        </div>
                        <div className="legend-item">
                            <div className="legend-box booked relative">
                                <FontAwesomeIcon icon={faCircleCheck} style={{ position: "absolute", right: "-30%", top: "-30%", color: "#30d203", fontSize: "10px" }} />
                            </div>
                            <span>เช็คอินแล้ว</span>
                        </div>
                    </div>

                    <div className="bus-grid-card w-full max-w-sm mb-8">
                        <div className="bus-windshield"></div>
                        <div className="space-y-4">
                            {layout.rows.map((row, rowIdx) => (
                                <div key={rowIdx} className="bus-row">
                                    {row.map((cell, colIdx) => {
                                        const isAisle = colIdx === 1 && (layout.id.includes('12m') || layout.id.includes('7m'));
                                        const aisleClass = isAisle ? "aisle-margin" : "";
                                        if (cell === null || cell === "") return <div key={colIdx} className={`seat-null ${aisleClass}`} />;
                                        if (isSpecialCell(cell)) {
                                            return (
                                                <div key={colIdx} className={`special-cell ${aisleClass}`}>
                                                    {cell === 'DRIVER' && <CircleDot className="driver-icon" />}
                                                    {cell === 'TOILET' && <Toilet className="lucide-icon" />}
                                                    {cell.startsWith('DOOR') && <DoorOpen className="lucide-icon" />}
                                                    {cell === 'STAIRS' && <MoveDown className="lucide-icon" />}
                                                    {cell === 'EMERGENCY' && <TriangleAlert className="lucide-icon emergency-icon" />}
                                                    <span className="special-cell-label">{specialCellLabels[cell as keyof typeof specialCellLabels] || cell}</span>
                                                </div>
                                            );
                                        }

                                        const seat = seats.find(s => s.number === cell);
                                        if (!seat) return <div key={colIdx} className={`w-12 h-12 ${aisleClass}`} />;

                                        return (
                                            <button
                                                key={seat.number}
                                                onClick={() => toggleSeat(seat)}
                                                disabled={seat.status === "unavailable"}
                                                className={`seat-button ${statusClasses[seat.status]} ${aisleClass} relative`}
                                            >
                                                {seat.status === "booked" ? (
                                                    <div className="flex flex-col items-center ">
                                                        <User className="text-slate-300" style={{ width: "80%", height: "80%" }} />
                                                        <span className="text-[16px] leading-none">{seat.number}</span>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <Armchair className="text-slate-300" style={{ width: "40%", height: "40%", marginTop: "-.8rem" }} />
                                                        <IonLabel style={{ position: "absolute", bottom: "6px" }}>{seat.number}</IonLabel>
                                                    </>
                                                )}
                                                {seat.status === "booked" && !seat.ticket_id?.checked_in_at &&
                                                    <FontAwesomeIcon icon={faClock} style={{ position: "absolute", right: "-10%", top: "-10%", color: "#f5cb42" }} />
                                                }
                                                {seat.status === "booked" && seat.ticket_id?.checked_in_at &&
                                                    <FontAwesomeIcon icon={faCircleCheck} style={{ position: "absolute", right: "-10%", top: "-10%", color: "#30d203" }} />
                                                }
                                            </button>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                        <div className="bus-bumper"></div>
                    </div><br />

                    <IonButton expand="block" className="w-full max-w-sm" mode="ios" color="primary" onClick={handleContinue}>
                        ย้อนกลับ
                    </IonButton>
                </div>
            </IonContent>

            {selectedSeats.length > 0 && (
                <div className="sale-ticket-footer">
                    <div className="sale-ticket-summary">
                        <span>{selectedSeats.length} ที่นั่ง</span>
                        <strong>{selectedSeats.map((seat) => seat.number).join(", ")}</strong>
                    </div>
                    <IonButton expand="block" mode="ios" color="primary" onClick={openSaleModal}>
                        ขายตั๋ว
                    </IonButton>
                </div>
            )}
            <ReceiptModal 
                receiptData={receiptData} // Replace 'receiptData' with your actual receipt data variable
                open={isReceiptModalOpen} // Replace 'isReceiptModalOpen' with your actual state variable
                setOpen={setIsReceiptModalOpen} // Replace 'setIsReceiptModalOpen' with your actual state setter
            />
            <IonModal
                isOpen={showSeatModal}
                initialBreakpoint={0.9}
                breakpoints={[0, 0.8, 0.9, 1]}
                onDidDismiss={() => { setShowSeatModal(false); setSelectedSeatData(null); }}
            >
                <IonContent scrollY>
                    {selectedSeatData && (() => {
                        const ticket = selectedSeatData.ticket_id;
                        const isCheckedIn = !!ticket?.checked_in_at;
                        const calcDuration = (dep?: string, arr?: string) => {
                            if (!dep || !arr) return '-';
                            const [dh, dm] = dep.split(':').map(Number);
                            const [ah, am] = arr.split(':').map(Number);
                            const diff = (ah * 60 + am) - (dh * 60 + dm);
                            if (diff <= 0) return '-';
                            return `${Math.floor(diff / 60)}.${(diff % 60).toString().padStart(2, '0')} ชม.`;
                        };

                        return (
                            <div className="flex flex-col  ">
                                {/* Header */}
                                <div className="flex items-center justify-between px-5 pt-5 pb-4 ">
                                    <h2 className="text-lg font-bold text-slate-800 ion-margin-start">ที่นั่ง {selectedSeatData.seat_number}</h2>
                                    <button
                                        onClick={() => { setShowSeatModal(false); setSelectedSeatData(null); }}
                                        className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 relative ion-margin-end"
                                    >
                                        <X className="w-4 h-4" />

                                    </button>
                                </div>
                                <IonRow>
                                    <IonCol size="12" className="set-center flex-col">
                                        <div className="set-center relative modal-seat-icon-box" >
                                            <Armchair className="  text-slate-300" style={{ width: "50%", height: "50%" }} />
                                            {selectedSeatData?.ticket_id && selectedSeatData?.ticket_id?.checked_in_at === null &&
                                                <FontAwesomeIcon icon={faClock}
                                                    style={{ position: "absolute", right: "20%", top: "20%", color: "#f5cb42" }} />
                                            }
                                            {selectedSeatData?.ticket_id && selectedSeatData?.ticket_id?.checked_in_at !== null &&
                                                <FontAwesomeIcon icon={faCircleCheck}
                                                    style={{ position: "absolute", right: "20%", top: "20%", color: "#30d203" }} />
                                            }
                                        </div>
                                        <p className="text-slate-400 mt-3 text-base font-medium">{selectedSeatData.seat_number}</p>
                                    </IonCol>
                                </IonRow>

                                {/* Scrollable body */}
                                <div className="flex-1 w-full flex flex-col items-center pt-4" >

                                    <div className="modal-card-box" >
                                        {ticket && (
                                            <div className="modal-inner-card">
                                                <div className="flex justify-between items-start">
                                                    <span className="text-sm text-slate-500">สถานะ</span>
                                                    <span className="text-sm font-semibold text-slate-800 text-right">
                                                        {isCheckedIn ? 'เช็คอินแล้ว' : 'จองตั๋วแล้ว รอผู้โดยสาร'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-sm text-slate-500">ชื่อ-สกุล</span>
                                                    <span className="text-sm font-semibold text-slate-800">{ticket.passenger_name}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-sm text-slate-500">หมายเลขโทรศัพท์</span>
                                                    <span className="text-sm font-semibold text-slate-800">{ticket.passenger_phone}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div> <br />

                                    {/* Passenger info card */}

                                    {/* Trip info card */}
                                    <div className="modal-card-box" >
                                        {ticket && (
                                            <div className="flex justify-between items-start">
                                                <span className="text-sm text-slate-500">เลขจอง</span>
                                                <span className="text-xs font-mono font-semibold text-slate-800 text-right break-all max-w-[60%]">
                                                    #{ticket.ticket_number}
                                                </span>
                                            </div>
                                        )}
                                        {trip && (
                                            <>
                                                <div className="flex justify-between items-start">
                                                    <span className="text-sm text-slate-500">จุดขึ้น</span>
                                                    <span className="text-sm font-semibold text-slate-800 text-right max-w-[60%]">{trip.route_id?.origin}</span>
                                                </div>
                                                <div className="flex justify-between items-start">
                                                    <span className="text-sm text-slate-500">จุดลง</span>
                                                    <span className="text-sm font-semibold text-slate-800 text-right max-w-[60%]">{trip.route_id?.destination}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-sm text-slate-500">เวลาออก</span>
                                                    <span className="text-sm font-semibold text-slate-800">{trip.departure_time}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-sm text-slate-500">เวลาถึง</span>
                                                    <span className="text-sm font-semibold text-slate-800">{trip.arrival_time}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-sm text-slate-500">ระยะเวลา</span>
                                                    <span className="text-sm font-semibold text-slate-800">
                                                        {calcDuration(trip.departure_time, trip.arrival_time)}
                                                    </span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                    <br />
                                    {selectedSeatData?.call_record && selectedSeatData?.call_record.length > 0 && (

                                        <div className="modal-card-box" >
                                            <IonLabel className="font-bold mb-2 block">ประวัติการโทร</IonLabel>
                                            {
                                                selectedSeatData &&  selectedSeatData?.call_record.length > 0 &&selectedSeatData?.call_record?.map((e: any, i: any) => (
                                                    <div key={i} className="call-record-item" >
                                                        <div className="flex justify-between">
                                                            <span className="text-sm text-slate-500">เบอร์โทรศัพท์</span>
                                                            <span className="text-sm font-semibold text-slate-800">{e.phone_number}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-sm text-slate-500">ผลการโทร</span>
                                                            <span className="text-sm font-semibold text-slate-800">
                                                                {e.result === "no_reponse" ? "ไม่สามารถติดต่อได้" :
                                                                    e.result === "successful" ? "โทรสำเร็จ" :
                                                                        e.result === "wrong_number" ? "เบอร์ผิด" :
                                                                            e.result === "customer_deny" ? "ลูกค้าปฏิเสธ" :
                                                                                e.result === "other" ? "อื่นๆ" :
                                                                                    e.result
                                                                }
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))
                                            }
                                        </div>
                                    )}
                                </div>


                            </div>
                        );
                    })()}
                    <br />
                    <div className="px-5 pb-6 pt-3 border-slate-100 flex gap-3 mt-8 ion-padding-horizontal"
                        style={{ borderTop: "1px solid #e5e5e5", width: "100%", maxWidth: "720px" }} >
                        {/* <IonButton expand="block" fill="solid" color="primary" mode="ios" className="flex-1" onClick={checkInSeat} disabled={!!selectedSeatData?.ticket_id?.checked_in_at || !isToday}>
                            เช็คอินผู้โดยสาร
                        </IonButton> */}
                        <IonButton expand="block" fill="solid" color="primary" mode="ios" className="flex-1"  
                        onClick={() => { 
                            printTicket(selectedSeatData)
                        }}>
                            พิมพ์ใบเสร็จตั๋ว
                        </IonButton>
                        <IonButton expand="block" fill="outline" color="primary" mode="ios" className="flex-1" onClick={() => {
                            presentActionSheet({
                                header: `ติดต่อผู้โดยสาร`,
                                buttons: [
                                    { text: "โทรติดต่อผู้โดยสาร", icon: callOutline, handler: () => { calltoCustomer() } },
                                    { text: "ยกเลิก", role: "cancel" }
                                ]
                            })
                        }}>
                            ติดต่อผู้โดยสาร
                        </IonButton>
                    </div>
                </IonContent>
            </IonModal>

            <IonActionSheet
                isOpen={showResultSheet}
                onDidDismiss={() => setShowResultSheet(false)}
                header={`สรุปผลการติดต่อ (${currentPhone})`}
                subHeader="กรุณาเลือกผลการสนทนาที่เกิดขึ้น"
                buttons={[
                    { text: 'สำเร็จ (Successful)', icon: thumbsUpOutline, handler: () => { handlerCall("successful"); submitCallResult('successful'); } },
                    { text: 'ไม่มีผู้รับสาย (No response)', icon: helpCircleOutline, handler: () => { handlerCall("no_reponse"); submitCallResult('no response'); } },
                    { text: 'ลูกค้าปฏิเสธ (Customer deny)', icon: thumbsDownOutline, handler: () => { handlerCall("customer_deny"); submitCallResult('customer deny'); } },
                    { text: 'บันทึกภายหลัง', role: 'cancel' },
                ]}
            />

            <IonLoading isOpen={isLoading} message="กำลังโหลดข้อมูลผังที่นั่ง..." />
            <IonLoading isOpen={isSaving} message="กำลังบันทึกข้อมูล..." />
        </IonPage>
    );
};

export default PlanChair;
 
