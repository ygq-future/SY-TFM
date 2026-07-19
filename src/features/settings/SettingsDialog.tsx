import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Check,
  Database,
  Download,
  ExternalLink,
  FolderOpen,
  Image,
  Info,
  KeyRound,
  Languages,
  Palette,
  Save,
  Settings2,
  SlidersHorizontal,
  Type,
  Upload,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { openUrl } from '@tauri-apps/plugin-opener';
import { ModalPortal } from '../../components/shared/ModalPortal';
import { ConfirmDialog } from '../../components/shared/Dialog';
import { Select } from '../../components/ui/Select';
import { Switch } from '../../components/ui/Switch';
import { pickDirectory, pickFile, pickImageFile, pickSaveFile } from '../../lib/dialog';
import {
  exportPortableVault,
  getAppInfo,
  getStoragePaths,
  importPortableVault,
  loadBackgroundImage,
  saveVaultBackupPassword,
  type AppInfo,
} from '../../lib/tauri';
import { ACCENT_COLORS, useSettingsStore, type AppearanceTheme } from '../../stores/settingsStore';
import { useConnectionStore } from '../../stores/connectionStore';
import type { StoragePaths } from '../../types/generated/StoragePaths';
import { formatAppError } from '../../lib/errors';
import { VaultSyncPanel } from './VaultSyncPanel';
import { useVaultSyncStore } from '../../stores/vaultSyncStore';
import { reviewBackupPassword } from './backupPasswordReview';

type SettingsSection = 'general' | 'appearance' | 'storage' | 'about';

const SECTIONS: ReadonlyArray<{
  value: SettingsSection;
  labelKey: string;
  icon: typeof Settings2;
}> = [
  { value: 'general', labelKey: 'settings.sections.general', icon: SlidersHorizontal },
  { value: 'appearance', labelKey: 'settings.sections.appearance', icon: Palette },
  { value: 'storage', labelKey: 'settings.sections.storage', icon: Database },
  { value: 'about', labelKey: 'settings.sections.about', icon: Info },
];

function SettingRow({
  title,
  hint,
  icon,
  className,
  children,
}: {
  title: string;
  hint: string;
  icon: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`setting-row${className ? ` ${className}` : ''}`}>
      <div className="setting-copy">
        <span className="setting-icon">{icon}</span>
        <div>
          <strong>{title}</strong>
          <small>{hint}</small>
        </div>
      </div>
      <div className="setting-control">{children}</div>
    </div>
  );
}

function RangeControl({
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="settings-range">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <output>
        {Math.round(value * (unit === '%' ? 100 : 1))}
        {unit}
      </output>
    </div>
  );
}

