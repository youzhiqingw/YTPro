package com.google.android.youtube.pro.webview;

import android.content.Intent;
import android.text.TextUtils;
import android.util.Log;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.google.android.youtube.pro.ForegroundService;
import com.google.android.youtube.pro.MainActivity;

import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.URL;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import javax.net.ssl.HttpsURLConnection;

public class YTProWebViewClient extends WebViewClient {

    private final MainActivity activity;
    private final YTProWebView web;

    public YTProWebViewClient(MainActivity activity, YTProWebView web) {
        this.activity = activity;
        this.web = web;
    }

    /**
     * Bootstrap injected into the intercepted main-frame HTML, so it runs at
     * document-start — before YouTube's own scripts. It:
     *   1. creates a permissive trustedTypes default policy early (fixes CSP issues),
     *   2. patches fetch/XHR to drop ad & telemetry requests before they leave the page,
     *   3. loads the YTPRO feature scripts as soon as the DOM is interactive.
     * Kept ASCII-only and free of "</script>" so it can be embedded inline safely.
     */
    private static final String BOOTSTRAP_JS =
            "(function(){"
            + "if(window.__YTPRO_BOOT__)return;window.__YTPRO_BOOT__=true;"
            + "if(window.top!==window.self)return;"
            + "try{if(window.trustedTypes&&window.trustedTypes.createPolicy){"
            + "window.trustedTypes.createPolicy('default',{"
            + "createHTML:function(s){return s;},"
            + "createScriptURL:function(s){return s;},"
            + "createScript:function(s){return s;}});}}catch(e){}"
            + "var AD=['googleads.g.doubleclick.net','youtube.com/youtubei/v1/player/ad_break','youtube.com/pagead/adview','youtube.com/api/stats/ads'];"
            + "function isAd(u){if(!u)return false;for(var i=0;i<AD.length;i++){if(u.indexOf(AD[i])>-1)return true;}return false;}"
            + "var _f=window.fetch;if(_f){window.fetch=function(input,init){"
            + "try{var u=(typeof input==='string')?input:(input&&input.url);if(isAd(u)){return Promise.resolve('');}}catch(e){}"
            + "return _f.apply(this,arguments);};}"
            + "var _x=window.XMLHttpRequest;if(_x){"
            + "var _o=_x.prototype.open;var _s=_x.prototype.send;"
            + "_x.prototype.open=function(m,u){this.__ytproUrl=u;return _o.apply(this,arguments);};"
            + "_x.prototype.send=function(){if(isAd(this.__ytproUrl)){return;}return _s.apply(this,arguments);};}"
            + "function boot(){var urls=["
            + "'https://youtube.com/ytpro_cdn/npm/ytpro@latest',"
            + "'https://youtube.com/ytpro_cdn/npm/ytpro@latest/bgplay.js',"
            + "'https://youtube.com/ytpro_cdn/npm/ytpro@latest/innertube.js'];"
            + "for(var i=0;i<urls.length;i++){var s=document.createElement('script');"
            + "s.src=urls[i];s.async=true;if(i===2){s.type='module';}"
            + "(document.head||document.documentElement).appendChild(s);}}"
            + "if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',boot);}else{boot();}"
            + "})();";

    /** Injects the bootstrap right after the <head> opening tag, or at the top of the document. */
    private static String injectBootstrap(String html) {
        String script = "<script>" + BOOTSTRAP_JS + "</script>";
        String lower = html.toLowerCase(java.util.Locale.ROOT);
        int headIdx = lower.indexOf("<head");
        if (headIdx != -1) {
            int headEnd = html.indexOf('>', headIdx);
            if (headEnd != -1) {
                return html.substring(0, headEnd + 1) + script + html.substring(headEnd + 1);
            }
        }
        return script + html;
    }

