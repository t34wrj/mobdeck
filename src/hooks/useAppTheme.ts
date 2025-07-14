import { useMemo } from 'react';

/**
 * Application theme interface defining color palette, spacing, and typography
 */
export interface AppTheme {
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    error: string;
    warning: string;
    success: string;
    info: string;
    border: string;
    divider: string;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  borderRadius: {
    sm: number;
    md: number;
    lg: number;
  };
  fontSize: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
}

const defaultTheme: AppTheme = {
  colors: {
    primary: '#FE5D26', // Giants Orange
    secondary: '#F9BD4D', // Xanthous
    background: '#FFFFFF', // White background
    surface: '#F8F9FA', // Light surface from neutral palette
    text: '#083D77', // Yale Blue for primary text
    textSecondary: '#6C757D', // Neutral gray for secondary text
    error: '#E8603C', // Warm red (kept from original)
    warning: '#F9BD4D', // Xanthous
    success: '#0B5739', // Castleton Green
    info: '#7DE2D1', // Tiffany Blue
    border: '#DEE2E6', // Light gray from neutral palette
    divider: '#CED4DA', // Medium gray from neutral palette
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 16,
  },
  fontSize: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 24,
  },
};

/**
 * Hook to access the application theme
 *
 * @returns AppTheme object with colors, spacing, and typography values
 * @example
 * ```tsx
 * const theme = useAppTheme();
 * const styles = {
 *   container: {
 *     backgroundColor: theme.colors.background,
 *     padding: theme.spacing.md,
 *   }
 * };
 * ```
 */
export const useAppTheme = (): AppTheme => {
  return useMemo(() => defaultTheme, []);
};
