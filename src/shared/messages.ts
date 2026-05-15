import type { LibInfo } from './types';

export type ColorFamily = 'Blue' | 'Green' | 'Yellow' | 'Red' | 'Purple' | 'Orange';

export type MainToUiMessage =
  | { type: 'phase-private-colors' }
  | { type: 'phase-main-lib'; info: LibInfo }
  | { type: 'lib-error'; message: string; missingCollections?: string[] }
  | { type: 'generate-done'; varCount: number }
  | { type: 'generate-error'; message: string };

export type UiToMainMessage =
  | { type: 'close' }
  | { type: 'generate-private-colors'; brandName: string; brandHex: string; colorOverrides?: Partial<Record<ColorFamily, string>> };
