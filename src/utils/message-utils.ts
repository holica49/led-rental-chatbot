// src/utils/message-utils.ts

/**
 * 메시지 관련 유틸리티 통합
 */

// 구분선
export const DIVIDER = '━━━━';

// 이모지
export const EMOJI = {
  CHECK: '✅',
  ERROR: '❌',
  INFO: '📋',
  BUILDING: '🏗️',
  PACKAGE: '📦',
  PEOPLE: '👥',
  COMPANY: '🏢',
  PERSON: '👤',
  PHONE: '📞',
  CALENDAR: '📅',
  MONITOR: '🖥️',
  RULER: '📐',
  MANAGER: '👨‍💼',
  TV: '📺',
  CAMERA: '📹',
  MONEY: '💰',
  WARNING: '⚠️',
  OUTDOOR: '🌳',
  INDOOR: '🏢',
  TOOL: '🔨',
  STRUCTURE: '🏗️',
  SPARKLE: '✨',
} as const;

/**
 * 서비스 선택 완료 메시지
 */
export function serviceSelectedMessage(serviceName: string, nextPrompt: string): string {
  return `${getServiceEmoji(serviceName)} ${serviceName} 서비스를 선택하셨습니다.\n\n${DIVIDER}\n\n${nextPrompt}`;
}

/**
 * 확인 메시지
 */
export function confirmMessage(label: string, value: string): string {
  return `${EMOJI.CHECK} ${label}: ${value}`;
}

/**
 * 확인 메시지 + 다음 질문
 */
export function confirmAndAsk(label: string, value: string, nextPrompt: string): string {
  return `${confirmMessage(label, value)}\n\n${DIVIDER}\n\n${nextPrompt}`;
}

/**
 * 에러 메시지
 */
export function errorMessage(message: string, example?: string): string {
  let result = `${EMOJI.ERROR} ${message}`;
  if (example) {
    result += `\n\n${example}`;
  }
  return result;
}

/**
 * 성공 메시지
 */
export function successMessage(title: string): string {
  return `${EMOJI.CHECK} ${title}`;
}

/**
 * 섹션 구분 메시지
 */
export function sectionMessage(content: string, nextPrompt: string): string {
  return `${content}\n\n${DIVIDER}\n\n${nextPrompt}`;
}

/**
 * LED 정보 포맷팅
 */
export function formatLEDInfo(ledNumber: number, size: string, moduleCount?: number): string {
  const info = `LED${ledNumber}: ${size}`;
  if (moduleCount !== undefined) {
    return `${info} (${moduleCount}개)`;
  }
  return info;
}

/**
 * LED 크기에서 모듈 개수 계산
 */
export function calculateModuleCount(size: string): number {
  const [width, height] = size.split('x').map(Number);
  return (width / 500) * (height / 500);
}

/**
 * LED 요약 생성
 */
export function createLEDSummary(ledSpecs: Array<{ size: string; stageHeight?: number }>): string {
  return ledSpecs.map((led, index) => {
    const moduleCount = calculateModuleCount(led.size);
    let summary = formatLEDInfo(index + 1, led.size, moduleCount);
    if (led.stageHeight !== undefined) {
      summary += `, 무대높이: ${led.stageHeight}mm`;
    }
    return summary;
  }).join('\n');
}

/**
 * 서비스별 이모지 반환
 */
function getServiceEmoji(serviceName: string): string {
  switch (serviceName) {
    case 'LED 설치':
    case '설치':
      return EMOJI.BUILDING;
    case 'LED 렌탈':
    case '렌탈':
      return EMOJI.PACKAGE;
    case '멤버쉽':
      return EMOJI.PEOPLE;
    default:
      return EMOJI.INFO;
  }
}

/**
 * 최종 확인 메시지 생성
 */
export interface FinalConfirmData {
  serviceType: string;
  items: Array<{ label: string; value: string }>;
}

export function createFinalConfirmMessage(data: FinalConfirmData): string {
  const header = `${successMessage('모든 정보가 입력되었습니다!')}\n\n${EMOJI.INFO} 최종 확인\n\n${DIVIDER}`;
  
  const serviceInfo = `🔖 서비스: ${data.serviceType}`;
  
  const details = data.items
    .map(item => `${item.label}: ${item.value}`)
    .join('\n');
  
  const footer = '\n\n견적을 요청하시겠습니까?';
  
  return `${header}\n\n${serviceInfo}\n${details}${footer}`;
}

/**
 * 실외 행사 알림 메시지
 */
export function outdoorEventNotice(): string {
  return `${EMOJI.OUTDOOR} 실외 행사로 확인되었습니다.\n\n${DIVIDER}\n\n실외 행사는 최수삼 팀장이 별도로 상담을 도와드립니다.\n\n${EMOJI.PERSON} 담당: 최수삼 팀장\n${EMOJI.PHONE} 연락처: 010-2797-2504\n\n견적 요청은 계속 진행하시겠습니까?`;
}

/**
 * 멤버 코드 확인 메시지
 */
export function memberCodeConfirmed(code: string, companyName: string = '메쎄이상'): string {
  return confirmAndAsk(
    '멤버 코드 확인',
    `${code} (${companyName})`,
    '행사명과 행사장을 알려주세요.\n예: 커피박람회 / 수원메쎄 2홀'
  );
}

/**
 * 행사 정보 확인 메시지
 */
export function eventInfoConfirmed(eventName: string, venue: string, nextPrompt: string): string {
  const info = `${successMessage('행사 정보 확인')}\n${EMOJI.INFO} 행사명: ${eventName}\n${EMOJI.INFO} 행사장: ${venue}`;
  return sectionMessage(info, nextPrompt);
}

/**
 * 설치 프로젝트명 생성
 */
export function createInstallProjectName(region: string): string {
  return `${region} 프로젝트`;
}