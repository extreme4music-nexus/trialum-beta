# Keep the JavaScript-callable WebView bridge methods: their names are part of
# the HTML/Android contract and are invoked reflectively by WebView.
-keepclassmembers class com.trialum.ziivaiskra.MainActivity$Bridge {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes *Annotation*
