/**
 * Tests for Text component
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from '../Text';

describe('Text', () => {
  it('should render text content', () => {
    const { getByText } = render(<Text>Hello World</Text>);

    expect(getByText('Hello World')).toBeTruthy();
  });

  it('should use body1 variant by default', () => {
    const { getByText } = render(<Text>Default text</Text>);

    expect(getByText('Default text')).toBeTruthy();
  });

  describe('Variants', () => {
    const variants = [
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'body1',
      'body2',
      'caption',
      'overline',
    ] as const;

    variants.forEach(variant => {
      it(`should render ${variant} variant`, () => {
        const { getByText } = render(
          <Text variant={variant}>{variant} text</Text>
        );

        expect(getByText(`${variant} text`)).toBeTruthy();
      });
    });
  });

  describe('Color', () => {
    it('should apply custom color', () => {
      const { getByText } = render(<Text color='red'>Red text</Text>);

      const textElement = getByText('Red text');
      expect(textElement.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            color: 'red',
          }),
        ])
      );
    });

    it('should handle theme color references', () => {
      const { getByText } = render(
        <Text color='primary'>Primary color text</Text>
      );

      expect(getByText('Primary color text')).toBeTruthy();
    });

    it('should handle theme color with shade notation', () => {
      const { getByText } = render(
        <Text color='primary.500'>Primary 500 text</Text>
      );

      expect(getByText('Primary 500 text')).toBeTruthy();
    });
  });

  describe('Size', () => {
    it('should apply custom size', () => {
      const { getByText } = render(<Text size='lg'>Large text</Text>);

      expect(getByText('Large text')).toBeTruthy();
    });
  });

  describe('Weight', () => {
    it('should apply custom weight', () => {
      const { getByText } = render(<Text weight='bold'>Bold text</Text>);

      expect(getByText('Bold text')).toBeTruthy();
    });
  });

  describe('Alignment', () => {
    const alignments = ['left', 'center', 'right', 'justify'] as const;

    alignments.forEach(align => {
      it(`should apply ${align} alignment`, () => {
        const { getByText } = render(
          <Text align={align}>{align} aligned text</Text>
        );

        const textElement = getByText(`${align} aligned text`);
        expect(textElement.props.style).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              textAlign: align,
            }),
          ])
        );
      });
    });
  });

  describe('Line Limits', () => {
    it('should apply numberOfLines prop', () => {
      const { getByText } = render(
        <Text numberOfLines={2}>Multi-line text content</Text>
      );

      const textElement = getByText('Multi-line text content');
      expect(textElement.props.numberOfLines).toBe(2);
    });

    it('should apply ellipsizeMode prop', () => {
      const { getByText } = render(
        <Text ellipsizeMode='middle'>Text with ellipsis</Text>
      );

      const textElement = getByText('Text with ellipsis');
      expect(textElement.props.ellipsizeMode).toBe('middle');
    });

    it('should use tail as default ellipsizeMode', () => {
      const { getByText } = render(<Text>Text with default ellipsis</Text>);

      const textElement = getByText('Text with default ellipsis');
      expect(textElement.props.ellipsizeMode).toBe('tail');
    });
  });

  describe('Accessibility', () => {
    it('should have text role', () => {
      const { getByRole } = render(<Text>Accessible text</Text>);

      expect(getByRole('text')).toBeTruthy();
    });

    it('should use children as accessibility label for strings', () => {
      const { getByLabelText } = render(<Text>Screen reader text</Text>);

      expect(getByLabelText('Screen reader text')).toBeTruthy();
    });

    it('should accept custom accessibility label', () => {
      const { getByLabelText } = render(
        <Text accessibilityLabel='Custom label'>Display text</Text>
      );

      expect(getByLabelText('Custom label')).toBeTruthy();
    });

    it('should accept accessibility hint', () => {
      const { getByText } = render(
        <Text accessibilityHint='Additional context'>Hinted text</Text>
      );

      const textElement = getByText('Hinted text');
      expect(textElement.props.accessibilityHint).toBe('Additional context');
    });
  });

  describe('Custom Styles', () => {
    it('should apply custom styles', () => {
      const customStyle = { fontStyle: 'italic' };
      const { getByText } = render(
        <Text style={customStyle}>Italic text</Text>
      );

      const textElement = getByText('Italic text');
      expect(textElement.props.style).toEqual(
        expect.arrayContaining([expect.objectContaining(customStyle)])
      );
    });

    it('should merge custom styles with variant styles', () => {
      const customStyle = { marginTop: 10 };
      const { getByText } = render(
        <Text variant='h1' style={customStyle}>
          Styled heading
        </Text>
      );

      const textElement = getByText('Styled heading');
      expect(textElement.props.style).toEqual(
        expect.arrayContaining([expect.objectContaining(customStyle)])
      );
    });
  });

  describe('Prop Combinations', () => {
    it('should handle multiple custom props together', () => {
      const { getByText } = render(
        <Text
          variant='h2'
          color='blue'
          size='xl'
          weight='bold'
          align='center'
          numberOfLines={3}
          ellipsizeMode='head'
        >
          Complex text
        </Text>
      );

      const textElement = getByText('Complex text');
      expect(textElement.props.numberOfLines).toBe(3);
      expect(textElement.props.ellipsizeMode).toBe('head');
      expect(textElement.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            color: 'blue',
            textAlign: 'center',
          }),
        ])
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle non-string children', () => {
      const { getByText } = render(<Text>{42}</Text>);

      expect(getByText('42')).toBeTruthy();
    });

    it('should handle undefined/null children gracefully', () => {
      const { UNSAFE_root } = render(<Text>{null}</Text>);

      expect(UNSAFE_root).toBeTruthy();
    });

    it('should handle invalid color gracefully', () => {
      const { getByText } = render(
        <Text color='nonexistent.color'>Text with invalid color</Text>
      );

      expect(getByText('Text with invalid color')).toBeTruthy();
    });
  });
});
