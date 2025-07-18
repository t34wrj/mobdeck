# ============================================================================
# MOBDECK REACT NATIVE PROGUARD CONFIGURATION
# Based on Android ProGuard best practices guide
# ============================================================================

# ============================================================================
# BASIC ANDROID CONFIGURATION
# ============================================================================

# Keep line numbers for debugging
-keepattributes SourceFile,LineNumberTable

# Keep annotations
-keepattributes *Annotation*

# Keep generic signatures
-keepattributes Signature

# Keep parameter names for better debugging
-keepattributes MethodParameters

# Keep inner classes
-keepattributes InnerClasses,EnclosingMethod

# ============================================================================
# ANDROID FRAMEWORK RULES
# ============================================================================

# Keep all public classes extending Android framework classes
-keep public class * extends android.app.Activity
-keep public class * extends android.app.Application
-keep public class * extends android.app.Service
-keep public class * extends android.content.BroadcastReceiver
-keep public class * extends android.content.ContentProvider

# Keep custom Views
-keep public class * extends android.view.View {
    public <init>(android.content.Context);
    public <init>(android.content.Context, android.util.AttributeSet);
    public <init>(android.content.Context, android.util.AttributeSet, int);
}

# Keep onClick methods
-keepclassmembers class * extends android.app.Activity {
    public void *(android.view.View);
}

# Keep Parcelable implementations
-keep class * implements android.os.Parcelable {
    public static final android.os.Parcelable$Creator *;
}

# Keep enum methods
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# ============================================================================
# DEBUGGING AND LOGGING (DISABLE IN RELEASE)
# ============================================================================

# Remove Android logging in release builds
-assumenosideeffects class android.util.Log {
    public static boolean isLoggable(java.lang.String, int);
    public static int v(...);
    public static int i(...);
    public static int w(...);
    public static int d(...);
    public static int e(...);
}

# Remove System.out logging
-assumenosideeffects class java.io.PrintStream {
    public void println(...);
    public void print(...);
}

# Remove React Native console.log (handled by RN bridge)
# Note: Console logs are handled by React Native bridge, not removed here

# ============================================================================
# REACT NATIVE CORE CONFIGURATION
# ============================================================================

# Keep React Native bridge classes (essential for JS-Native communication)
-keep class com.facebook.react.bridge.** { *; }
-keep class com.facebook.react.uimanager.** { *; }
-keep class com.facebook.react.common.** { *; }
-keep class com.facebook.react.** { *; }

# Keep Hermes JavaScript engine
-keep class com.facebook.hermes.** { *; }

# Keep JNI bridge
-keep class com.facebook.jni.** { *; }

# Keep React Native modules and their methods
-keep @com.facebook.react.bridge.ReactModuleWithSpec class * { *; }
-keep class * extends com.facebook.react.bridge.JavaScriptModule { *; }
-keep class * extends com.facebook.react.bridge.NativeModule { *; }
-keep class * extends com.facebook.react.bridge.BaseJavaModule { *; }

# Keep all native modules that might be used by the app
-keep class * extends com.facebook.react.bridge.ReactContextBaseJavaModule { *; }

# Keep methods annotated with @ReactMethod (CRITICAL for RN bridge)
-keepclassmembers class * {
    @com.facebook.react.bridge.ReactMethod <methods>;
}

# Keep React Native UI annotations
-keepclassmembers class * {
    @com.facebook.react.uimanager.annotations.ReactProp <methods>;
    @com.facebook.react.uimanager.annotations.ReactPropGroup <methods>;
}

# Keep React Native ViewManagers
-keep public class * extends com.facebook.react.uimanager.ViewManager {
    public <init>(...);
}

# Keep Promise class for async operations (CRITICAL for API calls)
-keep class com.facebook.react.bridge.Promise { *; }
-keep class com.facebook.react.bridge.WritableMap { *; }
-keep class com.facebook.react.bridge.ReadableMap { *; }
-keep class com.facebook.react.bridge.WritableArray { *; }
-keep class com.facebook.react.bridge.ReadableArray { *; }

# ===========================
# Security-Critical Libraries
# ===========================

# react-native-keychain (secure token storage)
-keep class com.oblador.keychain.** { *; }
-keepclassmembers class com.oblador.keychain.** { *; }

# Keep security providers
-keep class com.android.org.conscrypt.** { *; }
-keep class org.apache.harmony.xnet.provider.jsse.** { *; }
-keep class sun.security.ssl.** { *; }

# ===========================
# SQLite Storage Rules
# ===========================

# Keep SQLite related classes
-keep class org.sqlite.** { *; }
-keep class org.sqlite.database.** { *; }
-keep class net.sqlcipher.** { *; }
-keepclassmembers class net.sqlcipher.** { *; }

# ============================================================================
# NETWORKING AND HTTP CLIENT CONFIGURATION
# ============================================================================

# CRITICAL: Keep React Native networking module (handles HTTP requests)
-keep class com.facebook.react.modules.network.** { *; }
-keep class com.facebook.react.modules.network.NetworkingModule { *; }
-keep class com.facebook.react.modules.network.NetworkingModule$* { *; }

