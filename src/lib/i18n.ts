import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from '../locales/en.json';
import zh from '../locales/zh.json';

function initialLanguage(): 'zh' | 'en' {
  try {
    const stored =
      typeof localStorage === 'undefined' ? null : localStorage.getItem('sy-tfm-appearance-v2');
    const persisted = JSON.parse(stored ?? '{}') as {
      state?: { language?: string };
    };
    if (persisted.state?.language === 'zh' || persisted.state?.language === 'en') {
      return persisted.state.language;
    }
  } catch {
    // 无效的本地偏好交由后端配置覆盖。
  }
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('zh')
    ? 'zh'
    : 'en';
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    zh: { translation: zh },
  },
  lng: initialLanguage(),
  fallbackLng: 'en',
  supportedLngs: ['zh', 'en'],
  showSupportNotice: false,
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
