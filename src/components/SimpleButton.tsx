import React from 'react';
import { TouchableOpacity, TouchableOpacityProps, Text, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';

interface SimpleButtonProps extends TouchableOpacityProps {
  title?: string;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  textStyle?: TextStyle;
  fullWidth?: boolean;
  children?: React.ReactNode;
}

export const SimpleButton: React.FC<SimpleButtonProps> = ({
  title,
  loading = false,
  variant = 'primary',
  size = 'md',
  style,
  textStyle,
  disabled,
  fullWidth = false,
  children,
  ...props
}) => {
  const isDisabled = disabled || loading;

  const getButtonStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      paddingHorizontal: size === 'sm' ? 12 : size === 'lg' ? 24 : 16,
      paddingVertical: size === 'sm' ? 8 : size === 'lg' ? 16 : 12,
      minHeight: size === 'sm' ? 32 : size === 'lg' ? 48 : 40,
      width: fullWidth ? '100%' : undefined,
    };

    switch (variant) {
      case 'primary':
        return {
          ...baseStyle,
          backgroundColor: isDisabled ? '#d1d5db' : '#FE5D26',
        };
      case 'secondary':
        return {
          ...baseStyle,
          backgroundColor: isDisabled ? '#d1d5db' : '#F9BD4D',
        };
      case 'outline':
        return {
          ...baseStyle,
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: isDisabled ? '#d1d5db' : '#FE5D26',
        };
      case 'ghost':
        return {
          ...baseStyle,
          backgroundColor: 'transparent',
        };
      default:
        return baseStyle;
    }
  };

  const getTextStyle = (): TextStyle => {
    const baseStyle: TextStyle = {
      fontSize: size === 'sm' ? 14 : size === 'lg' ? 18 : 16,
      fontWeight: '500',
    };

    switch (variant) {
      case 'primary':
      case 'secondary':
        return {
          ...baseStyle,
          color: isDisabled ? '#6b7280' : '#ffffff',
        };
      case 'outline':
      case 'ghost':
        return {
          ...baseStyle,
          color: isDisabled ? '#6b7280' : '#FE5D26',
        };
      default:
        return baseStyle;
    }
  };

  return (
    <TouchableOpacity
      style={[getButtonStyle(), style]}
      disabled={isDisabled}
      activeOpacity={0.7}
      {...props}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'primary' || variant === 'secondary' ? '#ffffff' : '#FE5D26'} />
      ) : (
        children || (title && <Text style={[getTextStyle(), textStyle]}>{title}</Text>)
      )}
    </TouchableOpacity>
  );
};