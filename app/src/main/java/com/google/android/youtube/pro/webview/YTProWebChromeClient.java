package com.google.android.youtube.pro.webview;

import android.Manifest;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.os.Build;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.widget.FrameLayout;

// Import the main files from the parent package
import com.google.android.youtube.pro.MainActivity;

public class YTProWebChromeClient extends WebChromeClient {
    /** How long to hold the video-aspect orientation before enabling free sensor rotation. */
    private static final long INITIAL_ORIENTATION_HOLD_MS = 1000L;

    private final MainActivity activity;
    private final YTProWebView web;

    private View mCustomView;
    private WebChromeClient.CustomViewCallback mCustomViewCallback;
    private int mOriginalSystemUiVisibility;
    private int mOriginalRequestedOrientation;

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

        FrameLayout decor = (FrameLayout) activity.getWindow().getDecorView();
        decor.addView(mCustomView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));
        decor.setSystemUiVisibility(immersiveFlags());

        // The initial fullscreen direction follows the video's own aspect ratio
        // (portrait content -> portrait, landscape content -> landscape).
        // activity.portrait is kept in sync with the video element by the
        // injected script before requestFullscreen() fires. Once the initial
        // rotation has settled we switch back to sensor-driven rotation so the
        // user can keep rotating freely with the device.
        if (activity.isPip) {
            // PIP is transient, so there is no meaningful "initial" direction.
            activity.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR);
        } else {
            final int initialOrientation = activity.portrait
                    ? ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
                    : ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE;
            activity.setRequestedOrientation(initialOrientation);
            decor.postDelayed(() -> {
                if (mCustomView != null) {
                    activity.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR);
                }
            }, INITIAL_ORIENTATION_HOLD_MS);
        }
    }

    @Override
    public void onHideCustomView() {
        if (mCustomView == null) {
            return;
        }

        FrameLayout decor = (FrameLayout) activity.getWindow().getDecorView();
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
