/**
 * Tests for Button component
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Button } from '../Button';

describe('Button', () => {
  it('should render button with children text', () => {
    const { getByText } = render(<Button>Click me</Button>);

    expect(getByText('Click me')).toBeTruthy();
  });

  it('should handle onPress events', () => {
    const onPressMock = jest.fn();
    const { getByRole } = render(
      <Button onPress={onPressMock}>Press me</Button>
    );

    fireEvent.press(getByRole('button'));
    expect(onPressMock).toHaveBeenCalledTimes(1);
  });

  it('should not call onPress when disabled', () => {
    const onPressMock = jest.fn();
    const { getByRole } = render(
      <Button onPress={onPressMock} disabled>
        Disabled Button
      </Button>
    );

    fireEvent.press(getByRole('button'));
    expect(onPressMock).not.toHaveBeenCalled();
  });

  it('should not call onPress when loading', () => {
    const onPressMock = jest.fn();
    const { getByRole } = render(
      <Button onPress={onPressMock} loading>
        Loading Button
      </Button>
    );

    fireEvent.press(getByRole('button'));
    expect(onPressMock).not.toHaveBeenCalled();
  });

  it('should show activity indicator when loading', () => {
    const { queryByTestId, UNSAFE_getByType } = render(
      <Button loading>Loading</Button>
    );

    // Should show ActivityIndicator
    expect(UNSAFE_getByType('ActivityIndicator')).toBeTruthy();
  });

  it('should hide content when loading', () => {
    const { queryByText } = render(<Button loading>Click me</Button>);

    // Text should not be visible when loading
    expect(queryByText('Click me')).toBeNull();
  });

  describe('Variants', () => {
    it('should render primary variant by default', () => {
      const { getByRole } = render(<Button>Primary</Button>);
      const button = getByRole('button');

      expect(button).toBeTruthy();
      // Default variant should be primary
    });

    it('should render secondary variant', () => {
      const { getByRole } = render(
        <Button variant='secondary'>Secondary</Button>
      );

      expect(getByRole('button')).toBeTruthy();
    });

    it('should render outline variant', () => {
      const { getByRole } = render(<Button variant='outline'>Outline</Button>);

      expect(getByRole('button')).toBeTruthy();
    });

    it('should render ghost variant', () => {
      const { getByRole } = render(<Button variant='ghost'>Ghost</Button>);

      expect(getByRole('button')).toBeTruthy();
    });

    it('should render destructive variant', () => {
      const { getByRole } = render(
        <Button variant='destructive'>Delete</Button>
      );

      expect(getByRole('button')).toBeTruthy();
    });
  });

  describe('Sizes', () => {
    it('should render medium size by default', () => {
      const { getByRole } = render(<Button>Medium</Button>);

      expect(getByRole('button')).toBeTruthy();
    });

    it('should render small size', () => {
      const { getByRole } = render(<Button size='sm'>Small</Button>);

      expect(getByRole('button')).toBeTruthy();
    });

    it('should render large size', () => {
      const { getByRole } = render(<Button size='lg'>Large</Button>);

      expect(getByRole('button')).toBeTruthy();
    });
  });

  describe('Icons', () => {
    it('should render left icon', () => {
      const leftIcon = <div testID='left-icon'>←</div>;
      const { getByTestId } = render(
        <Button leftIcon={leftIcon}>With Left Icon</Button>
      );

      expect(getByTestId('left-icon')).toBeTruthy();
    });

    it('should render right icon', () => {
      const rightIcon = <div testID='right-icon'>→</div>;
      const { getByTestId } = render(
        <Button rightIcon={rightIcon}>With Right Icon</Button>
      );

      expect(getByTestId('right-icon')).toBeTruthy();
    });

    it('should render both left and right icons', () => {
      const leftIcon = <div testID='left-icon'>←</div>;
      const rightIcon = <div testID='right-icon'>→</div>;
      const { getByTestId } = render(
        <Button leftIcon={leftIcon} rightIcon={rightIcon}>
          With Both Icons
        </Button>
      );

      expect(getByTestId('left-icon')).toBeTruthy();
      expect(getByTestId('right-icon')).toBeTruthy();
    });

    it('should not render icons when loading', () => {
      const leftIcon = <div testID='left-icon'>←</div>;
      const rightIcon = <div testID='right-icon'>→</div>;
      const { queryByTestId } = render(
        <Button leftIcon={leftIcon} rightIcon={rightIcon} loading>
          Loading with icons
        </Button>
      );

      expect(queryByTestId('left-icon')).toBeNull();
      expect(queryByTestId('right-icon')).toBeNull();
    });
  });

  describe('Accessibility', () => {
    it('should have button role', () => {
      const { getByRole } = render(<Button>Accessible</Button>);

      expect(getByRole('button')).toBeTruthy();
    });

    it('should accept accessibility label', () => {
      const { getByLabelText } = render(
        <Button accessibilityLabel='Custom label'>Button</Button>
      );

      expect(getByLabelText('Custom label')).toBeTruthy();
    });

    it('should have disabled state when disabled', () => {
      const { getByRole } = render(<Button disabled>Disabled</Button>);

      const button = getByRole('button');
      expect(button.props.accessibilityState.disabled).toBe(true);
    });

    it('should have busy state when loading', () => {
      const { getByRole } = render(<Button loading>Loading</Button>);

      const button = getByRole('button');
      expect(button.props.accessibilityState.busy).toBe(true);
    });
  });

  describe('Full Width', () => {
    it('should render full width button', () => {
      const { getByRole } = render(<Button fullWidth>Full Width</Button>);

      const button = getByRole('button');
      expect(button.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            alignSelf: 'stretch',
          }),
        ])
      );
    });
  });

  describe('Custom Styles', () => {
    it('should accept custom container styles', () => {
      const customStyle = { backgroundColor: 'red' };
      const { getByRole } = render(<Button style={customStyle}>Styled</Button>);

      const button = getByRole('button');
      expect(button.props.style).toEqual(
        expect.arrayContaining([expect.objectContaining(customStyle)])
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined onPress gracefully', () => {
      const { getByRole } = render(<Button>No onPress</Button>);

      expect(() => {
        fireEvent.press(getByRole('button'));
      }).not.toThrow();
    });

    it('should handle both disabled and loading states', () => {
      const onPressMock = jest.fn();
      const { getByRole } = render(
        <Button onPress={onPressMock} disabled loading>
          Disabled and Loading
        </Button>
      );

      fireEvent.press(getByRole('button'));
      expect(onPressMock).not.toHaveBeenCalled();
    });

    it('should render with number children', () => {
      const { getByText } = render(<Button>{42}</Button>);

      expect(getByText('42')).toBeTruthy();
    });
  });
});
