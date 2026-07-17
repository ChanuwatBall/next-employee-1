import { downloadReceiptPdf, encodeBitmapToEscPos, ReceiptPdfData, urlToBitmap } from './receiptPdf';
import { Printer } from '@capgo/capacitor-printer';
import { Capacitor } from '@capacitor/core';
import { BluetoothSerial, BluetoothWriteOptions } from '@e-is/capacitor-bluetooth-serial';
// Note: remove Node-specific fs and pdf2pic which don't run in Capacitor/web runtime.
import * as pdfjsLib from 'pdfjs-dist';

const uint8ToBase64 = (bytes: Uint8Array) => {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
};

const canvasToEscPos = (canvas: HTMLCanvasElement) => {
    const width = canvas.width;
    const height = canvas.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');

    const imageData = ctx.getImageData(0, 0, width, height);
    const pixels = imageData.data;

    const widthBytes = Math.ceil(width / 8);
    const data = [] as number[];

    data.push(0x1B, 0x40); // ESC @
    data.push(0x1B, 0x32);

    const header = [0x1D, 0x76, 0x30, 0x00];
    for (let y = 0; y < height; y++) {
        const rowBytes = new Uint8Array(widthBytes);
        for (let xb = 0; xb < widthBytes; xb++) {
            let byte = 0;
            for (let bit = 0; bit < 8; bit++) {
                const x = xb * 8 + bit;
                if (x >= width) continue;
                const idx = (y * width + x) * 4;
                const r = pixels[idx];
                const g = pixels[idx + 1];
                const b = pixels[idx + 2];
                const alpha = pixels[idx + 3];
                const lum = (0.299 * r + 0.587 * g + 0.114 * b) * (alpha / 255);
                const black = lum < 128;
                byte |= (black ? 1 : 0) << (7 - bit);
            }
            rowBytes[xb] = byte;
        }

        data.push(...header);
        data.push(widthBytes & 0xFF, (widthBytes >> 8) & 0xFF);
        data.push(1 & 0xFF, (1 >> 8) & 0xFF);
        for (let i = 0; i < rowBytes.length; i++) data.push(rowBytes[i]);
    }

    data.push(0x1B, 0x64, 0x03);
    data.push(0x1D, 0x56, 0x01);

    return new Uint8Array(data);
};

const renderReceiptToCanvas = async (data: any) => {
    const width = 384;
    const padding = 8;
    const lineHeight = 18;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not available');

    ctx.font = '16px sans-serif';
    const titleHeight = 34;
    const qrHeight = 90;
    const passengerCount = (data.passengers || []).length || 1;
    const estimatedHeight = titleHeight + qrHeight + passengerCount * lineHeight + 160;

    canvas.width = width;
    canvas.height = estimatedHeight;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.font = '18px sans-serif';
    ctx.fillText((data.bookingDetail?.companyName) || 'Nova Express', width / 2, 22);
    ctx.font = '12px sans-serif';
    ctx.fillText(`Booking #${data.bookingReference || '-'}`, width / 2, 42);

    const qrY = 56;
    if (data.qrCodeImage) {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const im = new Image();
            im.onload = () => resolve(im);
            im.onerror = reject;
            im.src = data.qrCodeImage;
        });
        const qrX = (width - qrHeight) / 2;
        ctx.drawImage(img, qrX, qrY, qrHeight, qrHeight);
    }

    ctx.textAlign = 'left';
    ctx.font = '12px sans-serif';
    let y = qrY + qrHeight + 12;
    ctx.fillText(`Route: ${(data.trip?.route_id?.origin) || '-'} -> ${(data.trip?.route_id?.destination) || '-'}`, padding, y);
    y += lineHeight;
    ctx.fillText(`Date: ${data.bookingDetail?.date || data.trip?.date || '-'} ${data.bookingDetail?.departureTime || data.trip?.departure_time || ''}`, padding, y);
    y += lineHeight;

    ctx.fillText('Passengers:', padding, y);
    y += lineHeight;
    const passengers = data.passengers || [];
    for (let i = 0; i < passengers.length; i++) {
        const p = passengers[i];
        ctx.fillText(`${i + 1}. ${p.fullName || '-'} | ${p.seatNumber || '-'} | ${p.phone || '-'}`, padding, y);
        y += lineHeight;
    }

    y += lineHeight;
    ctx.fillText(`Total: ${Number(data.total || 0).toLocaleString()} ฿`, padding, y);
    y += lineHeight * 2;
    ctx.fillText('Thank you', width / 2 - 20, y);

    const usedHeight = Math.min(canvas.height, y + 40);
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = canvas.width;
    finalCanvas.height = usedHeight;
    const fctx = finalCanvas.getContext('2d');
    if (!fctx) throw new Error('Canvas not available');
    fctx.fillStyle = '#FFFFFF';
    fctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
    fctx.drawImage(canvas, 0, 0, finalCanvas.width, finalCanvas.height, 0, 0, finalCanvas.width, finalCanvas.height);

    return finalCanvas;
};

