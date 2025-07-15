/**
 * Tests for Button component
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ActivityIndicator, Text, View } from 'react-native';
import { Button } from '../Button';

// Mock the custom Text component
jest.mock('../Text');

describe('Button', () => {
  it('should render button with children text', () => {
    const { getByText } = render(<Button>Click me</Button>);

    expect(getByText('Click me')).toBeTruthy();
  });

  it('should handle onPress events', () => {
    const onPressMock = jest.fn();
    const { getByText } = render(
      <Button onPress={onPressMock}>Press me</Button>
    );

    fireEvent.press(getByText('Press me').parent.parent);
    expect(onPressMock).toHaveBeenCalledTimes(1);
  });

  it('should not call onPress when disabled', () => {
    const onPressMock = jest.fn();
    const { getByText } = render(
      <Button onPress={onPressMock} disabled>
        Disabled Button
      </Button>
    );

    fireEvent.press(getByText('Disabled Button').parent.parent);
    expect(onPressMock).not.toHaveBeenCalled();
  });

  it.skip('should not call onPress when loading', () => {
    const onPressMock = jest.fn();
    const { UNSAFE_getByType } = render(
      <Button onPress={onPressMock} loading>
        Loading Button
      </Button>
    );

    const activityIndicator = UNSAFE_getByType(ActivityIndicator);
    fireEvent.press(activityIndicator.parent);
    expect(onPressMock).not.toHaveBeenCalled();
  });

  it.skip('should show activity indicator when loading', () => {
    const { UNSAFE_getByType } = render(<Button loading>Loading</Button>);

    // Should show ActivityIndicator
    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });

  it.skip('should hide content when loading', () => {
    const { queryByText } = render(<Button loading>Click me</Button>);

    // Text should not be visible when loading
    expect(queryByText('Click me')).toBeNull();
  });

  describe('Variants', () => {
    it('should render primary variant by default', () => {
      const { getByText } = render(<Button>Primary</Button>);

      expect(getByText('Primary')).toBeTruthy();
    });

    it('should render secondary variant', () => {
      const { getByText } = render(
        <Button variant='secondary'>Secondary</Button>
      );

      expect(getByText('Secondary')).toBeTruthy();
    });

    it('should render outline variant', () => {
      const { getByText } = render(<Button variant='outline'>Outline</Button>);

      expect(getByText('Outline')).toBeTruthy();
    });

    it('should render ghost variant', () => {
      const { getByText } = render(<Button variant='ghost'>Ghost</Button>);

      expect(getByText('Ghost')).toBeTruthy();
    });

    it('should render destructive variant', () => {
      const { getByText } = render(
        <Button variant='destructive'>Delete</Button>
      );

      expect(getByText('Delete')).toBeTruthy();
    });
  });

  describe('Sizes', () => {
    it('should render medium size by default', () => {
      const { getByText } = render(<Button>Medium</Button>);

      expect(getByText('Medium')).toBeTruthy();
    });

    it('should render small size', () => {
      const { getByText } = render(<Button size='sm'>Small</Button>);

      expect(getByText('Small')).toBeTruthy();
    });

    it('should render large size', () => {
      const { getByText } = render(<Button size='lg'>Large</Button>);

      expect(getByText('Large')).toBeTruthy();
    });
  });

  describe('Icons', () => {
    it('should render left icon', () => {
      const leftIcon = <Text testID='left-icon'>←</Text>;
      const { getByTestId } = render(
        <Button leftIcon={leftIcon}>With Left Icon</Button>
      );

      expect(getByTestId('left-icon')).toBeTruthy();
    });

    it('should render right icon', () => {
      const rightIcon = <Text testID='right-icon'>→</Text>;
      const { getByTestId } = render(
        <Button rightIcon={rightIcon}>With Right Icon</Button>
      );

      expect(getByTestId('right-icon')).toBeTruthy();
    });

    it('should render both left and right icons', () => {
      const leftIcon = <Text testID='left-icon'>←</Text>;
      const rightIcon = <Text testID='right-icon'>→</Text>;
      const { getByTestId } = render(
        <Button leftIcon={leftIcon} rightIcon={rightIcon}>
          With Both Icons
        </Button>
      );

      expect(getByTestId('left-icon')).toBeTruthy();
      expect(getByTestId('right-icon')).toBeTruthy();
    });

    it.skip('should not render icons when loading', () => {
      const leftIcon = <Text testID='left-icon'>←</Text>;
      const rightIcon = <Text testID='right-icon'>→</Text>;
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
    it('should have button accessibility role', () => {
      const { getByText } = render(<Button>Accessible</Button>);

      const button = getByText('Accessible').parent.parent;
      expect(button.props.accessibilityRole).toBe('button');
    });

    it('should accept accessibility label', () => {
      const { getByLabelText } = render(
        <Button accessibilityLabel='Custom label'>Button</Button>
      );

      expect(getByLabelText('Custom label')).toBeTruthy();
    });

    it('should have disabled state when disabled', () => {
      const { getByText } = render(<Button disabled>Disabled</Button>);

      const button = getByText('Disabled').parent.parent;
      expect(button.props.accessibilityState.disabled).toBe(true);
    });

    it.skip('should have busy state when loading', () => {
      const { UNSAFE_getByType } = render(<Button loading>Loading</Button>);

      const button = UNSAFE_getByType(ActivityIndicator).parent;
      expect(button.props.accessibilityState.busy).toBe(true);
    });
  });

  describe('Full Width', () => {
    it('should render full width button', () => {
      const { getByText } = render(<Button fullWidth>Full Width</Button>);

      const button = getByText('Full Width').parent.parent;
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
      const { getByText } = render(<Button style={customStyle}>Styled</Button>);

      const button = getByText('Styled').parent.parent;
      expect(button.props.style).toEqual(
        expect.arrayContaining([expect.objectContaining(customStyle)])
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined onPress gracefully', () => {
      const { getByText } = render(<Button>No onPress</Button>);

      expect(() => {
        fireEvent.press(getByText('No onPress').parent.parent);
      }).not.toThrow();
    });

    it.skip('should handle both disabled and loading states', () => {
      const onPressMock = jest.fn();
      const { UNSAFE_getByType } = render(
        <Button onPress={onPressMock} disabled loading>
          Disabled and Loading
        </Button>
      );

      const button = UNSAFE_getByType(ActivityIndicator).parent;
      fireEvent.press(button);
      expect(onPressMock).not.toHaveBeenCalled();
    });

    it('should render with number children', () => {
      const { getByText } = render(<Button>{42}</Button>);

      expect(getByText('42')).toBeTruthy();
    });
  });
});
