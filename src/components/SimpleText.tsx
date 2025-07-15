import React from 'react';
import { Text as RNText, TextProps as RNTextProps, TextStyle } from 'react-native';

interface SimpleTextProps extends RNTextProps {
  variant?: 'h1' | 'h2' | 'h3' | 'body' | 'caption';
  color?: string;
  size?: number;
  weight?: 'normal' | 'bold' | '500' | '600';
}

export const SimpleText: React.FC<SimpleTextProps> = ({
  variant = 'body',
  color = '#1f2937',
  size,
  weight,
  style,
  children,
  ...props
}) => {
  const getTextStyle = (): TextStyle => {
    const baseStyle: TextStyle = {
      color,
      fontWeight: weight || 'normal',
    };

    if (size) {
      baseStyle.fontSize = size;
      return baseStyle;
    }

    switch (variant) {
      case 'h1':
        return {
          ...baseStyle,
          fontSize: 32,
          fontWeight: weight || 'bold',
        };
      case 'h2':
        return {
          ...baseStyle,
          fontSize: 28,
          fontWeight: weight || 'bold',
        };
      case 'h3':
        return {
          ...baseStyle,
          fontSize: 24,
          fontWeight: weight || '600',
        };
      case 'body':
        return {
          ...baseStyle,
          fontSize: 16,
        };
      case 'caption':
        return {
          ...baseStyle,
          fontSize: 14,
          color: color === '#1f2937' ? '#6b7280' : color,
        };
      default:
        return baseStyle;
    }
  };

  return (
    <RNText style={[getTextStyle(), style]} {...props}>
      {children}
    </RNText>
  );
};