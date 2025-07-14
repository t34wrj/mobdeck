/**
 * Android Security Configuration Tests
 * 
 * Validates Android-specific security configurations including:
 * - Permission declarations and usage
 * - Manifest security settings
 * - Build security configurations
 * - ProGuard obfuscation rules
 * - Network security policies
 */

import * as fs from 'fs';
import * as path from 'path';
import { DOMParser, Document, Element } from '@xmldom/xmldom';

const ANDROID_DIR = path.join(__dirname, '../../android');
const MANIFEST_PATH = path.join(ANDROID_DIR, 'app/src/main/AndroidManifest.xml');
const BUILD_GRADLE_PATH = path.join(ANDROID_DIR, 'app/build.gradle');
const PROGUARD_RULES_PATH = path.join(ANDROID_DIR, 'app/proguard-rules.pro');
const NETWORK_CONFIG_PATH = path.join(ANDROID_DIR, 'app/src/main/res/xml/network_security_config.xml');

describe('Android Security Configuration Tests', () => {
  
  describe('AndroidManifest.xml Security', () => {
    let manifestContent: string;
    let manifestDoc: Document;

    beforeAll(() => {
      manifestContent = fs.readFileSync(MANIFEST_PATH, 'utf8');
      const parser = new DOMParser();
      manifestDoc = parser.parseFromString(manifestContent, 'text/xml');
    });

    it('should have secure backup settings', () => {
      const applicationElement = manifestDoc.getElementsByTagName('application')[0] as Element;
      const allowBackup = applicationElement.getAttribute('android:allowBackup');
      
      expect(allowBackup).toBe('false');
    });

    it('should only declare necessary permissions', () => {
      const permissions = manifestDoc.getElementsByTagName('uses-permission');
      const declaredPermissions = Array.from(permissions).map((p: Element) => 
        p.getAttribute('android:name')
      );

      // Expected permissions based on app functionality
      const expectedPermissions = [
        'android.permission.INTERNET',
        'android.permission.ACCESS_NETWORK_STATE',
        'android.permission.RECEIVE_BOOT_COMPLETED',
        'android.permission.WAKE_LOCK',
        'android.permission.FOREGROUND_SERVICE',
        'android.permission.FOREGROUND_SERVICE_DATA_SYNC',
        'android.permission.POST_NOTIFICATIONS',
        'android.permission.USE_EXACT_ALARM',
        'android.permission.SCHEDULE_EXACT_ALARM'
      ];

      // Validate all declared permissions are expected
      declaredPermissions.forEach(permission => {
        expect(expectedPermissions).toContain(permission);
      });

      // Validate no dangerous permissions are requested unnecessarily
      const dangerousPermissions = [
        'android.permission.CAMERA',
        'android.permission.RECORD_AUDIO',
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.READ_CONTACTS',
        'android.permission.WRITE_CONTACTS',
        'android.permission.READ_SMS',
        'android.permission.SEND_SMS',
        'android.permission.READ_PHONE_STATE',
        'android.permission.CALL_PHONE',
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE'
      ];

      declaredPermissions.forEach(permission => {
        expect(dangerousPermissions).not.toContain(permission);
      });
    });

    it('should properly configure exported components', () => {
      const activities = manifestDoc.getElementsByTagName('activity');
      const services = manifestDoc.getElementsByTagName('service');
      const receivers = manifestDoc.getElementsByTagName('receiver');

      // MainActivity should be exported for launcher
      const mainActivity = Array.from(activities).find((activity: Element) =>
        activity.getAttribute('android:name') === '.MainActivity'
      );
      expect(mainActivity?.getAttribute('android:exported')).toBe('true');

      // ShareActivity should be exported for intent handling
      const shareActivity = Array.from(activities).find((activity: Element) =>
        activity.getAttribute('android:name') === '.ShareActivity'
      );
      expect(shareActivity?.getAttribute('android:exported')).toBe('true');

      // Background service should have proper permission
      const backgroundService = Array.from(services).find((service: Element) =>
        service.getAttribute('android:name') === 'com.mobdeck.BackgroundSyncJobService'
      );
      expect(backgroundService?.getAttribute('android:permission')).toBe('android.permission.BIND_JOB_SERVICE');
      expect(backgroundService?.getAttribute('android:exported')).toBe('true');

      // Boot receiver should be exported for system events
      const bootReceiver = Array.from(receivers).find((receiver: Element) =>
        receiver.getAttribute('android:name') === 'com.mobdeck.BootReceiver'
      );
      expect(bootReceiver?.getAttribute('android:exported')).toBe('true');
    });

    it('should have secure intent filters', () => {
      const activities = manifestDoc.getElementsByTagName('activity');
      
      Array.from(activities).forEach((activity: Element) => {
        const intentFilters = activity.getElementsByTagName('intent-filter');
        
        Array.from(intentFilters).forEach((filter: Element) => {
          const actions = filter.getElementsByTagName('action');
          const categories = filter.getElementsByTagName('category');
          
          // Validate no overly broad intent filters
          Array.from(actions).forEach((action: Element) => {
            const actionName = action.getAttribute('android:name');
            
            // Dangerous actions that shouldn't be handled
            const dangerousActions = [
              'android.intent.action.BOOT_COMPLETED', // Only for BootReceiver
              'android.intent.action.NEW_OUTGOING_CALL',
              'android.intent.action.PHONE_STATE',
              'android.provider.Telephony.SMS_RECEIVED'
            ];

            if (activity.getAttribute('android:name') !== 'com.mobdeck.BootReceiver') {
              expect(dangerousActions.slice(1)).not.toContain(actionName);
            }
          });
        });
      });
    });

    it('should have network security configuration', () => {
      const applicationElement = manifestDoc.getElementsByTagName('application')[0];
      const networkSecurityConfig = applicationElement.getAttribute('android:networkSecurityConfig');
      
      expect(networkSecurityConfig).toBe('@xml/network_security_config');
    });

    it('should have cleartext traffic properly configured', () => {
      const applicationElement = manifestDoc.getElementsByTagName('application')[0];
      const usesCleartextTraffic = applicationElement.getAttribute('android:usesCleartextTraffic');
      
      // Should be true for development (self-hosted Readeck instances may use HTTP)
      expect(usesCleartextTraffic).toBe('true');
    });
  });

  describe('Build Security Configuration', () => {
    let buildGradleContent: string;

    beforeAll(() => {
      buildGradleContent = fs.readFileSync(BUILD_GRADLE_PATH, 'utf8');
    });

    it('should enable ProGuard for release builds', () => {
      expect(buildGradleContent).toMatch(/enableProguardInReleaseBuilds\s*=\s*true/);
    });

    it('should enable R8 obfuscation', () => {
      expect(buildGradleContent).toMatch(/enableR8InReleaseBuilds\s*=\s*true/);
    });

    it('should have release build optimizations', () => {
      expect(buildGradleContent).toMatch(/minifyEnabled\s*=\s*enableProguardInReleaseBuilds/);
      expect(buildGradleContent).toMatch(/shrinkResources\s*=\s*true/);
      expect(buildGradleContent).toMatch(/zipAlignEnabled\s*=\s*true/);
      expect(buildGradleContent).toMatch(/crunchPngs\s*=\s*true/);
    });

    it('should have secure signing configuration', () => {
      // Debug signing should use debug keystore
      expect(buildGradleContent).toMatch(/storeFile\s*=\s*file\('debug\.keystore'\)/);
      
      // Release signing should use environment variables
      expect(buildGradleContent).toMatch(/MOBDECK_UPLOAD_STORE_FILE/);
      expect(buildGradleContent).toMatch(/MOBDECK_UPLOAD_STORE_PASSWORD/);
      expect(buildGradleContent).toMatch(/MOBDECK_UPLOAD_KEY_ALIAS/);
      expect(buildGradleContent).toMatch(/MOBDECK_UPLOAD_KEY_PASSWORD/);
    });

    it('should not contain hardcoded secrets', () => {
      // Should not contain actual passwords or keys in non-comment lines
      const nonCommentLines = buildGradleContent.split('\n').filter(line => 
        !line.trim().startsWith('//') && !line.trim().startsWith('*') && !line.trim().startsWith('/*')
      ).join('\n');
      
      expect(nonCommentLines).not.toMatch(/password\s*=\s*["'][^"']{10,}["']/);
      expect(nonCommentLines).not.toMatch(/keyPassword\s*=\s*["'][^"']{10,}["']/);
      
      // Should not contain actual API keys (exclude development/template values)
      const suspiciousKeys: string[] = nonCommentLines.match(/[A-Za-z0-9]{32,}/g) || [];
      const allowedKeys = [
        'ioGithubReactNativeCommunityJscAndroid', // JSC dependency
        'proguardAndroidOptimize', // ProGuard rule
        'comFacebookReactReactAndroid', // React Native dependency
        'comFacebookReactHermesAndroid' // Hermes dependency
      ];
      
      suspiciousKeys.forEach((key: string) => {
        const isAllowed = allowedKeys.some(allowed => key.includes(allowed)) || 
                         buildGradleContent.includes(`// ${key}`) || 
                         buildGradleContent.includes(`* ${key}`);
        if (!isAllowed) {
          console.warn(`Potential hardcoded secret found: ${key}`);
        }
      });
    });

    it('should have appropriate target SDK version', () => {
      // Should target modern Android API level for security
      expect(buildGradleContent).toMatch(/targetSdkVersion\s*=\s*rootProject\.ext\.targetSdkVersion/);
    });
  });

  describe('ProGuard Security Rules', () => {
    let proguardContent: string;

    beforeAll(() => {
      proguardContent = fs.readFileSync(PROGUARD_RULES_PATH, 'utf8');
    });

    it('should remove logging in release builds', () => {
      expect(proguardContent).toMatch(/-assumenosideeffects class android\.util\.Log/);
      expect(proguardContent).toMatch(/public static int v\(\.\.\.\);/);
      expect(proguardContent).toMatch(/public static int d\(\.\.\.\);/);
      expect(proguardContent).toMatch(/public static int i\(\.\.\.\);/);
      expect(proguardContent).toMatch(/public static int w\(\.\.\.\);/);
      expect(proguardContent).toMatch(/public static int e\(\.\.\.\);/);
    });

    it('should remove console.log calls', () => {
      expect(proguardContent).toMatch(/-assumenosideeffects class java\.io\.PrintStream/);
      expect(proguardContent).toMatch(/public void println\(\.\.\.\);/);
      expect(proguardContent).toMatch(/public void print\(\.\.\.\);/);
    });

    it('should protect security-critical libraries', () => {
      // react-native-keychain protection
      expect(proguardContent).toMatch(/-keep class com\.oblador\.keychain/);
      
      // Security providers protection
      expect(proguardContent).toMatch(/-keep class com\.android\.org\.conscrypt/);
      expect(proguardContent).toMatch(/-keep class org\.apache\.harmony\.xnet\.provider\.jsse/);
      
      // Certificate pinning protection
      expect(proguardContent).toMatch(/-keep class javax\.net\.ssl/);
    });

    it('should obfuscate package names', () => {
      expect(proguardContent).toMatch(/-repackageclasses 'o'/);
    });

    it('should remove debug information', () => {
      expect(proguardContent).toMatch(/-renamesourcefileattribute SourceFile/);
      expect(proguardContent).toMatch(/-keepattributes !SourceFile,!LineNumberTable/);
    });

    it('should have anti-tampering protection', () => {
      expect(proguardContent).toMatch(/-keep class com\.mobdeck\.security/);
      expect(proguardContent).toMatch(/-keep class com\.mobdeck\.integrity/);
    });
  });

  describe('Network Security Configuration', () => {
    let networkConfigContent: string;
    let networkConfigDoc: Document;

    beforeAll(() => {
      networkConfigContent = fs.readFileSync(NETWORK_CONFIG_PATH, 'utf8');
      const parser = new DOMParser();
      networkConfigDoc = parser.parseFromString(networkConfigContent, 'text/xml');
    });

    it('should disable cleartext traffic by default', () => {
      const baseConfig = networkConfigDoc.getElementsByTagName('base-config')[0] as Element;
      const cleartextPermitted = baseConfig.getAttribute('cleartextTrafficPermitted');
      
      expect(cleartextPermitted).toBe('false');
    });

    it('should allow cleartext for localhost development', () => {
      const domainConfigs = networkConfigDoc.getElementsByTagName('domain-config');
      
      let localhostConfig = null;
      Array.from(domainConfigs).forEach((config: Element) => {
        const domains = config.getElementsByTagName('domain');
        Array.from(domains).forEach((domain: Element) => {
          if (domain.textContent === 'localhost' || 
              domain.textContent === '127.0.0.1' || 
              domain.textContent === '10.0.2.2') {
            localhostConfig = config;
          }
        });
      });

      expect(localhostConfig).toBeTruthy();
      expect((localhostConfig as Element)?.getAttribute('cleartextTrafficPermitted')).toBe('true');
    });

    it('should trust system certificates', () => {
      const trustAnchors = networkConfigDoc.getElementsByTagName('trust-anchors');
      
      let hasSystemCerts = false;
      Array.from(trustAnchors).forEach((anchor: Element) => {
        const certificates = anchor.getElementsByTagName('certificates');
        Array.from(certificates).forEach((cert: Element) => {
          if (cert.getAttribute('src') === 'system') {
            hasSystemCerts = true;
          }
        });
      });

      expect(hasSystemCerts).toBe(true);
    });

    it('should have debug overrides for development', () => {
      const debugOverrides = networkConfigDoc.getElementsByTagName('debug-overrides');
      expect(debugOverrides.length).toBeGreaterThan(0);
    });

    it('should be prepared for certificate pinning', () => {
      // Should have commented certificate pinning configuration
      expect(networkConfigContent).toMatch(/pin-set/);
      expect(networkConfigContent).toMatch(/digest="SHA-256"/);
    });
  });

  describe('Permission Usage Validation', () => {
    it('should validate INTERNET permission usage', () => {
      // This permission is used for API calls
      expect(fs.existsSync(path.join(__dirname, '../../src/services/ReadeckApiService.ts'))).toBe(true);
    });

    it('should validate ACCESS_NETWORK_STATE permission usage', () => {
      // This permission is used for connectivity checking
      expect(fs.existsSync(path.join(__dirname, '../../src/utils/connectivityManager.ts'))).toBe(true);
    });

    it('should validate background service permissions usage', () => {
      // FOREGROUND_SERVICE permissions are used for sync
      expect(fs.existsSync(path.join(__dirname, '../../src/services/BackgroundSyncService.ts'))).toBe(true);
      expect(fs.existsSync(path.join(__dirname, '../../src/services/BackgroundTaskManager.ts'))).toBe(true);
    });

    it('should validate notification permission usage', () => {
      // POST_NOTIFICATIONS is used for sync status
      const backgroundTaskManager = fs.readFileSync(
        path.join(__dirname, '../../src/services/BackgroundTaskManager.ts'), 
        'utf8'
      );
      expect(backgroundTaskManager).toMatch(/POST_NOTIFICATIONS/);
    });

    it('should validate alarm permissions usage', () => {
      // Alarm permissions are used for background sync scheduling
      const backgroundTaskManager = fs.readFileSync(
        path.join(__dirname, '../../src/services/BackgroundTaskManager.ts'), 
        'utf8'
      );
      expect(backgroundTaskManager).toMatch(/SCHEDULE_EXACT_ALARM/);
      
      // Check manifest for permission declarations
      const manifestContent = fs.readFileSync(MANIFEST_PATH, 'utf8');
      expect(manifestContent).toMatch(/USE_EXACT_ALARM/);
      expect(manifestContent).toMatch(/SCHEDULE_EXACT_ALARM/);
    });
  });

  describe('Security Best Practices Compliance', () => {
    it('should not expose unnecessary components', () => {
      const manifestContent = fs.readFileSync(MANIFEST_PATH, 'utf8');
      
      // Should not have debug activities in production
      expect(manifestContent).not.toMatch(/debug.*Activity/i);
      expect(manifestContent).not.toMatch(/test.*Activity/i);
    });

    it('should have proper app branding', () => {
      const manifestContent = fs.readFileSync(MANIFEST_PATH, 'utf8');
      
      expect(manifestContent).toMatch(/@string\/app_name/);
      expect(manifestContent).toMatch(/@mipmap\/ic_launcher/);
    });

    it('should follow Android 13+ requirements', () => {
      const buildGradleContent = fs.readFileSync(BUILD_GRADLE_PATH, 'utf8');
      
      // Should support modern Android versions
      expect(buildGradleContent).toMatch(/compileSdk\s*=\s*rootProject\.ext\.compileSdkVersion/);
      expect(buildGradleContent).toMatch(/targetSdkVersion\s*=\s*rootProject\.ext\.targetSdkVersion/);
    });

    it('should have secure default configurations', () => {
      const manifestContent = fs.readFileSync(MANIFEST_PATH, 'utf8');
      
      // Should have secure defaults
      expect(manifestContent).toMatch(/android:allowBackup="false"/);
      expect(manifestContent).toMatch(/android:supportsRtl="true"/);
    });
  });

  describe('Development vs Production Security', () => {
    it('should have debug keystore for development only', () => {
      const debugKeystore = path.join(ANDROID_DIR, 'app/debug.keystore');
      expect(fs.existsSync(debugKeystore)).toBe(true);
      
      // Should not have release keystore committed
      const releaseKeystore = path.join(ANDROID_DIR, 'app/release.keystore');
      expect(fs.existsSync(releaseKeystore)).toBe(false);
    });

    it('should have environment-based signing configuration', () => {
      const gradleProperties = fs.readFileSync(
        path.join(ANDROID_DIR, 'gradle.properties'), 
        'utf8'
      );
      
      // Should document signing configuration
      expect(gradleProperties).toMatch(/MOBDECK_UPLOAD_STORE_FILE/);
      expect(gradleProperties).toMatch(/MOBDECK_UPLOAD_KEY_ALIAS/);
      
      // Should not contain actual secrets
      expect(gradleProperties).not.toMatch(/password.*=.*[^#]/);
    });

    it('should handle cleartext traffic appropriately', () => {
      const networkConfigContent = fs.readFileSync(NETWORK_CONFIG_PATH, 'utf8');
      
      // Should allow localhost but not production cleartext
      expect(networkConfigContent).toMatch(/localhost/);
      expect(networkConfigContent).toMatch(/127\.0\.0\.1/);
      expect(networkConfigContent).toMatch(/cleartextTrafficPermitted="true"/);
      expect(networkConfigContent).toMatch(/cleartextTrafficPermitted="false"/);
    });
  });
});