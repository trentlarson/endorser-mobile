package ch.endorser.mobile;

import android.content.Context;
import android.util.Log;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import com.facebook.react.bridge.CatalystInstance;
import com.facebook.react.bridge.NativeModule;
//import com.facebook.react.bridge.Callback;

public class CallbackWorker extends Worker {

  //public static Callback callback;

  public CallbackWorker(Context context, WorkerParameters params) {
    super(context, params);
  }

  // from https://developer.android.com/topic/libraries/architecture/workmanager/basics
  @Override
  public Result doWork() {
    Log.d("CallbackWorker", "Starting a background task.");

    /**
    CatalystInstance catal = ((MainApplication)getApplicationContext())
      .getReactNativeHost()
      .getReactInstanceManager()
      .getCurrentReactContext()
      .getCatalystInstance();
    for (NativeModule mod : catal.getNativeModules()) {
      System.out.println("module " + mod.getName());
    }
    **/

    ((MainApplication)getApplicationContext())
      .getReactNativeHost()
      .getReactInstanceManager()
      .getCurrentReactContext()
      .getCatalystInstance()
      .callFunction("utilityPlus", "checkClaims", new com.facebook.react.bridge.WritableNativeArray());
    //callback.invoke("PERIODIC_TIMER");

    Log.d("CallbackWorker", "Finished a background task.");
    return Result.success();
  }
}
