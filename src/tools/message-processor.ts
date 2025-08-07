import { UserSession, KakaoResponse } from '../types/index.js';
import { isModificationRequest } from './utils/request-utils.js';
import { handlers, handleStart, handleSelectService, handleDefault } from './handlers/index.js';
import { MESSAGES, BUTTONS } from '../constants/messages.js';
import { createQuickReplies } from '../utils/handler-utils.js';
import { checkPreviousRequest, checkResetRequest } from './handlers/common-handlers.js';
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

export async function processUserMessage(message: string, session: UserSession): Promise<KakaoResponse> {
  // 리셋 요청 체크 (공통 핸들러 사용)
  const resetResponse = checkResetRequest(message, session);
  if (resetResponse) {
    return resetResponse;
  }

  // 이전 단계로 돌아가기 체크
  const previousResponse = checkPreviousRequest(message, session);
  if (previousResponse) {
    return previousResponse;
  }
  
  // 수정 요청 체크
  if (isModificationRequest(message)) {
    return handleModificationRequest(message, session);
  }
  
  // 현재 상태 저장 (핸들러 실행 전)
  savePreviousStep(session);
  
  // 단계별 처리
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