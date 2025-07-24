export interface EventPeriodValidationResult {
  valid: boolean;
  startDate?: string;
  endDate?: string;
  days?: number;
  error?: string;
}

/**
 * 행사 기간 검증
 * @param input 사용자 입력 행사 기간
 * @returns 검증 결과
 */
export function validateEventPeriod(input: string): EventPeriodValidationResult {
  if (!input || typeof input !== 'string') {
    return { valid: false, error: '행사 기간을 입력해주세요.' };
  }
  
  const cleanInput = input.replace(/\s/g, '');
  const patterns = [
    /^(\d{4}-\d{2}-\d{2})~(\d{4}-\d{2}-\d{2})$/,
    /^(\d{4}-\d{2}-\d{2})-(\d{4}-\d{2}-\d{2})$/,
    /^(\d{4}-\d{2}-\d{2})부터(\d{4}-\d{2}-\d{2})까지$/,
    /^(\d{4}-\d{2}-\d{2})에서(\d{4}-\d{2}-\d{2})$/
  ];
  
  for (const pattern of patterns) {
    const match = cleanInput.match(pattern);
    if (match) {
      const [, startDate, endDate] = match;
      
      // 날짜 형식 검증
      const datePattern = /^\d{4}-\d{2}-\d{2}$/;
      if (!datePattern.test(startDate) || !datePattern.test(endDate)) {
        continue;
      }
      
      // 날짜 유효성 검증
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return { valid: false, error: '유효하지 않은 날짜입니다.' };
      }
      
      if (start > end) {
        return { valid: false, error: '시작일이 종료일보다 늦을 수 없습니다.' };
      }
      
      // 일수 계산 (시작일과 종료일 포함)
      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      
      return { valid: true, startDate, endDate, days };
    }
  }
  
  return { 
    valid: false, 
    error: '행사 기간 형식이 올바르지 않습니다.\n예시: 2025-07-09 ~ 2025-07-11' 
  };
}

/**
 * 날짜 기반 일정 계산
 * @param startDate 시작일
 * @param endDate 종료일
 * @returns 각 일정 날짜
 */
export function calculateScheduleDates(startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // 설치 일정: 시작일 하루 전
  const installDate = new Date(start);
  installDate.setDate(installDate.getDate() - 1);
  
  // 리허설 일정: 시작일 하루 전 (설치일과 같음)
  const rehearsalDate = new Date(installDate);
  
  // 철거 일정: 마지막 날
  const dismantleDate = new Date(end);
  
  return {
    eventSchedule: `${startDate} ~ ${endDate}`,
    installSchedule: installDate.toISOString().split('T')[0],
    rehearsalSchedule: rehearsalDate.toISOString().split('T')[0],
    dismantleSchedule: dismantleDate.toISOString().split('T')[0]
  };
}