export interface ValidationResult<T = any> {
  valid: boolean;
  value?: T;
  error?: string;
}

/**
 * 숫자 입력 검증
 * @param input 사용자 입력
 * @param min 최소값
 * @param max 최대값
 * @returns 검증 결과
 */
export function validateNumber(input: string, min: number = 1, max: number = 10): ValidationResult<number> {
  const num = parseInt(input);
  
  if (isNaN(num)) {
    return { valid: false, error: '숫자를 입력해주세요.' };
  }
  
  if (num < min || num > max) {
    return { valid: false, error: `${min}에서 ${max} 사이의 숫자를 입력해주세요.` };
  }
  
  return { valid: true, value: num };
}

/**
 * 수정 요청 감지
 * @param message 사용자 메시지
 * @returns 수정 요청 여부
 */
export function isModificationRequest(message: string): boolean {
  const modificationKeywords = [
    '수정', '바꾸', '변경', '다시', '틀렸', '잘못', '돌아가', '이전',
    '고쳐', '바꿔', '뒤로', '취소'
  ];
  return modificationKeywords.some(keyword => message.includes(keyword));
}

/**
 * 초기화 요청 감지
 * @param message 사용자 메시지
 * @returns 초기화 요청 여부
 */
export function isResetRequest(message: string): boolean {
  const resetKeywords = ['처음부터', '처음부터 시작', '초기화', '새로', '다시 시작'];
  return resetKeywords.some(keyword => message.includes(keyword));
}