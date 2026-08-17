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

    private View mCustomView;
    private WebChromeClient.CustomViewCallback mCustomViewCallback;
    private int mOriginalSystemUiVisibility;
    private int mOriginalRequestedOrientation;

    /** Orientation-lock toggle shown on the left of portrait fullscreen. */
    private ImageView mLockButton;
    /** Whether the portrait fullscreen is locked to a fixed orientation. */
    private boolean mOrientationLocked = true;

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

        // Match the fullscreen orientation to the video's own aspect ratio.
        // Portrait content starts fixed (locked) in portrait and offers a lock
        // toggle; landscape content starts in sensor-landscape (180 degree flip).
        // activity.portrait is kept in sync with the video element by the
        // injected script before requestFullscreen() fires.
        final int orientation;
        if (activity.isPip) {
            orientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_PORTRAIT;
        } else if (activity.portrait) {
            mOrientationLocked = true;
            orientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT;
            addLockOverlay(decor);
        } else {
            orientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE;
        }
        activity.setRequestedOrientation(orientation);
    }

    /** Whether the HTML5 player is currently showing its fullscreen custom view. */
    public boolean isFullscreen() {
        return mCustomView != null;
    }

    /** Exits the HTML5 fullscreen custom view, if one is currently showing. */
    public void exitFullscreen() {
        if (mCustomView != null) {
            onHideCustomView();
        }
    }

    @Override
    public void onHideCustomView() {
        if (mCustomView == null) {
            return;
        }

        FrameLayout decor = (FrameLayout) activity.getWindow().getDecorView();
        removeLockOverlay(decor);
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
        activity.setRequestedOrientation(mOriginalRequestedOrientation);

        if (mCustomViewCallback != null) {
            mCustomViewCallback.onCustomViewHidden();
            mCustomViewCallback = null;
        }
        web.requestFocus();
    }

    /**
     * Keeps the immersive flags in sync after a rotation (which would otherwise
     * drop the hidden-system-bars state and cause UI offset / black bars), and
     * keeps the portrait-fullscreen lock toggle visible only while portrait.
     */
    public void onConfigurationChanged(Configuration newConfig) {
        if (mCustomView != null) {
            activity.getWindow().getDecorView().setSystemUiVisibility(immersiveFlags());
            if (mLockButton != null) {
                boolean portrait = newConfig.orientation == Configuration.ORIENTATION_PORTRAIT;
                mLockButton.setVisibility(portrait ? View.VISIBLE : View.GONE);
            }
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

    /** Adds the native orientation-lock toggle to the left of portrait fullscreen. */
    private void addLockOverlay(FrameLayout decor) {
        if (mLockButton != null) {
            return;
        }

        mLockButton = new ImageView(activity);
        mLockButton.setImageResource(R.drawable.ic_lock);
        mLockButton.setContentDescription("Lock orientation");
        mLockButton.setPadding(dp(12), dp(12), dp(12), dp(12));

        GradientDrawable bg = new GradientDrawable();
        bg.setShape(GradientDrawable.OVAL);
        bg.setColor(0x66000000);
        mLockButton.setBackground(bg);

        mLockButton.setOnClickListener(v -> toggleOrientationLock());

        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT);
        lp.gravity = Gravity.START | Gravity.CENTER_VERTICAL;
        lp.leftMargin = dp(12);
        decor.addView(mLockButton, lp);
    }

    /** Toggles between locked (fixed portrait) and unlocked (follow device). */
    private void toggleOrientationLock() {
        mOrientationLocked = !mOrientationLocked;
        if (mOrientationLocked) {
            activity.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
            if (mLockButton != null) {
                mLockButton.setImageResource(R.drawable.ic_lock);
            }
        } else {
            activity.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR);
            if (mLockButton != null) {
                mLockButton.setImageResource(R.drawable.ic_lock_open);
            }
        }
    }

    private void removeLockOverlay(FrameLayout decor) {
        if (mLockButton != null) {
            decor.removeView(mLockButton);
            mLockButton = null;
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
