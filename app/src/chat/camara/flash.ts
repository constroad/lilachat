export type FlashMode = 'off' | 'on' | 'auto';

export const NEXT_FLASH: Record<FlashMode, FlashMode> = { auto: 'on', on: 'off', off: 'auto' };
export const FLASH_LABEL: Record<FlashMode, string> = { auto: 'Auto', on: 'Sí', off: 'No' };
