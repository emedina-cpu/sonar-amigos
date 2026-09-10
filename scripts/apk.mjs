import { existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const env = { ...process.env };
const windows = process.platform === 'win32';

// Reuse installed Android tooling without launching the IDE.
if (!env.JAVA_HOME) {
  const candidates = windows
    ? [join(env.ProgramFiles || 'C:\\Program Files', 'Android', 'Android Studio', 'jbr')]
    : process.platform === 'darwin'
      ? ['/Applications/Android Studio.app/Contents/jbr/Contents/Home']
      : ['/opt/android-studio/jbr'];
  env.JAVA_HOME = candidates.find(path => existsSync(join(path, 'bin', windows ? 'java.exe' : 'java'))) || '';
  if (!env.JAVA_HOME) delete env.JAVA_HOME;
}
if (!env.ANDROID_HOME && !env.ANDROID_SDK_ROOT) {
  const sdk = windows
    ? join(env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'Android', 'Sdk')
    : process.platform === 'darwin'
      ? join(homedir(), 'Library', 'Android', 'sdk')
      : join(homedir(), 'Android', 'Sdk');
  if (existsSync(sdk)) env.ANDROID_HOME = sdk;
}

console.log('\nCompilando APK Android…');
const result = windows
  ? spawnSync(env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'gradlew.bat assembleDebug --console=plain'], { cwd: join(root, 'android'), env, stdio: 'inherit' })
  : spawnSync('sh', ['./gradlew', 'assembleDebug', '--console=plain'], { cwd: join(root, 'android'), env, stdio: 'inherit' });
if (result.error || result.status !== 0) {
  console.error('\nNo se pudo compilar la APK. Revisá el error anterior y la instalación del JDK y SDK Android.');
  if (result.error) console.error(result.error.message);
  process.exit(result.status || 1);
}
const destination = join(root, 'apk', 'sonar-amigos-debug.apk');
mkdirSync(dirname(destination), { recursive: true });
copyFileSync(join(root, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk'), destination);
console.log(`\nAPK lista: ${destination}\n`);
