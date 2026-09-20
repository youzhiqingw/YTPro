package com.google.android.youtube.pro.webview;

import android.app.PictureInPictureParams;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.util.Rational;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.widget.Toast;
import java.io.File;
import android.Manifest;

import android.os.Build;
import android.os.Environment;
import androidx.webkit.WebViewFeature;

import com.google.android.youtube.pro.ForegroundService;
import com.google.android.youtube.pro.MainActivity;
import com.google.android.youtube.pro.R;
import com.google.android.youtube.pro.utils.DownloadUtils;
import com.google.android.youtube.pro.utils.MediaMuxerUtils;

public class WebAppInterface {
	private final MainActivity activity;
	private final YTProWebView web;
	
	private String icon = "";
	private String title = "";
	private String subtitle = "";
	private long duration;
	
	public WebAppInterface(MainActivity activity, YTProWebView web) {
		this.activity = activity;
		this.web = web;
	}
	
	@JavascriptInterface
	public void showToast(String txt) {
		Toast.makeText(activity.getApplicationContext(), txt, Toast.LENGTH_SHORT).show();
	}
	
	@JavascriptInterface
	public void gohome(String x) {
		Intent startMain = new Intent(Intent.ACTION_MAIN);
		startMain.addCategory(Intent.CATEGORY_HOME);
		startMain.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
		activity.startActivity(startMain);
	}
	
	@JavascriptInterface
	public void downvid(String name, String url, String m) {
		DownloadUtils.downloadFile(activity, name, url, m);
	}

	//Hand the download off to YTDLnis (com.deniscerri.ytdl) via ACTION_SEND;
	//the built-in downloader stays unused from the UI. If YTDLnis is not
	//installed, fall back to the system chooser so any downloader can be picked.
	@JavascriptInterface
	public void sendToDownloader(String url) {
		activity.runOnUiThread(() -> {
			try {
				Intent send = new Intent(Intent.ACTION_SEND);
				send.setType("text/plain");
				send.putExtra(Intent.EXTRA_TEXT, url);
				try {
					send.setPackage("com.deniscerri.ytdl");
					activity.startActivity(send);
				} catch (Exception e) {
					Intent open = new Intent(Intent.ACTION_SEND);
					open.setType("text/plain");
					open.putExtra(Intent.EXTRA_TEXT, url);
					activity.startActivity(Intent.createChooser(open, "Download with"));
				}
			} catch (Exception e) {
				Toast.makeText(activity.getApplicationContext(), "No downloader available", Toast.LENGTH_SHORT).show();
			}
		});
	}
	
	@JavascriptInterface
	public void copyLink(String text) {
		activity.runOnUiThread(() -> {
			try {
				ClipboardManager cm = (ClipboardManager) activity.getSystemService(Context.CLIPBOARD_SERVICE);
				cm.setPrimaryClip(ClipData.newPlainText("YTPro link", text));
			} catch (Exception e) {
				Toast.makeText(activity.getApplicationContext(), "Copy failed", Toast.LENGTH_SHORT).show();
			}
		});
	}

	@JavascriptInterface
	public void shareText(String text) {
		activity.runOnUiThread(() -> {
			try {
				Intent send = new Intent(Intent.ACTION_SEND);
				send.setType("text/plain");
				send.putExtra(Intent.EXTRA_TEXT, text);
				activity.startActivity(Intent.createChooser(send, "Share to"));
			} catch (Exception e) {
				Toast.makeText(activity.getApplicationContext(), "Share failed", Toast.LENGTH_SHORT).show();
			}
		});
	}

	@JavascriptInterface
	public void fullScreen(boolean value) {
		activity.portrait = value;
	}
	
	@JavascriptInterface
	public void oplink(String url) {
		Intent i = new Intent(Intent.ACTION_VIEW);
		i.setData(Uri.parse(url));
		activity.startActivity(i);
	}
	
