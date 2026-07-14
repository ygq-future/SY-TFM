import { create } from 'zustand';
import type { Language } from '../types/enums/Language';
import type { Theme } from '../types/enums/Theme';

/** 设置状态（骨架，完整实现见 Phase 1 任务 1.23）。 */
interface SettingsState {
  /** 主题 */
  theme: Theme;
  /** 语言 */
  language: Language;
  /** 设置主题 */
  setTheme: (theme: Theme) => void;
  /** 设置语言 */
  setLanguage: (language: Language) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: 'system',
  language: 'en',
  setTheme: (theme) => set({ theme }),
  setLanguage: (language) => set({ language }),
}));
