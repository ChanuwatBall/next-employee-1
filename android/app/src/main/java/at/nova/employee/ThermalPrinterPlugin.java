package at.nova.employee;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothSocket;
import android.content.Context;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.util.Base64;

import androidx.core.app.ActivityCompat;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.OutputStream;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "ThermalPrinter")
public class ThermalPrinterPlugin extends Plugin {

    private static final UUID SPP_UUID
            = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    private final ExecutorService executor
            = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void printImage(PluginCall call) {
        String address = call.getString("address");
        String base64Image = call.getString("base64");
        int width = call.getInt("width", 384);
        int threshold = call.getInt("threshold", 160);

        if (address == null || address.trim().isEmpty()) {
            call.reject("Bluetooth address is required");
            return;
        }

        if (base64Image == null || base64Image.trim().isEmpty()) {
            call.reject("Base64 image is required");
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
                && ActivityCompat.checkSelfPermission(
                        getContext(),
                        Manifest.permission.BLUETOOTH_CONNECT
                ) != PackageManager.PERMISSION_GRANTED) {
            call.reject("BLUETOOTH_CONNECT permission is not granted");
            return;
        }

        getActivity().runOnUiThread(() -> {
            try {
                BluetoothManager bluetoothManager
                        = (BluetoothManager) getContext().getSystemService(
                                Context.BLUETOOTH_SERVICE
                        );

                if (bluetoothManager == null) {
                    call.reject("BluetoothManager is unavailable");
                    return;
                }

                BluetoothAdapter adapter
                        = bluetoothManager.getAdapter();

                if (adapter == null) {
                    call.reject("Bluetooth is not supported");
                    return;
                }

                if (!adapter.isEnabled()) {
                    call.reject("Bluetooth is disabled");
                    return;
                }

                BluetoothDevice device
                        = adapter.getRemoteDevice(address);

                if (device.getBondState() != BluetoothDevice.BOND_BONDED) {
                    call.reject("Printer is not paired");
                    return;
                }

                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S
                        || ActivityCompat.checkSelfPermission(
                                getContext(),
                                Manifest.permission.BLUETOOTH_SCAN
                        ) == PackageManager.PERMISSION_GRANTED) {
                    adapter.cancelDiscovery();
                }

                executor.execute(()
                        -> connectAndPrint(
                                call,
                                device,
                                base64Image,
                                width,
                                threshold
                        )
                );
            } catch (Exception exception) {
                call.reject(
                        "Bluetooth preparation failed: "
                        + exception.getMessage(),
                        exception
                );
            }
        });
    }

    private Bitmap scaleBitmap(
            Bitmap bitmap,
            int targetWidth
    ) {
        if (bitmap.getWidth() == targetWidth) {
            return bitmap;
        }

        float ratio
                = (float) targetWidth / bitmap.getWidth();

        int targetHeight = Math.round(
                bitmap.getHeight() * ratio
        );

        return Bitmap.createScaledBitmap(
                bitmap,
                targetWidth,
                targetHeight,
                true
        );
    }

    private byte[] bitmapToEscPos(
            Bitmap bitmap,
            int threshold
    ) {
        int width = bitmap.getWidth();
        int height = bitmap.getHeight();

        int widthBytes = (width + 7) / 8;

        ByteArrayOutputStream output
                = new ByteArrayOutputStream();

        /*
         * ESC/POS GS v 0
         *
         * 1D 76 30 m
         * xL xH
         * yL yH
         */
        output.write(0x1D);
        output.write(0x76);
        output.write(0x30);
        output.write(0x00);

        output.write(widthBytes & 0xFF);
        output.write((widthBytes >> 8) & 0xFF);

        output.write(height & 0xFF);
        output.write((height >> 8) & 0xFF);

        for (int y = 0; y < height; y++) {
            for (int byteIndex = 0;
                    byteIndex < widthBytes;
                    byteIndex++) {
                int imageByte = 0;

                for (int bit = 0; bit < 8; bit++) {
                    int x = byteIndex * 8 + bit;

                    if (x >= width) {
                        continue;
                    }

                    int pixel = bitmap.getPixel(x, y);

                    int red = (pixel >> 16) & 0xFF;
                    int green = (pixel >> 8) & 0xFF;
                    int blue = pixel & 0xFF;
                    int alpha = (pixel >> 24) & 0xFF;

                    // Transparent pixel = white
                    int grayscale;

                    if (alpha < 128) {
                        grayscale = 255;
                    } else {
                        grayscale = (red * 299
                                + green * 587
                                + blue * 114) / 1000;
                    }

                    if (grayscale < threshold) {
                        imageByte |= (1 << (7 - bit));
                    }
                }

                output.write(imageByte);
            }
        }

        return output.toByteArray();
    }

    private void writeInChunks(
            OutputStream stream,
            byte[] data,
            int chunkSize
    ) throws Exception {
        int offset = 0;

        while (offset < data.length) {
            int length = Math.min(
                    chunkSize,
                    data.length - offset
            );

            stream.write(data, offset, length);
            stream.flush();

            offset += length;

            Thread.sleep(20);
        }
    }

    @Override
    protected void handleOnDestroy() {
        executor.shutdownNow();
        super.handleOnDestroy();
    }

    private void connectAndPrint(
            PluginCall call,
            BluetoothDevice device,
            String base64Image,
            int width,
            int threshold
    ) {
        BluetoothSocket socket = null;
        OutputStream outputStream = null;

        try {
            String cleanBase64 = base64Image;

            int commaIndex = cleanBase64.indexOf(",");
            if (commaIndex >= 0) {
                cleanBase64 = cleanBase64.substring(commaIndex + 1);
            }

            byte[] pngBytes = Base64.decode(
                    cleanBase64,
                    Base64.DEFAULT
            );

            Bitmap originalBitmap
                    = BitmapFactory.decodeByteArray(
                            pngBytes,
                            0,
                            pngBytes.length
                    );

            if (originalBitmap == null) {
                call.reject("Unable to decode receipt image");
                return;
            }

            Bitmap scaledBitmap
                    = scaleBitmap(originalBitmap, width);

            byte[] escPosData
                    = bitmapToEscPos(scaledBitmap, threshold);

            socket
                    = device.createRfcommSocketToServiceRecord(
                            SPP_UUID
                    );

            socket.connect();

            outputStream = socket.getOutputStream();

            outputStream.write(
                    new byte[]{0x1B, 0x40}
            );

            outputStream.write(
                    new byte[]{0x1B, 0x61, 0x01}
            );

            writeInChunks(
                    outputStream,
                    escPosData,
                    512
            );

            outputStream.write(
                    new byte[]{0x0A, 0x0A, 0x0A}
            );

            outputStream.flush();

            call.resolve();
        } catch (SecurityException exception) {
            call.reject(
                    "Bluetooth permission denied",
                    exception
            );
        } catch (Exception exception) {
            call.reject(
                    "Print failed: "
                    + exception.getClass().getSimpleName()
                    + ": "
                    + exception.getMessage(),
                    exception
            );
        } finally {
            if (outputStream != null) {
                try {
                    outputStream.close();
                } catch (Exception ignored) {
                }
            }

            if (socket != null) {
                try {
                    socket.close();
                } catch (Exception ignored) {
                }
            }
        }
    }
}
