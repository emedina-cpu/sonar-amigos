package com.sonaramigos.app;

import android.content.Context;
import android.media.*;
import android.os.*;
import java.util.Set;

final class SonarAudio {
    private static MediaPlayer player;
    private static final Set<String> SOUNDS=new java.util.HashSet<>(java.util.Arrays.asList("boing","pato","robot","burbuja","trombon","ardilla","ovni","rebote","hipo","risita","laser","caida","moneda","error","magia","grillo","fantasma","carrera","globo","victoria","barco","bocina","niebla","submarino","sirena","tren","puerto","claxon","evacuacion","remolcador"));
    static synchronized void play(Context context,String id) throws Exception {
        stop();
        if("buzz".equals(id)){
            Vibrator vibrator=(Vibrator)context.getSystemService(Context.VIBRATOR_SERVICE);
            if(vibrator!=null&&vibrator.hasVibrator()){if(Build.VERSION.SDK_INT>=26)vibrator.vibrate(VibrationEffect.createOneShot(2000,VibrationEffect.DEFAULT_AMPLITUDE));else vibrator.vibrate(2000);}return;
        }
        if(!SOUNDS.contains(id))return;
        MediaPlayer next=new MediaPlayer();player=next;
        try(android.content.res.AssetFileDescriptor fd=context.getAssets().openFd("public/sounds/"+id+".wav")){
            next.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
            next.setDataSource(fd.getFileDescriptor(),fd.getStartOffset(),fd.getLength());
            next.setOnCompletionListener(p->{synchronized(SonarAudio.class){if(player==p)player=null;p.release();}});
            next.setOnErrorListener((p,w,e)->{synchronized(SonarAudio.class){if(player==p)player=null;p.release();}return true;});
            next.prepare();next.start();
        }catch(Exception e){if(player==next)player=null;next.release();throw e;}
    }
    static synchronized void stop(){if(player!=null){player.release();player=null;}}
}
