package com.google.android.youtube.pro.webview;


import android.content.Context;
import android.content.SharedPreferences;
import android.util.AttributeSet;
import android.view.View;
import android.webkit.WebView;

public class YTProWebView extends WebView {
	
	public YTProWebView(Context context) {
		super(context);
	}
	
	public YTProWebView(Context context, AttributeSet attrs) {
		super(context, attrs);
	}
	
	public YTProWebView(Context context, AttributeSet attrs, int defStyleAttr) {
		super(context, attrs, defStyleAttr);
	}
	
	@Override
	protected void onWindowVisibilityChanged(int visibility) {
		SharedPreferences prefs = getContext().getSharedPreferences("YTPRO", Context.MODE_PRIVATE);
		boolean bgPlay = prefs.getBoolean("bgplay", false);

		// When the window is hidden AND background playback is enabled, do not
		// forward the visibility change so the WebView keeps rendering audio.
		boolean hidden = (visibility == View.GONE || visibility == View.INVISIBLE);
		if (!hidden || !bgPlay) {
			super.onWindowVisibilityChanged(visibility);
		}
	}
}
