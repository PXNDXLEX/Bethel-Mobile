const fs = require('fs');
const path = require('path');

const gradlePath = path.join(__dirname, 'android', 'app', 'build.gradle');
const pkgPath = path.join(__dirname, 'package.json');

try {
    // Increment package.json version
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    let [major, minor, patch] = (pkg.version || '1.0.0').split('.').map(Number);
    patch += 1;
    pkg.version = `${major}.${minor}.${patch}`;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
    console.log(`Updated package.json version to ${pkg.version}`);

    // Increment android build.gradle version
    if (fs.existsSync(gradlePath)) {
        let gradle = fs.readFileSync(gradlePath, 'utf8');
        
        let newVersionCode = 1;
        gradle = gradle.replace(/versionCode\s+(\d+)/, (match, p1) => {
            newVersionCode = parseInt(p1, 10) + 1;
            return `versionCode ${newVersionCode}`;
        });

        gradle = gradle.replace(/versionName\s+"([^"]+)"/, (match, p1) => {
            return `versionName "${pkg.version}"`;
        });

        fs.writeFileSync(gradlePath, gradle);
        console.log(`Updated build.gradle versionCode to ${newVersionCode} and versionName to ${pkg.version}`);
    } else {
        console.log(`Could not find build.gradle at ${gradlePath}`);
    }
} catch (e) {
    console.error("Error incrementing version:", e);
}
