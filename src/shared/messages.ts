import type { LibInfo } from './types';

export type MainToUiMessage =
  | { type: 'phase-private-colors' }
  | { type: 'phase-main-lib'; info: LibInfo }
  | { type: 'lib-error'; message: string; missingCollections?: string[] };

export type UiToMainMessage =
  | { type: 'close' };
