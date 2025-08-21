#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Console colors
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

function exec(command, options = {}) {
  log(`Running: ${command}`, 'blue');
  try {
    return execSync(command, {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..'),
      ...options
    });
  } catch (error) {
    log(`Command failed: ${command}`, 'red');
    process.exit(1);
  }
}

function checkGitStatus(allowUncommittedFiles = []) {
  try {
    const status = execSync('git status --porcelain', {
      encoding: 'utf8',
      cwd: path.join(__dirname, '..')
    });
    if (status.trim()) {
      const lines = status.trim().split('\n');
      const uncommitted = lines.filter(line => {
        const file = line.trim().replace(/^([A-Z? ]+)\s+/, '');
        return !allowUncommittedFiles.includes(file);
      });
      if (uncommitted.length > 0) {
        log('Error: Working directory is not clean. Please commit or stash changes first.', 'red');
        process.exit(1);
      }
    }
  } catch (error) {
    log('Warning: Could not check git status', 'yellow');
  }
}

function getCurrentVersion() {
  const packagePath = path.join(__dirname, '..', 'package.json');
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  return pkg.version;
}

function bumpVersion(type = 'patch') {
  log(`Bumping ${type} version...`, 'blue');
  exec(`pnpm version ${type} --no-git-tag-version`);
  return getCurrentVersion();
}

function validatePackage() {
  log('Validating package...', 'blue');
  const distPath = path.join(__dirname, '..', 'dist');
  if (!fs.existsSync(distPath)) {
    log('Error: dist directory does not exist. Run pnpm run build first.', 'red');
    process.exit(1);
  }
  const mainFile = path.join(__dirname, '..', 'dist', 'index.js');
  if (!fs.existsSync(mainFile)) {
    log('Error: Main entry point dist/index.js does not exist.', 'red');
    process.exit(1);
  }
  const typesFile = path.join(__dirname, '..', 'dist', 'index.d.ts');
  if (!fs.existsSync(typesFile)) {
    log('Error: Types file dist/index.d.ts does not exist.', 'red');
    process.exit(1);
  }
  log('Package validation passed!', 'green');
}

function runTests() {
  log('Running tests...', 'blue');
  exec('pnpm test');
  log('All tests passed!', 'green');
}

function runLinting() {
  log('Running linter...', 'blue');
  exec('pnpm run lint');
  log('Linting passed!', 'green');
}

function buildPackage() {
  log('Building package...', 'blue');
  exec('pnpm run clean');
  exec('pnpm run build');
  log('Build completed!', 'green');
}

function dryRunPublish() {
  log('Running dry-run publish to check what will be published...', 'blue');
  exec('npm pack --dry-run');
}

function publishToNpm(tag = 'latest') {
  log(`Publishing to npm with tag: ${tag}...`, 'blue');
  exec(`pnpm publish --tag ${tag}`);
  log('Successfully published to npm!', 'green');
}

function pushToGit() {
  log('Pushing to git...', 'blue');
  exec('git push origin main --tags');
  log('Pushed to git!', 'green');
}

function showHelpAndExit() {
  console.log(`
Usage: node scripts/publish.js [version-type] [npm-tag] [options]

Arguments:
  version-type    Version bump type: patch (default), minor, major
  npm-tag         NPM distribution tag: latest (default), beta, alpha, etc.

Options:
  --dry-run       Run all steps except actual publishing
  --skip-tests    Skip running tests
  --skip-lint     Skip running linter
  --skip-git      Skip git operations (commit, tag, push)
  --help, -h      Show this help message

Examples:
  pnpm run publish                    # Bump patch version and publish
  pnpm run publish minor              # Bump minor version and publish
  pnpm run publish major latest       # Bump major version and publish to latest
  pnpm run publish patch beta         # Bump patch version and publish to beta tag
  pnpm run publish patch latest --dry-run    # Dry run without actually publishing
  pnpm run publish --skip-tests --skip-git   # Skip tests and git operations
`);
  process.exit(0);
}

// Prevent infinite recursion: check if this script is being called recursively
if (process.env.PUBLISH_SCRIPT_RUNNING === '1') {
  log('Detected recursive invocation of publish.js. Exiting to prevent infinite loop.', 'red');
  process.exit(1);
}
process.env.PUBLISH_SCRIPT_RUNNING = '1';

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  showHelpAndExit();
}

function main() {
  const args = process.argv.slice(2);
  const versionType = args[0] || 'patch';
  const tag = args[1] || 'latest';
  const skipTests = args.includes('--skip-tests');
  const skipLint = args.includes('--skip-lint');
  const skipGit = args.includes('--skip-git');
  const dryRun = args.includes('--dry-run');

  log('Starting pnpm publish process...', 'green');
  log(`Version bump type: ${versionType}`, 'blue');
  log(`NPM tag: ${tag}`, 'blue');

  try {
    if (!skipGit) {
      checkGitStatus();
    }
    if (!skipLint) {
      runLinting();
    }
    if (!skipTests) {
      runTests();
    }
    buildPackage();
    validatePackage();
    const newVersion = bumpVersion(versionType);
    log(`New version: ${newVersion}`, 'green');

    if (!skipGit) {
      checkGitStatus(['package.json', 'package-lock.json']);
      exec('git add package.json package-lock.json');
      exec(`git commit -m "chore: bump version to ${newVersion}"`);
    }

    dryRunPublish();

    if (dryRun) {
      log('Dry run completed. Use without --dry-run to actually publish.', 'yellow');
      return;
    }

    publishToNpm(tag);

    if (!skipGit) {
      exec(`git tag -a v${newVersion} -m "Release version ${newVersion}"`);
      pushToGit();
    }

    log(`\n🎉 Successfully published version ${newVersion} to npm!`, 'green');
    log(`Package: https://www.npmjs.com/package/spaya-ts`, 'blue');
  } catch (error) {
    log(`Publish failed: ${error.message}`, 'red');
    process.exit(1);
  }
}

main();
