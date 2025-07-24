// tests/unit/validators/led-validator.test.ts
import { 
  validateAndNormalizeLEDSize, 
  calculateLEDPower,
  calculateModuleCount 
} from '../../../src/tools/validators/led-validator.js';

describe('LED Validator', () => {
  describe('validateAndNormalizeLEDSize', () => {
    it('should validate correct LED sizes', () => {
      const result = validateAndNormalizeLEDSize('6000x3000');
      expect(result.valid).toBe(true);
      expect(result.size).toBe('6000x3000');
    });

    it('should handle various input formats', () => {
      expect(validateAndNormalizeLEDSize('6000*3000').size).toBe('6000x3000');
      expect(validateAndNormalizeLEDSize('6000×3000').size).toBe('6000x3000');
      expect(validateAndNormalizeLEDSize('6000 x 3000').size).toBe('6000x3000');
      expect(validateAndNormalizeLEDSize('6000mm x 3000mm').size).toBe('6000x3000');
    });

    it('should reject non-500mm multiples', () => {
      const result = validateAndNormalizeLEDSize('6100x3000');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('500mm 단위');
    });

    it('should reject sizes smaller than 500x500', () => {
      const result = validateAndNormalizeLEDSize('400x400');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('최소 500x500mm');
    });
  });

  describe('calculateLEDPower', () => {
    it('should calculate power correctly', () => {
      expect(calculateLEDPower('6000x3000')).toBe('14.4kW');
      expect(calculateLEDPower('4000x2500')).toBe('8.0kW');
    });
  });

  describe('calculateModuleCount', () => {
    it('should calculate module count correctly', () => {
      expect(calculateModuleCount('6000x3000')).toBe(72);
      expect(calculateModuleCount('4000x2500')).toBe(40);
    });
  });
});