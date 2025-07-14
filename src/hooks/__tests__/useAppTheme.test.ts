/**
 * Tests for useAppTheme hook
 */

import { renderHook } from '@testing-library/react-native';
import { useAppTheme, AppTheme } from '../useAppTheme';

describe('useAppTheme', () => {
  it('should return the default theme object', () => {
    const { result } = renderHook(() => useAppTheme());

    expect(result.current).toBeDefined();
    expect(typeof result.current).toBe('object');
  });

  it('should return theme with all required color properties', () => {
    const { result } = renderHook(() => useAppTheme());
    const theme = result.current;

    expect(theme.colors).toBeDefined();
    expect(theme.colors.primary).toBe('#FE5D26');
    expect(theme.colors.secondary).toBe('#F9BD4D');
    expect(theme.colors.background).toBe('#FFFFFF');
    expect(theme.colors.surface).toBe('#F8F9FA');
    expect(theme.colors.text).toBe('#083D77');
    expect(theme.colors.textSecondary).toBe('#6C757D');
    expect(theme.colors.error).toBe('#E8603C');
    expect(theme.colors.warning).toBe('#F9BD4D');
    expect(theme.colors.success).toBe('#0B5739');
    expect(theme.colors.info).toBe('#7DE2D1');
    expect(theme.colors.border).toBe('#DEE2E6');
    expect(theme.colors.divider).toBe('#CED4DA');
  });

  it('should return theme with all required spacing properties', () => {
    const { result } = renderHook(() => useAppTheme());
    const theme = result.current;

    expect(theme.spacing).toBeDefined();
    expect(theme.spacing.xs).toBe(4);
    expect(theme.spacing.sm).toBe(8);
    expect(theme.spacing.md).toBe(16);
    expect(theme.spacing.lg).toBe(24);
    expect(theme.spacing.xl).toBe(32);
  });

  it('should return theme with all required border radius properties', () => {
    const { result } = renderHook(() => useAppTheme());
    const theme = result.current;

    expect(theme.borderRadius).toBeDefined();
    expect(theme.borderRadius.sm).toBe(4);
    expect(theme.borderRadius.md).toBe(8);
    expect(theme.borderRadius.lg).toBe(16);
  });

  it('should return theme with all required font size properties', () => {
    const { result } = renderHook(() => useAppTheme());
    const theme = result.current;

    expect(theme.fontSize).toBeDefined();
    expect(theme.fontSize.xs).toBe(12);
    expect(theme.fontSize.sm).toBe(14);
    expect(theme.fontSize.md).toBe(16);
    expect(theme.fontSize.lg).toBe(18);
    expect(theme.fontSize.xl).toBe(24);
  });

  it('should return the same theme object on subsequent calls (memoization)', () => {
    const { result, rerender } = renderHook(() => useAppTheme());
    const firstResult = result.current;

    rerender();
    const secondResult = result.current;

    expect(firstResult).toBe(secondResult);
  });

  it('should match AppTheme interface structure', () => {
    const { result } = renderHook(() => useAppTheme());
    const theme = result.current;

    // Check that all required properties exist
    expect(theme).toHaveProperty('colors');
    expect(theme).toHaveProperty('spacing');
    expect(theme).toHaveProperty('borderRadius');
    expect(theme).toHaveProperty('fontSize');

    // Check that colors object has all required properties
    const requiredColorProps = [
      'primary',
      'secondary',
      'background',
      'surface',
      'text',
      'textSecondary',
      'error',
      'warning',
      'success',
      'info',
      'border',
      'divider',
    ];
    requiredColorProps.forEach(prop => {
      expect(theme.colors).toHaveProperty(prop);
      expect(typeof theme.colors[prop]).toBe('string');
    });

    // Check that spacing object has all required properties
    const requiredSpacingProps = ['xs', 'sm', 'md', 'lg', 'xl'];
    requiredSpacingProps.forEach(prop => {
      expect(theme.spacing).toHaveProperty(prop);
      expect(typeof theme.spacing[prop]).toBe('number');
    });

    // Check that borderRadius object has all required properties
    const requiredBorderRadiusProps = ['sm', 'md', 'lg'];
    requiredBorderRadiusProps.forEach(prop => {
      expect(theme.borderRadius).toHaveProperty(prop);
      expect(typeof theme.borderRadius[prop]).toBe('number');
    });

    // Check that fontSize object has all required properties
    const requiredFontSizeProps = ['xs', 'sm', 'md', 'lg', 'xl'];
    requiredFontSizeProps.forEach(prop => {
      expect(theme.fontSize).toHaveProperty(prop);
      expect(typeof theme.fontSize[prop]).toBe('number');
    });
  });
});
