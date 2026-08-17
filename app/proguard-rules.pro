# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# WebView calls into the JavaScript interface reflectively, so the annotated
# methods (and the class itself) must survive R8 shrinking/renaming.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

-keep class com.google.android.youtube.pro.webview.WebAppInterface { *; }

# Custom view is instantiated from layout XML via reflection.
-keep class com.google.android.youtube.pro.webview.YTProWebView { <init>(...); }

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable
