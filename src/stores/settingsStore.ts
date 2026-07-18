import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Language } from '../types/enums/Language';
import type { Theme } from '../types/enums/Theme';
import type { AppSettings } from '../types/generated/AppSettings';
import * as tauri from '../lib/tauri';

/** 界面只提供明确的亮色和暗色模式。 */
export type AppearanceTheme = Exclude<Theme, 'system'>;

/** 全局强调色方案；每套方案在亮暗主题下拥有独立表现。 */
export type AccentColor =
  | 'violet'
  | 'blue'
  | 'cyan'
  | 'rose'
  | 'emerald'
  | 'amber'
  | 'orange'
  | 'indigo'
  | 'teal'
  | 'graphite';

export const ACCENT_COLORS: ReadonlyArray<{ value: AccentColor; labelKey: string }> = [
  { value: 'violet', labelKey: 'settings.appearance.accents.violet' },
  { value: 'blue', labelKey: 'settings.appearance.accents.blue' },
  { value: 'cyan', labelKey: 'settings.appearance.accents.cyan' },
  { value: 'rose', labelKey: 'settings.appearance.accents.rose' },
  { value: 'emerald', labelKey: 'settings.appearance.accents.emerald' },
  { value: 'amber', labelKey: 'settings.appearance.accents.amber' },
  { value: 'orange', labelKey: 'settings.appearance.accents.orange' },
  { value: 'indigo', labelKey: 'settings.appearance.accents.indigo' },
  { value: 'teal', labelKey: 'settings.appearance.accents.teal' },
  { value: 'graphite', labelKey: 'settings.appearance.accents.graphite' },
];

const ACCENT_VALUES = new Set(ACCENT_COLORS.map(({ value }) => value));
let settingsWriteQueue = Promise.resolve();

function queueSettingsPatch(patch: Partial<AppSettings>): void {
  settingsWriteQueue = settingsWriteQueue
    .then(async () => {
      const current = await tauri.loadSettings();
      await tauri.saveSettings({ ...current, ...patch });
    })
    .catch(() => {
      // 浏览器预览没有 Tauri 后端，界面状态仍保存在 localStorage。
    });
}

function resolveTheme(theme: Theme): AppearanceTheme {
  if (theme !== 'system') return theme;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

interface SettingsState {
  theme: AppearanceTheme;
  language: Language;
  accentColor: AccentColor;
  backgroundImage: string | null;
  backgroundImageEnabled: boolean;
  backgroundOpacity: number;
  glassBlur: number;
  glassOpacity: number;
  fontSize: number;
  headingFontSize: number;
  labelFontSize: number;
  captionFontSize: number;
  dataFontSize: number;
  defaultDownloadPath: string | null;
  defaultDataPath: string | null;
  windowTopmost: boolean;
  hydrateSettings: () => Promise<void>;
  setTheme: (theme: AppearanceTheme) => void;
  setLanguage: (language: Language) => void;
  setAccentColor: (accentColor: AccentColor) => void;
  setBackgroundImage: (backgroundImage: string | null) => void;
  setBackgroundImageEnabled: (enabled: boolean) => void;
  setBackgroundOpacity: (opacity: number) => void;
  setGlassBlur: (blur: number) => void;
  setGlassOpacity: (opacity: number) => void;
  setFontSize: (fontSize: number) => void;
  setHeadingFontSize: (fontSize: number) => void;
  setLabelFontSize: (fontSize: number) => void;
  setCaptionFontSize: (fontSize: number) => void;
  setDataFontSize: (fontSize: number) => void;
  setDefaultDownloadPath: (path: string | null) => void;
  setDefaultDataPath: (path: string | null) => void;
  setWindowTopmost: (topmost: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'light',
      language: 'zh',
      accentColor: 'violet',
      backgroundImage: null,
      backgroundImageEnabled: true,
      backgroundOpacity: 0.3,
      glassBlur: 22,
      glassOpacity: 0.72,
      fontSize: 13,
      headingFontSize: 15,
      labelFontSize: 12,
      captionFontSize: 11,
      dataFontSize: 12,
      defaultDownloadPath: null,
      defaultDataPath: null,
      windowTopmost: false,
      hydrateSettings: async () => {
        try {
          const settings = await tauri.loadSettings();
          set({
            theme: resolveTheme(settings.theme),
            language: settings.language,
            accentColor: ACCENT_VALUES.has(settings.accentColor as AccentColor)
              ? (settings.accentColor as AccentColor)
              : 'violet',
            backgroundImage: settings.backgroundImagePath,
            backgroundImageEnabled: settings.backgroundImageEnabled,
            backgroundOpacity: settings.backgroundOpacity,
            glassBlur: settings.glassBlur,
            glassOpacity: settings.glassOpacity,
            fontSize: settings.fontSize,
            headingFontSize: settings.headingFontSize,
            labelFontSize: settings.labelFontSize,
            captionFontSize: settings.captionFontSize,
            dataFontSize: settings.dataFontSize,
            defaultDownloadPath: settings.defaultDownloadPath,
            defaultDataPath: settings.defaultDataPath,
            windowTopmost: settings.windowTopmost,
          });
        } catch {
          // 浏览器预览没有 Tauri 后端，保留本地偏好。
        }
      },
      setTheme: (theme) => {
        set({ theme });
        queueSettingsPatch({ theme });
      },
      setLanguage: (language) => {
        set({ language });
        queueSettingsPatch({ language });
      },
      setAccentColor: (accentColor) => {
        set({ accentColor });
        queueSettingsPatch({ accentColor });
      },
      setBackgroundImage: (backgroundImage) => {
        set({ backgroundImage });
        queueSettingsPatch({ backgroundImagePath: backgroundImage });
      },
      setBackgroundImageEnabled: (backgroundImageEnabled) => {
        set({ backgroundImageEnabled });
        queueSettingsPatch({ backgroundImageEnabled });
      },
      setBackgroundOpacity: (backgroundOpacity) => {
        const normalized = Math.min(1, Math.max(0, backgroundOpacity));
        set({ backgroundOpacity: normalized });
        queueSettingsPatch({ backgroundOpacity: normalized });
      },
      setGlassBlur: (glassBlur) => {
        const normalized = Math.min(40, Math.max(0, Math.round(glassBlur)));
        set({ glassBlur: normalized });
        queueSettingsPatch({ glassBlur: normalized });
      },
      setGlassOpacity: (glassOpacity) => {
        const normalized = Math.min(1, Math.max(0, glassOpacity));
        set({ glassOpacity: normalized });
        queueSettingsPatch({ glassOpacity: normalized });
      },
      setFontSize: (fontSize) => {
        const normalized = Math.min(18, Math.max(10, Math.round(fontSize)));
        set({ fontSize: normalized });
        queueSettingsPatch({ fontSize: normalized });
      },
      setHeadingFontSize: (headingFontSize) => {
        const normalized = Math.min(24, Math.max(12, Math.round(headingFontSize)));
        set({ headingFontSize: normalized });
        queueSettingsPatch({ headingFontSize: normalized });
      },
      setLabelFontSize: (labelFontSize) => {
        const normalized = Math.min(18, Math.max(10, Math.round(labelFontSize)));
        set({ labelFontSize: normalized });
        queueSettingsPatch({ labelFontSize: normalized });
      },
      setCaptionFontSize: (captionFontSize) => {
        const normalized = Math.min(16, Math.max(9, Math.round(captionFontSize)));
        set({ captionFontSize: normalized });
        queueSettingsPatch({ captionFontSize: normalized });
      },
      setDataFontSize: (dataFontSize) => {
        const normalized = Math.min(18, Math.max(10, Math.round(dataFontSize)));
        set({ dataFontSize: normalized });
        queueSettingsPatch({ dataFontSize: normalized });
      },
      setDefaultDownloadPath: (defaultDownloadPath) => {
        set({ defaultDownloadPath });
        queueSettingsPatch({ defaultDownloadPath });
      },
      setDefaultDataPath: (defaultDataPath) => {
        set({ defaultDataPath });
        queueSettingsPatch({ defaultDataPath });
      },
      setWindowTopmost: (windowTopmost) => {
        set({ windowTopmost });
        queueSettingsPatch({ windowTopmost });
      },
    }),
    {
      name: 'sy-tfm-appearance-v2',
      storage: createJSONStorage(() => localStorage),
      partialize: ({
        theme,
        language,
        accentColor,
        backgroundImage,
        backgroundImageEnabled,
        backgroundOpacity,
        glassBlur,
        glassOpacity,
        fontSize,
        headingFontSize,
        labelFontSize,
        captionFontSize,
        dataFontSize,
        defaultDownloadPath,
        defaultDataPath,
        windowTopmost,
      }) => ({
        theme,
        language,
        accentColor,
        backgroundImage,
        backgroundImageEnabled,
        backgroundOpacity,
        glassBlur,
        glassOpacity,
        fontSize,
        headingFontSize,
        labelFontSize,
        captionFontSize,
        dataFontSize,
        defaultDownloadPath,
        defaultDataPath,
        windowTopmost,
      }),
    },
  ),
);
