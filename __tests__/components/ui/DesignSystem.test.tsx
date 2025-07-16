import { theme } from '../../../src/components';

describe('Design System Foundation', () => {
  describe('Component Imports', () => {
    it('can import Text and Button components', () => {
      const { SimpleText, SimpleButton } = require('../../../src/components');
      expect(SimpleText).toBeDefined();
      expect(SimpleButton).toBeDefined();
    });
  });

  describe('Theme Configuration', () => {
    it('has proper color structure', () => {
      expect(theme.colors.primary).toBeDefined();
      expect(theme.colors.primary[500]).toBeTruthy();
      expect(theme.colors.neutral).toBeDefined();
      expect(theme.colors.success).toBeDefined();
      expect(theme.colors.error).toBeDefined();
    });

    it('has typography configuration', () => {
      expect(theme.typography.fontSize).toBeDefined();
      expect(theme.typography.fontWeight).toBeDefined();
      expect(theme.typography.lineHeight).toBeDefined();
    });

    it('has spacing configuration', () => {
      expect(theme.spacing).toBeDefined();
      expect(typeof theme.spacing[4]).toBe('number');
    });

    it('has border radius configuration', () => {
      expect(theme.borderRadius).toBeDefined();
      expect(typeof theme.borderRadius.base).toBe('number');
    });

    it('has shadow configuration', () => {
      expect(theme.shadows).toBeDefined();
      expect(theme.shadows.sm).toBeDefined();
      expect(theme.shadows.base).toBeDefined();
    });
  });
});
