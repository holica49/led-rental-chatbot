// src/tools/message-processor.ts

import { UserSession, KakaoResponse } from '../types/index.js';
import { isModificationRequest, isResetRequest } from './utils/request-utils.js';
import { handlers, handleStart, handleSelectService, handleDefault } from './handlers/index.js';
import { MESSAGES, BUTTONS } from '../constants/messages.js';
import { createQuickReplies } from '../utils/handler-utils.js';

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
  if (isModificationRequest(message)) {
    return handleModificationRequest(message, session);
  }
  
  if (isResetRequest(message)) {
    return handleResetRequest(session);
  }
  
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