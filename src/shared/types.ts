export type ThemeVariant = 'light' | 'dark' | 'lightHc' | 'darkHc';

export type AppearanceMode = 'Light' | 'Dark' | 'Light HC' | 'Dark HC';

export interface RGB {
  r: number; // 0..1
  g: number;
  b: number;
}

export interface ThemeBackgroundPair {
  primary: RGB;
  contrasting: RGB;
}

export interface LibInfo {
  existingBrands: string[];
  brandModeCount: number;
  themeBackgrounds: Record<AppearanceMode, ThemeBackgroundPair>;
  /** true if Private Colors collection exists locally; false = it's in an external file */
  privateColorsLocal: boolean;
  collectionIds: {
    privateColors: string | null;
    appearance: string;
    brand: string;
  };
  appearanceModes: Array<{ modeId: string; name: string }>;
}

export interface GeneratedBrand {
  name: string;
  brandColor: string;
  privateColors: Record<AppearanceMode, Record<string, RGB>>;
}
