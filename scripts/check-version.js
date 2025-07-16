#!/usr/bin/env node

/**
 * Version validation script for Mobdeck
 * Checks that version codes are properly configured and prevents downgrades
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function getGitCommitCount() {
  try {
    const output = execSync('git rev-list --count HEAD', { encoding: 'utf8' });
    return parseInt(output.trim());
  } catch (error) {
    console.error('Failed to get git commit count:', error.message);
    return null;
  }
}

function getPackageVersion() {
  try {
    const packagePath = path.join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    return packageJson.version;
  } catch (error) {
    console.error('Failed to read package.json:', error.message);
    return null;
  }
}

function checkVersionCode() {
  const commitCount = getGitCommitCount();
  const packageVersion = getPackageVersion();
  
  console.log('=== Mobdeck Version Check ===');
  console.log(`Package version: ${packageVersion}`);
  console.log(`Git commit count: ${commitCount}`);
  
  if (commitCount === null) {
    console.error('❌ Cannot determine version code - git command failed');
    process.exit(1);
  }
  
  // Check if version code is reasonable for established app
  const MIN_VERSION_CODE = 100;
  if (commitCount < MIN_VERSION_CODE) {
    console.error(`❌ Version code too low: ${commitCount}`);
    console.error('This indicates a shallow git clone or incomplete history.');
    console.error('This will cause app downgrade issues!');
    console.error('');
    console.error('Solutions:');
    console.error('- Use "git clone --depth=0" for full history');
    console.error('- In GitHub Actions, use "fetch-depth: 0" in checkout');
    process.exit(1);
  }
  
  console.log(`✅ Version code is valid: ${commitCount}`);
  
  // Additional checks
  if (process.env.CI) {
    console.log('Running in CI environment - additional checks:');
    
    // Check if we're in a shallow clone
    try {
      execSync('git rev-parse --is-shallow-repository', { encoding: 'utf8' }).trim();
      const isShallow = execSync('git rev-parse --is-shallow-repository', { encoding: 'utf8' }).trim() === 'true';
      if (isShallow) {
        console.error('❌ Repository is shallow - this will cause version code issues');
        process.exit(1);
      } else {
        console.log('✅ Repository has full history');
      }
    } catch {
      console.warn('⚠️  Could not check if repository is shallow');
    }
  }
  
  console.log('=== Version Check Complete ===');
  return {
    packageVersion,
    versionCode: commitCount
  };
}

// Export for use in other scripts
module.exports = { checkVersionCode, getGitCommitCount, getPackageVersion };

// Run check if script is executed directly
if (require.main === module) {
  checkVersionCode();
}