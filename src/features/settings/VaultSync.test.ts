import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('portable vault and WebDAV sync', () => {
  const panel = readFileSync(new URL('./VaultSyncPanel.tsx', import.meta.url), 'utf8');
  const api = readFileSync(new URL('../../lib/tauri.ts', import.meta.url), 'utf8');
  const backend = readFileSync(
    new URL('../../../src-tauri/src/core/vault_sync.rs', import.meta.url),
    'utf8',
  );
  const styles = readFileSync(new URL('../../index.css', import.meta.url), 'utf8');
  const dialog = readFileSync(new URL('./SettingsDialog.tsx', import.meta.url), 'utf8');
  const cargo = readFileSync(new URL('../../../src-tauri/Cargo.toml', import.meta.url), 'utf8');
  const portableVault = readFileSync(
    new URL('../../../src-tauri/src/crypto/portable_vault.rs', import.meta.url),
    'utf8',
  );
  const vaultResources = readFileSync(
    new URL('../../../src-tauri/src/enums/vault_resource.rs', import.meta.url),
    'utf8',
  );
  const keyStorage = readFileSync(
    new URL('../../../src-tauri/src/crypto/key_storage.rs', import.meta.url),
    'utf8',
  );
  const commands = readFileSync(
    new URL('../../../src-tauri/src/commands/mod.rs', import.meta.url),
    'utf8',
  );
  const app = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8');
  const settingsStore = readFileSync(
    new URL('../../stores/settingsStore.ts', import.meta.url),
    'utf8',
  );
  const androidStorage = readFileSync(
    new URL(
      '../../../src-tauri/plugins/secure-storage/android/src/main/java/SecureStoragePlugin.kt',
      import.meta.url,
    ),
    'utf8',
  );

  it('uses the fixed SY-TFM cloud path and never imports protocol libraries above adapters', () => {
    expect(backend).toContain('VaultResource::CloudDirectory');
    expect(backend).toContain('VaultResource::CloudFile');
    expect(backend).toContain('create_adapter(Protocol::WebDav)');
    expect(backend).not.toContain('use reqwest');
  });

  it('supports saved configuration, enable, revision sync, restore, and pause', () => {
    for (const command of [
      'test_and_save_vault_webdav',
      'save_vault_backup_password',
      'enable_vault_sync',
      'sync_vault_now',
      'restore_vault_from_webdav',
      'pause_vault_sync',
      'resume_vault_sync',
    ]) {
      expect(api).toContain(command);
    }
    expect(panel).toContain('enableVaultSync');
    expect(panel).toContain('isCloudOverwritePending');
    expect(panel).toContain('settings.storage.vaultOverwriteWarning');
    expect(panel).toContain('void performEnable(true)');
    expect(api).toContain('overwriteExisting = false');
    expect(panel).toContain('restoreVaultFromWebDav');
    expect(panel).toContain('syncVaultNow');
    expect(panel).toContain('pauseVaultSync');
    expect(panel).toContain('resumeVaultSync');
    expect(backend).toContain('schedule_auto_sync');
    expect(backend).toContain('AutoSyncDebounceMilliseconds');
    expect(backend).toContain('overwrite_existing');
    expect(backend).toMatch(/remote_vault_exists[\s\S]*?&& !overwrite_existing/);
    expect(backend).toMatch(/pub async fn pause\([\s\S]*?pause_settings\(&mut settings\)/);
    expect(backend).toMatch(/fn pause_settings\([\s\S]*?settings\.vault_sync\.enabled = false;/);
  });

  it('shares only hosts in WebDAV while keeping settings and backgrounds per platform', () => {
    expect(backend).toContain('struct CloudVaultPayload');
    expect(backend).toContain('hosts: Vec<RemoteHost>');
    expect(backend).toContain('platforms: Vec<CloudPlatformPayload>');
    expect(backend).toContain('platform: Platform');
    expect(backend).toContain('host_settings: Vec<CloudPlatformHostSettings>');
    expect(backend).toContain('build_cloud_payload_for_platform');
    expect(backend).toContain('restore_cloud_settings_for_platform');
    expect(backend).toContain('current_platform()');
    expect(backend).toContain('host.download_path = host_settings');
    expect(backend).toContain('None => (AppSettings::default(), Vec::new(), None, None)');
    expect(backend).toContain('background_asset: Option<CloudBackgroundAsset>');
    expect(backend).toContain('upload_background_assets');
    expect(backend).toContain('restore_cloud_background_asset');
    expect(backend).toContain('background_asset_file_name');
    expect(vaultResources).toContain('background-windows-');
    expect(vaultResources).toContain('background-android-');
  });

  it('compresses configuration before encryption and never embeds cloud images as Base64', () => {
    expect(cargo).toMatch(/^flate2\s*=/m);
    expect(portableVault).toContain('GzEncoder');
    expect(portableVault).toContain('GzDecoder');
    expect(portableVault).toContain('payload_encoding');
    expect(backend).toContain('data_base64'); // Legacy portable/import compatibility only.
    expect(backend).toMatch(/struct CloudBackgroundAsset[\s\S]*?sha256:/);
    expect(backend).toMatch(/struct CloudPlatformPayload[\s\S]*?background_asset:/);
    expect(backend).toContain('settings.background_image_path = None');
  });

  it('skips unchanged uploads and compares only shared hosts plus the current platform', () => {
    const comparisonIndex = backend.indexOf('let should_upload = push_hosts || push_platform');
    const uploadIndex = backend.indexOf(
      'upload_document(adapter.as_mut(), &document)',
      comparisonIndex,
    );
    expect(backend).toContain('struct CloudComparisonScope');
    expect(backend).toContain('last_synced_scope_hash');
    expect(backend).toContain('cloud_scope_hash(&payload, current_platform())');
    expect(backend).toContain('classify_scope_change');
    expect(backend).toContain('cloud_hosts_hash');
    expect(backend).toContain('cloud_platform_hash');
    expect(backend).toContain('.last_synced_revision\n        .max(remote_revision)');
    expect(comparisonIndex).toBeGreaterThan(-1);
    expect(uploadIndex).toBeGreaterThan(comparisonIndex);
    expect(backend.slice(comparisonIndex, uploadIndex)).toContain('if !should_upload');
    expect(backend.slice(comparisonIndex, uploadIndex)).toContain('return result');
  });

  it('syncs hosts quickly, defers appearance checks, and polls remote changes', () => {
    expect(commands).toMatch(
      /pub fn save_settings[\s\S]*?SettingsService::save\(&settings\)\?[\s\S]*?Ok\(\(\)\)/,
    );
    expect(
      commands.slice(
        commands.indexOf('pub fn save_settings'),
        commands.indexOf('pub fn export_settings_encrypted'),
      ),
    ).not.toContain('schedule_auto_sync');
    expect(commands).toMatch(/pub fn save_host[\s\S]*?if host_unchanged[\s\S]*?return Ok\(\(\)\)/);
    expect(settingsStore).toContain('flushSettingsWrites');
    expect(app).toContain('handleSettingsClose');
    expect(app).toContain("document.addEventListener('visibilitychange'");
    expect(app).toContain('syncVaultNow()');
    expect(app).toContain('vaultStatus.refreshIntervalMs');
    expect(backend).toContain('last_synced_hosts_hash');
    expect(backend).toContain('last_synced_hosts_snapshot');
    expect(backend).toContain('merge_hosts_three_way');
    expect(backend).toContain('capture_host_sync_baseline');
    expect(backend).toContain('last_synced_platform_hash');
    expect(backend).toContain('apply_remote_scope');
  });

  it('keeps local portable exports as complete single-device backups', () => {
    expect(backend).toContain('build_portable_payload');
    expect(backend).toContain('capture_background_image');
    expect(backend).toContain('restore_background_image');
    expect(backend).not.toContain('settings.default_download_path = None');
    expect(api).toContain('test_and_save_vault_webdav');
    expect(panel).toContain('testVaultWebDav');
  });

  it('shares one locally protected backup password between portable and WebDAV backups', () => {
    expect(dialog).toContain('portablePassword');
    expect(dialog).toContain('backupPassword={portablePassword}');
    expect(dialog).toContain('settings.storage.backupPasswordPurpose');
    expect(dialog).toContain('shared-backup-passwords');
    expect(dialog).toContain('saveVaultBackupPassword');
    expect(dialog).toContain('settings.storage.backupPasswordChangeWarning');
    expect(dialog).toContain('<ConfirmDialog');
    expect(dialog).toContain('settings.storage.vaultPasswordInput');
    expect(dialog).toContain('settings.storage.vaultPasswordConfirmPlaceholder');
    expect(dialog).toContain('vaultStatus?.backupPasswordSaved');
    expect(dialog).toContain('settings.storage.backupPasswordStoredOnWindows');
    expect(dialog).toContain('backup-password-footer');
    expect(dialog).toContain('isBackupPasswordReviewPending');
    expect(dialog).toContain('backup-password-review-value');
    expect(dialog).toContain('backupPasswordReviewWhitespace');
    expect(dialog).not.toContain('className="sr-only"');
    expect(styles).toMatch(
      /\.setting-row\.setting-row--backup-password\s*\{[^}]*grid-template-columns:\s*1fr/s,
    );
    expect(styles).toMatch(
      /\.backup-password-footer\s*\{[^}]*grid-column:\s*1 \/ -1[^}]*justify-content:\s*space-between/s,
    );
    expect(styles).not.toContain('minmax(430px, 1.28fr)');
    expect(dialog.indexOf('shared-backup-passwords')).toBeLessThan(
      dialog.indexOf('encrypted-backup-card'),
    );
    expect(panel).not.toContain('const [backupPassword, setBackupPassword]');
    expect(backend).toContain('backup_password');
    expect(backend).toContain('password != confirmation');
  });

  it('uses Android Keystore instead of keyring mock storage', () => {
    expect(cargo).toMatch(
      /\[target\.'cfg\(target_os = "android"\)'\.dependencies\][\s\S]*?sy-tfm-secure-storage/,
    );
    expect(keyStorage).toContain('sy_tfm_secure_storage::get');
    expect(androidStorage).toContain('AndroidKeyStore');
    expect(androidStorage).toContain('KeyGenParameterSpec.Builder');
    expect(backend).toContain('locally_protected_secret_is_readable');
  });

  it('restores cloud settings locally without enabling sync', () => {
    expect(backend).toMatch(
      /pub async fn restore\([\s\S]*?restored\.vault_sync = VaultSyncSettings \{[\s\S]*?enabled: false,/,
    );
  });

  it('validates localized vault inputs and never exposes backend messages directly', () => {
    expect(panel).toContain('settings.storage.vaultRequiredWebDavUrl');
    expect(panel).toContain('settings.storage.vaultRequiredUsername');
    expect(panel).toContain('settings.storage.vaultRequiredWebDavPassword');
    expect(panel).toContain('settings.storage.vaultRequiredBackupPassword');
    expect(panel).toContain('hasAppErrorCode');
    expect(panel).not.toContain('formatAppError');
  });

  it('keeps edited credential fields stable across background status refreshes', () => {
    expect(panel).toContain('mergeVaultCredentialStatus');
    expect(panel).toContain('webdavUrlEdited: true');
    expect(panel).toContain('usernameEdited: true');
  });

  it('keeps all WebDAV vault actions on one compact line', () => {
    expect(styles).toMatch(/\.vault-actions \.vault-action-button\s*\{[^}]*white-space:\s*nowrap/s);
    expect(styles).not.toMatch(/\.vault-actions \.vault-action-button\s*\{[^}]*width:\s*148px/s);
  });
});