    /**
     * Serves the app's own YTPRO scripts from bundled APK assets instead of a
     * CDN. Returns null when the URL is not a bundled YTPRO script, in which
     * case the caller falls through to the legacy CDN rewrite (eruda / esm).
     */
    private WebResourceResponse loadLocalYtproAsset(String url) {
        if (!url.contains("ytpro_cdn/npm/ytpro")) {
            return null;
        }

        String asset;
        if (url.contains("/bgplay.js")) {
            asset = "ytpro/bgplay.js";
        } else if (url.contains("/innertube.js")) {
            asset = "ytpro/innertube.js";
        } else {
            asset = "ytpro/script.js";
        }

        try {
            InputStream is = activity.getAssets().open(asset);
            Map<String, String> headers = new HashMap<>();
            headers.put("Access-Control-Allow-Origin", "*");
            headers.put("Access-Control-Allow-Methods", "GET");
            headers.put("Access-Control-Allow-Headers", "*");
            headers.put("Cross-Origin-Resource-Policy", "cross-origin");
            headers.put("Cache-Control", "no-cache");
            return new WebResourceResponse("application/javascript", "UTF-8", 200, "OK", headers, is);
        } catch (Exception e) {
            Log.e("YTPRO_WVC", "Failed to load local YTPRO asset: " + asset, e);
            return null;
        }
    }

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        String url = request.getUrl().toString();

        if (url.contains("accounts.google.com") ||
                url.contains("myaccount.google.com") ||
                url.contains("accounts.youtube.com") ||
                url.contains("google.com/signin") ||
                url.contains("google.com/oauth") ||
                url.contains("googleapis.com/oauth") ||
                url.contains("/signin") ||
                url.contains("SetSID")) {
            return super.shouldInterceptRequest(view, request);
        }