const printEscPosViaBluetooth = async (escBytes: Uint8Array, iontoast?: any) => {
    try {
        const base64 = uint8ToBase64(escBytes);
        const address = localStorage.getItem('printerAddress') || undefined;
        try {
                if (address) {
                    // const bufferToSend = escBytes.buffer;
                    const option: BluetoothWriteOptions = { address, value: base64 } as any;
                    console.debug('[receiptPrinter] Bluetooth write - address:', address, 'bytes:', base64?.length);
                    try {
                        const res = await BluetoothSerial.write(option);
                        console.debug('[receiptPrinter] Bluetooth write result:', JSON.stringify(res));
                    } catch (writeErr) {
                        console.error('[receiptPrinter] BluetoothSerial.write failed:', JSON.stringify(writeErr));
                        throw writeErr;
                    }
                } else if (iontoast) {
                    iontoast({ message: 'ไม่พบเครื่องพิมพ์ กรุณาเชื่อมต่อเครื่องพิมพ์ก่อนสั่งพิมพ์', duration: 2200, color: 'warning', position: 'top' });
                }
        } catch (err) {

            if (iontoast) iontoast({ message: 'ไม่สามารถสั่งพิมพ์ได้ ' + (err instanceof Error ? err.message : String(err)) + ' โปรดตรวจสอบการเชื่อมต่อเครื่องพิมพ์', duration: 5000, color: 'warning', position: 'top' });
        }

        if (iontoast) iontoast({ message: 'ส่งคำสั่งพิมพ์ไปยังเครื่องพิมพ์แล้ว', duration: 2000, color: 'success', position: 'top' });
    } catch (err) {
        console.error('Bluetooth print error:', err);
        if (iontoast) iontoast({ message: 'ไม่สามารถสั่งพิมพ์ผ่าน Bluetooth ได้', duration: 2200, color: 'danger', position: 'top' });
    }
};

export const printReceipt = async (data: ReceiptPdfData, iontoast?: any) => {
    // Android: try ESC/POS via Bluetooth

    if (Capacitor.getPlatform && Capacitor.getPlatform() === 'android') {
        try {
            
            const receiptbase64 = await downloadReceiptPdf(data, 'base64'); // generate receipt image for Android ESC/POS printing
            try {
                const pdfBase64ToPngDataUrl = async (base64: string) => {
                    const pdfData = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
                    // const pdfjsLib: any = await import('pdfjs-dist/legacy/build/pdf');
                    // Ensure workerSrc is set. Try to import the bundled worker entry first,
                    // otherwise fall back to a CDN copy of the worker.
                    try {
                        // const pdfjsWorker: any = await import('pdfjs-dist/legacy/build/pdf.worker.entry');
                        // pdfjsLib.GlobalWorkerOptions.workerSrc = (pdfjsWorker && (pdfjsWorker.default || pdfjsWorker)) as any;
                    } catch (e) {
                        // fallback to CDN (matches typical pdf.js releases). Replace version if needed.
                        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
                    }

                    const loadingTask = pdfjsLib.getDocument({ data: pdfData });
                    const pdf = await loadingTask.promise;
                    const page = await pdf.getPage(1);
                    const scale = 2; // increase for better density similar to 300dpi
                    const viewport = page.getViewport({ scale });
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    if (!ctx) throw new Error('Canvas 2D context unavailable for PDF render');
                    canvas.width = Math.round(viewport.width);
                    canvas.height = Math.round(viewport.height);
                    // await page.render({ canvasContext: ctx, viewport }).promise;
                    return canvas.toDataURL('image/png');
                };

                const dataUrl = await pdfBase64ToPngDataUrl(receiptbase64);
                const bitmap = await urlToBitmap(dataUrl);
                const esc = await encodeBitmapToEscPos(bitmap);
                await printEscPosViaBluetooth(esc, iontoast);
            } catch (err) {
                console.error('Error converting PDF to image (pdfjs fallback):', err);
            }
            // const bitmap = await urlToBitmap(receiptImage);
            // const esc = await encodeBitmapToEscPos(bitmap);
            // await printEscPosViaBluetooth(esc, iontoast);

            // const canvas = await renderReceiptToCanvas(data);
            // const esc = canvasToEscPos(canvas);
            // await printEscPosViaBluetooth(esc, iontoast);
            return;
        } catch (err) {
            console.warn('Bluetooth ESC/POS printing failed, falling back to PDF print', err);
        }
    }

    // Fallback: generate PDF and print
    const pdfBlob = await downloadReceiptPdf(data, 'blob');
    const safeReference = data.bookingReference || `receipt-${Date.now()}`;
    const pdffile = new File([pdfBlob], `${safeReference}.pdf`, { type: 'application/pdf' });
    const url = URL.createObjectURL(pdffile);
    try {
        await Printer.printPdf({ name: `receipt/${safeReference}.pdf`, path: url });
    } finally {
        URL.revokeObjectURL(url);
    }
};

export { renderReceiptToCanvas, canvasToEscPos };
