import { UserSession, KakaoResponse } from '../types/index.js';  // .js 추가
import { isModificationRequest, isResetRequest } from './utils/request-utils.js';  // .js 추가
import { handlers, handleStart, handleSelectService, handleDefault } from './handlers/index.js';  // .js 추가

export function handleModificationRequest(_message: string, _session: UserSession): KakaoResponse {
  return {
    text: '처음부터 다시 시작하시겠습니까?',
    quickReplies: [
      { label: '예, 처음부터', action: 'message', messageText: '처음부터 시작' },
      { label: '아니요, 계속', action: 'message', messageText: '계속' }
    ]
  };
}

export function handleResetRequest(session: UserSession): KakaoResponse {
  session.step = 'start';
  session.serviceType = undefined;
  session.data = { ledSpecs: [] };
  session.ledCount = 0;
  session.currentLED = 1;
  
  return {
    text: '처음부터 다시 시작합니다.\n\n안녕하세요! LED 전문 기업 오비스입니다. 😊\n\n어떤 서비스를 도와드릴까요?',
    quickReplies: [
      { label: '🏗️ LED 설치', action: 'message', messageText: '설치' },
      { label: '📦 LED 렌탈', action: 'message', messageText: '렌탈' },
      { label: '👥 멤버쉽 서비스', action: 'message', messageText: '멤버쉽' }
    ]
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