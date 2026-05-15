export type MainToUiMessage =
  | { type: 'ready'; libInfo: { brandCount: number } };

export type UiToMainMessage =
  | { type: 'close' };
