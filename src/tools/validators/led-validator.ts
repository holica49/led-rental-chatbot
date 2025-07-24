// src/tools/validators/led-validator.ts
export interface LEDValidationResult {
  valid: boolean;
  value?: string;
  size?: string;
  error?: string;
}

/**
 * LED 크기 검증 및 정규화
 * @param input 사용자 입력 LED 크기
 * @returns 검증 결과
 */
export function validateAndNormalizeLEDSize(input: string): LEDValidationResult {
  if (!input || typeof input !== 'string') {
    return { valid: false, error: 'LED 크기를 입력해주세요.' };
  }
  
  const cleanInput = input.replace(/\s/g, '').toLowerCase();
  const patterns = [
    /^(\d+)[x×*](\d+)$/,
    /^(\d+)[x×*]\s*(\d+)$/,
    /^(\d+)\s*[x×*]\s*(\d+)$/,
    /^(\d+)[x×*](\d+)mm$/,
    /^(\d+)mm[x×*](\d+)mm$/
  ];
  
  for (const pattern of patterns) {
    const match = cleanInput.match(pattern);
    if (match) {
      const [, widthStr, heightStr] = match;
      const width = parseInt(widthStr);
      const height = parseInt(heightStr);
      
      if (width % 500 !== 0 || height % 500 !== 0) {
        return { 
          valid: false, 
          error: `LED 크기는 500mm 단위로 입력해주세요.\n입력하신 크기: ${width}x${height}\n가까운 크기: ${Math.round(width/500)*500}x${Math.round(height/500)*500}` 
        };
      }
      
      if (width < 500 || height < 500) {
        return { valid: false, error: 'LED 크기는 최소 500x500mm 이상이어야 합니다.' };
      }
      
      return { valid: true, value: `${width}x${height}`, size: `${width}x${height}` };
    }
  }
  
  return { 
    valid: false, 
    error: 'LED 크기 형식이 올바르지 않습니다.\n예시: 6000x3000, 4000*3000, 4000×2500' 
  };
}

/**
 * LED 소비전력 계산
 * @param size LED 크기 (예: "6000x3000")
 * @returns 소비전력 문자열
 */
export function calculateLEDPower(size: string): string {
  if (!size) return '';
  
  const [width, height] = size.split('x').map(Number);
  const moduleCount = (width / 500) * (height / 500);
  const totalPower = moduleCount * 0.2;
  
  return `${totalPower.toFixed(1)}kW`;
}

/**
 * LED 해상도 계산
 * @param size LED 크기 (예: "6000x3000")
 * @returns 해상도 문자열
 */
export function calculateLEDResolution(size: string): string {
  if (!size) return '';
  
  const [width, height] = size.split('x').map(Number);
  const horizontalModules = width / 500;
  const verticalModules = height / 500;
  const horizontalPixels = horizontalModules * 168;
  const verticalPixels = verticalModules * 168;
  
  return `${horizontalPixels} x ${verticalPixels} pixels`;
}

/**
 * LED 대각선 인치 계산
 * @param size LED 크기 (예: "6000x3000")
 * @returns 대각선 인치
 */
export function calculateInches(size: string): number {
  if (!size) return 0;
  const [width, height] = size.split('x').map(Number);
  return Math.round(Math.sqrt(width ** 2 + height ** 2) / 25.4 * 10) / 10;
}

/**
 * LED 모듈 개수 계산
 * @param size LED 크기 (예: "6000x3000")
 * @returns 모듈 개수
 */
export function calculateModuleCount(size: string): number {
  if (!size) return 0;
  const [width, height] = size.split('x').map(Number);
  return (width / 500) * (height / 500);
}

/**
 * 전기 설치 방식 계산
 * @param size LED 크기 (예: "6000x3000")
 * @returns 전기 설치 방식 설명
 */
export function calculateElectricalInstallation(size: string): string {
  if (!size) return '';
  
  const [width, height] = size.split('x').map(Number);
  const inches = Math.sqrt(width ** 2 + height ** 2) / 25.4;
  
  if (inches < 250) {
    const moduleCount = (width / 500) * (height / 500);
    const multiTapCount = moduleCount <= 20 ? 3 : 4;
    return `220V 멀티탭 ${multiTapCount}개`;
  } else {
    const moduleCount = (width / 500) * (height / 500);
    const totalPower = moduleCount * 0.2;
    const panelCount = Math.ceil(totalPower / 19);
    return `50A 3상-4선 배전반 ${panelCount}개`;
  }
}