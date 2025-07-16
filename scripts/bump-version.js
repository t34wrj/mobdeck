#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function bumpVersion(currentVersion, bumpType = 'patch') {
    const [major, minor, patch] = currentVersion.split('.').map(Number);
    
    switch (bumpType) {
        case 'major':
            return `${major + 1}.0.0`;
        case 'minor':
            return `${major}.${minor + 1}.0`;
        case 'patch':
        default:
            return `${major}.${minor}.${patch + 1}`;
    }
}

function updatePackageJson(newVersion) {
    const packageJsonPath = path.join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    packageJson.version = newVersion;
    
    fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)  }\n`);
    console.log(`Updated package.json version to ${newVersion}`);
}

function main() {
    const bumpType = process.argv[2] || 'patch';
    const packageJsonPath = path.join(__dirname, '..', 'package.json');
    
    if (!fs.existsSync(packageJsonPath)) {
        console.error('package.json not found');
        process.exit(1);
    }
    
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const currentVersion = packageJson.version;
    const newVersion = bumpVersion(currentVersion, bumpType);
    
    updatePackageJson(newVersion);
    
    console.log(`Version bumped from ${currentVersion} to ${newVersion}`);
    console.log(`Tag: v${newVersion}`);
}

if (require.main === module) {
    main();
}

module.exports = { bumpVersion, updatePackageJson };