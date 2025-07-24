export interface PhoneValidationResult {
  valid: boolean;
  value?: string;
  phone?: string;
  error?: string;
}

/**
 * 전화번호 검증 및 포맷팅
 * @param input 사용자 입력 전화번호
 * @returns 검증 결과
 */
export function validatePhoneNumber(input: string): PhoneValidationResult {
  if (!input || typeof input !== 'string') {
    return { valid: false, error: '전화번호를 입력해주세요.' };
  }
  
  const cleanInput = input.replace(/[-\s]/g, '');
  const patterns = [
    /^010\d{8}$/,
    /^02\d{7,8}$/,
    /^0[3-9]\d{8,9}$/,
    /^070\d{8}$/
  ];
  
  for (const pattern of patterns) {
    if (pattern.test(cleanInput)) {
      // 전화번호 포맷팅
      let formattedPhone: string;
      
      if (cleanInput.startsWith('010')) {
        formattedPhone = cleanInput.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
      } else if (cleanInput.startsWith('02')) {
        if (cleanInput.length === 9) {
          formattedPhone = cleanInput.replace(/(\d{2})(\d{3})(\d{4})/, '$1-$2-$3');
        } else {
          formattedPhone = cleanInput.replace(/(\d{2})(\d{4})(\d{4})/, '$1-$2-$3');
        }
      } else {
        formattedPhone = cleanInput.replace(/(\d{3})(\d{3,4})(\d{4})/, '$1-$2-$3');
      }
      
      return { valid: true, value: formattedPhone, phone: formattedPhone };
    }
  }
  
  return { 
    valid: false, 
    error: '올바른 전화번호 형식이 아닙니다.\n예시: 010-1234-5678, 02-1234-5678' 
  };
}