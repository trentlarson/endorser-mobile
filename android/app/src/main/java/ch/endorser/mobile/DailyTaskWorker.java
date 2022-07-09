package ch.endorser.mobile;

import android.content.Context;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.work.Data;
import androidx.work.WorkerParameters;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.jstasks.HeadlessJsTaskConfig;
import io.github.wjaykim.rnheadlesstaskworker.HeadlessJsTaskWorker;

// extends https://github.com/wjaykim/react-native-headless-task-worker/blob/master/android/src/main/java/io/github/wjaykim/rnheadlesstaskworker/HeadlessJsTaskWorker.java
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
                "EndorserDailyTask",
                Arguments.makeNativeMap(data.getKeyValueMap()),
                5000, // timeout for the task, in ms
                false // optional: defines whether or not the task is allowed in foreground. Default is false
            );
        }
        return null;
    }
}
