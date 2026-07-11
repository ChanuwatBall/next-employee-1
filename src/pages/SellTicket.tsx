import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    IonBackButton,
    IonButton,
    IonButtons,
    IonCheckbox,
    IonContent,
    IonHeader,
    IonInput,
    IonItem,
    IonLabel,
    IonList,
    IonLoading,
    IonPage,
    IonSelect,
    IonSelectOption,
    IonTitle,
    IonToolbar,
    useIonToast,
} from "@ionic/react";
import { useHistory, useLocation, useParams } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleCheck } from "@fortawesome/free-solid-svg-icons";
import moment from "moment";
import QRCode from "qrcode";
import {
    BookingDetail,
    createBooking,
    CreateBookingResponse,
    createPaymentQr,
    driverSellTicket,
    DriverSellTicketResponse,
    getBookingDetail,
    getPaymentTransaction,
    getTripDetail,
    getTripSeats,
} from "../http/api";
import { TripDetail } from "../types/trip";
import { downloadReceiptPdf, ReceiptPdfData } from "../utils/receiptPdf";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Printer } from '@capgo/capacitor-printer';
import "./css/PlanChair.css";
import { Capacitor } from "@capacitor/core";

type SaleStep = "form" | "summary" | "cash" | "qrcode" | "success" | "failed";
type SalePaymentMethod = "cash" | "qrcode" | null;

interface SaleSeat {
    id: string;
    number: string;
    price?: number;
}

interface SalePassengerForm {
    seatNumber: string;
    name: string;
    phone: string;
    passengerType: string;
}

interface SellTicketLocationState {
    seats?: SaleSeat[];
    trip?: TripDetail;
}

const passengerTypeOptions = [
    { value: "da0b8eea-110f-43c1-84a7-e127dd96c3c8", label: "ทั่วไป" },
    { value: "fa3c874f-b3d3-4759-8aaa-e1c3da483aea", label: "เด็ก" },
    { value: "ea073cd9-68e1-4d3a-b4ed-c394e970f766", label: "สวัสดิการแห่งรัฐ" },
    { value: "d76dd5c9-b36a-41d8-8da9-8f6798f4a2e9", label: "ผู้สูงอายุ" },
    { value: "84368cf5-0460-4427-91c0-52ad377115ce", label: "พระภิกษุ/สามเณร" },
    { value: "fe44251a-3318-4bf2-9da9-6297965bfb8d", label: "ทหาร" },
];

const getPassengerTypeLabel = (value: string) => (
    passengerTypeOptions.find((option) => option.value === value)?.label || value
);

const extractTransactionId = (payment: any) => (
    payment?.transactionId || payment?.transaction_id || payment?.id || payment?.chargeId || payment?.charge_id || payment?.omiseChargeId || payment?.omise_charge_id || ""
);

const extractBookingReference = (booking: any) => (
    booking?.bookingReference || booking?.booking_reference || booking?.reference || booking?.id || ""
);

const extractBookingId = (booking: any) => (
    booking?.id || booking?.bookingId || booking?.booking_id || ""
);

const normalizePaymentMethod = (method: SalePaymentMethod) => {
    if (method === "cash") return "เงินสด";
    if (method === "qrcode") return "QR Code";
    return "-";
};

