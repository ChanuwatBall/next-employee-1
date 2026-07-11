import pdfMakeModule from "pdfmake/build/pdfmake";
import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import moment from "moment";
import { BookingDetail } from "../http/api";
import { TripDetail } from "../types/trip";

const pdfMake = (pdfMakeModule as any).default || pdfMakeModule;

export interface ReceiptPdfPassenger {
    fullName: string;
    phone: string;
    seatNumber: string;
    passengerType: string;
}

export interface ReceiptPdfData {
    bookingDetail: BookingDetail | null;
    trip: TripDetail | null;
    passengers: ReceiptPdfPassenger[];
    seats: string[];
    qrCodeImage: string;
    bookingReference: string;
    paymentMethod: string;
    paymentStatus: string;
    total: number;
    cashReceived?: number;
    cashChange?: number;
    pricePerSeat?: number;
}

const COMPANY_PROFILE = {
    name: "Nova Express Co., Ltd.",
    address: "99/9 Mockup Road, Bangkok 10110",
    phone: "02-000-0000",
};

const FONT_REGULAR = "Sarabun-Regular.ttf";
const FONT_BOLD = "Sarabun-Bold.ttf";
const THAI_FONT = "Sarabun";
let thaiFontReady: Promise<void> | null = null;

const fetchFontAsBase64 = async (path: string) => {
    const response = await fetch(path);
    if (!response.ok) {
        throw new Error(`โหลดฟอนต์ใบเสร็จไม่สำเร็จ: ${path}`);
    }

    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    bytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
    });
    return btoa(binary);
};

const ensureThaiPdfFont = async () => {
    if (!thaiFontReady) {
        thaiFontReady = Promise.all([
            fetchFontAsBase64("/assets/fonts/Sarabun-Regular.ttf"),
            fetchFontAsBase64("/assets/fonts/Sarabun-Bold.ttf"),
        ]).then(([regular, bold]) => {
            pdfMake.addFontContainer({
                vfs: {
                    [FONT_REGULAR]: regular,
                    [FONT_BOLD]: bold,
                },
                fonts: {
                    [THAI_FONT]: {
                        normal: FONT_REGULAR,
                        bold: FONT_BOLD,
                        italics: FONT_REGULAR,
                        bolditalics: FONT_BOLD,
                    },
                },
            });
            pdfMake.setFonts({
                ...(pdfMake.fonts || {}),
                [THAI_FONT]: {
                    normal: FONT_REGULAR,
                    bold: FONT_BOLD,
                    italics: FONT_REGULAR,
                    bolditalics: FONT_BOLD,
                },
            });
            pdfMake.addVirtualFileSystem({
                [FONT_REGULAR]: regular,
                [FONT_BOLD]: bold,
            });
        });
    }

    return thaiFontReady;
};

const formatDate = (value?: string) => (value ? moment(value).format("DD MMM YYYY") : "-");

const money = (value?: number) => `${Number(value || 0).toLocaleString()} บาท`;

const RECEIPT_WIDTH = 210;
const PAGE_MARGIN_X = 8;
const CONTENT_WIDTH = RECEIPT_WIDTH - (PAGE_MARGIN_X * 2);

const getPassengerTypeLabel = (value: string) => {
    const labels: Record<string, string> = {
        general: "ทั่วไป",
        "da0b8eea-110f-43c1-84a7-e127dd96c3c8": "ทั่วไป",
        child: "เด็ก",
        welfare: "สวัสดิการแห่งรัฐ",
        elderly: "ผู้สูงอายุ",
        monk: "พระภิกษุ/สามเณร",
        military: "ทหาร",
    };
    return labels[value] || value || "-";
};

const compactText = (value?: string) => value?.trim() || "-";

const labelValue = (label: string, value: string): Content => ({
    columns: [
        { text: label, width: 45, color: "#334155", font: THAI_FONT },
        { text: value || "-", width: "*", font: THAI_FONT },
    ],
    columnGap: 3,
    margin: [0, 0, 0, 0.5],
});

const divider = (margin: [number, number, number, number] = [0, 3, 0, 3]): Content => ({
    canvas: [
        { type: "line", x1: 0, y1: 0, x2: CONTENT_WIDTH, y2: 0, lineWidth: 0.5, lineColor: "#94a3b8", dash: { length: 2, space: 2 } },
    ],
    margin,
});

const amountRow = (label: string, value: string, bold = false): Content => ({
    columns: [
        { text: label, width: "*", bold, font: THAI_FONT },
        { text: value, width: 62, alignment: "right", bold, font: THAI_FONT },
    ],
    margin: [0, 0, 0, 0.5],
});

const sectionTitle = (text: string): Content => ({
    text,
    bold: true,
    fontSize: 7.2,
    margin: [0, 1, 0, 1],
});

const passengerLine = (passenger: ReceiptPdfPassenger, index: number, pricePerSeat: number): Content => ({
    columns: [
        {
            text: `${index + 1}. ${compactText(passenger.fullName)} | โทร ${compactText(passenger.phone)} | ที่นั่ง ${compactText(passenger.seatNumber)} | ${getPassengerTypeLabel(passenger.passengerType)}`,
            width: "*",
            fontSize: 6.8,
        },
        { text: money(pricePerSeat), width: 52, alignment: "right", fontSize: 6.8 },
    ],
    columnGap: 3,
    margin: [0, 0, 0, 0.5],
});

