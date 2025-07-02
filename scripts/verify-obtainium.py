#!/usr/bin/env python3
"""
Obtainium Configuration Verification Script for Mobdeck

This script validates the obtainium.json configuration and tests
the version extraction and APK filtering patterns against the
GitHub repository structure.
"""

import json
import re
import sys
import os
from pathlib import Path

def load_config():
    """Load and validate the obtainium.json configuration."""
    config_path = Path(__file__).parent.parent / "obtainium.json"
    
    if not config_path.exists():
        print("❌ obtainium.json not found")
        return None
    
    try:
        with open(config_path, 'r') as f:
            config = json.load(f)
        print("✅ obtainium.json loaded successfully")
        return config
    except json.JSONDecodeError as e:
        print(f"❌ JSON parsing error: {e}")
        return None

def validate_required_fields(config):
    """Validate that all required fields are present."""
    required_fields = [
        'id', 'url', 'name', 'description', 'additionalSettings'
    ]
    
    missing_fields = []
    for field in required_fields:
        if field not in config or not config[field]:
            missing_fields.append(field)
    
    if missing_fields:
        print(f"❌ Missing required fields: {', '.join(missing_fields)}")
        return False
    
    print("✅ All required fields present")
    return True

def test_version_extraction(config):
    """Test the version extraction regex pattern."""
    settings = config.get('additionalSettings', {})
    pattern = settings.get('versionExtractionRegEx', '')
    match_group = int(settings.get('matchGroupToUse', '1'))
    
    if not pattern:
        print("❌ No version extraction regex specified")
        return False
    
    print(f"🔍 Testing version extraction pattern: {pattern}")
    
    # Test cases based on expected GitHub release tag format
    test_cases = [
        'v1.0.0',
        'v1.2.3', 
        'v10.15.22',
        'v2.0.0-beta.1',
        'release-v1.5.0',
        'invalid-tag'
    ]
    
    success_count = 0
    for test_tag in test_cases:
        try:
            match = re.search(pattern, test_tag)
            if match and len(match.groups()) >= match_group:
                version = match.group(match_group)
                print(f"  ✅ {test_tag} -> {version}")
                success_count += 1
            else:
                print(f"  ❌ {test_tag} -> No match")
        except re.error as e:
            print(f"  ❌ Regex error for {test_tag}: {e}")
    
    if success_count >= 3:  # At least 3 valid version formats should work
        print("✅ Version extraction pattern working correctly")
        return True
    else:
        print("❌ Version extraction pattern needs improvement")
        return False

def test_apk_filter(config):
    """Test the APK filter regex pattern."""
    settings = config.get('additionalSettings', {})
    pattern = settings.get('apkFilterRegEx', '')
    
    if not pattern:
        print("❌ No APK filter regex specified")
        return False
    
    print(f"🔍 Testing APK filter pattern: {pattern}")
    
    # Test cases based on expected GitHub release asset names
    test_cases = [
        ('app-release.apk', True),
        ('app-debug.apk', False),
        ('mobdeck-release.apk', False),
        ('app-release.apk.sha256', False),
        ('app-release-universal.apk', False),
        ('something-app-release.apk', True)  # This might match depending on pattern
    ]
    
    success_count = 0
    for filename, should_match in test_cases:
        try:
            match = re.search(pattern, filename)
            if bool(match) == should_match:
                status = "✅" if should_match else "⚪"
                action = "Match" if should_match else "Ignore"
                print(f"  {status} {filename} -> {action}")
                success_count += 1
            else:
                expected = "Match" if should_match else "Ignore"
                actual = "Match" if match else "Ignore"
                print(f"  ❌ {filename} -> Expected {expected}, got {actual}")
        except re.error as e:
            print(f"  ❌ Regex error for {filename}: {e}")
    
    if success_count >= len(test_cases) - 1:  # Allow one test case to fail
        print("✅ APK filter pattern working correctly")
        return True
    else:
        print("❌ APK filter pattern needs adjustment")
        return False

def validate_urls(config):
    """Validate URL format and consistency."""
    url = config.get('url', '')
    source_url = config.get('sourceUrl', '')
    
    if not url.startswith('https://github.com/'):
        print("❌ Repository URL should start with https://github.com/")
        return False
    
    if source_url and source_url != url:
        print("❌ sourceUrl should match url field")
        return False
    
    print("✅ URLs are valid and consistent")
    return True

def check_github_compatibility(config):
    """Check compatibility with GitHub Actions workflow."""
    print("🔍 Checking GitHub Actions compatibility...")
    
    # Check if the configuration aligns with the release.yml workflow
    settings = config.get('additionalSettings', {})
    
    checks = []
    
    # Check APK filter matches workflow output
    apk_filter = settings.get('apkFilterRegEx', '')
    if 'app-release' in apk_filter:
        print("  ✅ APK filter matches GitHub Actions output (app-release.apk)")
        checks.append(True)
    else:
        print("  ❌ APK filter may not match GitHub Actions output")
        checks.append(False)
    
    # Check version extraction for semantic versioning
    version_regex = settings.get('versionExtractionRegEx', '')
    if 'v(' in version_regex and r'\d+\.\d+\.\d+' in version_regex:
        print("  ✅ Version extraction supports semantic versioning (v1.2.3)")
        checks.append(True)
    else:
        print("  ❌ Version extraction may not support semantic versioning")
        checks.append(False)
    
    # Check prerelease handling
    include_prereleases = settings.get('includePrereleases', True)
    if not include_prereleases:
        print("  ✅ Prereleases disabled (stable releases only)")
        checks.append(True)
    else:
        print("  ⚠️  Prereleases enabled (may include beta/alpha versions)")
        checks.append(True)  # Not a failure, just a note
    
    if all(checks):
        print("✅ Configuration compatible with GitHub Actions workflow")
        return True
    else:
        print("❌ Configuration may have compatibility issues")
        return False

def main():
    """Main validation function."""
    print("🔍 Mobdeck Obtainium Configuration Validator")
    print("=" * 50)
    
    # Load configuration
    config = load_config()
    if not config:
        sys.exit(1)
    
    # Run validation tests
    tests = [
        ("Required Fields", lambda: validate_required_fields(config)),
        ("URL Validation", lambda: validate_urls(config)),
        ("Version Extraction", lambda: test_version_extraction(config)),
        ("APK Filter", lambda: test_apk_filter(config)),
        ("GitHub Compatibility", lambda: check_github_compatibility(config))
    ]
    
    results = []
    for test_name, test_func in tests:
        print(f"\n📋 {test_name}")
        print("-" * 30)
        try:
            result = test_func()
            results.append(result)
        except Exception as e:
            print(f"❌ Test failed with error: {e}")
            results.append(False)
    
    # Summary
    print(f"\n📊 Validation Summary")
    print("=" * 50)
    passed = sum(results)
    total = len(results)
    
    if passed == total:
        print(f"✅ All {total} tests passed!")
        print("🎉 Obtainium configuration is ready for use")
        sys.exit(0)
    else:
        print(f"❌ {total - passed} of {total} tests failed")
        print("🔧 Please review and fix the configuration issues above")
        sys.exit(1)

if __name__ == "__main__":
    main()