const SellTicket: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const history = useHistory();
    const location = useLocation<SellTicketLocationState | undefined>();
    const [iontoast] = useIonToast();
    const querySeats = new URLSearchParams(location.search).get("seats") || "";
    const stateSeats = location.state?.seats || [];

    const [trip, setTrip] = useState<TripDetail | null>(location.state?.trip || null);
    const [saleSeats, setSaleSeats] = useState<SaleSeat[]>(stateSeats);
    const [salePassengers, setSalePassengers] = useState<SalePassengerForm[]>([]);
    const [useSamePhone, setUseSamePhone] = useState(true);
    const [saleStep, setSaleStep] = useState<SaleStep>("form");
    const [cashReceived, setCashReceived] = useState("");
    const [saleBookingId, setSaleBookingId] = useState("");
    const [saleBookingReference, setSaleBookingReference] = useState("");
    const [saleTicketCode, setSaleTicketCode] = useState("");
    const [salePaymentMethod, setSalePaymentMethod] = useState<SalePaymentMethod>(null);
    const [bookingDetail, setBookingDetail] = useState<BookingDetail | null>(null);
    const [ticketQrCodeImage, setTicketQrCodeImage] = useState("");
    const [qrPaymentData, setQrPaymentData] = useState<any | null>(null);
    const [qrTransactionId, setQrTransactionId] = useState("");
    const [qrCountdown, setQrCountdown] = useState(300);
    const [qrPaymentStatus, setQrPaymentStatus] = useState("");
    const [saleErrorMessage, setSaleErrorMessage] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const qrDeadlineRef = useRef<number | null>(null);
    const qrPollCountRef = useRef(0);

    const selectedSeatNumbers = useMemo(() => (
        querySeats
            .split(",")
            .map((seat) => seat.trim())
            .filter(Boolean)
    ), [querySeats]);

    const saleSummaryItems = useMemo(() => (
        salePassengers.map((passenger) => {
            const seat = saleSeats.find((selectedSeat) => selectedSeat.number === passenger.seatNumber);
            const price = seat?.price ?? trip?.price ?? trip?.route_id?.base_price ?? 0;
            return { passenger, seat, price };
        })
    ), [salePassengers, saleSeats, trip]);

    const saleTotalPrice = saleSummaryItems.reduce((total, item) => total + item.price, 0);
    const cashReceivedAmount = Number(cashReceived) || 0;
    const cashChange = Math.max(cashReceivedAmount - saleTotalPrice, 0);
    const qrPaymentImage = qrPaymentData?.qrCodeUrl;
    const qrPaymentText = qrPaymentData?.status;

    useEffect(() => {
        const fetchSaleContext = async () => {
            setIsLoading(true);
            try {
                const [tripData, seatData] = await Promise.all([
                    trip ? Promise.resolve(trip) : getTripDetail(id),
                    saleSeats.length > 0 ? Promise.resolve(null) : getTripSeats(id),
                ]);

                setTrip(tripData as TripDetail);

                if (saleSeats.length === 0) {
                    const seatsFromQuery = (seatData?.seats || [])
                        .filter((seat: any) => selectedSeatNumbers.includes(seat.number))
                        .map((seat: any) => ({
                            id: seat.number,
                            number: seat.number,
                            price: seat.price,
                        }));
                    setSaleSeats(seatsFromQuery);
                }
            } catch (error) {
                console.error("Error loading sale context:", error);
                iontoast({ message: "โหลดข้อมูลเตรียมขายไม่สำเร็จ", duration: 2200, color: "danger", position: "top" });
            } finally {
                setIsLoading(false);
            }
        };

        void fetchSaleContext();
    }, [id]);

    useEffect(() => {
        setSalePassengers(saleSeats.map((seat) => ({
            seatNumber: seat.number,
            name: "",
            phone: "",
            passengerType: "general",
        })));
    }, [saleSeats]);

    const getBoardingPointId = () => {
        const stops = trip?.bus_stops || [];
        return stops[0]?.id || trip?.route_id?.origin_id || trip?.origin_province_id || "";
    };

    const getDropOffPointId = () => {
        const stops = trip?.bus_stops || [];
        return stops[stops.length - 1]?.id || trip?.route_id?.destination_id || trip?.destination_province_id || "";
    };

    const validateSaleForm = () => {
        if (saleSeats.length === 0) {
            iontoast({ message: "ไม่พบที่นั่งสำหรับขายตั๋ว", duration: 2200, color: "warning", position: "top" });
            return false;
        }

        const missingName = salePassengers.some((passenger) => !passenger.name.trim());
        const missingPhone = useSamePhone
            ? !salePassengers[0]?.phone.trim()
            : salePassengers.some((passenger) => !passenger.phone.trim());

        if (missingName || missingPhone) {
            iontoast({ message: "กรุณากรอกชื่อและเบอร์โทรให้ครบถ้วน", duration: 2200, color: "warning", position: "top" });
            return false;
        }

        return true;
    };

    const updateSalePassenger = (index: number, field: keyof SalePassengerForm, value: string) => {
        setSalePassengers((prev) => {
            const next = prev.map((passenger, passengerIndex) => (
                passengerIndex === index ? { ...passenger, [field]: value } : passenger
            ));

            if (field === "phone" && useSamePhone && index === 0) {
                return next.map((passenger) => ({ ...passenger, phone: value }));
            }

            return next;
        });
    };

    const toggleSamePhone = (checked: boolean) => {
        setUseSamePhone(checked);
        if (checked) {
            setSalePassengers((prev) => {
                const sharedPhone = prev[0]?.phone || "";
                return prev.map((passenger) => ({ ...passenger, phone: sharedPhone }));
            });
        }
    };

    const buildBookingPayload = (omiseChargeId: string) => ({
        tripId: id,
        travelDate: trip?.date || moment().format("YYYY-MM-DD"),
        originProvinceId: trip?.origin_province_id || trip?.route_id?.origin_id || "",
        destinationProvinceId: trip?.destination_province_id || trip?.route_id?.destination_id || "",
        boardingPointId: getBoardingPointId(),
        dropOffPointId: getDropOffPointId(),
        passengers: saleSummaryItems.map((item) => ({
            seatId: item.seat?.id || item.passenger.seatNumber,
            seatNumber: item.passenger.seatNumber,
            fullName: item.passenger.name,
            thaiId: "",
            phone: item.passenger.phone,
            passengerType: item.passenger.passengerType,
        })),
        promoCode: "",
        omiseChargeId,
    });

    const buildReceiptData = (
        detail: BookingDetail | null,
        method: SalePaymentMethod,
        qrImage: string,
        bookingReference: string,
    ): ReceiptPdfData => {
        const passengers = detail?.passengers?.length
            ? detail.passengers
            : saleSummaryItems.map((item) => ({
                fullName: item.passenger.name,
                phone: item.passenger.phone,
                seatNumber: item.passenger.seatNumber,
                passengerType: item.passenger.passengerType,
            }));
        const seats = detail?.seats?.length ? detail.seats : passengers.map((passenger) => passenger.seatNumber);
        const total = detail?.total ?? saleTotalPrice;

        return {
            bookingDetail: detail,
            trip,
            passengers,
            seats,
            qrCodeImage: qrImage,
            bookingReference,
            paymentMethod: detail?.paymentMethod || normalizePaymentMethod(method),
            paymentStatus: detail?.paymentStatus || "paid",
            total,
            cashReceived: method === "cash" ? cashReceivedAmount : undefined,
            cashChange: method === "cash" ? cashChange : undefined,
            pricePerSeat: detail?.pricePerSeat || Math.round(total / Math.max(passengers.length, 1)),
        };
    };

    const blobToBase64 = async (blob: Blob): Promise<string> => {
        const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(`${reader.result || ""}`);
            reader.onerror = () => reject(new Error("Unable to convert PDF blob to base64"));
            reader.readAsDataURL(blob);
        });

        return dataUrl.split(",")[1] || "";
    };

    const printReceiptPdf = async (pdfBase64: string, reference: string) => {
        const safeReference = reference || "receipt";
        const fileName = `receipt/${safeReference}.pdf`;

        if (Capacitor.getPlatform() === "android") {
            const base64Data = pdfBase64;
            const filestore = await Filesystem.writeFile({
                path: fileName,
                data: base64Data,
                directory: Directory.Cache,
                recursive: true,
            });

            await Printer.printPdf({
                name: fileName,
                path: filestore.uri,
            }) 

            return;
        }
        const pdfBlob = await fetch(`data:application/pdf;base64,${pdfBase64}`).then((res) => res.blob());
        const pdffile = new File([pdfBlob], `${safeReference}.pdf`, { type: "application/pdf" });
        const url = URL.createObjectURL(pdffile);
        await Printer.printPdf({
            name: fileName,
            path: url,
        });
        URL.revokeObjectURL(url);
    };

    const downloadCurrentReceipt = async () => {
        if (!bookingDetail || !ticketQrCodeImage) return;

        try {
            const pdfbase64 = await downloadReceiptPdf(buildReceiptData(
                bookingDetail,
                salePaymentMethod,
                ticketQrCodeImage,
                bookingDetail.bookingReference || saleBookingReference,
            ), "base64");
            await printReceiptPdf(pdfbase64, bookingDetail.bookingReference || saleBookingReference);

        } catch (err) {
            console.error("Receipt PDF error:", err);
            iontoast({ message: "สร้างใบเสร็จ PDF ไม่สำเร็จ", duration: 2200, color: "danger", position: "top" });
        }
    };

    const setSuccessFromBookingDetail = async (detail: BookingDetail, method: SalePaymentMethod, fallbackReference?: string) => {
        const tripId = detail?.tripId || id;
        const bookingReference = detail?.bookingReference || fallbackReference || saleBookingReference;
        const qrBookingPayload = JSON.stringify({ "trip": tripId, "bookingReference": bookingReference });
        const qrImage = await QRCode.toDataURL(btoa(qrBookingPayload));
        const receiptData = buildReceiptData(detail, method, qrImage, bookingReference);

        setBookingDetail(detail);
        setSaleBookingReference(bookingReference);
        setTicketQrCodeImage(qrImage);
        setSaleTicketCode(btoa(JSON.stringify({
            trip: tripId,
            bookingReference,
            source: method === "cash" ? "driver_cash_sale" : "driver_qr_sale",
        })));
        setSalePaymentMethod(method);
        setSaleStep("success");

        const pdfbase64 = await downloadReceiptPdf(receiptData, "base64");
        await printReceiptPdf(pdfbase64, detail?.bookingReference || bookingReference);
    };

    const startQrPayment = async () => {
        if (!validateSaleForm()) return;
        setIsSaving(true);
        setSalePaymentMethod("qrcode");
        setSaleErrorMessage("");
        setQrPaymentStatus("pending");

        try {
            const payment = await createPaymentQr({ amount: saleTotalPrice });
            const transactionId = extractTransactionId(payment);

            if (!transactionId) {
                throw new Error("ไม่พบรหัสธุรกรรมจากระบบชำระเงิน");
            }

            setQrPaymentData(payment);
            setQrTransactionId(transactionId);

            const booking: CreateBookingResponse = await createBooking(buildBookingPayload(transactionId));
            console.log("Booking created:", JSON.stringify(booking));
            setSaleBookingId(booking?.bookingId || extractBookingId(booking));
            setSaleBookingReference(booking?.bookingReference || extractBookingReference(booking));

            qrDeadlineRef.current = Date.now() + (5 * 60 * 1000);
            qrPollCountRef.current = 0;
            setQrCountdown(300);
            setSaleStep("qrcode");
        } catch (err: any) {
            console.error("QR payment error:", err);
            setSaleErrorMessage(err?.response?.data?.message || err?.response?.data?.error || err?.message || "สร้าง QR Code ไม่สำเร็จ");
            setSaleStep("failed");
        } finally {
            setIsSaving(false);
        }
    };

    const handleConfirmCashPayment = async () => {
        if (cashReceivedAmount < saleTotalPrice) {
            iontoast({ message: "จำนวนเงินสดไม่พอสำหรับยอดชำระ", duration: 2200, color: "warning", position: "top" });
            return;
        }

        setIsSaving(true);
        setSaleErrorMessage("");
        try {
            const sessionstr = localStorage.getItem("session")
            const session = JSON.parse(sessionstr || "{}")
            const payload = {
                tripId: id,
                passengers: saleSummaryItems.map((item) => ({
                    seatNumber: item.passenger.seatNumber,
                    fullName: item.passenger.name,
                    phone: item.passenger.phone,
                    tierId: item.passenger.passengerType,
                })),
                addOns: [],
            };

            const result: DriverSellTicketResponse = await driverSellTicket(payload, session?.access_token);
            if (!result?.bookingId) {
                throw new Error("ไม่พบรหัส booking หลังขายตั๋ว");
            }

            setSaleBookingId(result.bookingId);
            const detail = await getBookingDetail(result.bookingId, session?.access_token);
            await setSuccessFromBookingDetail(detail, "cash", result.bookingReference);
            iontoast({ message: "ชำระเงินสดสำเร็จ", duration: 2000, color: "success", position: "top" });
            downloadCurrentReceipt()
        } catch (err: any) {
            console.error("Cash payment error:", err);
            setSaleErrorMessage(err?.response?.data?.message || err?.response?.data?.error || err?.message || "ขายตั๋วเงินสดไม่สำเร็จ");
            setSaleStep("failed");
        } finally {
            setIsSaving(false);
        }
    };

    const finalizeQrBookingSuccess = async () => {
        try {
            if (!saleBookingId) {
                throw new Error("ไม่พบรหัส booking สำหรับดึงรายละเอียด");
            }

            const detail = await getBookingDetail(saleBookingId);
            await setSuccessFromBookingDetail(detail, "qrcode", saleBookingReference);
            iontoast({ message: "จองตั๋วสำเร็จ", duration: 2000, color: "success", position: "top" });
            downloadCurrentReceipt()
        } catch (err: any) {
            console.error("Fetch booking after QR success error:", err);
            setSaleErrorMessage(err?.response?.data?.message || err?.response?.data?.error || err?.message || "ดึงข้อมูล booking ไม่สำเร็จ");
            setSaleStep("failed");
        }
    };

    useEffect(() => {
        if (saleStep !== "qrcode" || !qrTransactionId) return;

        const intervalId = window.setInterval(async () => {
            const deadline = qrDeadlineRef.current;
            if (!deadline) return;

            const secondsLeft = Math.max(Math.ceil((deadline - Date.now()) / 1000), 0);
            setQrCountdown(secondsLeft);

            if (secondsLeft <= 0) {
                window.clearInterval(intervalId);
                setQrPaymentStatus("expired");
                setSaleErrorMessage("หมดเวลาชำระเงิน QR Code");
                setSaleStep("failed");
                return;
            }

            qrPollCountRef.current += 1;
            if (qrPollCountRef.current % 3 !== 0) return;

            try {
                const transaction = await getPaymentTransaction(qrTransactionId);
                const status = `${transaction?.status || transaction?.paymentStatus || transaction?.payment_status || ""}`.toLowerCase();
                setQrPaymentStatus(status || "pending");

                if (status === "success" || status === "successful" || status === "paid") {
                    window.clearInterval(intervalId);
                    await finalizeQrBookingSuccess();
                }

                if (status === "failed" || status === "fail" || status === "canceled" || status === "cancelled" || status === "expired") {
                    window.clearInterval(intervalId);
                    setSaleErrorMessage("ชำระเงินไม่สำเร็จ");
                    setSaleStep("failed");
                }
            } catch (err) {
                console.error("Payment polling error:", err);
            }
        }, 1000);

        return () => window.clearInterval(intervalId);
    }, [saleStep, qrTransactionId, saleBookingId, saleBookingReference, iontoast]);

    const openSoldTicketDetail = () => {
        if (!saleTicketCode) return;
        history.push(`/ticket/${saleTicketCode}`);
    };

    const bookingSeats = bookingDetail?.seats?.length ? bookingDetail.seats : saleSummaryItems.map((item) => item.passenger.seatNumber);
    const bookingPassengers = bookingDetail?.passengers?.length ? bookingDetail.passengers : saleSummaryItems.map((item) => ({
        fullName: item.passenger.name,
        phone: item.passenger.phone,
        seatNumber: item.passenger.seatNumber,
        passengerType: item.passenger.passengerType,
        thaiId: "",
    }));
    const successTotal = bookingDetail?.total ?? saleTotalPrice;

    return (
        <IonPage>
            <IonHeader className="ion-no-border">
                <IonToolbar color="primary">
                    <IonButtons slot="start">
                        <IonBackButton defaultHref={`/plan/${id}`} text="" />
                    </IonButtons>
                    <IonTitle style={{ color: "#FFF" }}>ขายตั๋ว</IonTitle>
                </IonToolbar>
            </IonHeader>

            <IonContent scrollY className="bg-slate-50">
                <div className="sale-modal sell-ticket-page">
                    <div className="sale-modal-header">
                        <div>
                            <h2>
                                {saleStep === "form" && "เตรียมขายตั๋ว"}
                                {saleStep === "summary" && "สรุปรายการ"}
                                {saleStep === "cash" && "ชำระเงินสด"}
                                {saleStep === "qrcode" && "ชำระเงิน QR Code"}
                                {saleStep === "success" && "จองตั๋วสำเร็จ"}
                                {saleStep === "failed" && "ชำระเงินไม่สำเร็จ"}
                            </h2>
                            <p>{salePassengers.length} ผู้โดยสาร • ที่นั่ง {salePassengers.map((p) => p.seatNumber).join(", ") || "-"}</p>
                        </div>
                    </div>

                    {trip && (
                        <div className="sale-summary-card">
                            <div className="sale-summary-row">
                                <span>เที่ยวรถ</span>
                                <strong>{trip.route_id?.origin} - {trip.route_id?.destination}</strong>
                            </div>
                            <div className="sale-summary-row">
                                <span>เวลาเดินทาง</span>
                                <strong>{moment(trip.date).format("DD MMM YYYY")} • {trip.departure_time}</strong>
                            </div>
                        </div>
                    )}

                    {saleStep === "form" && (
                        <>
                            <IonItem lines="none" className="same-phone-item">
                                <IonCheckbox
                                    checked={useSamePhone}
                                    onIonChange={(event) => toggleSamePhone(event.detail.checked)}
                                    labelPlacement="end"
                                >
                                    ใช้เบอร์เดียวกัน
                                </IonCheckbox>
                            </IonItem>

                            <IonList className="sale-passenger-list">
                                {salePassengers.map((passenger, index) => (
                                    <div className="sale-passenger-card" key={passenger.seatNumber}>
                                        <div className="sale-passenger-title">
                                            <span>ผู้โดยสาร {index + 1}</span>
                                            <strong>ที่นั่ง {passenger.seatNumber}</strong>
                                        </div>

                                        <IonItem className="sale-form-item">
                                            <IonLabel position="stacked">ชื่อผู้โดยสาร</IonLabel>
                                            <IonInput
                                                value={passenger.name}
                                                placeholder="กรอกชื่อ"
                                                onIonInput={(event) => updateSalePassenger(index, "name", `${event.detail.value || ""}`)}
                                            />
                                        </IonItem>

                                        <IonItem className="sale-form-item">
                                            <IonLabel position="stacked">
                                                เบอร์โทร{useSamePhone && index > 0 ? " (ใช้ร่วมกัน)" : ""}
                                            </IonLabel>
                                            <IonInput
                                                value={passenger.phone}
                                                placeholder="กรอกเบอร์โทร"
                                                inputMode="tel"
                                                type="tel"
                                                maxlength={10}
                                                disabled={useSamePhone && index > 0}
                                                onIonInput={(event) => updateSalePassenger(index, "phone", `${event.detail.value || ""}`)}
                                            />
                                        </IonItem>

                                        <IonItem className="sale-form-item">
                                            <IonLabel position="stacked">ประเภทผู้โดยสาร</IonLabel>
                                            <IonSelect
                                                value={passenger.passengerType}
                                                interface="action-sheet"
                                                onIonChange={(event) => updateSalePassenger(index, "passengerType", event.detail.value)}
                                            >
                                                {passengerTypeOptions.map((option) => (
                                                    <IonSelectOption key={option.value} value={option.value}>
                                                        {option.label}
                                                    </IonSelectOption>
                                                ))}
                                            </IonSelect>
                                        </IonItem>
                                    </div>
                                ))}
                            </IonList>

                            <div className="sale-payment-footer">
                                <IonButton expand="block" mode="ios" color="primary" onClick={() => validateSaleForm() && setSaleStep("summary")}>
                                    ถัดไป
                                </IonButton>
                            </div>
                        </>
                    )}

                    {saleStep === "summary" && (
                        <>
                            <div className="sale-summary-card">
                                <div className="sale-summary-row">
                                    <span>จำนวนที่นั่ง</span>
                                    <strong>{saleSummaryItems.length} ที่นั่ง</strong>
                                </div>
                                <div className="sale-summary-row">
                                    <span>ที่นั่ง</span>
                                    <strong>{saleSummaryItems.map((item) => item.passenger.seatNumber).join(", ")}</strong>
                                </div>
                            </div>

                            <div className="sale-summary-list">
                                {saleSummaryItems.map((item, index) => (
                                    <div className="sale-summary-passenger" key={item.passenger.seatNumber}>
                                        <div className="sale-passenger-title">
                                            <span>ผู้โดยสาร {index + 1}</span>
                                            <strong>ที่นั่ง {item.passenger.seatNumber}</strong>
                                        </div>
                                        <div className="sale-summary-row">
                                            <span>ชื่อ</span>
                                            <strong>{item.passenger.name}</strong>
                                        </div>
                                        <div className="sale-summary-row">
                                            <span>เบอร์โทร</span>
                                            <strong>{item.passenger.phone}</strong>
                                        </div>
                                        <div className="sale-summary-row">
                                            <span>ประเภท</span>
                                            <strong>{getPassengerTypeLabel(item.passenger.passengerType)}</strong>
                                        </div>
                                        <div className="sale-summary-row">
                                            <span>ราคา</span>
                                            <strong>{item.price.toLocaleString()} บาท</strong>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="sale-summary-total">
                                <span>ยอดรวม</span>
                                <strong>{saleTotalPrice.toLocaleString()} บาท</strong>
                            </div>

                            <div className="sale-payment-footer">
                                <IonButton expand="block" mode="ios" color="primary" onClick={startQrPayment}>
                                    QR Code
                                </IonButton>
                                <IonButton expand="block" mode="ios" fill="outline" color="primary" onClick={() => setSaleStep("cash")}>
                                    ชำระเงินสด
                                </IonButton>
                            </div>
                            <IonButton expand="block" mode="ios" fill="outline" color="medium" onClick={() => setSaleStep("form")}>
                                ย้อนกลับ
                            </IonButton>
                        </>
                    )}

                    {saleStep === "cash" && (
                        <>
                            <div className="sale-summary-card">
                                <div className="sale-summary-row">
                                    <span>ยอดชำระสุทธิ</span>
                                    <strong>{saleTotalPrice.toLocaleString()} บาท</strong>
                                </div>
                            </div>

                            <IonItem className="sale-form-item ion-margin-bottom">
                                <IonLabel position="fixed">เงินสดที่รับ</IonLabel>
                                <IonInput
                                    value={cashReceived}
                                    mode="ios"
                                    placeholder="กรอกจำนวนเงินสด"
                                    inputMode="decimal"
                                    className="ion-text-right"
                                    type="number"
                                    min="0"
                                    onIonInput={(event) => setCashReceived(`${event.detail.value || ""}`)}
                                />
                            </IonItem>

                            <div className="sale-summary-total">
                                <span>เงินทอน</span>
                                <strong>{cashChange.toLocaleString()} บาท</strong>
                            </div>

                            <div className="sale-payment-footer">
                                <IonButton expand="block" mode="ios" fill="outline" color="medium" onClick={() => setSaleStep("summary")}>
                                    ย้อนกลับ
                                </IonButton>
                                <IonButton expand="block" mode="ios" color="primary" onClick={handleConfirmCashPayment}>
                                    ยืนยันชำระเงิน
                                </IonButton>
                            </div>
                        </>
                    )}

                    {saleStep === "qrcode" && (
                        <>
                            <div className="sale-summary-card">
                                <div className="sale-summary-row">
                                    <span>ยอดชำระ</span>
                                    <strong>{saleTotalPrice.toLocaleString()} บาท</strong>
                                </div>
                                <div className="sale-summary-row">
                                    <span>สถานะ</span>
                                    <strong>{qrPaymentStatus || "pending"}</strong>
                                </div>
                                <div className="sale-summary-row">
                                    <span>เวลาที่เหลือ</span>
                                    <strong>
                                        {Math.floor(qrCountdown / 60)}:{(qrCountdown % 60).toString().padStart(2, "0")} นาที
                                    </strong>
                                </div>
                            </div>

                            <div className="sale-qr-card">
                                {qrPaymentImage ? (
                                    <img src={qrPaymentImage} alt="QR Code สำหรับชำระเงิน" />
                                ) : (
                                    <div className="sale-qr-placeholder">
                                        <span>รอข้อมูล QR Code</span>
                                    </div>
                                )}
                                {qrPaymentText && <p>{qrPaymentText}</p>}
                            </div>

                            <div className="sale-payment-footer">
                                <IonButton expand="block" mode="ios" fill="outline" color="medium" onClick={() => setSaleStep("summary")}>
                                    ย้อนกลับ
                                </IonButton>
                            </div>
                        </>
                    )}

                    {saleStep === "success" && (
                        <>
                            <div className="sale-success-card">
                                <div className="sale-success-icon">
                                    <FontAwesomeIcon icon={faCircleCheck} />
                                </div>
                                <h3>จองตั๋วสำเร็จ</h3>
                                <p>เลขจอง #{bookingDetail?.bookingReference || saleBookingReference}</p>
                                {ticketQrCodeImage && (
                                    <img className="sale-ticket-qr-image" src={ticketQrCodeImage} alt="QR Code ตั๋ว" />
                                )}
                            </div>

                            <div className="sale-summary-card">
                                <div className="sale-summary-row">
                                    <span>เส้นทาง</span>
                                    <strong>{bookingDetail?.origin || trip?.route_id?.origin || "-"} - {bookingDetail?.destination || trip?.route_id?.destination || "-"}</strong>
                                </div>
                                <div className="sale-summary-row">
                                    <span>วันเวลา</span>
                                    <strong>
                                        {bookingDetail?.date ? moment(bookingDetail.date).format("DD MMM YYYY") : trip?.date ? moment(trip.date).format("DD MMM YYYY") : "-"}
                                        {" • "}
                                        {bookingDetail?.departureTime || trip?.departure_time || "-"}
                                    </strong>
                                </div>
                                <div className="sale-summary-row">
                                    <span>ที่นั่ง</span>
                                    <strong>{bookingSeats.join(", ")}</strong>
                                </div>
                                <div className="sale-summary-row">
                                    <span>วิธีชำระเงิน</span>
                                    <strong>{bookingDetail?.paymentMethod || normalizePaymentMethod(salePaymentMethod)}</strong>
                                </div>
                                <div className="sale-summary-row">
                                    <span>สถานะชำระเงิน</span>
                                    <strong>{bookingDetail?.paymentStatus || "paid"}</strong>
                                </div>
                                <div className="sale-summary-row">
                                    <span>ยอดชำระ</span>
                                    <strong>{successTotal.toLocaleString()} บาท</strong>
                                </div>
                                {salePaymentMethod === "cash" && (
                                    <>
                                        <div className="sale-summary-row">
                                            <span>รับเงินสด</span>
                                            <strong>{cashReceivedAmount.toLocaleString()} บาท</strong>
                                        </div>
                                        <div className="sale-summary-row">
                                            <span>เงินทอน</span>
                                            <strong>{cashChange.toLocaleString()} บาท</strong>
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="sale-summary-list">
                                {bookingPassengers.map((passenger, index) => (
                                    <div className="sale-summary-passenger" key={`${passenger.seatNumber}-${index}`}>
                                        <div className="sale-passenger-title">
                                            <span>ผู้โดยสาร {index + 1}</span>
                                            <strong>ที่นั่ง {passenger.seatNumber}</strong>
                                        </div>
                                        <div className="sale-summary-row">
                                            <span>ชื่อ</span>
                                            <strong>{passenger.fullName}</strong>
                                        </div>
                                        <div className="sale-summary-row">
                                            <span>เบอร์โทร</span>
                                            <strong>{passenger.phone}</strong>
                                        </div>
                                        <div className="sale-summary-row">
                                            <span>ประเภท</span>
                                            <strong>{getPassengerTypeLabel(passenger.passengerType)}</strong>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div >
                                <IonButton className="ioin-margin-bottom" expand="block" mode="ios" color="primary" onClick={openSoldTicketDetail}>
                                    เปิดรายละเอียดตั๋ว
                                </IonButton>
                                <IonButton className="ioin-margin-bottom" expand="block" mode="ios" fill="outline" color="primary" onClick={downloadCurrentReceipt}>
                                    พิมพ์ใบเสร็จ
                                </IonButton>
                                <IonButton expand="block" mode="ios" fill="outline" color="medium" onClick={() => history.replace(`/plan/${id}`)}>
                                    กลับไปผังที่นั่ง
                                </IonButton>
                            </div>
                        </>
                    )}

                    {saleStep === "failed" && (
                        <>
                            <div className="sale-failed-card">
                                <div className="sale-failed-icon">!</div>
                                <h3>ชำระเงินไม่สำเร็จ</h3>
                                <p>{saleErrorMessage || "ไม่พบสถานะ success จากระบบชำระเงิน"}</p>
                            </div>

                            <div className="sale-payment-footer">
                                <IonButton expand="block" mode="ios" fill="outline" color="medium" onClick={() => setSaleStep("summary")}>
                                    กลับไปสรุปรายการ
                                </IonButton>
                                <IonButton expand="block" mode="ios" color="primary" onClick={startQrPayment}>
                                    ลอง QR Code อีกครั้ง
                                </IonButton>
                            </div>
                        </>
                    )}
                </div>
            </IonContent>

            <IonLoading isOpen={isLoading} message="กำลังโหลดข้อมูลเตรียมขาย..." />
            <IonLoading isOpen={isSaving} message="กำลังบันทึกข้อมูล..." />
        </IonPage>
    );
};

export default SellTicket;
