package me.flieith.filmstream;

import android.os.Bundle;
import android.webkit.WebSettings;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WebSettings settings = this.bridge.getWebView().getSettings();
        // The app is a fixed 1920x1080 design canvas (viewport meta width=1920).
        // WebView ignores that meta unless wide viewport is on — without it the
        // page renders ~2x too big on a 4K panel. Overview mode then scales the
        // canvas to fit the actual screen (1080p/4K alike).
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        // TV has no touch: the player must start without a user gesture.
        settings.setMediaPlaybackRequiresUserGesture(false);
        // Disable font boosting — it inflates arbitrary text and breaks the layout.
        settings.setLayoutAlgorithm(WebSettings.LayoutAlgorithm.NORMAL);
    }
}