/** 四分区桌面设置面板，所有选项均直接作用于全局并持久化。 */
export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [section, setSection] = useState<SettingsSection>('general');
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [storagePaths, setStoragePaths] = useState<StoragePaths | null>(null);
  const settings = useSettingsStore();
  const loadHosts = useConnectionStore((state) => state.loadHosts);
  const refreshVaultStatus = useVaultSyncStore((state) => state.refreshStatus);
  const vaultStatus = useVaultSyncStore((state) => state.status);
  const [backgroundPathDraft, setBackgroundPathDraft] = useState(settings.backgroundImage ?? '');
  const [downloadPathDraft, setDownloadPathDraft] = useState('');
  const [dataPathDraft, setDataPathDraft] = useState('');
  const [portablePassword, setPortablePassword] = useState('');
  const [portablePasswordConfirm, setPortablePasswordConfirm] = useState('');
  const [isSavingBackupPassword, setIsSavingBackupPassword] = useState(false);
  const [isBackupPasswordReviewPending, setIsBackupPasswordReviewPending] = useState(false);
  const backupPasswordReview = reviewBackupPassword(portablePassword);

  useEffect(() => {
    void getStoragePaths()
      .then(setStoragePaths)
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    void refreshVaultStatus();
  }, [refreshVaultStatus]);
  useEffect(() => {
    setBackgroundPathDraft(settings.backgroundImage ?? '');
  }, [settings.backgroundImage]);
  useEffect(() => {
    setDownloadPathDraft(settings.defaultDownloadPath ?? storagePaths?.defaultDownloadPath ?? '');
  }, [settings.defaultDownloadPath, storagePaths?.defaultDownloadPath]);
  useEffect(() => {
    setDataPathDraft(settings.defaultDataPath ?? storagePaths?.defaultDataPath ?? '');
  }, [settings.defaultDataPath, storagePaths?.defaultDataPath]);

  useEffect(() => {
    if (section !== 'about' || appInfo) return;
    void getAppInfo()
      .then(setAppInfo)
      .catch(() => undefined);
  }, [appInfo, section]);

  const applyBackgroundPath = async (path: string) => {
    if (!path) {
      settings.setBackgroundImage(null);
      return;
    }
    try {
      await loadBackgroundImage(path);
      settings.setBackgroundImage(path);
      settings.setBackgroundImageEnabled(true);
    } catch (error) {
      toast.error(t('settings.appearance.backgroundFailed', { error: formatAppError(error) }));
    }
  };

  const chooseBackground = async () => {
    const selected = await pickImageFile(
      t('settings.appearance.chooseImage'),
      t('settings.appearance.imageFilter'),
      settings.backgroundImage ?? undefined,
    );
    if (!selected) return;
    setBackgroundPathDraft(selected);
    await applyBackgroundPath(selected);
  };

  const chooseDirectory = async (kind: 'download' | 'data') => {
    try {
      const selected = await pickDirectory(
        t(kind === 'download' ? 'settings.storage.chooseDownload' : 'settings.storage.chooseData'),
        kind === 'download' ? downloadPathDraft : dataPathDraft,
      );
      if (!selected) return;
      if (kind === 'download') {
        setDownloadPathDraft(selected);
        settings.setDefaultDownloadPath(selected);
      } else {
        setDataPathDraft(selected);
        settings.setDefaultDataPath(selected);
      }
    } catch {
      toast.error(t('settings.storage.directoryFailed'));
    }
  };

  const exportConfig = async () => {
    if (portablePassword !== portablePasswordConfirm) {
      toast.error(t('settings.storage.vaultPasswordMismatch'));
      return;
    }
    try {
      const path = await pickSaveFile(
        t('settings.storage.exportTitle'),
        'sy-tfm-backup.sytfm',
        t('settings.storage.backupFilter'),
      );
      if (!path) return;
      await exportPortableVault(path, portablePassword);
      await refreshVaultStatus();
      setPortablePassword('');
      setPortablePasswordConfirm('');
      toast.success(t('settings.storage.exportDone'));
    } catch (error) {
      toast.error(t('settings.storage.exportFailed', { error: String(error) }));
    }
  };

  const importConfig = async () => {
    try {
      const path = await pickFile(t('settings.storage.importTitle'));
      if (!path) return;
      await importPortableVault(path, portablePassword);
      setPortablePassword('');
      setPortablePasswordConfirm('');
      await Promise.all([settings.hydrateSettings(), loadHosts(), refreshVaultStatus()]);
      toast.success(t('settings.storage.importDone'));
    } catch (error) {
      toast.error(t('settings.storage.importFailed', { error: String(error) }));
    }
  };

  const persistBackupPassword = async () => {
    setIsBackupPasswordReviewPending(false);
    setIsSavingBackupPassword(true);
    try {
      await saveVaultBackupPassword(portablePassword, portablePasswordConfirm);
      await refreshVaultStatus();
      setPortablePassword('');
      setPortablePasswordConfirm('');
      toast.success(t('settings.storage.backupPasswordSaved'));
    } catch {
      toast.error(t('settings.storage.backupPasswordSaveFailed'));
    } finally {
      setIsSavingBackupPassword(false);
      setIsBackupPasswordReviewPending(false);
    }
  };

  const requestBackupPasswordSave = () => {
    if (Array.from(portablePassword).length < 8) {
      toast.error(t('settings.storage.backupPasswordTooShort'));
      return;
    }
    if (portablePassword !== portablePasswordConfirm) {
      toast.error(t('settings.storage.vaultPasswordMismatch'));
      return;
    }
    setIsBackupPasswordReviewPending(true);
  };

  return (
    <ModalPortal>
      <div className="modal-backdrop settings-backdrop" role="presentation">
        <section
          className="settings-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-title"
        >
          <header className="settings-header">
            <span className="settings-mark">
              <Settings2 />
            </span>
            <div>
              <small>SY·TFM</small>
              <h2 id="settings-title">{t('settings.title')}</h2>
            </div>
            <button
              className="icon-button settings-close"
              type="button"
              aria-label={t('settings.close')}
              onClick={onClose}
            >
              <X />
            </button>
          </header>

          <div className="settings-layout">
            <nav className="settings-nav" aria-label={t('settings.categories')}>
              {SECTIONS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.value}
                    type="button"
                    className={
                      section === item.value
                        ? 'settings-nav-item settings-nav-item--active'
                        : 'settings-nav-item'
                    }
                    onClick={() => setSection(item.value)}
                  >
                    <Icon />
                    <span>{t(item.labelKey)}</span>
                  </button>
                );
              })}
            </nav>

            <div className="settings-content">
              {section === 'general' && (
                <div className="settings-page">
                  <div className="settings-page-heading">
                    <small>{t('settings.sections.general').toUpperCase()}</small>
                    <h3>{t('settings.sections.general')}</h3>
                    <p>{t('settings.general.description')}</p>
                  </div>
                  <SettingRow
                    title={t('settings.general.language')}
                    hint={t('settings.general.languageHint')}
                    icon={<Languages />}
                  >
                    <Select
                      value={settings.language}
                      ariaLabel={t('settings.general.language')}
                      options={[
                        { value: 'zh', label: t('settings.general.chinese') },
                        { value: 'en', label: t('settings.general.english') },
                      ]}
                      onValueChange={settings.setLanguage}
                    />
                  </SettingRow>
                  <SettingRow
                    title={t('settings.general.fontSize')}
                    hint={t('settings.general.fontSizeHint')}
                    icon={<Type />}
                  >
                    <RangeControl
                      value={settings.fontSize}
                      min={10}
                      max={18}
                      step={1}
                      unit="px"
                      onChange={settings.setFontSize}
                    />
                  </SettingRow>
                  <SettingRow
                    title={t('settings.general.headingFontSize')}
                    hint={t('settings.general.headingFontSizeHint')}
                    icon={<Type />}
                  >
                    <RangeControl
                      value={settings.headingFontSize}
                      min={12}
                      max={24}
                      step={1}
                      unit="px"
                      onChange={settings.setHeadingFontSize}
                    />
                  </SettingRow>
                  <SettingRow
                    title={t('settings.general.labelFontSize')}
                    hint={t('settings.general.labelFontSizeHint')}
                    icon={<Type />}
                  >
                    <RangeControl
                      value={settings.labelFontSize}
                      min={10}
                      max={18}
                      step={1}
                      unit="px"
                      onChange={settings.setLabelFontSize}
                    />
                  </SettingRow>
                  <SettingRow
                    title={t('settings.general.captionFontSize')}
                    hint={t('settings.general.captionFontSizeHint')}
                    icon={<Type />}
                  >
                    <RangeControl
                      value={settings.captionFontSize}
                      min={9}
                      max={16}
                      step={1}
                      unit="px"
                      onChange={settings.setCaptionFontSize}
                    />
                  </SettingRow>
                  <SettingRow
                    title={t('settings.general.dataFontSize')}
                    hint={t('settings.general.dataFontSizeHint')}
                    icon={<Type />}
                  >
                    <RangeControl
                      value={settings.dataFontSize}
                      min={10}
                      max={18}
                      step={1}
                      unit="px"
                      onChange={settings.setDataFontSize}
                    />
                  </SettingRow>
                </div>
              )}

              {section === 'appearance' && (
                <div className="settings-page">
                  <div className="settings-page-heading">
                    <small>{t('settings.sections.appearance').toUpperCase()}</small>
                    <h3>{t('settings.sections.appearance')}</h3>
                    <p>{t('settings.appearance.description')}</p>
                  </div>
                  <SettingRow
                    title={t('settings.appearance.theme')}
                    hint={t('settings.appearance.themeHint')}
                    icon={<Palette />}
                  >
                    <div className="theme-segmented">
                      {(['light', 'dark'] as AppearanceTheme[]).map((theme) => (
                        <button
                          key={theme}
                          type="button"
                          className={settings.theme === theme ? 'is-active' : ''}
                          onClick={() => settings.setTheme(theme)}
                        >
                          {t(
                            theme === 'light'
                              ? 'settings.appearance.light'
                              : 'settings.appearance.dark',
                          )}
                        </button>
                      ))}
                    </div>
                  </SettingRow>
                  <div className="setting-row setting-row--stacked">
                    <div className="setting-copy">
                      <span className="setting-icon">
                        <Palette />
                      </span>
                      <div>
                        <strong>{t('settings.appearance.accent')}</strong>
                        <small>{t('settings.appearance.accentHint')}</small>
                      </div>
                    </div>
                    <div className="accent-grid">
                      {ACCENT_COLORS.map((accent) => (
                        <button
                          key={accent.value}
                          type="button"
                          data-color={accent.value}
                          className={
                            settings.accentColor === accent.value
                              ? 'accent-swatch accent-swatch--active'
                              : 'accent-swatch'
                          }
                          title={t(accent.labelKey)}
                          onClick={() => settings.setAccentColor(accent.value)}
                        >
                          <span />
                          {settings.accentColor === accent.value && <Check />}
                        </button>
                      ))}
                    </div>
                  </div>
                  <SettingRow
                    title={t('settings.appearance.backgroundEnabled')}
                    hint={t('settings.appearance.backgroundEnabledHint')}
                    icon={<Image />}
                  >
                    <Switch
                      checked={settings.backgroundImageEnabled}
                      ariaLabel={t('settings.appearance.backgroundEnabled')}
                      onCheckedChange={settings.setBackgroundImageEnabled}
                    />
                  </SettingRow>
                  <SettingRow
                    title={t('settings.appearance.background')}
                    hint={t('settings.appearance.backgroundHint')}
                    icon={<Image />}
                  >
                    <div className="path-setting background-path-setting">
                      <input
                        value={backgroundPathDraft}
                        placeholder={t('settings.appearance.backgroundPlaceholder')}
                        onChange={(event) => setBackgroundPathDraft(event.target.value)}
                        onBlur={() => void applyBackgroundPath(backgroundPathDraft)}
                      />
                      <button
                        type="button"
                        title={t('settings.appearance.selectImage')}
                        aria-label={t('settings.appearance.selectImage')}
                        onClick={() => void chooseBackground()}
                      >
                        <FolderOpen />
                      </button>
                      {settings.backgroundImage && (
                        <button
                          type="button"
                          className="path-clear-button"
                          title={t('settings.appearance.removeImage')}
                          aria-label={t('settings.appearance.removeImage')}
                          onClick={() => {
                            setBackgroundPathDraft('');
                            settings.setBackgroundImage(null);
                          }}
                        >
                          <X />
                        </button>
                      )}
                    </div>
                  </SettingRow>
                  <SettingRow
                    title={t('settings.appearance.backgroundOpacity')}
                    hint={t('settings.appearance.backgroundOpacityHint')}
                    icon={<Image />}
                  >
                    <RangeControl
                      value={settings.backgroundOpacity}
                      min={0}
                      max={1}
                      step={0.05}
                      unit="%"
                      onChange={settings.setBackgroundOpacity}
                    />
                  </SettingRow>
                  <SettingRow
                    title={t('settings.appearance.glassBlur')}
                    hint={t('settings.appearance.glassBlurHint')}
                    icon={<SlidersHorizontal />}
                  >
                    <RangeControl
                      value={settings.glassBlur}
                      min={0}
                      max={40}
                      step={1}
                      unit="px"
                      onChange={settings.setGlassBlur}
                    />
                  </SettingRow>
                  <SettingRow
                    title={t('settings.appearance.glassOpacity')}
                    hint={t('settings.appearance.glassOpacityHint')}
                    icon={<SlidersHorizontal />}
                  >
                    <RangeControl
                      value={settings.glassOpacity}
                      min={0}
                      max={1}
                      step={0.05}
                      unit="%"
                      onChange={settings.setGlassOpacity}
                    />
                  </SettingRow>
                </div>
              )}

              {section === 'storage' && (
                <div className="settings-page">
                  <div className="settings-page-heading">
                    <small>{t('settings.sections.storage').toUpperCase()}</small>
                    <h3>{t('settings.sections.storage')}</h3>
                    <p>{t('settings.storage.description')}</p>
                  </div>
                  <SettingRow
                    title={t('settings.storage.downloadPath')}
                    hint={t('settings.storage.downloadHint')}
                    icon={<Download />}
                  >
                    <div className="path-setting">
                      <input
                        value={downloadPathDraft}
                        onChange={(event) => setDownloadPathDraft(event.target.value)}
                        onBlur={() =>
                          settings.setDefaultDownloadPath(
                            downloadPathDraft === storagePaths?.defaultDownloadPath
                              ? null
                              : downloadPathDraft || null,
                          )
                        }
                      />
                      <button type="button" onClick={() => void chooseDirectory('download')}>
                        <FolderOpen />
                      </button>
                    </div>
                  </SettingRow>
                  <SettingRow
                    title={t('settings.storage.dataPath')}
                    hint={
                      storagePaths?.portableMode
                        ? t('settings.storage.portableDataHint')
                        : t('settings.storage.dataHint')
                    }
                    icon={<Database />}
                  >
                    <div className="path-setting">
                      <input
                        value={dataPathDraft}
                        disabled={storagePaths?.portableMode}
                        onChange={(event) => setDataPathDraft(event.target.value)}
                        onBlur={() =>
                          settings.setDefaultDataPath(
                            dataPathDraft === storagePaths?.defaultDataPath
                              ? null
                              : dataPathDraft || null,
                          )
                        }
                      />
                      <button
                        type="button"
                        disabled={storagePaths?.portableMode}
                        onClick={() => void chooseDirectory('data')}
                      >
                        <FolderOpen />
                      </button>
                    </div>
                  </SettingRow>
                  <SettingRow
                    title={t('settings.storage.vaultPassword')}
                    hint={t('settings.storage.backupPasswordPurpose')}
                    icon={<KeyRound />}
                    className="setting-row--backup-password"
                  >
                    <div className="shared-backup-passwords">
                      <label className="vault-field backup-password-field">
                        <span>{t('settings.storage.vaultPasswordInput')}</span>
                        <input
                          type="password"
                          autoComplete="new-password"
                          aria-label={t('settings.storage.vaultPasswordInput')}
                          value={portablePassword}
                          onChange={(event) => setPortablePassword(event.target.value)}
                          placeholder={t('settings.storage.vaultPasswordPlaceholder')}
                        />
                      </label>
                      <label className="vault-field backup-password-field">
                        <span>{t('settings.storage.vaultPasswordConfirm')}</span>
                        <input
                          type="password"
                          autoComplete="new-password"
                          aria-label={t('settings.storage.vaultPasswordConfirm')}
                          value={portablePasswordConfirm}
                          onChange={(event) => setPortablePasswordConfirm(event.target.value)}
                          placeholder={t('settings.storage.vaultPasswordConfirmPlaceholder')}
                        />
                      </label>
                      <div className="backup-password-footer">
                        {vaultStatus?.backupPasswordSaved && (
                          <span className="backup-password-saved-state">
                            <Check />
                            {t('settings.storage.backupPasswordStoredOnWindows')}
                          </span>
                        )}
                        <button
                          type="button"
                          className="primary-button backup-password-save"
                          disabled={isSavingBackupPassword || !portablePassword || !vaultStatus}
                          onClick={requestBackupPasswordSave}
                        >
                          <Save />
                          {t('settings.storage.backupPasswordSave')}
                        </button>
                      </div>
                    </div>
                  </SettingRow>
                  <div className="encrypted-backup-card">
                    <div>
                      <strong>{t('settings.storage.backup')}</strong>
                      <p>{t('settings.storage.backupHint')}</p>
                    </div>
                    <div className="settings-button-row">
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => void exportConfig()}
                      >
                        <Download />
                        {t('settings.storage.export')}
                      </button>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => void importConfig()}
                      >
                        <Upload />
                        {t('settings.storage.import')}
                      </button>
                    </div>
                  </div>
                  <VaultSyncPanel
                    backupPassword={portablePassword}
                    confirmPassword={portablePasswordConfirm}
                    onSecretsSaved={() => {
                      setPortablePassword('');
                      setPortablePasswordConfirm('');
                    }}
                    onRestored={async () => {
                      await Promise.all([settings.hydrateSettings(), loadHosts()]);
                    }}
                  />
                </div>
              )}

              {section === 'about' && (
                <div className="settings-page settings-about">
                  <div className="about-mark">SY</div>
                  <h3>{appInfo?.name ?? 'SY-TFM'}</h3>
                  <p>{t('settings.about.subtitle')}</p>
                  <dl>
                    <div>
                      <dt>{t('settings.about.version')}</dt>
                      <dd>{appInfo?.version ?? '1.0.0'}</dd>
                    </div>
                    <div>
                      <dt>{t('settings.about.developer')}</dt>
                      <dd>{appInfo?.developer ?? 'Sheepyu'}</dd>
                    </div>
                    <div>
                      <dt>{t('settings.about.license')}</dt>
                      <dd>{appInfo?.license ?? 'MIT'}</dd>
                    </div>
                  </dl>
                  <a
                    href={appInfo?.githubUrl ?? 'https://github.com/ygq-future/SY-TFM'}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(event) => {
                      event.preventDefault();
                      const projectUrl =
                        appInfo?.githubUrl ?? 'https://github.com/ygq-future/SY-TFM';
                      void openUrl(projectUrl).catch((error: unknown) => {
                        toast.error(formatAppError(error));
                      });
                    }}
                  >
                    GitHub <ExternalLink />
                  </a>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
      {isBackupPasswordReviewPending && (
        <ConfirmDialog
          title={t('settings.storage.backupPasswordReviewTitle')}
          message={
            <div className="backup-password-review">
              <p>{t('settings.storage.backupPasswordReviewIntro')}</p>
              <div className="backup-password-review-card">
                <span>{t('settings.storage.backupPasswordReviewExact')}</span>
                <div className="backup-password-review-value">
                  <i aria-hidden="true">“</i>
                  <code>{backupPasswordReview.raw}</code>
                  <i aria-hidden="true">”</i>
                </div>
                <div className="backup-password-review-meta">
                  <span>
                    {t('settings.storage.backupPasswordReviewCharacters', {
                      count: backupPasswordReview.characterCount,
                    })}
                  </span>
                  <span>
                    {t('settings.storage.backupPasswordReviewWhitespace', {
                      count: backupPasswordReview.whitespaceCount,
                    })}
                  </span>
                </div>
              </div>
              {backupPasswordReview.whitespaceCount > 0 && (
                <div className="backup-password-whitespace-warning">
                  <strong>{t('settings.storage.backupPasswordWhitespaceTitle')}</strong>
                  <code>{backupPasswordReview.visualized}</code>
                  <small>{t('settings.storage.backupPasswordWhitespaceLegend')}</small>
                  {backupPasswordReview.hasBoundaryWhitespace && (
                    <small>{t('settings.storage.backupPasswordBoundaryWhitespace')}</small>
                  )}
                </div>
              )}
              {vaultStatus?.backupPasswordSaved && (
                <p className="backup-password-change-warning">
                  {t('settings.storage.backupPasswordChangeWarning')}
                </p>
              )}
              <small className="backup-password-review-privacy">
                {t('settings.storage.backupPasswordReviewPrivacy')}
              </small>
            </div>
          }
          confirmLabel={t(
            vaultStatus?.backupPasswordSaved
              ? 'settings.storage.backupPasswordChangeConfirm'
              : 'settings.storage.backupPasswordReviewConfirm',
          )}
          danger={vaultStatus?.backupPasswordSaved}
          onConfirm={() => void persistBackupPassword()}
          onCancel={() => setIsBackupPasswordReviewPending(false)}
        />
      )}
    </ModalPortal>
  );
}
