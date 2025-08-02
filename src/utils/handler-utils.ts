// src/utils/handler-utils.ts

import { KakaoResponse, UserSession } from '../types/index.js';
import { MESSAGES, BUTTONS, VALIDATION_ERRORS } from '../constants/messages.js';
import { 
  confirmAndAsk, 
  errorMessage, 
  serviceSelectedMessage,
  formatLEDInfo,
  calculateModuleCount,
  createLEDSummary,
  eventInfoConfirmed,
  memberCodeConfirmed,
  outdoorEventNotice,
  createInstallProjectName,
  askWithProgress
} from './message-utils.js';

// Re-export message utils
export {
  confirmAndAsk,
  errorMessage,
  serviceSelectedMessage,
  formatLEDInfo,
  calculateModuleCount,
  createLEDSummary,
  eventInfoConfirmed,
  memberCodeConfirmed,
  outdoorEventNotice,
  createInstallProjectName,
  askWithProgress
} from './message-utils.js';

/**
 * Quick Reply 생성 헬퍼
 */
export function createQuickReplies(items: Array<{ label: string; value?: string }>): Array<{ label: string; action: 'message'; messageText: string }> {
  return items.map(item => ({
    label: item.label,
    action: 'message' as const,
    messageText: item.value || item.label
  }));
}

/**
 * 서비스 선택 Quick Replies
 */
export const SERVICE_QUICK_REPLIES = createQuickReplies([
  { label: BUTTONS.SERVICE_INSTALL, value: '설치' },
  { label: BUTTONS.SERVICE_RENTAL, value: '렌탈' },
  { label: BUTTONS.SERVICE_MEMBERSHIP, value: '멤버쉽' }
]);

/**
 * 예/아니오 Quick Replies
 */
export const YES_NO_QUICK_REPLIES = createQuickReplies([
  { label: BUTTONS.YES, value: '네' },
  { label: BUTTONS.NO, value: '아니요' }
]);

/**
 * 확인/취소 Quick Replies
 */
export const CONFIRM_CANCEL_QUICK_REPLIES = createQuickReplies([
  { label: BUTTONS.CONFIRM, value: '네' },
  { label: BUTTONS.CANCEL, value: '취소' }
]);

/**
 * 공통 환경 선택 핸들러
 */
export function handleEnvironmentSelection(
  message: string,
  session: UserSession,
  nextStep: string
): KakaoResponse {
  const isIndoor = message.includes('실내');
  const isOutdoor = message.includes('실외');
  
  if (!isIndoor && !isOutdoor) {
    return {
      text: askWithProgress(MESSAGES.SELECT_ENVIRONMENT, session),
      quickReplies: createQuickReplies([
        { label: BUTTONS.INDOOR_SIMPLE, value: '실내' },
        { label: BUTTONS.OUTDOOR_SIMPLE, value: '실외' }
      ])
    };
  }
  
  session.data.installEnvironment = isIndoor ? '실내' : '실외';
  session.step = nextStep;
  
  return {
    text: askWithProgress(
      session.serviceType === '설치' ? MESSAGES.INPUT_REGION : 
      isOutdoor ? outdoorEventNotice() : MESSAGES.SELECT_STRUCTURE,
      session
    ),
    quickReplies: session.serviceType === '설치' ? [] :
      isOutdoor ? createQuickReplies([
        { label: BUTTONS.CONTINUE, value: '목공 설치' },
        { label: BUTTONS.START_OVER, value: '처음부터' }
      ]) : createQuickReplies([
        { label: BUTTONS.STRUCTURE_WOOD, value: '목공 설치' },
        { label: BUTTONS.STRUCTURE_STANDALONE, value: '단독 설치' }
      ])
  };
}

/**
 * LED 크기 입력 프롬프트 생성 (진행 상황 포함)
 */
export function createLEDSizePrompt(ledNumber: number, session?: UserSession): string {
  const prompt = `LED ${ledNumber}번째 화면의 크기를 알려주세요.

가로x세로 형식으로 입력해 주시면 됩니다. (단위: mm)

💡 예시: 5000x3000`;
  
  if (session) {
    return askWithProgress(prompt, session);
  }
  return prompt;
}

/**
 * LED 정보 저장
 */
export function saveLEDSpec(session: UserSession, size: string): void {
  session.data.ledSpecs.push({
    size: size,
    stageHeight: 0,
    needOperator: false,
    operatorDays: 0,
    prompterConnection: false,
    relayConnection: false
  });
}

/**
 * 현재 LED 인덱스 가져오기
 */
export function getCurrentLEDIndex(session: UserSession): number {
  return session.data.ledSpecs.length - 1;
}

/**
 * 다음 LED로 진행할지 확인
 */
export function shouldContinueToNextLED(session: UserSession): boolean {
  return session.currentLED < session.ledCount;
}

/**
 * LED 설정 완료 메시지 생성 (진행 상황 포함)
 */
export function createLEDCompleteMessage(session: UserSession): string {
  const summary = createLEDSummary(session.data.ledSpecs);
  return `✅ 모든 LED 설정이 완료되었습니다!\n\n📋 설정 요약:\n${summary}`;
}

/**
 * 빈 값 검증
 */
export function validateNotEmpty(value: string, fieldName: string): { valid: boolean; error?: string } {
  if (!value || value.trim().length === 0) {
    return { 
      valid: false, 
      error: VALIDATION_ERRORS.REQUIRED_FIELD(fieldName) 
    };
  }
  return { valid: true };
}

/**
 * 선택 옵션 검증
 */
export function validateSelection(value: string, options: string[], promptMessage: string, session?: UserSession): { valid: boolean; response?: KakaoResponse } {
  if (!options.includes(value.trim())) {
    return {
      valid: false,
      response: {
        text: session ? askWithProgress(promptMessage, session) : promptMessage,
        quickReplies: createQuickReplies(options.map(opt => ({ label: opt })))
      }
    };
  }
  return { valid: true };
}

/**
 * 이벤트 정보 파싱
 */
export function parseEventInfo(message: string): { eventName?: string; venue?: string; error?: string } {
  const parts = message.split('/').map(part => part.trim());
  
  if (parts.length < 2) {
    return { error: VALIDATION_ERRORS.EVENT_INFO };
  }
  
  return {
    eventName: parts[0],
    venue: parts[1]
  };
}

/**
 * 행사 기간 일수 계산
 */
export function calculateEventDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}