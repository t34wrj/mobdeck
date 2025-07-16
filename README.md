# Mobdeck Mobile App

Mobdeck is a React Native mobile application that provides seamless access to your self-hosted [Readeck] (https://readeck.org/en/) instance. Designed for self-hosting enthusiasts, it offers offline-first article reading, background synchronization, and Android share integration for a complete mobile reading experience.

![Android](https://img.shields.io/badge/Android-7.0%2B-green) ![React Native](https://img.shields.io/badge/React%20Native-0.80.0-blue) ![License](https://img.shields.io/badge/License-MIT-yellow)

## Features

🔒 **Secure Authentication**: Bearer token authentication with encrypted storage  
📱 **Share Integration**: Add articles from any Android app via share menu  
🌐 **Offline-First**: Full article caching for offline reading  
🔄 **Background Sync**: Automatic synchronization with configurable intervals  
🏷️ **Label Management**: Organize articles with Readeck labels and tags  
⚙️ **Network Control**: WiFi-only or mobile sync options  
📦 **Auto Updates**: Distributed via GitHub Releases with Obtainium support

## Installation

### For End Users

Choose your preferred installation method:

#### Option 1: Obtainium (Recommended)

Obtainium provides automatic updates directly from GitHub releases:

1. **Install Obtainium**:
   - Download from [F-Droid](https://f-droid.org/) (recommended)
   - Or get APK from [Obtainium releases](https://github.com/ImranR98/Obtainium/releases)

2. **Add Mobdeck to Obtainium**:
   - Open Obtainium app
   - Tap "+" to add new app
   - Enter: `https://github.com/t34wrj/mobdeck`
   - Tap "Add App" and install

3. **Enable automatic updates**:
   - Configure check interval (recommended: 24 hours)
   - Enable background update checks
   - Set to WiFi-only if preferred

#### Option 2: Direct APK Download

1. **Download APK**:
   - Visit [Mobdeck Releases](https://github.com/t34wrj/mobdeck/releases)
   - Download latest `app-release.apk`
   - Verify SHA256 hash (provided in release notes)

2. **Install APK**:
   - Enable "Install from unknown sources" in Android Settings
   - Open downloaded APK file
   - Grant installation permissions
   - Complete installation

### System Requirements

**Android Device:**

- **Minimum**: Android 7.0+ (API level 24)
- **Target**: Android 15 (API level 35)
- **Recommended**: Android 10+ (API level 29) for optimal performance
- **RAM**: 2GB minimum, 3GB+ recommended for optimal performance
- **Storage**: 100MB for app installation, 500MB+ recommended for offline article cache
- **CPU**: ARMv7 or ARM64 architecture
- **Network**: WiFi or mobile data connectivity required for synchronization
- **Permissions**: Internet access, storage access, background app refresh, notifications (optional)

### Initial Setup

#### Bearer Token Authentication

Bearer tokens provide secure API access to your Readeck instance. Each token should be unique per device for security.

**Step 1: Generate Token in Readeck**

1. **Access Readeck Web Interface**:
   - Open your Readeck server URL in a web browser
   - Log in with your Readeck account credentials
   - Ensure you have administrative access to create API tokens

2. **Navigate to API Tokens**:
   - Click **Settings** in the main navigation
   - Select **API Tokens** from the settings menu
   - You'll see a list of existing tokens (if any)

3. **Create New Token**:
   - Click **"Create Token"** or **"+ Add Token"** button
   - **Name**: Enter descriptive name (e.g., "Mobdeck Mobile - [Your Device]")
   - **Description**: Add optional details (e.g., "Samsung Galaxy S23 - Primary")
   - **Permissions**: Select the following required permissions:
     - ✅ **Read Articles** - View and download articles
     - ✅ **Write Articles** - Add new articles via share integration
     - ✅ **Manage Labels** - Create and assign article labels
   - **Expiration**: Set to "Never" or choose long-term duration

4. **Copy and Secure Token**:
   - Click **"Generate Token"**
   - **IMMEDIATELY COPY** the generated token (usually 32+ characters)
   - Token format: `abcd1234efgh5678ijkl9012mnop3456` (example)
   - ⚠️ **Important**: Save token securely for mobile configuration

**Step 2: Configure in Mobdeck**

1. **Open Mobdeck Authentication Screen**:
   - Launch Mobdeck app
   - Enter server URL and bearer token in the authentication form

2. **Enter Server Details**:
   - **Server URL**: Enter your complete Readeck URL
   - **Bearer Token**: Paste the copied token (no spaces)

3. **Test and Verify Connection**:
   - Tap **"Test Connection"** button
   - Wait for verification (may take 5-15 seconds)
   - Success indicators:
     - ✅ "Connection Successful"
     - Server version displayed
     - Article count shown
   - If failed: Check troubleshooting section below

4. **Save Configuration**:
   - Tap **"Save Configuration"**
   - Token is encrypted and stored in Android Keychain
   - Configuration persists across app restarts

**Security Best Practices**:

- 🔐 Use unique tokens per device
- 📝 Use descriptive token names for easy management
- 🔄 Rotate tokens periodically (every 6-12 months)
- 🗑️ Revoke tokens for lost/replaced devices
- 🚫 Never share tokens between users or apps
- 🔒 Use HTTPS servers when possible for token transmission

#### 3. Advanced Configuration Options

**Sync Preferences:**

_Frequency Options:_
Enter sync interval in minutes (e.g., 15 for every 15 minutes, 60 for hourly, 1440 for daily)

_Network Configuration:_

- ✅ **WiFi Only**: Toggle to restrict sync to WiFi networks only
- 🔄 **Background Sync**: Continue syncing when app is closed

**Content Settings:**
Content synchronization settings are automatically configured based on your Readeck server setup and available articles.

**Security Configuration:**

- 🔐 **Token Auto-Refresh**: Automatically renew authentication tokens
- 🔒 **Secure Storage**: Verify encrypted storage of authentication data
- 🚫 **Certificate Pinning**: Enhanced security for HTTPS connections
- 🔍 **Connection Logging**: Enable detailed logging for troubleshooting

### Post-Setup Configuration

#### Network and Connectivity Settings

1. **Connection Testing**:
   - **Manual Test**: Settings → "Test Connection" → Verify server response
   - **Network Check**: Ensure mobile device can reach server URL
   - **DNS Resolution**: Test both hostname and IP address access
   - **Port Accessibility**: Verify firewall allows configured port

2. **SSL/TLS Configuration**:
   - **HTTPS Recommended**: Use `https://` for secure token transmission
   - **Self-Signed Certificates**: May require manual acceptance in mobile browser first
   - **HTTP Local Only**: Only use `http://` for local network servers
   - **Certificate Validation**: Mobdeck validates certificates by default

#### Permission Configuration

1. **Android Permissions**:
   - **Network Access**: Automatically granted for internet connectivity
   - **Storage Access**: Required for offline article caching
   - **Notifications**: Optional for sync status and update alerts
   - **Background App Refresh**: Enable for automatic synchronization

2. **Battery Optimization**:
   - **Disable Battery Optimization**: Settings → Apps → Mobdeck → Battery → "Don't optimize"
   - **Background Activity**: Allow app to run in background for sync
   - **Data Saver Exceptions**: Add Mobdeck to unrestricted data usage

#### First Sync and Verification

1. **Initial Synchronization**:
   - **Manual Sync**: Tap refresh icon to trigger first sync
   - **Progress Monitoring**: Watch sync status in app header
   - **Article Count**: Verify articles appear from your Readeck instance
   - **Completion Time**: Initial sync time depends on collection size

2. **Functionality Verification**:
   - **Article Reading**: Open any article to test offline viewing
   - **Search Function**: Test search with known article titles
   - **Label Display**: Verify labels sync correctly from server
   - **Share Integration**: Test adding article from browser share menu

### Quick Start Guide

1. **Add Your First Article**:
   - Open any app with a web link (browser, social media, news app)
   - Tap **Share** button → Select **Mobdeck** from share menu
   - Wait for "Article Added" confirmation
   - Article automatically appears in your Readeck instance and syncs to mobile

2. **Browse and Read Articles**:
   - Open Mobdeck to see synchronized articles
   - **Offline Reading**: Tap any article to read without internet
   - **Search**: Use search bar to find specific articles
   - **Filter**: Apply label filters to organize reading
   - **Pull to Refresh**: Sync latest articles from server

3. **Configure Sync Preferences**:
   - **Sync Frequency**: Set sync interval in minutes
   - **Network Options**: WiFi-only toggle
   - **Image Downloads**: Enable/disable image caching for offline reading

## App Usage Guide

### Getting Started with Mobdeck

This guide covers all major app functionality to help you get the most out of your reading experience.

#### Main Interface Overview

**Home Screen Features:**

- **Article List**: Browse your synchronized articles with titles, summaries, and read status
- **Search Bar**: Real-time search across article titles and content
- **Sync Status**: Current synchronization status displayed in header
- **Pull-to-Refresh**: Swipe down to manually trigger sync
- **Filter Options**: Filter articles by read status, labels, or favorites

**Navigation:**

- **Articles Tab**: Main article browsing and reading interface
- **Labels Tab**: Manage and organize article labels/tags
- **Settings Tab**: Configure sync, account, and app preferences
- **Share Queue**: Monitor shared articles processing status

### Share Integration

Mobdeck integrates seamlessly with Android's share system, allowing you to add articles from any app.

#### Adding Articles via Share

**Step 1: Access Share Menu**

1. **From Browser**: Open article in Chrome, Firefox, or any browser
   - Tap **Share** button (usually three dots or share icon)
   - Select **Mobdeck** from share options
2. **From Social Media**: Share articles from Twitter, Reddit, Facebook, etc.
   - Tap **Share** button on post or article
   - Choose **Mobdeck** from share menu
3. **From News Apps**: Share from news apps, RSS readers, etc.
   - Use app's built-in share functionality
   - Select **Mobdeck** as target app

**Step 2: Automatic Processing**

- **URL Extraction**: Mobdeck automatically extracts URLs from shared content
- **Validation**: System verifies URLs are valid and accessible
- **Queue Processing**: Articles are added to processing queue
- **Server Upload**: URLs are sent to your Readeck server
- **Sync Confirmation**: Articles appear in your collection after next sync

**Supported Content Types:**

- ✅ **Direct URLs**: Web links shared from browsers
- ✅ **Social Media Posts**: Posts containing article links
- ✅ **Text Content**: Plain text containing multiple URLs
- ✅ **News Articles**: Articles from news and media apps
- ✅ **Blog Posts**: Content from blogging platforms

**Share Processing Status:**

- **Settings → Share Processing**: Monitor processing queue
- **Notification Feedback**: Real-time processing notifications
- **Error Handling**: Clear error messages for invalid content
- **Retry Logic**: Failed shares automatically retry

#### Troubleshooting Share Issues

**Mobdeck Not in Share Menu:**

- ✅ Restart Android device to refresh share targets
- ✅ Reinstall Mobdeck if share registration is broken
- ✅ Check app permissions in Android settings
- ✅ Clear default app associations for text sharing

**Share Processing Failures:**

- ✅ Verify shared URLs are publicly accessible
- ✅ Check network connectivity during share processing
- ✅ Ensure Bearer token has write permissions
- ✅ Review share processing queue for detailed error messages

### Sync Features

Mobdeck provides comprehensive synchronization options to keep your articles up-to-date across devices.

#### Sync Configuration

**Access Sync Settings**: **Settings → Sync Settings**

**Sync Frequency Options:**
Set sync interval in minutes (e.g., 15, 60, 1440)

**Network Preferences:**

- **WiFi Only**: Toggle to restrict sync to WiFi connections only

**Content Sync Options:**

- **Download Images**: Cache images for offline viewing (uses more storage)
- **Full-Text Sync**: Download complete article content (recommended)
- **Metadata Only**: Sync titles and links only (minimal data usage)
- **Label Synchronization**: Keep labels in sync with server
- **Archive Handling**: Include archived articles in sync

#### Manual Sync Operations

**Trigger Manual Sync:**

1. **Pull-to-Refresh**: Swipe down on article list
2. **Sync Button**: Tap sync icon in app header
3. **Settings Sync**: Use "Sync Now" button in sync settings
4. **Share Processing**: Sync after sharing articles

**Sync Status Monitoring:**

- **Progress Indicator**: Real-time sync progress with percentage
- **Article Count**: Number of articles being processed
- **Network Status**: Current connection type (WiFi/Cellular/Offline)
- **Error Notifications**: Clear notifications for sync failures
- **Completion Confirmation**: Success notifications with sync summary

#### Background Sync Management

**Enable Background Sync:**

1. **App Settings**: Enable "Background Sync" in sync settings
2. **Android Settings**: Disable battery optimization for Mobdeck
3. **Background Data**: Allow background data usage for the app
4. **Auto-Start**: Permit app to start automatically

**Background Sync Behavior:**

- **Scheduled Intervals**: Runs at configured frequency
- **Network-Aware**: Respects WiFi/mobile preferences
- **Battery-Conscious**: Reduces frequency when battery is low
- **Error Recovery**: Automatic retry with exponential backoff

### Article Management

#### Browsing and Reading Articles

**Article List Features:**

- **Article Cards**: Display title, summary, source, and read status
- **Status Indicators**: Visual cues for read/unread, favorite, archived
- **Thumbnail Images**: Article preview images when available
- **Quick Actions**: Swipe left/right for common operations
- **Long Press Menu**: Additional actions via long press

**Reading Experience:**

- **Offline Reading**: Access cached articles without internet
- **Responsive Design**: Optimized text formatting for mobile
- **Image Support**: In-line images display when downloaded
- **Dark Mode**: Automatic theme switching based on system preferences
- **Reading Progress**: Track reading position in long articles

**Article Actions:**

- **Mark Read/Unread**: Toggle reading status
- **Add to Favorites**: Star articles for quick access
- **Archive Articles**: Remove from main list while preserving access
- **Share Article**: Share article URL or content with other apps
- **Copy Link**: Copy article URL to clipboard

#### Search and Filtering

**Search Functionality:**

- **Real-Time Search**: Search as you type in search bar
- **Title Search**: Find articles by title keywords
- **Content Search**: Full-text search across article content (offline capable)
- **Search History**: Recent search terms for quick access
- **Search Suggestions**: Auto-complete based on article content

**Filter Options:**

- **Read Status**: Show read, unread, or all articles
- **Favorites**: Display only starred articles
- **Labels**: Filter by specific labels or combinations
- **Date Range**: Filter articles by publication or addition date
- **Source**: Filter by article source or domain

### Advanced Features

#### Offline Functionality

**Offline Capabilities:**

- **Article Reading**: Access all synced articles without internet
- **Full-Text Search**: Search works completely offline
- **Label Management**: Add/remove labels offline (synced later)
- **Reading Status**: Mark articles as read/unread offline
- **Share Queue**: Add articles via share integration offline

**Offline Data Management:**

- **Smart Caching**: Frequently accessed articles prioritized
- **Storage Optimization**: Configurable cache size with automatic cleanup
- **Image Downloads**: Optional image caching for complete offline experience
- **Metadata Sync**: Article changes sync when connection returns

#### Performance Optimization

**Battery Optimization:**

- **Sync Intervals**: Use longer intervals (hourly/daily) to conserve battery
- **WiFi-Only Sync**: Restrict sync to WiFi to save mobile data and battery
- **Background Limits**: Disable background sync when battery is low
- **Screen-On Sync**: Prefer manual sync when actively using app

**Storage Management:**

- **Cache Limits**: Set maximum storage used for offline articles
- **Auto-Cleanup**: Automatically remove old cached content
- **Selective Sync**: Choose which articles to download for offline reading
- **Storage Monitoring**: Track storage usage in app settings

**Network Optimization:**

- **Batch Processing**: Sync multiple articles in single request
- **Compression**: Use data compression for faster sync
- **Connection Pooling**: Reuse connections for better performance
- **Timeout Management**: Adjustable timeouts for slow connections

## Troubleshooting

### Common Issues

#### Installation Problems

**APK Won't Install:**

- ✅ Enable "Install from unknown sources" for browser/file manager
- ✅ Ensure sufficient storage space (500MB+ recommended)
- ✅ Disable Play Protect temporarily if it blocks installation
- ✅ Try downloading APK again if corrupted
- ✅ Check Android version compatibility (Android 7.0+ required)

**Obtainium Not Detecting Updates:**

- ✅ Check internet connection
- ✅ Refresh app list (pull down to refresh)
- ✅ Verify repository URL: `https://github.com/t34wrj/mobdeck`
- ✅ Check background app permissions for Obtainium
- ✅ Update Obtainium to latest version

#### Authentication Issues

**Cannot Connect to Server:**

- ✅ **URL Format**: Verify server URL includes protocol (`http://` or `https://`)
- ✅ **Browser Test**: Test server access in mobile browser first
- ✅ **Port Check**: Include port number if using non-standard port (e.g., `:8000`)
- ✅ **Network Access**: Ensure server is accessible from mobile network
- ✅ **DNS Resolution**: Try using IP address instead of hostname
- ✅ **Firewall**: Check if firewall blocks mobile device IP range

**"Authentication Failed" Error:**

- ✅ **Token Format**: Verify token is alphanumeric, 32+ characters
- ✅ **Copy/Paste**: Check for extra spaces when copying token
- ✅ **Permissions**: Ensure token has read/write permissions in Readeck
- ✅ **Expiration**: Verify token hasn't expired in Readeck settings
- ✅ **Regenerate**: Create new token if authentication continues to fail
- ✅ **Case Sensitivity**: Tokens are case-sensitive - copy exactly

**"Server Not Reachable" Error:**

- ✅ **Network Connectivity**: Test with other apps requiring internet
- ✅ **Server Status**: Verify Readeck server is running and responsive
- ✅ **VPN/Proxy**: Try connecting with/without VPN
- ✅ **Different Network**: Test on different WiFi or mobile data
- ✅ **Server Logs**: Check Readeck server logs for connection attempts

#### Sync Issues

**Articles Not Syncing:**

- ✅ **Manual Sync**: Try "Pull to Refresh" to trigger manual sync
- ✅ **Network Settings**: Verify sync allows current network type (WiFi/Cellular)
- ✅ **Background Sync**: Check if background sync is enabled in settings
- ✅ **Battery Optimization**: Disable battery optimization for Mobdeck
- ✅ **Storage Space**: Ensure sufficient device storage (>100MB free)
- ✅ **Token Validity**: Verify authentication token is still valid

**"Sync Failed" Error:**

- ✅ **Connection Test**: Test server connection in app settings
- ✅ **Restart App**: Force close and reopen Mobdeck
- ✅ **Clear Cache**: Clear app cache in Android settings
- ✅ **Network Quality**: Ensure stable internet connection
- ✅ **Server Load**: Check if server is under heavy load

**Sync Taking Too Long:**

- ✅ **Network Speed**: Test internet speed with speed test app
- ✅ **Batch Size**: Reduce sync batch size in advanced settings
- ✅ **Image Downloads**: Disable image downloading temporarily
- ✅ **WiFi Connection**: Switch to WiFi for faster sync
- ✅ **Server Performance**: Check server resource usage

**Background Sync Not Working:**

- ✅ **Battery Optimization**: Disable for Mobdeck in Android settings
- ✅ **Background App Refresh**: Enable in Android settings
- ✅ **Data Saver**: Add Mobdeck to unrestricted apps
- ✅ **Doze Mode**: Ensure app isn't affected by Android Doze mode
- ✅ **Sync Schedule**: Verify sync interval is properly configured

#### Connection Issues

**Network Timeout Errors:**

- ✅ **Signal Strength**: Ensure strong WiFi or mobile signal
- ✅ **Network Speed**: Test connection speed with other apps
- ✅ **Timeout Settings**: Increase network timeout in advanced settings
- ✅ **Server Response**: Check if server responds to simple HTTP requests
- ✅ **Switch Networks**: Try different WiFi or mobile data connection

**SSL/TLS Certificate Errors:**

- ✅ **HTTPS URLs**: Verify HTTPS server uses valid certificate
- ✅ **Self-Signed Certs**: Add certificate exception in mobile browser first
- ✅ **Certificate Chain**: Ensure complete certificate chain is configured
- ✅ **HTTP Fallback**: Temporarily test with HTTP (local networks only)
- ✅ **Certificate Expiry**: Check if server certificate has expired

**"DNS Resolution Failed" Error:**

- ✅ **DNS Servers**: Use public DNS (8.8.8.8, 1.1.1.1) in WiFi settings
- ✅ **Hostname**: Try using server IP address instead of hostname
- ✅ **Network Reset**: Reset network settings on Android device
- ✅ **Router Restart**: Restart WiFi router/modem
- ✅ **Mobile Data**: Test using mobile data instead of WiFi

#### Share Integration Issues

**Mobdeck Not in Share Menu:**

- ✅ **Device Restart**: Reboot Android device to refresh share targets
- ✅ **App Reinstall**: Uninstall and reinstall Mobdeck
- ✅ **Default Apps**: Clear default app associations in Android settings
- ✅ **App Permissions**: Verify all required permissions are granted
- ✅ **Android Version**: Ensure compatibility with share intent system

**Share Processing Failed:**

- ✅ **URL Validity**: Verify shared URLs are properly formatted and accessible
- ✅ **Network Connection**: Ensure internet connectivity during share processing
- ✅ **Authentication**: Check if Bearer token is valid for adding articles
- ✅ **Processing Queue**: Check share processing queue in app settings
- ✅ **Content Type**: Verify shared content contains valid article URLs

#### Common Error Messages

**"Permission Denied":**

- Bearer token lacks necessary permissions → Create new token with read/write access

**"Invalid URL":**

- Server URL malformed → Verify format includes protocol and correct port

**"Database Error":**

- Local database corruption → Clear app data and reconfigure

**"Storage Full":**

- Insufficient device storage → Free up space or reduce cache size

**"Network Timeout":**

- Slow or unreliable connection → Improve network or adjust timeout settings

#### Performance Issues

**App Running Slowly:**

- ✅ **Restart App**: Force close and reopen Mobdeck
- ✅ **Device Restart**: Reboot Android device
- ✅ **Free Memory**: Close other apps to free RAM
- ✅ **Storage Space**: Ensure >1GB free device storage
- ✅ **Cache Size**: Reduce article cache size in settings

**High Battery Usage:**

- ✅ **Sync Frequency**: Use longer sync intervals (hourly/daily)
- ✅ **WiFi Only**: Restrict sync to WiFi connections
- ✅ **Background Limits**: Disable background sync when battery low
- ✅ **Image Downloads**: Disable image downloading to reduce processing

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License

This project is licensed under the MIT License. See the LICENSE file for details.
