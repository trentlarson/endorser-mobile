package ch.endorser.mobile;

import android.content.Context;
import android.util.Log;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import com.facebook.react.bridge.Callback;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableMap;

public class CallbackWorker extends Worker {

  public static TimedCallbackManager callbackModule;

  public CallbackWorker(Context context, WorkerParameters params) {
    super(context, params);
  }

  // from https://developer.android.com/topic/libraries/architecture/workmanager/basics
  @Override
  public Result doWork() {
    Log.d("CallbackWorker", "Doing work for background task.");

    WritableMap params = Arguments.createMap();
    params.putString("eventProperty", "someValue");
    callbackModule.sendEvent(params);

    return Result.success();
  }
}