	@JavascriptInterface
	public String getInfo() {
		try {
			PackageInfo info = activity.getPackageManager().getPackageInfo(activity.getPackageName(), PackageManager.GET_ACTIVITIES);
			return info.versionName;
		} catch (Exception e) {
			return "1.0";
		}
	}
	@JavascriptInterface
	public boolean isWebViewSupported() {
		return WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_ARRAY_BUFFER);
	}
	
	@JavascriptInterface
	public boolean hasStoragePermission() {
		if (Build.VERSION.SDK_INT > 22 && Build.VERSION.SDK_INT < Build.VERSION_CODES.R){
			if (activity.checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) == PackageManager.PERMISSION_DENIED || activity.checkSelfPermission(Manifest.permission.READ_EXTERNAL_STORAGE) == PackageManager.PERMISSION_DENIED) {
				activity.runOnUiThread(() -> Toast.makeText(activity, R.string.grant_storage, Toast.LENGTH_SHORT).show());
				activity.requestPermissions(new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE,Manifest.permission.READ_EXTERNAL_STORAGE}, 1);
			}
			return (activity.checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) == PackageManager.PERMISSION_DENIED || activity.checkSelfPermission(Manifest.permission.READ_EXTERNAL_STORAGE) == PackageManager.PERMISSION_DENIED);
		}
		return true;
	}
	
	// 页面侧传来的文件名源于可构造的视频标题，可能携带路径分隔符或 ../，
	// 统一在桥接边界消毒，杜绝 Downloads/Pictures/YTPRO 写入时的目录穿越。
	private static String safeFileName(String name) {
		if (name == null || name.trim().isEmpty()) return "ytpro.bin";
		String cleaned = name.replaceAll("[/\\\\]", "_");
		int i = 0;
		while (i < cleaned.length() && cleaned.charAt(i) == '.') i++;
		cleaned = cleaned.substring(i).trim();
		return cleaned.isEmpty() ? "ytpro.bin" : cleaned;
	}

	@JavascriptInterface
	public void requestBinaryPort(String fileName) {
		activity.runOnUiThread(() -> {
			if (activity.streamManager != null) {
				activity.streamManager.openStreamForFile(safeFileName(fileName));
			}
		});
	}
	
	@JavascriptInterface
	public void muxVideoAudio(String videoFileName,String audioFileName,String outputFileName) {
		java.io.File downloads = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS.concat("/YTPRO"));
		java.io.File video  = new java.io.File(downloads, safeFileName(videoFileName));
		java.io.File audio  = new java.io.File(downloads, safeFileName(audioFileName));

		java.io.File output = new java.io.File(downloads, safeFileName(outputFileName));
		
		MediaMuxerUtils.muxVideoAudio(activity.getApplicationContext(), video, audio, output, new MediaMuxerUtils.MuxCallback() {
			@Override
			public void onSuccess(File output) {
				// safe to update UI here — already on main thread
				Toast.makeText(activity, "Done: " + output.getName(), Toast.LENGTH_SHORT).show();
			}
			
			@Override
			public void onFailure(Exception e) {
				Toast.makeText(activity, "Failed: " + e.getMessage(), Toast.LENGTH_SHORT).show();
			}
		});
	}
	
	@JavascriptInterface
	public void setBgPlay(boolean bgplay) {
		activity.getSharedPreferences("YTPRO", Context.MODE_PRIVATE).edit().putBoolean("bgplay", bgplay).apply();
	}
	
	@JavascriptInterface
	public void bgStart(String iconn, String titlen, String subtitlen, long dura) {
		icon = iconn; title = titlen; subtitle = subtitlen; duration = dura;
		activity.isPlaying = true; activity.mediaSession = true;
		
		Intent intent = new Intent(activity.getApplicationContext(), ForegroundService.class);
		intent.putExtra("icon", icon); intent.putExtra("title", title);
		intent.putExtra("subtitle", subtitle); intent.putExtra("duration", duration);
		intent.putExtra("currentPosition", 0); intent.putExtra("action", "play");
		if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
			activity.startForegroundService(intent);
		} else {
			activity.startService(intent);
		}
	}
	
	@JavascriptInterface
	public void bgUpdate(String iconn, String titlen, String subtitlen, long dura) {
		icon = iconn; title = titlen; subtitle = subtitlen; duration = dura;
		activity.isPlaying = true;
		sendUpdateBroadcast(0, "pause");
	}
	
	@JavascriptInterface
	public void bgStop() {
		activity.isPlaying = false; activity.mediaSession = false;
		activity.stopService(new Intent(activity.getApplicationContext(), ForegroundService.class));
	}
	
	@JavascriptInterface
	public void bgPause(long ct) {
		activity.isPlaying = false;
		sendUpdateBroadcast(ct, "pause");
	}
	
	@JavascriptInterface
	public void bgPlay(long ct) {
		activity.isPlaying = true;
		sendUpdateBroadcast(ct, "play");
	}
	
	@JavascriptInterface
	public void bgBuffer(long ct) {
		activity.isPlaying = true;
		sendUpdateBroadcast(ct, "buffer");
	}
	
	private void sendUpdateBroadcast(long ct, String action) {
		activity.sendBroadcast(new Intent("UPDATE_NOTIFICATION")
		.putExtra("icon", icon).putExtra("title", title)
		.putExtra("subtitle", subtitle).putExtra("duration", duration)
		.putExtra("currentPosition", ct).putExtra("action", action));
	}
	
	@JavascriptInterface
	public String getAllCookies(String url) {
		return CookieManager.getInstance().getCookie(url);
	}
	
	@JavascriptInterface
	public void pipvid(String mode) {
		if (android.os.Build.VERSION.SDK_INT >= 26) {
			try {
				PictureInPictureParams params = new PictureInPictureParams.Builder()
				.setAspectRatio(new Rational(mode.equals("portrait") ? 9 : 16, mode.equals("portrait") ? 16 : 9))
				.build();
				activity.enterPictureInPictureMode(params);
			} catch (Exception e) { e.printStackTrace(); }
		} else {
			Toast.makeText(activity, activity.getString(R.string.no_pip), Toast.LENGTH_SHORT).show();
		}
	}
}
