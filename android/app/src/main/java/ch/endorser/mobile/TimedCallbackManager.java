package ch.endorser.mobile;

import android.util.Log;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import com.facebook.react.bridge.Callback;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import java.util.concurrent.TimeUnit;
import java.util.Map;
import java.util.HashMap;

public class TimedCallbackManager extends ReactContextBaseJavaModule {

  TimedCallbackManager(ReactApplicationContext context) {
    super(context);
  }

  public String getName() {
    return "TimedCallbackManager";
  }

  // from https://developer.android.com/topic/libraries/architecture/workmanager/how-to/define-work#schedule_periodic_work
  @ReactMethod
  public void schedule() {
    Log.d("TimedCallbackManager", "OK, custom java is scheduled.");
    //CallbackWorker.callbackModule = this;

    PeriodicWorkRequest saveWorkerRequest =
      new PeriodicWorkRequest.Builder(CallbackWorker.class, 1, TimeUnit.MINUTES)
      .build();

    WorkManager.getInstance(getReactApplicationContext()).enqueue(saveWorkerRequest);
  }

  /**
  // from https://reactnative.dev/docs/native-modules-android#sending-events-to-javascript
  public void sendEvent(WritableMap params) {
    getReactApplicationContext()
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
      .emit("PeriodicTimer", params);
  }
  **/

}
