package at.nova.employee;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BluetoothPermissionPlugin.class);
        registerPlugin(ThermalPrinterPlugin.class);

        super.onCreate(savedInstanceState);
    }
}