const buildReceiptDefinition = (data: ReceiptPdfData): TDocumentDefinitions => {
    const detail = data.bookingDetail;
    const origin = detail?.origin || data.trip?.route_id?.origin || "-";
    const destination = detail?.destination || data.trip?.route_id?.destination || "-";
    const tripDate = detail?.date || data.trip?.date || "";
    const departureTime = detail?.departureTime || data.trip?.departure_time || "-";
    const arrivalTime = detail?.arrivalTime || data.trip?.arrival_time || "-";
    const pricePerSeat = data.pricePerSeat || detail?.pricePerSeat || Math.round(data.total / Math.max(data.passengers.length, 1));
    const boardingPoint = detail?.boardingPoint || data.trip?.bus_stops?.[0]?.name || "-";
    const dropOffPoint = detail?.dropOffPoint || data.trip?.bus_stops?.[data.trip.bus_stops.length - 1]?.name || "-";
    const busPlate = detail?.busPlate || data.trip?.bus_number || "-";

    return {
        pageSize: { width: RECEIPT_WIDTH, height: "auto" },
        pageMargins: [PAGE_MARGIN_X, 7, PAGE_MARGIN_X, 8],
        defaultStyle: {
            font: THAI_FONT,
            fontSize: 7,
            color: "#111827",
            lineHeight: 1.02,
        },
        styles: {
            companyName: { font: THAI_FONT, fontSize: 10, bold: true, alignment: "center", color: "#111827" },
            receiptTitle: { font: THAI_FONT, fontSize: 8.2, bold: true, alignment: "center", color: "#111827" },
            footer: { font: THAI_FONT, fontSize: 5.6, color: "#334155", lineHeight: 0.95 },
        },
        content: [
            { text: COMPANY_PROFILE.name, style: "companyName" },
            { text: `${COMPANY_PROFILE.address} | โทร. ${COMPANY_PROFILE.phone}`, alignment: "center", fontSize: 5.8, margin: [0, 0, 0, 1] },
            divider([0, 2, 0, 2]),
            { text: "ใบเสร็จรับเงิน / RECEIPT", style: "receiptTitle" },
            {
                columns: [
                    { text: `เลขจอง #${data.bookingReference || "-"}`, width: "*", bold: true },
                    { text: moment().format("DD/MM/YY HH:mm"), width: 64, alignment: "right" },
                ],
                columnGap: 4,
                margin: [0, 1, 0, 0],
            },
            divider([0, 2, 0, 2]),
            data.qrCodeImage
                ? { image: data.qrCodeImage, width: 68, alignment: "center", margin: [0, 0, 0, 0] }
                : { text: "QR Code", alignment: "center", margin: [0, 18, 0, 18] },
            { text: "QR CODE ตั๋วโดยสาร", alignment: "center", fontSize: 5.8, margin: [0, 0, 0, 1] },
            divider([0, 2, 0, 2]),
            sectionTitle("รายละเอียดเที่ยวจอง"),
            labelValue("เส้นทาง", `${origin} - ${destination}`),
            labelValue("วัน/เวลา", `${formatDate(tripDate)} ${departureTime} - ${arrivalTime}`),
            labelValue("ขึ้น/ลง", `${boardingPoint} -> ${dropOffPoint}`),
            labelValue("รถ", busPlate),
            labelValue("ที่นั่ง", data.seats.join(", ") || "-"),
            divider([0, 2, 0, 2]),
            sectionTitle("ผู้โดยสาร"),
            ...data.passengers.map((passenger, index) => passengerLine(passenger, index, pricePerSeat)),
            divider([0, 2, 0, 2]),
            labelValue("วิธีชำระเงิน", data.paymentMethod),
            labelValue("สถานะ", data.paymentStatus),
            ...(data.cashReceived !== undefined
                ? [
                    amountRow("รับเงินสด", money(data.cashReceived)),
                    amountRow("เงินทอน", money(data.cashChange)),
                ]
                : []),
            divider([0, 2, 0, 2]),
            amountRow("ยอดรวมสุทธิ", money(data.total), true),
            divider([0, 3, 0, 2]),
            {
                text: [
                    "เงื่อนไข: บริษัทฯ ไม่รับผิดชอบสิ่งของผิดกฎหมาย/ต้องห้าม/ตกค้าง ",
                    "กรณีเสียหายหรือสูญหายต้องแจ้งภายใน 8 วัน บริษัทฯ ขอสงวนสิทธิ์ชดใช้ตามส่วน",
                ],
                style: "footer",
            },
            { text: "ขอบคุณที่ใช้บริการ", alignment: "center", bold: true, fontSize: 7, margin: [0, 3, 0, 0] },
        ],
    };
};

export const createReceiptPdf = async (data: ReceiptPdfData) => {
    await ensureThaiPdfFont();
    return pdfMake.createPdf(buildReceiptDefinition(data));
};

export const downloadReceiptPdf = async (data: ReceiptPdfData , type: "base64" | "blob") => {
    const pdf = await createReceiptPdf(data);
    if (type === "base64") {
        return await pdf.getBase64();
    } else {
        return await pdf.getBlob();
    }
};
