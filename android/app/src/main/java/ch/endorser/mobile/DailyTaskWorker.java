package ch.endorser.mobile;

import android.content.Context;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.work.Data;
import androidx.work.WorkerParameters;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.jstasks.HeadlessJsTaskConfig;
import io.github.wjaykim.rnheadlesstaskworker.HeadlessJsTaskWorker;

/**
   See MainApplication for initialization of this task.

   Extends https://github.com/wjaykim/react-native-headless-task-worker/blob/master/android/src/main/java/io/github/wjaykim/rnheadlesstaskworker/HeadlessJsTaskWorker.java
 **/
public class DailyTaskWorker extends HeadlessJsTaskWorker {
    public DailyTaskWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    // returns https://github.com/facebook/react-native/blob/main/ReactAndroid/src/main/java/com/facebook/react/jstasks/HeadlessJsTaskConfig.java
    @Nullable
    @Override
    protected HeadlessJsTaskConfig getTaskConfig(Data data) {
        if (data != null) {
            return new HeadlessJsTaskConfig(
                "EndorserDailyTask", // also referenced in App.tsx
                Arguments.makeNativeMap(data.getKeyValueMap()),
                30000, // timeout for the task, in ms
                true // allowedInForeground is optional (defaults to false), but when false it crashes the app; see https://stackoverflow.com/questions/72929861/how-do-i-set-headlessjstaskconfig-to-not-run-if-the-app-is-running-in-the-foregr
            );
        }
        return null;
    }
}
