import { IonButton, IonCol, IonContent, IonFooter, IonHeader, IonIcon, IonImg, IonLabel, IonModal, IonRow, IonText, IonToolbar, useIonLoading, useIonToast } from "@ionic/react";
import { closeOutline } from "ionicons/icons";
import { useEffect, useState } from "react";
import "../components/css/Receipt.css";
import moment from "moment";
import { toJpeg } from "html-to-image";
import { BluetoothSerial } from "@e-is/capacitor-bluetooth-serial";
import { ThermalPrinter } from "../plugins/thermal-printer";

interface ReceiptProps {
    // Define any props you want to pass to the Receipt component here
    receiptData: ReceiptState; // Replace 'any' with the actual type of your receipt data
    open: boolean;
    setOpen: (open: boolean) => void;
    company: {
        name: string,
        address: string,
        phone: string,
        taxId: string,
        ticketTerms: string
    }
}
interface ReceiptState {
    // Define any state variables you want to use in the Receipt component here
    bookingDetail: any; // Replace 'any' with the actual type of your booking detail
    bookingReference: string;
    passengers: {
        fullName: string;
        phone: string;
        seatNumber: string;
        passengerType: string;
    }[],
    paymentMethod: string;
    paymentStatus: string;
    pricePerSeat: number;
    qrCodeImage: string;
    seats: string[];
    total: number;
    trip: Trip;
}

interface Trip {
    id: string,
    routeId: string,
    originProvinceId: string,
    destinationProvinceId: string,
    departureTime: string,
    arrivalTime: string,
    price: number,
    availableSeats: number,
    totalSeats: number,
    tripType: string,
    busType: string,
    date: string,
    route_id: {
        id: string,
        origin: string,
        destination: string,
        origin_id: string,
        destination_id: string,
        duration: string
    },
    bus_type: {
        id: string,
        name: string,
        amenities: string[]
    },
    bus_type_id: string,
    departure_time: string,
    arrival_time: string,
    available_seats: number,
    total_seats: number,
    trip_type: string,
    bus_number: string,
    origin_province_id: string,
    destination_province_id: string
}

// const receiptCompany = {
//     CompanyName: "Nova Express Co., Ltd.",
//     CompanyAddress: "123 Main St, City, Country",
//     CompanyPhone: "+1 (123) 456-7890",
//     CompanyEmail: "info@novaexpress.com",
//     conditions: ["บริษัทไม่รับผิดชอบต่อความเสียหายหรือสูญหายของทรัพย์สินส่วนตัวของผู้โดยสาร / The company is not responsible for loss of or damage to passengers' personal belongings."],
// }

export async function printReceipt(PRINTER_ADDRESS: string, element: any): Promise<void> {

    if (!element) {
        throw new Error("ไม่พบ element #receipt-content / element #receipt-content not found");
    }

    const status = await BluetoothSerial.isConnected({
        address: PRINTER_ADDRESS,
    });

    if (!status.connected) {
        throw new Error("เครื่องพิมพ์ยังไม่ได้เชื่อมต่อ / Printer is not connected");
    }

    const receiptText = element.innerText.trim();

    if (!receiptText) {
        throw new Error("ไม่มีข้อมูลสำหรับพิมพ์ / No data to print");
    }
 
}

