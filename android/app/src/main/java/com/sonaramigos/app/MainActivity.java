package com.sonaramigos.app;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(android.os.Bundle state) {
        registerPlugin(SonarPlugin.class);
        super.onCreate(state);
    }
}
