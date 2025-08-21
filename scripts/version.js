#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function getCurrentVersion() {
  const packagePath = path.join(__dirname, '..', 'package.json');
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  return pkg.version;
}

function getNextVersion(current, type) {
  const parts = current.split('.').map(Number);
  
  switch (type) {
    case 'major':
      return `${parts[0] + 1}.0.0`;
    case 'minor':
      return `${parts[0]}.${parts[1] + 1}.0`;
    case 'patch':
      return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
    default:
      throw new Error(`Invalid version type: ${type}`);
  }
}

function setVersion(version) {
  const packagePath = path.join(__dirname, '..', 'package.json');
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  pkg.version = version;
  fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === '--help' || command === '-h') {
    console.log(`
Usage: node scripts/version.js <command> [options]

Commands:
  current                    Show current version
  next <type>               Show what the next version would be
  bump <type>               Bump version (patch, minor, major)
  set <version>             Set specific version

Examples:
  npm run version current           # Show current version
  npm run version next patch        # Show next patch version
  npm run version bump minor        # Bump minor version
  npm run version set 2.0.0         # Set version to 2.0.0
`);
    return;
  }

  const currentVersion = getCurrentVersion();

  switch (command) {
    case 'current':
      log(`Current version: ${currentVersion}`, 'green');
      break;

    case 'next':
      const type = args[1];
      if (!['patch', 'minor', 'major'].includes(type)) {
        log('Error: Version type must be patch, minor, or major', 'red');
        process.exit(1);
      }
      const nextVersion = getNextVersion(currentVersion, type);
      log(`Next ${type} version: ${nextVersion}`, 'blue');
      break;

    case 'bump':
      const bumpType = args[1];
      if (!['patch', 'minor', 'major'].includes(bumpType)) {
        log('Error: Version type must be patch, minor, or major', 'red');
        process.exit(1);
      }
      const newVersion = getNextVersion(currentVersion, bumpType);
      setVersion(newVersion);
      log(`Version bumped from ${currentVersion} to ${newVersion}`, 'green');
      break;

    case 'set':
      const targetVersion = args[1];
      if (!targetVersion || !/^\d+\.\d+\.\d+/.test(targetVersion)) {
        log('Error: Please provide a valid version (e.g., 1.2.3)', 'red');
        process.exit(1);
      }
      setVersion(targetVersion);
      log(`Version set to ${targetVersion}`, 'green');
      break;

    default:
      log(`Unknown command: ${command}`, 'red');
      log('Use --help for usage information', 'yellow');
      process.exit(1);
  }
}

main();
