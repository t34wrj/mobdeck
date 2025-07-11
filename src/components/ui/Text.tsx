import React from 'react';
import {
  Text as RNText,
  TextProps as RNTextProps,
  TextStyle,
} from 'react-native';
import { theme } from './theme';

/**
 * Props for the Text component
 */
export interface TextProps extends Omit<RNTextProps, 'style'> {
  /** Typography variant for predefined styles */
  variant?:
    | 'h1'
    | 'h2'
    | 'h3'
    | 'h4'
    | 'h5'
    | 'h6'
    | 'body1'
    | 'body2'
    | 'caption'
    | 'overline';
  /** Text color from theme or custom color */
  color?: keyof typeof theme.colors | string;
  /** Font size from theme scale */
  size?: keyof typeof theme.typography.fontSize;
  /** Font weight from theme scale */
  weight?: keyof typeof theme.typography.fontWeight;
  /** Text alignment */
  align?: 'left' | 'center' | 'right' | 'justify';
  /** Custom text styles */
  style?: TextStyle | TextStyle[];
  /** Maximum number of lines to display */
  numberOfLines?: number;
  /** Text truncation mode */
  ellipsizeMode?: 'head' | 'middle' | 'tail' | 'clip';
}

const variantStyles: Record<NonNullable<TextProps['variant']>, TextStyle> = {
  h1: {
    fontSize: theme.typography.fontSize['4xl'],
    lineHeight: theme.typography.lineHeight['4xl'],
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.neutral[900],
  },
  h2: {
    fontSize: theme.typography.fontSize['3xl'],
    lineHeight: theme.typography.lineHeight['3xl'],
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.neutral[900],
  },
  h3: {
    fontSize: theme.typography.fontSize['2xl'],
    lineHeight: theme.typography.lineHeight['2xl'],
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.neutral[900],
  },
  h4: {
    fontSize: theme.typography.fontSize.xl,
    lineHeight: theme.typography.lineHeight.xl,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.neutral[900],
  },
  h5: {
    fontSize: theme.typography.fontSize.lg,
    lineHeight: theme.typography.lineHeight.lg,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.neutral[900],
  },
  h6: {
    fontSize: theme.typography.fontSize.base,
    lineHeight: theme.typography.lineHeight.base,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.neutral[900],
  },
  body1: {
    fontSize: theme.typography.fontSize.base,
    lineHeight: theme.typography.lineHeight.base,
    fontWeight: theme.typography.fontWeight.normal,
    color: theme.colors.neutral[800],
  },
  body2: {
    fontSize: theme.typography.fontSize.sm,
    lineHeight: theme.typography.lineHeight.sm,
    fontWeight: theme.typography.fontWeight.normal,
    color: theme.colors.neutral[700],
  },
  caption: {
    fontSize: theme.typography.fontSize.xs,
    lineHeight: theme.typography.lineHeight.xs,
    fontWeight: theme.typography.fontWeight.normal,
    color: theme.colors.neutral[600],
  },
  overline: {
    fontSize: theme.typography.fontSize.xs,
    lineHeight: theme.typography.lineHeight.xs,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.neutral[600],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
};

const getColorValue = (color: string): string => {
  // Check if it's a theme color path (e.g., 'primary.500')
  if (color.includes('.')) {
    const [colorName, shade] = color.split('.');
    const colorGroup = theme.colors[colorName as keyof typeof theme.colors];
    if (colorGroup && typeof colorGroup === 'object') {
      return (colorGroup as any)[shade] || color;
    }
  }

  // Check if it's a direct theme color reference
  if (theme.colors[color as keyof typeof theme.colors]) {
    const colorValue = theme.colors[color as keyof typeof theme.colors];
    if (typeof colorValue === 'string') {
      return colorValue;
    }
    // If it's a color object, return the default (500) shade
    if (typeof colorValue === 'object' && (colorValue as any)[500]) {
      return (colorValue as any)[500];
    }
  }

  // Return as-is (could be a hex color, etc.)
  return color;
};

/**
 * Themed Text component with typography variants and customization options
 * 
 * @param props - Text component props
 * @returns Rendered text component with theme-based styling
 * 
 * @example
 * ```tsx
 * <Text variant="h1" color="primary">Main Title</Text>
 * <Text variant="body1" numberOfLines={2}>Article content...</Text>
 * <Text size="lg" weight="semibold" align="center">Custom styled text</Text>
 * ```
 */
export const Text: React.FC<TextProps> = ({
  variant = 'body1',
  color,
  size,
  weight,
  align,
  style,
  children,
  accessibilityLabel,
  accessibilityHint,
  numberOfLines,
  ellipsizeMode = 'tail',
  ...props
}) => {
  const variantStyle = variantStyles[variant];

  const textStyle: TextStyle = {
    ...variantStyle,
    ...(size && { fontSize: theme.typography.fontSize[size] }),
    ...(weight && { fontWeight: theme.typography.fontWeight[weight] }),
    ...(color && { color: getColorValue(color) }),
    ...(align && { textAlign: align }),
  };

  const combinedStyle = [textStyle, style];

  return (
    <RNText
      style={combinedStyle}
      accessibilityLabel={
        accessibilityLabel ||
        (typeof children === 'string' ? children : undefined)
      }
      accessibilityHint={accessibilityHint}
      accessibilityRole='text'
      numberOfLines={numberOfLines}
      ellipsizeMode={ellipsizeMode}
      {...props}
    >
      {children}
    </RNText>
  );
};
