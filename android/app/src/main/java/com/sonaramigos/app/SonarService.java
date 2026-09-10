package com.sonaramigos.app;

import android.app.*;
import android.content.*;
import android.content.pm.ServiceInfo;
import android.os.*;
import androidx.core.app.NotificationCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.JSArray;
import okhttp3.*;
import org.json.*;
import java.util.ArrayDeque;
import java.util.concurrent.TimeUnit;

public class SonarService extends Service {
    static volatile SonarService instance;
    private static final ArrayDeque<JSONObject> events=new ArrayDeque<>();
    private static JSONObject currentUser;
    private static JSONArray currentRoster = new JSONArray();
    private final Handler handler=new Handler(Looper.getMainLooper());
    private OkHttpClient client;
    private WebSocket socket;
    private PowerManager.WakeLock wakeLock;
    private boolean stopping;
    static synchronized void event(JSONObject event){while(events.size()>=100)events.removeFirst();events.addLast(event);}
    static synchronized JSObject poll(){JSObject result=new JSObject();JSArray list=new JSArray();while(!events.isEmpty())list.put(events.removeFirst());result.put("events",list);result.put("running",instance!=null);result.put("users",currentRoster);if(currentUser!=null)result.put("user",currentUser);return result;}
    private static synchronized void setUser(JSONObject value){currentUser=value;}
    @Override public IBinder onBind(Intent intent){return null;}
    @Override public int onStartCommand(Intent intent,int flags,int id){
        if(intent==null){stopSelf();return START_NOT_STICKY;}
        if(instance==this&&socket!=null)return START_NOT_STICKY;
        instance=this;stopping=false;
        NotificationManager manager=getSystemService(NotificationManager.class);
        if(Build.VERSION.SDK_INT>=26){NotificationChannel channel=new NotificationChannel("session","Sesión activa",NotificationManager.IMPORTANCE_LOW);channel.setSound(null,null);manager.createNotificationChannel(channel);NotificationChannel signals=new NotificationChannel("signals","Señales recibidas",NotificationManager.IMPORTANCE_DEFAULT);signals.setSound(null,null);signals.enableVibration(false);manager.createNotificationChannel(signals);}
        Notification notification=notification("Conectando con tu grupo…","session",true);
        if(Build.VERSION.SDK_INT>=34)startForeground(1,notification,ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);else startForeground(1,notification);
        wakeLock=((PowerManager)getSystemService(POWER_SERVICE)).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK,"Sonar:liveSession");wakeLock.acquire();
        client=new OkHttpClient.Builder().pingInterval(10,TimeUnit.SECONDS).connectTimeout(12,TimeUnit.SECONDS).readTimeout(0,TimeUnit.SECONDS).build();
        String login=intent.getStringExtra("login");
        try{socket=client.newWebSocket(new Request.Builder().url(intent.getStringExtra("url")).build(),new WebSocketListener(){
            @Override public void onOpen(WebSocket ws,Response response){ws.send(login);}
            @Override public void onMessage(WebSocket ws,String text){handler.post(()->handle(text));}
            @Override public void onClosed(WebSocket ws,int code,String reason){handler.post(()->finish());}
            @Override public void onClosing(WebSocket ws,int code,String reason){handler.post(()->finish());}
            @Override public void onFailure(WebSocket ws,Throwable error,Response response){handler.post(()->finish());}
        });}catch(Exception e){finish();}
        return START_NOT_STICKY;
    }
    private Notification notification(String text,String channel,boolean ongoing){
        PendingIntent open=PendingIntent.getActivity(this,0,new Intent(this,MainActivity.class),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
        return new NotificationCompat.Builder(this,channel).setSmallIcon(android.R.drawable.ic_lock_silent_mode_off).setContentTitle("Sonar Amigos").setContentText(text).setContentIntent(open).setOngoing(ongoing).setAutoCancel(!ongoing).setSilent(true).build();
    }
    private void handle(String text){if(stopping)return;try{JSONObject m=new JSONObject(text);String type=m.optString("type");event(m);
        if("users".equals(type)){synchronized(SonarService.class){currentRoster=m.getJSONArray("users");}}
        if("welcome".equals(type)){setUser(m.getJSONObject("user"));getSystemService(NotificationManager.class).notify(1,notification(m.getJSONObject("user").getString("name")+" · Activo. Cerrá la app para salir.","session",true));}
        if("signal".equals(type)){String label=m.optString("from")+" te envió "+m.optString("label");getSystemService(NotificationManager.class).notify(2,notification(label,"signals",false));try{SonarAudio.play(this,m.optString("sound"));}catch(Exception e){event(new JSONObject().put("type","error").put("message","Se recibió la señal, pero no se pudo reproducir."));}}
        if("error".equals(type)&&currentUser==null)finish();
    }catch(JSONException e){finish();}}
    boolean send(String message){return !stopping&&socket!=null&&socket.send(message);}
    void finish(){handler.post(()->{if(stopping)return;stopping=true;if(socket!=null){socket.close(1000,"Session ended");socket=null;}setUser(null);try{event(new JSONObject().put("type","disconnected"));}catch(JSONException ignored){}stopForeground(STOP_FOREGROUND_REMOVE);stopSelf();});}
    @Override public void onTaskRemoved(Intent rootIntent){finish();super.onTaskRemoved(rootIntent);}
    @Override public void onDestroy(){stopping=true;if(socket!=null)socket.cancel();if(client!=null){client.dispatcher().executorService().shutdown();client.connectionPool().evictAll();}if(wakeLock!=null&&wakeLock.isHeld())wakeLock.release();SonarAudio.stop();setUser(null);if(instance==this)instance=null;super.onDestroy();}
}