        if (request.isForMainFrame() && (url.contains("m.youtube.com") || url.contains("www.youtube.com"))) {
            try {
                URL newUrl = new URL(url);
                HttpsURLConnection connection = (HttpsURLConnection) newUrl.openConnection();
                connection.setRequestMethod(request.getMethod());

                for (Map.Entry<String, String> header : request.getRequestHeaders().entrySet()) {
                    if (!header.getKey().equalsIgnoreCase("Accept-Encoding")) {
                        connection.setRequestProperty(header.getKey(), header.getValue());
                    }
                }

                String cookies = android.webkit.CookieManager.getInstance().getCookie(url);
                if (cookies != null) connection.setRequestProperty("Cookie", cookies);

                connection.connect();

                Map<String, String> safeHeaders = new HashMap<>();
                for (Map.Entry<String, List<String>> entry : connection.getHeaderFields().entrySet()) {
                    if (entry.getKey() != null) {
                        String headerName = entry.getKey().toLowerCase();
                        if (!headerName.equals("content-security-policy") && !headerName.equals("content-security-policy-report-only")) {
                            // TextUtils.join is API 1+; String.join would crash on API 21-25.
                            safeHeaders.put(entry.getKey(), TextUtils.join(", ", entry.getValue()));
                        }
                    }
                }

                InputStream is = connection.getInputStream();
                BufferedReader reader = new BufferedReader(new InputStreamReader(is));
                StringBuilder html = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    if (line.toLowerCase().contains("content-security-policy")) {
                        line = line.replaceAll("<meta.*?http-equiv=[\"']?Content-Security-Policy[\"']?.*?>", "");
                    }
                    html.append(line).append("\n");
                }
                reader.close();

                String modifiedHtml = injectBootstrap(html.toString());
                InputStream modifiedHtmlStream = new ByteArrayInputStream(modifiedHtml.getBytes("UTF-8"));
                return new WebResourceResponse("text/html", "utf-8", connection.getResponseCode(), "OK", safeHeaders, modifiedHtmlStream);

            } catch (Exception e) {
                return super.shouldInterceptRequest(view, request);
            }
        }

        if (url.startsWith("https://www.google.com/js/") ||
                url.startsWith("https://www.google.com/recaptcha/") ||
                url.startsWith("https://www.google.com/js/th/")) {

            try {
                HttpsURLConnection conn = (HttpsURLConnection) new URL(url).openConnection();
                conn.setRequestProperty("User-Agent", request.getRequestHeaders().get("User-Agent"));
                conn.setRequestProperty("Referer", "https://www.youtube.com/");
                conn.setInstanceFollowRedirects(true);
                conn.setConnectTimeout(10000);
                conn.setReadTimeout(10000);
                conn.connect();

                String mimeType = conn.getContentType();
                String encoding = conn.getContentEncoding();
                if (encoding == null) encoding = "utf-8";
                if (mimeType == null) mimeType = "application/javascript";

                Map<String, String> headers = new HashMap<>();
                headers.put("Access-Control-Allow-Origin", "*");
                headers.put("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
                headers.put("Access-Control-Allow-Headers", "*");
                headers.put("Cross-Origin-Resource-Policy", "cross-origin");

                return new WebResourceResponse(
                        mimeType, encoding,
                        conn.getResponseCode(), "OK",
                        headers, conn.getInputStream()
                );

            } catch (Exception e) {
                Log.e("YTPRO_WVC", "Google JS fetch failed: " + e.getMessage());
            }
        }

        // Serve the app's own scripts from bundled assets (offline, no CDN).
        WebResourceResponse localAsset = loadLocalYtproAsset(url);
        if (localAsset != null) {
            return localAsset;
        }

        if (url.contains("youtube.com/ytpro_cdn/")) {
            String modifiedUrl = url;
            if (url.contains("youtube.com/ytpro_cdn/esm")) modifiedUrl = url.replace("youtube.com/ytpro_cdn/esm", "esm.sh");
            else if (url.contains("youtube.com/ytpro_cdn/npm")) modifiedUrl = url.replace("youtube.com/ytpro_cdn", "cdn.jsdelivr.net");

            try {
                URL newUrl = new URL(modifiedUrl);
                HttpsURLConnection connection = (HttpsURLConnection) newUrl.openConnection();

                connection.setUseCaches(false);
                connection.setDefaultUseCaches(false);
                connection.addRequestProperty("Cache-Control", "no-cache, no-store, must-revalidate");
                connection.addRequestProperty("Pragma", "no-cache");
                connection.addRequestProperty("Expires", "0");
                connection.setRequestProperty("User-Agent", "YTPRO");
                connection.setRequestProperty("Accept", "*/*");
                connection.setConnectTimeout(10000);
                connection.setReadTimeout(10000);
                connection.setRequestMethod("GET");
                connection.connect();

                String contentType = connection.getContentType();
                if (contentType == null) contentType = "application/javascript";

                Map<String, String> headers = new HashMap<>();
                headers.put("Access-Control-Allow-Origin", "*");
                headers.put("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
                headers.put("Access-Control-Allow-Headers", "*");
                headers.put("Content-Type", contentType);
                headers.put("Access-Control-Allow-Credentials", "true");
                headers.put("Cross-Origin-Resource-Policy", "cross-origin");

                if (request.getMethod().equals("OPTIONS")) {
                    return new WebResourceResponse("text/plain", "UTF-8", 204, "No Content", headers, null);
                }

                return new WebResourceResponse(contentType, "utf-8", connection.getResponseCode(), "OK", headers, connection.getInputStream());
            } catch (Exception e) {
                return super.shouldInterceptRequest(view, request);
            }
        }

        return super.shouldInterceptRequest(view, request);
    }

    @Override
    public void onPageFinished(WebView view, String url) {
        // Feature scripts are now injected at document-start via shouldInterceptRequest,
        // so no late evaluateJavascript calls happen here (which previously caused ad
        // flicker and UI jumps). We only maintain background-playback state.
        if (!url.contains("youtube.com/watch") && !url.contains("youtube.com/shorts") && activity.isPlaying) {
            activity.isPlaying = false;
            activity.mediaSession = false;
            activity.stopService(new Intent(activity.getApplicationContext(), ForegroundService.class));
        }
        super.onPageFinished(view, url);
    }
}
