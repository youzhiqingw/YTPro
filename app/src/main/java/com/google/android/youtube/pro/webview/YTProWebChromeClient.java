package com.google.android.youtube.pro.webview;

import android.Manifest;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.widget.FrameLayout;
import android.widget.ImageView;

// Import the main files from the parent package
import com.google.android.youtube.pro.MainActivity;
import com.google.android.youtube.pro.R;

public class YTProWebChromeClient extends WebChromeClient {
    private final MainActivity activity;
    private final YTProWebView web;

    /** JS that opens the injected YTPro settings sheet after leaving fullscreen. */
    private static final String OPEN_SETTINGS_JS =
            "(function(){"
            + "try{if(typeof ytproSettings==='function'){ytproSettings();return;}}catch(e){}"
            + "window.location.hash='';window.location.hash='settings';"
            + "})();";

    private View mCustomView;
    private WebChromeClient.CustomViewCallback mCustomViewCallback;
    private int mOriginalSystemUiVisibility;
    private int mOriginalRequestedOrientation;
    /** Native gear overlay shown on top of the fullscreen custom view. */
    private ImageView mSettingsButton;

    public YTProWebChromeClient(MainActivity activity, YTProWebView web) {
        this.activity = activity;
        this.web = web;
    }

    /**
     * No magic resource ids: let the page supply its own video poster.
     * Returning null keeps behaviour consistent across devices and avoids
     * a fragile hard-coded resource lookup.
     */
    @Override
    public android.graphics.Bitmap getDefaultVideoPoster() {
        return null;
    }

    @Override
    public void onShowCustomView(View paramView, WebChromeClient.CustomViewCallback viewCallback) {
        // Re-entrant fullscreen request: release the previous view first.
        if (mCustomView != null) {
            onHideCustomView();
        }

        mCustomView = paramView;
        mCustomViewCallback = viewCallback;

        // Remember exactly what to restore when we leave fullscreen.
        mOriginalSystemUiVisibility = activity.getWindow().getDecorView().getSystemUiVisibility();
        mOriginalRequestedOrientation = activity.getRequestedOrientation();

        // Immersive layout so the custom view can draw under the status bar and cutout.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams params = activity.getWindow().getAttributes();
            params.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            activity.getWindow().setAttributes(params);
            activity.getWindow().setFlags(
                    WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                    WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS);
        }

        // Match the fullscreen orientation to the video's own aspect ratio
        // rather than the device's physical orientation: portrait content goes
        // portrait, landscape content goes landscape. SENSOR_* variants allow a
        // 180 degree flip so the picture stays upright either way up the phone
        // is held. activity.portrait is kept in sync with the video element by
        // the injected script before requestFullscreen() fires.
        final int orientation;
        if (activity.isPip) {
            orientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_PORTRAIT;
        } else if (activity.portrait) {
            orientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_PORTRAIT;
        } else {
            orientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE;
        }
        activity.setRequestedOrientation(orientation);

        FrameLayout decor = (FrameLayout) activity.getWindow().getDecorView();
        decor.addView(mCustomView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));
        decor.setSystemUiVisibility(immersiveFlags());
        addSettingsOverlay(decor);
    }

    @Override
    public void onHideCustomView() {
        if (mCustomView == null) {
            return;
        }

        FrameLayout decor = (FrameLayout) activity.getWindow().getDecorView();
        removeSettingsOverlay(decor);
        decor.removeView(mCustomView);
        mCustomView = null;

        // Restore the system UI chrome.
        decor.setSystemUiVisibility(mOriginalSystemUiVisibility);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS);
            WindowManager.LayoutParams params = activity.getWindow().getAttributes();
            params.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_DEFAULT;
            activity.getWindow().setAttributes(params);
        }

        // Restore the exact orientation the activity had before fullscreen.
        // Normally this is SCREEN_ORIENTATION_UNSPECIFIED, i.e. free rotation,
        // which is what we want for a pure player experience.
        activity.setRequestedOrientation(mOriginalRequestedOrientation);

        if (mCustomViewCallback != null) {
            mCustomViewCallback.onCustomViewHidden();
            mCustomViewCallback = null;
        }
        web.requestFocus();
    }

    /**
     * Keeps the immersive flags in sync after a rotation (which would otherwise
     * drop the hidden-system-bars state and cause UI offset / black bars).
     */
    public void onConfigurationChanged(Configuration newConfig) {
        if (mCustomView != null) {
            activity.getWindow().getDecorView().setSystemUiVisibility(immersiveFlags());
        }
    }

    private int immersiveFlags() {
        return View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION;
    }

    /**
     * Draws a native settings gear on top of the fullscreen custom view. The
     * WebView (and the page-level gear/settings sheet it renders) sits behind the
     * detached video during fullscreen, so a native overlay is the only way to
     * keep settings reachable. Tapping it leaves fullscreen and opens the sheet.
     */
    private void addSettingsOverlay(FrameLayout decor) {
        if (mSettingsButton != null) {
            return;
        }

        ImageView button = new ImageView(activity);
        button.setImageResource(R.drawable.ic_settings_white);
        button.setContentDescription("Settings");
        button.setPadding(dp(12), dp(12), dp(12), dp(12));

        GradientDrawable bg = new GradientDrawable();
        bg.setShape(GradientDrawable.OVAL);
        bg.setColor(0x66000000);
        button.setBackground(bg);

        button.setOnClickListener(v -> {
            // Exit fullscreen first so the WebView (and its settings sheet) is
            // visible again, then open the injected YTPro settings panel.
            onHideCustomView();
            web.postDelayed(() -> web.evaluateJavascript(OPEN_SETTINGS_JS, null), 200);
        });

        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.gravity = Gravity.TOP | Gravity.END;
        lp.topMargin = dp(16);
        lp.rightMargin = dp(12);
        decor.addView(button, lp);
        mSettingsButton = button;
    }

    private void removeSettingsOverlay(FrameLayout decor) {
        if (mSettingsButton != null) {
            decor.removeView(mSettingsButton);
            mSettingsButton = null;
        }
    }

    private int dp(int value) {
        return (int) (value * activity.getResources().getDisplayMetrics().density + 0.5f);
    }

    @Override
    public void onPermissionRequest(final PermissionRequest request) {
        if (Build.VERSION.SDK_INT > 22 && request.getOrigin().toString().contains("youtube.com")) {
            if (activity.checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_DENIED) {
                activity.requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, 101);
            } else {
                request.grant(request.getResources());
            }
        } else {
            // Never leave a pending permission request hanging on non-YouTube origins.
            request.deny();
        }
    }
}
