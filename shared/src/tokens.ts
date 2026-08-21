/**
 * Vivid Pulse — la ÚNICA fuente de los tokens de marca (spec §2.1).
 *
 * Valores extraídos del design system del proyecto Stitch
 * (`assets/78ffeb6efbad4591b2dcc89131e1c5f5`), no inventados. De acá salen:
 * - `web/`: el puente a las variables CSS de shadcn (se genera en F6).
 * - `app/`: el `tailwind.config` de NativeWind.
 *
 * Regla dura: ningún componente escribe un hex. Si un color no está acá, no
 * existe.
 */
export const vividPulse = {
  colors: {
    light: {
      primary: '#6b38d4',
      primaryContainer: '#8455ef',
      /** Base de marca del design system (overridePrimaryColor). */
      brandPrimary: '#8b5cf6',
      secondary: '#0058be',
      brandSecondary: '#3b82f6',
      tertiary: '#a12e70',
      brandTertiary: '#f472b6',
      neutral: '#64748b',
      background: '#f8f9ff',
      surfaceContainerLowest: '#ffffff',
      surfaceVariant: '#d3e4fe',
      onSurface: '#0b1c30',
      onSurfaceVariant: '#494454',
      outline: '#7b7486',
      error: '#ba1a1a',
      onPrimary: '#ffffff',
    },
    dark: {
      /** Navy, nunca negro puro: el glass necesita profundidad (spec §2.1). */
      background: '#0f172a',
      inversePrimary: '#d0bcff',
    },
  },
  typography: {
    /** Inter única — el design system no usa Plus Jakarta Sans. */
    fontFamily: 'Inter',
    display: { size: 48, weight: '700', lineHeight: 56, letterSpacing: -0.02 },
    headlineLg: { size: 32, weight: '600', lineHeight: 40, letterSpacing: -0.01 },
    headlineLgMobile: { size: 24, weight: '600', lineHeight: 32 },
    titleMd: { size: 18, weight: '600', lineHeight: 24 },
    bodyLg: { size: 16, weight: '400', lineHeight: 24 },
    bodyMd: { size: 14, weight: '400', lineHeight: 20 },
    labelMd: { size: 12, weight: '500', lineHeight: 16, letterSpacing: 0.01 },
  },
  radius: {
    sm: 4,
    md: 12,
    lg: 16,
    xl: 24,
    /** Esquina-cola de la burbuja de chat: apunta al emisor. */
    bubbleTail: 4,
    full: 9999,
  },
  spacing: {
    unit: 4,
    /** Mensajes consecutivos del MISMO emisor. */
    stackSameSender: 8,
    /** Cambio de emisor o de bloque. */
    stackNewSender: 16,
    gutter: 16,
    marginMobile: 16,
    marginDesktop: 40,
  },
  /** Área táctil mínima en toda superficie (spec §2.1). */
  minTouchTarget: 44,
} as const;

export type VividPulseTokens = typeof vividPulse;
