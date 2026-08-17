package com.google.android.youtube.pro;

/**
 * Distinct manifest entry for the download/share intent filters.
 * Behaviour is identical to MainActivity: the shared onCreate already
 * handles ACTION_VIEW / ACTION_SEND and performs a single WebView load,
 * so this subclass must NOT re-inflate the layout or call load() again
 * (that used to create a second, leaked WebView instance).
 */
public class DownloadFromIntentFilter extends MainActivity {
}
