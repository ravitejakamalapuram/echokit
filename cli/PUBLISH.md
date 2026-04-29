# Publishing echokit-server to npm

## Prerequisites
- npm account (free at https://www.npmjs.com/signup)
- Verified email address
- Package name `echokit-server` is available (or you own it)

## Pre-Publish Checklist

✅ Package.json configured correctly
✅ LICENSE file present (MIT)
✅ README.md with installation and usage instructions
✅ .npmignore excludes test files
✅ All tests passing (17/17)

## Step-by-Step Publishing

### 1. Login to npm
```bash
npm login
```
You'll be prompted for:
- Username
- Password
- Email
- One-time password (if 2FA enabled)

Verify you're logged in:
```bash
npm whoami
```

### 2. Verify Package Configuration
```bash
cd cli
cat package.json
```

Key fields:
- `name`: `echokit-server` ✅
- `version`: `1.0.0` (first publish)
- `description`: ✅
- `main`: `lib/server.js` ✅
- `bin`: `{"echokit-server": "./bin/echokit-server.js"}` ✅
- `license`: `MIT` ✅
- `files`: Includes `bin/` and `lib/` ✅

### 3. Test Local Installation
Before publishing, test that the package installs correctly:
```bash
# Pack the package (creates a tarball)
npm pack

# This creates echokit-server-1.0.0.tgz
# You can test install it:
npm install -g ./echokit-server-1.0.0.tgz

# Test it works
echokit-server --help

# Uninstall test version
npm uninstall -g echokit-server
```

### 4. Publish to npm
```bash
cd /Users/rkamalapuram/git-personal/echokit/cli
npm publish --access=public
```

Expected output:
```
npm notice 
npm notice 📦  echokit-server@1.0.0
npm notice === Tarball Contents === 
npm notice XXX B bin/echokit-server.js
npm notice XXX B lib/server.js
npm notice XXX B lib/match.js
npm notice XXX B README.md
npm notice XXX B LICENSE
npm notice === Tarball Details === 
npm notice name:          echokit-server                          
npm notice version:       1.0.0                                   
npm notice filename:      echokit-server-1.0.0.tgz                
npm notice package size:  XX.X kB                                 
npm notice unpacked size: XX.X kB                                 
npm notice total files:   5                                       
npm notice 
+ echokit-server@1.0.0
```

### 5. Verify Publication
Visit: https://www.npmjs.com/package/echokit-server

Test installation:
```bash
# Install globally
npm install -g echokit-server

# Or run directly with npx
npx echokit-server --help
```

### 6. Update Documentation
After successful publish:

1. Update repo README.md to reference `npx echokit-server`
2. Update extension documentation
3. Update GitHub Actions template to use `npx echokit-server`
4. Add badge to README: [![npm version](https://badge.fury.io/js/echokit-server.svg)](https://www.npmjs.com/package/echokit-server)

## Future Version Updates

When releasing updates:

1. Update version in `cli/package.json`:
   ```bash
   cd cli
   npm version patch  # 1.0.0 → 1.0.1
   # or
   npm version minor  # 1.0.0 → 1.1.0
   # or
   npm version major  # 1.0.0 → 2.0.0
   ```

2. Commit the version bump:
   ```bash
   git add package.json
   git commit -m "chore: bump echokit-server to v1.0.1"
   git tag v1.0.1
   git push && git push --tags
   ```

3. Publish:
   ```bash
   npm publish
   ```

## Troubleshooting

**Error: "You need to log in"**
→ Run `npm login`

**Error: "Package name already exists"**
→ Either the package is taken, or you need access. Check https://www.npmjs.com/package/echokit-server

**Error: "You do not have permission to publish"**
→ You need to be added as a maintainer or use a different package name

**Error: "Invalid package.json"**
→ Run `npm pack` to see what's included, fix any issues

## Post-Publish Checklist

- [ ] Package visible at npmjs.com
- [ ] `npx echokit-server --help` works
- [ ] Update repo README with npm installation instructions
- [ ] Update .github/workflows/echokit-mock.yml to use published version
- [ ] Announce on social media / changelog
