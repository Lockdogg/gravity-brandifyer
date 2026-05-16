import type { LibInfo } from './types';

export type ColorFamily = 'Blue' | 'Green' | 'Yellow' | 'Red' | 'Purple' | 'Orange';

export type BrandCssEntry = { brandName: string; cssContent: string };

export type MainToUiMessage =
  | { type: 'phase-private-colors'; existingBrands: BrandCssEntry[] }
  | { type: 'phase-main-lib'; info: LibInfo }
  | { type: 'lib-error'; message: string; missingCollections?: string[] }
  | { type: 'generate-done'; varCount: number; cssContent: string; brandName: string }
  | { type: 'generate-error'; message: string }
  | { type: 'phase2-progress'; current: number; total: number }
  | { type: 'phase2-done'; brandName: string; varCount: number }
  | { type: 'phase2-error'; message: string };

export type UiToMainMessage =
  | { type: 'ui-ready' }
  | { type: 'close' }
  | { type: 'generate-private-colors'; brandName: string; brandHex: string; colorOverrides?: Partial<Record<ColorFamily, string>> }
  | { type: 'generate-phase2'; brandName: string; baseBrandName: string };
