package at.nova.employee; 

import android.Manifest;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "BluetoothPermission",
    permissions = {
        @Permission(
            alias = "bluetooth",
            strings = {
                Manifest.permission.BLUETOOTH_SCAN,
                Manifest.permission.BLUETOOTH_CONNECT
            }
        ),
        @Permission(
            alias = "location",
            strings = {
                Manifest.permission.ACCESS_FINE_LOCATION
            }
        )
    }
)
public class BluetoothPermissionPlugin extends Plugin {

    @PluginMethod
    public void checkPermissions(PluginCall call) {
        JSObject result = new JSObject();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            PermissionState state = getPermissionState("bluetooth");
            result.put("granted", state == PermissionState.GRANTED);
        } else {
            PermissionState state = getPermissionState("location");
            result.put("granted", state == PermissionState.GRANTED);
        }

        call.resolve(result);
    }

    @PluginMethod
    public void requestPermissions(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            requestPermissionForAlias(
                "bluetooth",
                call,
                "bluetoothPermissionCallback"
            );
        } else {
            requestPermissionForAlias(
                "location",
                call,
                "locationPermissionCallback"
            );
        }
    }

    @PermissionCallback
    private void bluetoothPermissionCallback(PluginCall call) {
        JSObject result = new JSObject();

        boolean granted =
            getPermissionState("bluetooth") == PermissionState.GRANTED;

        result.put("granted", granted);
        call.resolve(result);
    }

    @PermissionCallback
    private void locationPermissionCallback(PluginCall call) {
        JSObject result = new JSObject();

        boolean granted =
            getPermissionState("location") == PermissionState.GRANTED;

        result.put("granted", granted);
        call.resolve(result);
    }
}
