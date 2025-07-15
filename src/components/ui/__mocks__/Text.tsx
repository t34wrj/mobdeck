import React from 'react';
import { Text as RNText, TextProps as RNTextProps } from 'react-native';

export interface TextProps extends RNTextProps {
  variant?: any;
  color?: any;
  size?: any;
  weight?: any;
  align?: any;
}

export const Text: React.FC<TextProps> = ({
  children,
  accessibilityLabel,
  ...props
}) => {
  return (
    <RNText
      {...props}
      accessibilityLabel={
        accessibilityLabel ||
        (typeof children === 'string' ? children : undefined)
      }
    >
      {children}
    </RNText>
  );
};
