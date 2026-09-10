package com.sonaramigos.app;

import android.Manifest;
import android.content.Intent;
import android.os.Build;
import androidx.core.content.ContextCompat;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import org.json.JSONObject;

@CapacitorPlugin(name="Sonar", permissions={@Permission(alias="notifications",strings={Manifest.permission.POST_NOTIFICATIONS})})
public class SonarPlugin extends Plugin {
    @PluginMethod public void connect(PluginCall call) {
        if(Build.VERSION.SDK_INT>=33&&getPermissionState("notifications")!=PermissionState.GRANTED){requestPermissionForAlias("notifications",call,"notificationResult");return;}
        start(call);
    }
    @PermissionCallback private void notificationResult(PluginCall call) {
        if(getPermissionState("notifications")!=PermissionState.GRANTED){call.reject("Habilitá las notificaciones para recibir las señales del grupo.");return;}
        start(call);
    }
    private void start(PluginCall call) {
        try {
            String url=call.getString("url","");
            java.net.URI uri=new java.net.URI(url);
            String host=uri.getHost();
            if(host==null||uri.getUserInfo()!=null||!("wss".equals(uri.getScheme())||("ws".equals(uri.getScheme())&&("localhost".equals(host)||"127.0.0.1".equals(host)||"10.0.2.2".equals(host)))))throw new Exception("Usá un servidor wss:// seguro.");
            new JSONObject(call.getString("login",""));
            Intent intent=new Intent(getContext(),SonarService.class).putExtra("url",url).putExtra("login",call.getString("login"));
            ContextCompat.startForegroundService(getContext(),intent);call.resolve();
        } catch(Exception e){call.reject(e.getMessage());}
    }
    @PluginMethod public void send(PluginCall call){SonarService service=SonarService.instance;if(service==null||!service.send(call.getString("message",""))){call.reject("No hay conexión.");return;}call.resolve();}
    @PluginMethod public void disconnect(PluginCall call){SonarService service=SonarService.instance;if(service!=null)service.finish();call.resolve();}
    @PluginMethod public void poll(PluginCall call){call.resolve(SonarService.poll());}
    @PluginMethod public void preview(PluginCall call){String sound=call.getString("sound","");getActivity().runOnUiThread(()->{try{SonarAudio.play(getContext(),sound);call.resolve();}catch(Exception e){call.reject("No se pudo reproducir el sonido.");}});}
}
