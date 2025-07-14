export const colors = {
  // Primary colors - Giants Orange (FE5D26)
  primary: {
    50: '#fff5f0',
    100: '#ffe6db',
    200: '#fec7b3',
    300: '#fea58a',
    400: '#fe8361',
    500: '#fe5d26',
    600: '#e54a1f',
    700: '#c63c1a',
    800: '#a73016',
    900: '#882612',
  },

  // Secondary colors - Xanthous (F9BD4D)
  secondary: {
    50: '#fffaf0',
    100: '#fef2d9',
    200: '#fde2b0',
    300: '#fcd187',
    400: '#fac05e',
    500: '#f9bd4d',
    600: '#e0a844',
    700: '#c7943c',
    800: '#ae8033',
    900: '#956c2b',
  },

  // Accent colors - Tiffany Blue (7DE2D1)
  accent: {
    50: '#f0fdfa',
    100: '#d9fbf5',
    200: '#b3f7ea',
    300: '#8df3df',
    400: '#67efd4',
    500: '#7de2d1',
    600: '#4dd4c0',
    700: '#3cb8a6',
    800: '#329b8b',
    900: '#297e71',
  },

  // Dark colors - Yale Blue (083D77) - primary reference at 500
  dark: {
    50: '#f0f4f9',
    100: '#d9e2f0',
    200: '#b3c5e1',
    300: '#8da8d2',
    400: '#678bc3',
    500: '#083d77', // Yale Blue - now the primary reference
    600: '#073563',
    700: '#062c52',
    800: '#051f3d',
    900: '#041829',
  },

  // Success colors - Castleton Green (0B5739)
  success: {
    50: '#f0f7f4',
    100: '#d9ebe2',
    200: '#b3d7c5',
    300: '#8dc3a8',
    400: '#67af8b',
    500: '#419b6e',
    600: '#2b8155',
    700: '#0b5739',
    800: '#094a30',
    900: '#073d27',
  },

  // Error colors - Warm red that complements the palette
  error: {
    50: '#fef4f2',
    100: '#fde8e4',
    200: '#fbd5cc',
    300: '#f7b8a7',
    400: '#f18971',
    500: '#e8603c',
    600: '#d54e2a',
    700: '#b8431f',
    800: '#9a381a',
    900: '#7e2f16',
  },

  // Warning colors - Using Xanthous yellow
  warning: {
    50: '#fffaf0',
    100: '#fef2d9',
    200: '#fde2b0',
    300: '#fcd187',
    400: '#fac05e',
    500: '#f9bd4d',
    600: '#e0a844',
    700: '#c7943c',
    800: '#ae8033',
    900: '#956c2b',
  },

  // Info colors - Using Tiffany Blue
  info: {
    50: '#f0fdfa',
    100: '#d9fbf5',
    200: '#b3f7ea',
    300: '#8df3df',
    400: '#67efd4',
    500: '#7de2d1',
    600: '#4dd4c0',
    700: '#3cb8a6',
    800: '#329b8b',
    900: '#297e71',
  },

  // Neutral colors - Based on Yale Blue for consistency
  neutral: {
    50: '#f8f9fa',
    100: '#f1f3f5',
    200: '#e9ecef',
    300: '#dee2e6',
    400: '#ced4da',
    500: '#adb5bd',
    600: '#6c757d',
    700: '#495057',
    800: '#343a40',
    900: '#212529',
  },
};

export const typography = {
  fontFamily: {
    regular: 'sans-serif',
    medium: 'sans-serif',
    bold: 'sans-serif',
  },

  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
    '5xl': 48,
  },

  lineHeight: {
    xs: 16,
    sm: 20,
    base: 24,
    lg: 28,
    xl: 32,
    '2xl': 36,
    '3xl': 40,
    '4xl': 44,
    '5xl': 56,
  },

  fontWeight: {
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
};

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  9: 36,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
  24: 96,
  32: 128,
  40: 160,
  48: 192,
  56: 224,
  64: 256,
};

export const accessibility = {
  // WCAG 2.1 AA minimum touch target sizes
  minTouchTarget: {
    width: 44,
    height: 44,
  },
  
  // Font size scaling support
  fontScale: {
    min: 0.85,
    max: 2.0,
    default: 1.0,
  },
  
  // High contrast mode colors (automatically used when system setting is enabled)
  highContrast: {
    text: '#000000',
    background: '#ffffff', 
    border: '#000000',
    accent: '#0000ff',
  },
};

export const borderRadius = {
  none: 0,
  sm: 4,
  base: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  full: 9999,
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.18,
    shadowRadius: 1.0,
    elevation: 1,
  },
  base: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.23,
    shadowRadius: 2.62,
    elevation: 4,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.37,
    shadowRadius: 7.49,
    elevation: 12,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.51,
    shadowRadius: 13.16,
    elevation: 20,
  },
};

/**
 * Mobdeck design system theme object containing all design tokens
 * 
 * Provides a comprehensive design system with:
 * - Color palette with semantic color scales
 * - Typography system with font sizes, weights, and line heights  
 * - Spacing scale for consistent layout
 * - Border radius values
 * - Shadow/elevation styles
 * 
 * @example
 * ```tsx
 * import { theme } from './theme';
 * 
 * const styles = {
 *   container: {
 *     backgroundColor: theme.colors.primary[500],
 *     padding: theme.spacing[4],
 *     borderRadius: theme.borderRadius.md,
 *   },
 *   text: {
 *     fontSize: theme.typography.fontSize.lg,
 *     fontWeight: theme.typography.fontWeight.semibold,
 *   }
 * };
 * ```
 */
export const theme = {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  accessibility,
};

export type Theme = typeof theme;
export type ThemeColors = typeof colors;
export type ThemeSpacing = typeof spacing;
export type ThemeBorderRadius = typeof borderRadius;
