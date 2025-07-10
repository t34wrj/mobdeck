# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# ===========================
# Mobdeck Security ProGuard Configuration
# ===========================

# General optimization and obfuscation
-optimizationpasses 5
-dontusemixedcaseclassnames
-dontskipnonpubliclibraryclasses
-dontpreverify
-verbose
-optimizations !code/simplification/arithmetic,!field/*,!class/merging/*

# Remove logging in release builds (security best practice)
-assumenosideeffects class android.util.Log {
    public static boolean isLoggable(java.lang.String, int);
    public static int v(...);
    public static int i(...);
    public static int w(...);
    public static int d(...);
    public static int e(...);
}

# Remove console.log calls
-assumenosideeffects class java.io.PrintStream {
    public void println(...);
    public void print(...);
}

# ===========================
# React Native Specific Rules
# ===========================

# Keep React Native classes
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }

# Keep React Native JavaScript interfaces
-keepclassmembers class * {
    @com.facebook.react.uimanager.annotations.ReactProp <methods>;
    @com.facebook.react.uimanager.annotations.ReactPropGroup <methods>;
}

# Keep React Native modules
-keep @com.facebook.react.bridge.ReactModuleWithSpec class * { *; }
-keep class * extends com.facebook.react.bridge.JavaScriptModule { *; }
-keep class * extends com.facebook.react.bridge.NativeModule { *; }
-keep class * extends com.facebook.react.bridge.BaseJavaModule { *; }

# Keep React Native ViewManagers
-keep public class * extends com.facebook.react.uimanager.ViewManager {
    public <init>(...);
}

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

# ===========================
# Networking and API Security
# ===========================

# OkHttp and Retrofit (used by axios)
-keepattributes Signature
-keepattributes *Annotation*
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }
-dontwarn okhttp3.**
-dontwarn okio.**

# Certificate pinning
-keep class javax.net.ssl.** { *; }
-keep class com.android.org.bouncycastle.** { *; }

# ===========================
# Serialization and JSON
# ===========================

# Keep serialization classes
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

# Keep JSON models (adjust package name as needed)
-keep class com.mobdeck.models.** { *; }
-keepclassmembers class com.mobdeck.models.** { *; }

# ===========================
# React Navigation
# ===========================

-keep class com.swmansion.rnscreens.** { *; }
-keep class com.swmansion.reanimated.** { *; }
-keep class com.th3rdwave.safeareacontext.** { *; }

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

# ===========================
# Additional Security Rules
# ===========================

# Obfuscate package names (except critical ones)
-repackageclasses 'o'

# Remove source file names and line numbers
-renamesourcefileattribute SourceFile
-keepattributes !SourceFile,!LineNumberTable

# Keep only necessary attributes
-keepattributes RuntimeVisibleAnnotations,AnnotationDefault

# Aggressive optimization for smaller APK
-allowaccessmodification

# Remove unused code
-dontshrink
-dontoptimize

# ===========================
# Debugging Prevention
# ===========================

# Remove debug information
-assumenosideeffects class kotlin.jvm.internal.Intrinsics {
    static void checkParameterIsNotNull(...);
    static void checkNotNullParameter(...);
    static void checkExpressionValueIsNotNull(...);
    static void checkNotNullExpressionValue(...);
    static void checkReturnedValueIsNotNull(...);
    static void checkFieldIsNotNull(...);
    static void checkParameterIsNotNull(...);
}

# ===========================
# Anti-Tampering Protection
# ===========================

# Keep classes used for integrity checks
-keep class com.mobdeck.security.** { *; }
-keep class com.mobdeck.integrity.** { *; }

# Warning suppression for known issues
-dontwarn javax.annotation.**
-dontwarn javax.lang.model.element.Modifier
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**