# Keep OkHttp (used by React Native for network requests)
-keepattributes Signature
-keepattributes *Annotation*
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }
-dontwarn okhttp3.**
-dontwarn okio.**

# Keep Retrofit interfaces if used
-keepclasseswithmembers class * {
    @retrofit2.http.* <methods>;
}

# Keep annotation default values for networking
-keepattributes AnnotationDefault

# Keep HTTP response/request classes
-keep class okhttp3.Response { *; }
-keep class okhttp3.Request { *; }
-keep class okhttp3.RequestBody { *; }
-keep class okhttp3.ResponseBody { *; }

# Keep SSL/TLS classes
-keep class javax.net.ssl.** { *; }
-keep class com.android.org.bouncycastle.** { *; }

# Keep security providers
-keep class com.android.org.conscrypt.** { *; }
-keep class org.apache.harmony.xnet.provider.jsse.** { *; }
-keep class sun.security.ssl.** { *; }

# Volley (alternative HTTP library)
-keep class com.android.volley.** { *; }
-keep class com.android.volley.toolbox.** { *; }

# ============================================================================
# JSON SERIALIZATION AND DATA MODELS
# ============================================================================

# Keep serialization classes
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

# Keep GSON for JSON parsing
-keepattributes Signature
-keep class sun.misc.Unsafe { *; }
-keep class com.google.gson.stream.** { *; }
-keep class com.google.gson.** { *; }
-keep class * implements com.google.gson.** { *; }

# Keep all fields in data models (important for API response parsing)
-keepclassmembers class * {
    private <fields>;
    public <init>(...);
}

# Keep model classes that might be used for API responses
-keep class com.mobdeck.models.** { *; }
-keepclassmembers class com.mobdeck.models.** { *; }

# Keep classes that might be used for JSON serialization
-keep class * {
    @com.google.gson.annotations.SerializedName <fields>;
}

# Keep Jackson annotations if used
-keep class com.fasterxml.jackson.annotation.** { *; }
-keep class org.codehaus.jackson.** { *; }
-keepclassmembers class * {
    @org.codehaus.jackson.annotate.* *;
    @com.fasterxml.jackson.annotation.* *;
}

# ===========================
# React Navigation
# ===========================

# React Native Screens - CRITICAL for fragment handling
-keep class com.swmansion.rnscreens.** { *; }
-keepclassmembers class com.swmansion.rnscreens.** { *; }
-keep class com.swmansion.rnscreens.RNScreensPackage { *; }
-keep class com.swmansion.rnscreens.ScreenFragment { *; }
-keep class com.swmansion.rnscreens.ScreenFragmentWrapper { *; }
-keep class com.swmansion.rnscreens.ScreenContainer { *; }
-keep class com.swmansion.rnscreens.ScreenStackFragment { *; }
-keep class com.swmansion.rnscreens.ScreenStackFragmentWrapper { *; }
-dontwarn com.swmansion.rnscreens.**

# React Native Reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.th3rdwave.safeareacontext.** { *; }

# AndroidX Fragment support for React Native Screens
-keep class androidx.fragment.app.Fragment { *; }
-keep class androidx.fragment.app.FragmentActivity { *; }
-keep class androidx.fragment.app.FragmentManager { *; }
-keep class androidx.fragment.app.FragmentTransaction { *; }
-keepclassmembers class androidx.fragment.app.Fragment {
    public <init>(...);
}
-keepclassmembers class * extends androidx.fragment.app.Fragment {
    public <init>(...);
}

# ===========================
# Crash Reporting and Analytics
# ===========================

# Keep crash reporting intact for debugging production issues
-keep class com.bugsnag.** { *; }
-keep class com.crashlytics.** { *; }

# ===========================
# Reflection and Dynamic Loading
# ===========================

# Keep classes that use reflection
-keepattributes InnerClasses
-keepattributes EnclosingMethod
-keepattributes Exceptions

# ===========================
# Native Libraries
# ===========================

# Keep native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# ===========================
# WebView Security
# ===========================

# Keep JavaScript interfaces
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# ============================================================================
# OPTIMIZATION AND PERFORMANCE CONFIGURATION
# ============================================================================

# Controlled optimization passes
-optimizationpasses 5

# Allow access modification for better optimization
-allowaccessmodification

# Repackage classes for smaller APK
-repackageclasses 'o'

# Standard optimization settings (avoid aggressive optimizations that break RN)
-optimizations !code/simplification/arithmetic,!field/*,!class/merging/*

# ============================================================================
# DEBUGGING AND REFLECTION SAFETY
# ============================================================================

# Keep classes that use reflection
-keepattributes InnerClasses
-keepattributes EnclosingMethod
-keepattributes Exceptions

# Keep native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep JavaScript interfaces for WebView
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# ============================================================================
# WARNING SUPPRESSION
# ============================================================================

# Suppress warnings for known issues
-dontwarn javax.annotation.**
-dontwarn javax.lang.model.element.Modifier
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn retrofit2.Platform$Java8

# ============================================================================
# FINAL CONFIGURATION
# ============================================================================

# Enable verbose output for debugging
-verbose

# Generate mapping file for stack trace deobfuscation
-printmapping mapping.txt

# Keep source file names for debugging (remove in production if needed)
-keepattributes SourceFile,LineNumberTable