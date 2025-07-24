// src/tools/validators/types.ts
export interface ValidationResult<T = any> {
  valid: boolean;
  value?: T;
  error?: string;
}

export interface LEDValidationResult extends ValidationResult<string> {
  size?: string; // 별칭 제공
}

export interface StageHeightValidationResult extends ValidationResult<number> {
  height?: number; // 별칭 제공
}

export interface PhoneValidationResult extends ValidationResult<string> {
  phone?: string; // 별칭 제공
}

export interface EventPeriodValidationResult extends ValidationResult {
  startDate?: string;
  endDate?: string;
  days?: number;
}