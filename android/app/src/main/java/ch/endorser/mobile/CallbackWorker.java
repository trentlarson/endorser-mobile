package ch.endorser.mobile;

import android.content.Context;
import android.util.Log;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import com.facebook.react.bridge.Callback;

public class CallbackWorker extends Worker {
  public static Callback callback;
  public CallbackWorker(Context context, WorkerParameters params) {
    super(context, params);
  }
  @Override
  public Result doWork() {
    Log.d("CallbackWorker", "Doing work for background task.");
    callback.invoke("PERIODIC_TIMER");
    return Result.success();
  }
}
