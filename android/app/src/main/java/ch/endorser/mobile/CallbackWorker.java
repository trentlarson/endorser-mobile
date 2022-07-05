package ch.endorser.mobile;

import android.content.Context;
import android.util.Log;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import com.facebook.react.bridge.Callback;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

public class CallbackWorker extends Worker {

  //public static TimedCallbackManager callbackModule;

  public CallbackWorker(Context context, WorkerParameters params) {
    super(context, params);
  }

  // from https://developer.android.com/topic/libraries/architecture/workmanager/basics
  @Override
  public Result doWork() {
    Log.d("CallbackWorker", "Doing work for background task.");

    WritableMap params = Arguments.createMap();
    params.putString("eventProperty", "someValue");
    //callbackModule.sendEvent(params);

    ((MainApplication)getApplicationContext())
      .getReactNativeHost()
      .getReactInstanceManager()
      .getCurrentReactContext()
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
      .emit("PeriodicTimer", params);

    Log.d("CallbackWorker", "Emitted 'PeriodicTimer' for background task.");
    return Result.success();
  }
}