const ReceiptModal = ({ receiptData, open, setOpen, company }: ReceiptProps & { company: any }) => {
    const [toast, dimisstoast] = useIonToast();
    const [ionloading, dimismissLoading] =  useIonLoading();

     const fetchReceiptData = async () => {
            if (open) {
                ionloading({
                    message: "กำลังพิมพ์... / Printing..." 
                });
                console.log("Receipt modal opened with receiptData:", receiptData);
                // Call print receipt function
                // printReceipt(receiptData);
                const node:any = document.querySelector("#receipt-content") ;
                console.log("node:", node);
                if (!node) return;

                try {
                    const base64 = await toJpeg(node, {
                        backgroundColor: "#ffffff",
                        cacheBust: true,
                    })
                    console.log("canvas:", base64 ? "generated" : "failed");
                    console.log("base64 image data:", base64);
                    const printerstr= localStorage.getItem("selected_printer_device");
                    console.log("printerstr:", printerstr);
 
                    const printerAddress = printerstr ? JSON.parse(printerstr).address : null;
                    if (!printerAddress) {
                        toast({
                            message: "ไม่พบเครื่องพิมพ์ / Printer not found",
                            duration: 2000,
                            color: "danger",
                            position: "top",
                        });
                        dimismissLoading();
                        return;
                    }
                    // await printReceipt(printerAddress, imageData);
                    await ThermalPrinter.printImage({
                        address: printerAddress,
                        base64,
                        width: 384,
                        threshold: 165,
                    }).catch((error) => {
                        console.error("ThermalPrinter error:", error);
                        throw new Error("ไม่สามารถพิมพ์ใบเสร็จได้ / Unable to print receipt: " + (error instanceof Error ? error.message : String(error)));
                    }).finally(() => {
                        dimismissLoading();
                    });


                    toast({
                        message: "พิมพ์ใบเสร็จเรียบร้อยแล้ว / Receipt printed successfully",
                        duration: 2000,
                        color: "success",
                        position: "top",
                    });
                } catch (error) {
                    console.error("Print error:", error);
                     dimismissLoading();
                    toast({
                        message:
                            error instanceof Error
                                ? error.message
                                : "ไม่สามารถพิมพ์ใบเสร็จได้ / Unable to print receipt",
                        duration: 2500,
                        color: "danger",
                        position: "top",
                    });
                }
            }
        };

    useEffect(() => {
        // This effect will run when the modal opens
       
        setTimeout(() => {
          fetchReceiptData();
        }, 500); // Delay of 500ms to ensure the modal content is rendered
    }, [open, receiptData]);

    return (
        <IonModal isOpen={open} onDidDismiss={() => setOpen(false)}>
            <IonHeader className="ion-no-border" >
                <IonToolbar>
                    <IonButton fill="clear" slot="end" onClick={() => setOpen(false)}><IonIcon icon={closeOutline} /> </IonButton>
                </IonToolbar>
            </IonHeader>
            <IonContent  >
                <div className="set-center" style={{ width: "100%" }}>

                    <div id="receipt-content" className="ion-padding">
                        {/* Render receipt content here using props.receiptData */}
                        <IonRow>
                            <IonCol size="12" className="ion-text-center">
                                <IonLabel>
                                    <h2 className="ion-text-center"><b>{company?.name}</b></h2>
                                    <IonLabel><small>{company?.address}  | โทร. / Tel. {company?.phone}</small></IonLabel>
                                </IonLabel><br />
                            </IonCol>
                            <IonCol size="12">
                                <IonLabel className="receipt-title ion-text-center">
                                    <h2 className="ion-no-margin">ใบเสร็จรับเงิน / RECEIPT</h2>
                                </IonLabel>
                                <div style={{  width: '100%',paddingTop:"0.5em" }}>
                                    <IonLabel className="booking-ref-num"> Booking Ref: {receiptData?.bookingReference}</IonLabel><br/>
                                    <IonLabel className="booking-date" > Booking Date {moment(receiptData?.bookingDetail.bookingDate).format("DD/MM/YYYY")}</IonLabel>
                                </div>
                            </IonCol>
                            <IonCol size="12" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' ,marginTop:".5em"}}>
                                <IonImg src={receiptData?.qrCodeImage} alt="QR Code" className="qr-img" />
                                <small> QR Code </small>
                            </IonCol>
                        </IonRow>
                        <IonLabel className="bold">  รายละเอียดเที่ยวจอง / Trip Details  </IonLabel>
                        <IonRow className="trip-detail ion-margin-bottom"  >
                            <IonCol size="5">
                                <IonLabel> เส้นทาง Route:</IonLabel>
                            </IonCol>
                            <IonCol size="7">
                                <IonLabel> {receiptData?.bookingDetail?.routeName}</IonLabel>
                            </IonCol>

                            <IonCol size="6">
                                <IonLabel> วันที่-เวลา  Date-Time:</IonLabel>
                            </IonCol>
                            <IonCol size="6">
                                <IonLabel> {receiptData?.trip?.date} {receiptData?.trip?.departureTime}</IonLabel>
                            </IonCol>

                            <IonCol size="7">
                                <IonLabel> ขึ้น-ลง up-down:</IonLabel>
                            </IonCol>
                            <IonCol size="5">
                                <IonLabel> {receiptData?.bookingDetail?.boardingPoint} / {receiptData?.bookingDetail?.dropOffPoint}</IonLabel>
                            </IonCol>

                            <IonCol size="5">
                                <IonLabel> รถ / Bus:</IonLabel>
                            </IonCol>
                            <IonCol size="7">
                                <IonLabel> {receiptData?.bookingDetail?.busPlate}  {receiptData?.bookingDetail?.busType} {receiptData?.bookingDetail?.tripType}</IonLabel>
                            </IonCol>
                        </IonRow>

                        <IonLabel className="bold">  ผู้โดยสาร / Passengers  </IonLabel>
                        <IonRow className="trip-detail  ion-margin-bottom  dashed-bottom" >
                            <IonCol size="12">
                                {receiptData?.passengers.map((passenger, index) => (
                                    <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }} >
                                        <IonLabel>{index + 1}. {passenger.fullName} <br/> {passenger.phone} |  {passenger.seatNumber} | {passenger.passengerType}</IonLabel>
                                        <IonLabel> {receiptData?.pricePerSeat} บาท</IonLabel>
                                    </div>
                                ))}
                            </IonCol>
                        </IonRow>

                        <IonRow className="trip-detail ion-margin-bottom"  >
                            <IonCol size="8">
                                <IonLabel> วิธีชำระเงิน  Payment:</IonLabel>
                            </IonCol>
                            <IonCol size="4">
                                <IonLabel> {receiptData?.bookingDetail?.paymentMethod}  </IonLabel>
                            </IonCol>

                            <IonCol size="8">
                                <IonLabel> สถานะ Status:</IonLabel>
                            </IonCol>
                            <IonCol size="4">
                                <IonLabel> {receiptData?.bookingDetail?.paymentStatus}  </IonLabel>
                            </IonCol>
                        </IonRow>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }} >
                            <IonLabel >ส่วนลด Discount:</IonLabel>
                            <IonLabel > {receiptData?.bookingDetail?.discount} บาท</IonLabel>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }} >
                            <IonLabel >ค่าธรรมเนียม Fee:</IonLabel>
                            <IonLabel > {receiptData?.bookingDetail?.fee_amt ?? "-"} &nbsp;บาท</IonLabel>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }} >
                            <IonLabel >เงินทอน Change:</IonLabel>
                            <IonLabel > {receiptData?.bookingDetail?.change ?? "-"} &nbsp;บาท</IonLabel>
                        </div>
                        <div className=" dashed-bottom" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }} >
                            <IonLabel className="bold">ยอดรวมสุทธิ Net Total:</IonLabel>
                            <IonLabel className="bold"> {receiptData?.total} &nbsp;บาท</IonLabel>
                        </div>


                        <div className="conditions " >
                            <small className="conditions-title">เงื่อนไขการใช้บริการ / Terms & Conditions</small>&nbsp;
                            {/* {company?.conditions.map((condition, index) => (
                                <small key={index} className="condition-text">
                                    {index + 1}. {condition}
                                </small>
                            ))} */}
                            <small className="condition-text">
                                {company?.ticketTerms}
                            </small>
                        </div> 

                    </div>

                </div>
            </IonContent>
            <IonFooter style={{ padding: "10px" , display: "flex", flexDirection: "row", gap: "10px" }}>
                <IonButton expand="block" color="primary" onClick={() => setOpen(false)}>
                    ปิด 
                </IonButton>
                <IonButton expand="block" color="secondary" onClick={() => fetchReceiptData()}>
                    พิมพ์ใบเสร็จ  
                </IonButton>
            </IonFooter>

        </IonModal >
    )
}
export default ReceiptModal
