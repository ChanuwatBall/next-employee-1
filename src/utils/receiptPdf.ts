import pdfMakeModule from "pdfmake/build/pdfmake";
import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import moment from "moment";
import * as pdfjsLib from 'pdfjs-dist';
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

const convertPdfToImages = async (docDefinition: any) => {
  // 1. Generate PDF as an ArrayBuffer
  const pdfDocGenerator = pdfMake.createPdf(docDefinition);
  const arrayBuffer = await new Promise((resolve) => pdfDocGenerator.getBuffer(resolve));

  // 2. Load the PDF into PDF.js 
  //@ts-ignore
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const imageUrls = [];

  // 3. Loop through each page and render to canvas
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2.0 }); // 2.0 scale increases image quality

    const canvas = document.createElement('canvas');
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    const context = canvas.getContext('2d');

    //@ts-ignore
    await page.render({ canvasContext: context, viewport: viewport }).promise;

    // 4. Convert canvas to base64 image URL
    imageUrls.push(canvas.toDataURL('image/png'));
  }

  return imageUrls; // Array of base64 PNG images
}
export const downloadReceiptPdf = async (data: ReceiptPdfData , type: "base64" | "blob" | "image") => {
    const pdf = await createReceiptPdf(data);
    if (type === "base64") {
        return await pdf.getBase64();
    } else if (type === "blob") {
        return await pdf.getBlob();
    }else if (type === "image") {
        const docDefinition = buildReceiptDefinition(data);
        return await convertPdfToImages(docDefinition);
    }
};

// Function to convert a single Image URL/Base64 to an ImageData Bitmap
export async function urlToBitmap(url:any) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous'; // Prevents CORS issues for external URLs
    
    img.onload = () => {
      // 1. Create a temporary canvas matching image dimensions
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx:any = canvas.getContext('2d');
      
      // 2. Draw the image onto the canvas
      ctx.drawImage(img, 0, 0);
      
      // 3. Extract the raw RGBA bitmap pixel data
      const bitmapData = ctx.getImageData(0, 0, img.width, img.height);
      resolve(bitmapData);
    };
    
    img.onerror = (err) => reject(err);
    img.src = url;
  });
}

// How to use it with your array of imageUrls
export async function processImages(imageUrls:any[]) {
  try {
    const bitmapPromises = imageUrls.map(url => urlToBitmap(url));
    const bitmaps = await Promise.all(bitmapPromises);
    
    // 'bitmaps' is now an array of ImageData objects containing raw pixel arrays
    console.log('Successfully converted all pages to bitmaps:', bitmaps);
    
    // Example: Access raw pixel data of the first page
    // const pixelArray = bitmaps[0].data; // Uint8ClampedArray [R, G, B, A, R, G, B, A...]
    
  } catch (error) {
    console.error('Error converting images to bitmap:', error);
  }
}

export async function encodeBitmapToEscPos(imageData:any) {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data; // Raw RGBA pixel array

  // ESC/POS requires the width in bytes to be rounded up to a multiple of 8
  const widthBytes = Math.ceil(width / 8);
  const imageBuffer = [];

  // Loop through each row (Y) and each column (X)
  for (let y = 0; y < height; y++) {
    for (let b = 0; b < widthBytes; b++) {
      let byteValue = 0;

      // Pack 8 horizontal pixels into a single byte
      for (let bit = 0; bit < 8; bit++) {
        const x = b * 8 + bit;
        
        if (x < width) {
          // Calculate the pixel position in the RGBA array
          const offset = (y * width + x) * 4;
          const r = data[offset];
          const g = data[offset + 1];
          const bVal = data[offset + 2];
          const a = data[offset + 3];

          // Calculate perceived brightness (Luminance)
          const brightness = (r * 0.299) + (g * 0.587) + (bVal * 0.114);

          // Transparent pixels (a < 128) or bright pixels (> 128) are White (0)
          // Dark pixels are Black (1)
          if (a >= 128 && brightness < 128) {
            // Set the corresponding bit to 1 (Black pixel)
            byteValue |= (1 << (7 - bit));
          }
        }
      }
      imageBuffer.push(byteValue);
    }
  }

  // Define ESC/POS GS v 0 Header Command Parameters
  const xL = widthBytes % 256;      // Width Low byte
  const xH = Math.floor(widthBytes / 256); // Width High byte
  const yL = height % 256;     // Height Low byte
  const yH = Math.floor(height / 256);    // Height High byte

  // Construct final ESC/POS command array
  const header = [
    0x1B, 0x40,             // ESC @  -> Initialize Printer
    0x1D, 0x76, 0x30, 0x00, // GS v 0 m -> Raster Image Command (m=0: Normal size)
    xL, xH,                 // Number of horizontal bytes
    yL, yH                  // Number of vertical dots (height)
  ];

  const footer = [
    0x1D, 0x56, 0x41, 0x03, // GS V m n -> Feed paper and partial cut
  ];

  // Merge header, image payload, and footer cutting commands
  return new Uint8Array([...header, ...imageBuffer, ...footer]);
}