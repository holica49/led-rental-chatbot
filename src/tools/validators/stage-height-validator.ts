export interface StageHeightValidationResult {
  valid: boolean;
  value?: number;
  height?: number;
  error?: string;
}

/**
 * 무대 높이 검증
 * @param input 사용자 입력 무대 높이
 * @returns 검증 결과
 */
export function validateStageHeight(input: string): StageHeightValidationResult {
  if (!input || typeof input !== 'string') {
    return { valid: false, error: '무대 높이를 입력해주세요.' };
  }
  
  const cleanInput = input.replace(/\s/g, '').toLowerCase();
  
  // 버튼 클릭 텍스트 직접 처리
  const buttonValues: { [key: string]: number } = {
    '0mm': 0,
    '600mm': 600,
    '800mm': 800,
    '1000mm': 1000
  };
  
  if (buttonValues[cleanInput] !== undefined) {
    return { valid: true, value: buttonValues[cleanInput], height: buttonValues[cleanInput] };
  }
  
  const patterns = [
    /^(\d+)$/,
    /^(\d+)mm$/,
    /^(\d+)cm$/,
    /^(\d+)m$/,
    /^(\d+\.\d+)m$/
  ];
  
  for (const pattern of patterns) {
    const match = cleanInput.match(pattern);
    if (match) {
      let height = parseFloat(match[1]);
      
      if (cleanInput.includes('cm')) {
        height = height * 10;
      } else if (cleanInput.includes('m') && !cleanInput.includes('mm')) {
        height = height * 1000;
      }
      
      // 최소값 0으로 변경
      if (height < 0 || height > 10000) {
        return { 
          valid: false, 
          error: '무대 높이는 0mm ~ 10000mm(10m) 사이로 입력해주세요.' 
        };
      }
      
      const roundedHeight = Math.round(height);
      return { valid: true, value: roundedHeight, height: roundedHeight };
    }
  }
  
  return { 
    valid: false, 
    error: '무대 높이 형식이 올바르지 않습니다.\n예시: 0, 600, 600mm, 60cm, 0.6m' 
  };
}