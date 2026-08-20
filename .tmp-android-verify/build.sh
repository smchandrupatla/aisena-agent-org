#!/bin/bash
set -e
apt-get update -qq
apt-get install -y -qq unzip curl python3 >/dev/null

echo "== Fetching Android repository manifest =="
curl -fsSL https://dl.google.com/android/repository/repository2-3.xml -o /tmp/repo.xml

python3 - <<'PY'
import re
xml = open('/tmp/repo.xml', encoding='utf-8', errors='ignore').read()

def find_zip(path_marker, require_linux):
    idx = xml.find(path_marker)
    if idx == -1:
        return None
    chunk = xml[idx:idx+4000]
    pattern = r'<url>([^<]+linux[^<]*\.zip)</url>' if require_linux else r'<url>([^<]+\.zip)</url>'
    m = re.search(pattern, chunk)
    return m.group(1) if m else None

platform = find_zip('path="platforms;android-34"', require_linux=False)
build_tools = find_zip('path="build-tools;34.0.0"', require_linux=True)
with open('/tmp/urls.env', 'w') as f:
    f.write(f'PLATFORM_ZIP={platform}\n')
    f.write(f'BUILD_TOOLS_ZIP={build_tools}\n')
print('platform:', platform)
print('build_tools:', build_tools)
PY

source /tmp/urls.env
echo "Resolved PLATFORM_ZIP=$PLATFORM_ZIP BUILD_TOOLS_ZIP=$BUILD_TOOLS_ZIP"

export ANDROID_HOME=/cache/android-sdk
mkdir -p "$ANDROID_HOME/platforms/android-34" "$ANDROID_HOME/build-tools" "$ANDROID_HOME/licenses"

if [ -d "$ANDROID_HOME/platforms/android-34/data" ]; then
  echo "== platform-34 already cached, skipping download =="
else
  echo "== Downloading platform-34 =="
  curl -fsSL -o /tmp/platform.zip "https://dl.google.com/android/repository/$PLATFORM_ZIP"
  unzip -q /tmp/platform.zip -d "$ANDROID_HOME/platforms/android-34-tmp"
  mv "$ANDROID_HOME/platforms/android-34-tmp"/*/* "$ANDROID_HOME/platforms/android-34/" 2>/dev/null || \
    mv "$ANDROID_HOME/platforms/android-34-tmp"/* "$ANDROID_HOME/platforms/android-34/"
fi

if [ -d "$ANDROID_HOME/build-tools/34.0.0" ]; then
  echo "== build-tools 34.0.0 already cached, skipping download =="
else
  echo "== Downloading build-tools 34.0.0 =="
  curl -fsSL -o /tmp/build-tools.zip "https://dl.google.com/android/repository/$BUILD_TOOLS_ZIP"
  mkdir -p "$ANDROID_HOME/build-tools/tmp-extract" "$ANDROID_HOME/build-tools/34.0.0"
  unzip -q /tmp/build-tools.zip -d "$ANDROID_HOME/build-tools/tmp-extract"
  cp -r "$ANDROID_HOME/build-tools/tmp-extract"/*/. "$ANDROID_HOME/build-tools/34.0.0"
  rm -rf "$ANDROID_HOME/build-tools/tmp-extract"
fi

# Accept SDK licenses non-interactively (hashes are public, published in Android SDK docs).
cat > "$ANDROID_HOME/licenses/android-sdk-license" <<'EOF'
24333f8a63b6825ea9c5514f83c2829b004d1fee
d56f5187479451eabf01fb78af6dfcb131a6481e
EOF

if [ -d /cache/gradle-8.7 ]; then
  echo "== gradle 8.7 already cached, skipping download =="
else
  echo "== Downloading Gradle 8.7 =="
  curl -fsSL -o /tmp/gradle.zip https://services.gradle.org/distributions/gradle-8.7-bin.zip
  unzip -q /tmp/gradle.zip -d /cache
fi
export PATH="$PATH:/cache/gradle-8.7/bin"

echo "== Running gradle testDebugUnitTest =="
cd /project
gradle testDebugUnitTest --no-daemon --tests "com.aisena.simpleapp.MainActivityRobolectricTest" --tests "com.aisena.simpleapp.MainActivityUnitTest" --info 2>&1 | tail -n 200
echo BUILD_SUCCESS
find app/build/test-results -name "*.xml" -exec cat {} \;
