export type ThemeVariant = 'light' | 'dark' | 'lightHc' | 'darkHc';

export interface ThemeBackgrounds {
  primary: string;
  contrasting: string;
}

export interface GeneratedBrand {
  name: string;
  brandColor: string;
  privateColors: Record<ThemeVariant, Record<string, string>>;
}
