import { UserSession, KakaoResponse } from '../types/index.js';
import { isModificationRequest, isResetRequest } from './utils/request-utils.js';
import { handlers, handleStart, handleSelectService, handleDefault } from './handlers/index.js';
import { MESSAGES, BUTTONS } from '../constants/messages.js';
import { createQuickReplies } from '../utils/handler-utils.js';
import { checkPreviousRequest } from './handlers/common-handlers.js';
import { savePreviousStep } from '../utils/session-utils.js';

export function handleModificationRequest(_message: string, _session: UserSession): KakaoResponse {
  return {
    text: '처음부터 다시 시작하시겠습니까?',
    quickReplies: createQuickReplies([
      { label: '예, 처음부터', value: '처음부터 시작' },
      { label: '아니요, 계속', value: '계속' }
    ])
  };
}



export function handleResetRequest(session: UserSession): KakaoResponse {
  session.step = 'start';
  session.serviceType = undefined;
  session.data = { ledSpecs: [] };
  session.ledCount = 0;
  session.currentLED = 1;
  
  return {
    text: `처음부터 다시 시작합니다.\n\n${MESSAGES.GREETING}`,
    quickReplies: createQuickReplies([
      { label: BUTTONS.SERVICE_INSTALL, value: '설치' },
      { label: BUTTONS.SERVICE_RENTAL, value: '렌탈' },
      { label: BUTTONS.SERVICE_MEMBERSHIP, value: '멤버쉽' }
    ])
  };
}

export async function processUserMessage(message: string, session: UserSession): Promise<KakaoResponse> {
  // 전역 리셋 키워드 체크
  const resetKeywords = ['처음', '처음부터', '처음으로', '초기화', '리셋'];
  if (resetKeywords.some(keyword => message === keyword || message.includes(`${keyword} 시작`))) {
    return handleResetRequest(session);
  }

  // 이전 단계로 돌아가기 체크 (추가)
  const previousResponse = checkPreviousRequest(message, session);
  if (previousResponse) {
    return previousResponse;
  }
  
  // 수정 요청 체크
  if (isModificationRequest(message)) {
    return handleModificationRequest(message, session);
  }
  
  if (isResetRequest(message)) {
    return handleResetRequest(session);
  }
  
  // 현재 상태 저장 (핸들러 실행 전)
  savePreviousStep(session);
  
  switch (session.step) {
    case 'start':
      return handleStart(session);
    case 'select_service':
      return handleSelectService(message, session);
    default:
      const handler = handlers[session.step];
      if (handler) {
        return handler(message, session);
      }
      return handleDefault(session);
  }
}