import React from 'react';
import {
  TouchableOpacity,
  TouchableOpacityProps,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
  View,
} from 'react-native';
import { Text } from './Text';
import { theme } from './theme';

/**
 * Props for the Button component
 */
export interface ButtonProps extends Omit<TouchableOpacityProps, 'style'> {
  /** Button visual variant */
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  /** Button size */
  size?: 'sm' | 'md' | 'lg';
  /** Show loading spinner */
  loading?: boolean;
  /** Disable button interaction */
  disabled?: boolean;
  /** Icon to display on the left side */
  leftIcon?: React.ReactNode;
  /** Icon to display on the right side */
  rightIcon?: React.ReactNode;
  /** Custom button container styles */
  style?: ViewStyle | ViewStyle[];
  /** Custom text styles */
  textStyle?: TextStyle | TextStyle[];
  /** Button content */
  children: React.ReactNode;
  /** Make button take full width */
  fullWidth?: boolean;
}

const getButtonStyles = (
  variant: NonNullable<ButtonProps['variant']>,
  size: NonNullable<ButtonProps['size']>,
  disabled: boolean,
  fullWidth: boolean
): { container: ViewStyle; text: TextStyle } => {
  const baseContainer: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.base,
    ...(fullWidth && { alignSelf: 'stretch' }),
  };

  const baseText: TextStyle = {
    fontWeight: theme.typography.fontWeight.medium,
  };

  // Size styles
  const sizeStyles = {
    sm: {
      container: {
        paddingHorizontal: theme.spacing[3],
        paddingVertical: theme.spacing[2],
        minHeight: 32,
      },
      text: {
        fontSize: theme.typography.fontSize.sm,
        lineHeight: theme.typography.lineHeight.sm,
      },
    },
    md: {
      container: {
        paddingHorizontal: theme.spacing[4],
        paddingVertical: theme.spacing[3],
        minHeight: 40,
      },
      text: {
        fontSize: theme.typography.fontSize.base,
        lineHeight: theme.typography.lineHeight.base,
      },
    },
    lg: {
      container: {
        paddingHorizontal: theme.spacing[6],
        paddingVertical: theme.spacing[4],
        minHeight: 48,
      },
      text: {
        fontSize: theme.typography.fontSize.lg,
        lineHeight: theme.typography.lineHeight.lg,
      },
    },
  };

  // Variant styles
  const variantStyles = {
    primary: {
      container: {
        backgroundColor: disabled
          ? theme.colors.neutral[300]
          : theme.colors.primary[500],
        ...theme.shadows.sm,
      },
      text: {
        color: disabled ? theme.colors.neutral[500] : theme.colors.neutral[50],
      },
    },
    secondary: {
      container: {
        backgroundColor: disabled
          ? theme.colors.neutral[200]
          : theme.colors.secondary[500],
        ...theme.shadows.sm,
      },
      text: {
        color: disabled ? theme.colors.neutral[500] : theme.colors.neutral[50],
      },
    },
    outline: {
      container: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: disabled
          ? theme.colors.neutral[300]
          : theme.colors.primary[500],
      },
      text: {
        color: disabled ? theme.colors.neutral[400] : theme.colors.primary[500],
      },
    },
    ghost: {
      container: {
        backgroundColor: 'transparent',
      },
      text: {
        color: disabled ? theme.colors.neutral[400] : theme.colors.primary[500],
      },
    },
    destructive: {
      container: {
        backgroundColor: disabled
          ? theme.colors.neutral[300]
          : theme.colors.error[500],
        ...theme.shadows.sm,
      },
      text: {
        color: disabled ? theme.colors.neutral[500] : theme.colors.neutral[50],
      },
    },
  };

  return {
    container: {
      ...baseContainer,
      ...sizeStyles[size].container,
      ...variantStyles[variant].container,
    },
    text: {
      ...baseText,
      ...sizeStyles[size].text,
      ...variantStyles[variant].text,
    },
  };
};

/**
 * Reusable Button component with multiple variants and sizes
 *
 * @param props - Button component props
 * @returns Rendered button component
 *
 * @example
 * ```tsx
 * <Button variant="primary" size="md" onPress={() => console.log('Pressed')}>
 *   Save Article
 * </Button>
 *
 * <Button variant="outline" loading={true}>
 *   Loading...
 * </Button>
 * ```
 */
export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  leftIcon,
  rightIcon,
  style,
  textStyle,
  children,
  fullWidth = false,
  accessibilityLabel,
  accessibilityHint,
  onPress,
  ...props
}) => {
  const isDisabled = disabled || loading;
  const styles = getButtonStyles(variant, size, isDisabled, fullWidth);

  const handlePress = (event: any) => {
    if (!isDisabled && onPress) {
      onPress(event);
    }
  };

  const getLoadingColor = (): string => {
    if (variant === 'outline' || variant === 'ghost') {
      return theme.colors.primary[500];
    }
    return theme.colors.neutral[50];
  };

  const iconSpacing = size === 'sm' ? theme.spacing[1] : theme.spacing[2];

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={handlePress}
      disabled={isDisabled}
      accessibilityRole='button'
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{
        disabled: isDisabled,
        busy: loading,
      }}
      activeOpacity={0.7}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size={size === 'sm' ? 'small' : 'small'}
          color={getLoadingColor()}
        />
      ) : (
        <>
          {leftIcon && (
            <View style={{ marginRight: iconSpacing }}>{leftIcon}</View>
          )}

          <Text
            style={[styles.text, textStyle]}
            numberOfLines={1}
            ellipsizeMode='tail'
          >
            {children}
          </Text>

          {rightIcon && (
            <View style={{ marginLeft: iconSpacing }}>{rightIcon}</View>
          )}
        </>
      )}
    </TouchableOpacity>
  );
};
