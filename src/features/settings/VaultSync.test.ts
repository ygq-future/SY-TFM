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

  it('backs up complete settings and the local background image', () => {
    expect(backend).toContain('capture_background_image');
    expect(backend).toContain('restore_background_image');
    expect(backend).toContain('PortableBackgroundImage');
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

  it('validates localized vault inputs and never exposes backend messages directly', () => {
    expect(panel).toContain('settings.storage.vaultRequiredWebDavUrl');
    expect(panel).toContain('settings.storage.vaultRequiredUsername');
    expect(panel).toContain('settings.storage.vaultRequiredWebDavPassword');
    expect(panel).toContain('settings.storage.vaultRequiredBackupPassword');
    expect(panel).toContain('hasAppErrorCode');
    expect(panel).not.toContain('formatAppError');
  });

  it('keeps all WebDAV vault actions on one compact line', () => {
    expect(styles).toMatch(/\.vault-actions \.vault-action-button\s*\{[^}]*white-space:\s*nowrap/s);
    expect(styles).not.toMatch(/\.vault-actions \.vault-action-button\s*\{[^}]*width:\s*148px/s);
  });
});
