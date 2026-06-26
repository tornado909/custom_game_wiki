export type DotaLanguage =
  | 'english'
  | 'russian';

export const dotaLanguages: readonly DotaLanguage[] = [
  'english',
  'russian',
];

export const isDotaLanguage = (value: string): value is DotaLanguage =>
  dotaLanguages.includes(value as any);

export interface LanguageData {
  code: string;
  english: string;
  native: string;
}

// https://partner.steamgames.com/doc/store/localization#supported_languages
export const dotaLanguagesData: Record<DotaLanguage, LanguageData> = {
  english: { code: 'en', english: 'English', native: 'English' },
  russian: { code: 'ru', english: 'Russian', native: 'Русский' },
};
