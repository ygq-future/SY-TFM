import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const manifestPath = fileURLToPath(
  new URL('../src-tauri/gen/android/app/src/main/AndroidManifest.xml', import.meta.url),
);

if (!existsSync(manifestPath)) {
  throw new Error('Android project is missing. Run `bun run tauri android init` first.');
}

const manifest = readFileSync(manifestPath, 'utf8');
const mainActivity = /<activity\b(?=[^>]*android:name="\.MainActivity")[^>]*>/s;
if (!mainActivity.test(manifest)) {
  throw new Error('Android MainActivity was not found in the generated manifest.');
}

let updated = manifest.replace(mainActivity, (activity) => {
  if (/android:screenOrientation="[^"]*"/.test(activity)) {
    return activity.replace(
      /android:screenOrientation="[^"]*"/,
      'android:screenOrientation="sensorPortrait"',
    );
  }
  return activity.replace(
    /\s*>$/,
    '\n            android:screenOrientation="sensorPortrait">',
  );
});

const restrictedResizabilityProperty =
  'android.window.PROPERTY_COMPAT_ALLOW_RESTRICTED_RESIZABILITY';
if (!updated.includes(restrictedResizabilityProperty)) {
  updated = updated.replace(
    /<application\b[^>]*>/s,
    (application) =>
      `${application}\n        <property\n            android:name="${restrictedResizabilityProperty}"\n            android:value="true" />`,
  );
}

if (updated !== manifest) writeFileSync(manifestPath, updated, 'utf8');
