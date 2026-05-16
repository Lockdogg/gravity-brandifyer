export type ThemeVariant = 'light' | 'dark' | 'lightHc' | 'darkHc';

export type AppearanceMode = 'Light' | 'Dark' | 'Light HC' | 'Dark HC';

export interface RGB {
  r: number; // 0..1
  g: number;
  b: number;
}

export interface RGBA extends RGB {
  a: number; // 0..1
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
  /** File names of connected "Private Colors" libraries */
  connectedPrivateColorLibs: string[];
}

// key = variable name suffix: "50", "100 Solid", "550 Solid", etc.
export interface GeneratedBrand {
  name: string;
  brandColor: string;
  brandScale: Record<AppearanceMode, Record<string, RGBA>>;
}
