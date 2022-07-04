package ch.endorser.mobile;

import android.util.Log;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import java.util.Map;
import java.util.HashMap;

/**
public class UploadWorker extends Worker {
  public UploadWorker(@NonNull Context context, @NonNull WorkerParameters params) {
    super(context, params);
  }
  @Override
  public Result doWork() {
    System.out.println("Doing work for background task.");
    return Result.success();
  }
}
**/

public class TimedCallbackManager extends ReactContextBaseJavaModule {
  TimedCallbackManager(ReactApplicationContext context) {
    super(context);
  }
  public String getName() {
    return "TimedCallbackManager";
  }
  @ReactMethod
  public void schedule() {
    Log.d("TimedCallbackManager", "OK, custom java is scheduled.");
  }
}
