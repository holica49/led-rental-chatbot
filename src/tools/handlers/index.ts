import { HandlerMap } from './types.js';  // .js 추가
import { commonHandlers } from './common.js';  // .js 추가
import { installHandlers } from './install.js';  // .js 추가
import { rentalHandlers } from './rental.js';  // .js 추가
import { membershipHandlers } from './membership.js';  // .js 추가
import { UserSession, KakaoResponse } from '../../types/index.js';  // .js 추가

export function handleStart(session: UserSession): KakaoResponse {
  session.step = 'select_service';
  
  return {
    text: '안녕하세요! LED 전문 기업 오비스입니다. 😊\n\n어떤 서비스를 도와드릴까요?',
    quickReplies: [
      { label: '🏗️ LED 설치', action: 'message', messageText: '설치' },
      { label: '📦 LED 렌탈', action: 'message', messageText: '렌탈' },
      { label: '👥 멤버쉽 서비스', action: 'message', messageText: '멤버쉽' }
    ]
  };
}

export function handleSelectService(message: string, session: UserSession): KakaoResponse {
  if (message.includes('설치')) {
    session.serviceType = '설치';
    session.step = 'install_environment';
    return {
      text: '🏗️ LED 설치 서비스를 선택하셨습니다.\n\n━━━━━━\n\n설치 환경을 선택해주세요.',
      quickReplies: [
        { label: '🏢 실내 설치', action: 'message', messageText: '실내' },
        { label: '🌳 실외 설치', action: 'message', messageText: '실외' }
      ]
    };
  } else if (message.includes('렌탈')) {
    session.serviceType = '렌탈';
    session.step = 'rental_indoor_outdoor';
    session.data.customerName = '메쎄이상';
    return {
      text: '📦 LED 렌탈 서비스를 선택하셨습니다.\n\n━━━━━━\n\n행사명과 행사장을 알려주세요.\n예: 커피박람회 / 수원메쎄 2홀',
      quickReplies: []
    };
  } else if (message.includes('멤버쉽')) {
    session.serviceType = '멤버쉽';
    session.step = 'membership_code';
    return {
      text: '👥 멤버쉽 서비스를 선택하셨습니다.\n\n━━━━━━\n\n멤버 코드를 입력해주세요.',
      quickReplies: []
    };
  } else {
    return {
      text: '서비스를 선택해주세요.',
      quickReplies: [
        { label: '🏗️ LED 설치', action: 'message', messageText: '설치' },
        { label: '📦 LED 렌탈', action: 'message', messageText: '렌탈' },
        { label: '👥 멤버쉽 서비스', action: 'message', messageText: '멤버쉽' }
      ]
    };
  }
}

export function handleDefault(session: UserSession): KakaoResponse {
  session.step = 'start';
  return {
    text: '안녕하세요! LED 전문 기업 오비스입니다.\n\n어떤 서비스를 도와드릴까요?',
    quickReplies: [
      { label: '🏗️ LED 설치', action: 'message', messageText: '설치' },
      { label: '📦 LED 렌탈', action: 'message', messageText: '렌탈' },
      { label: '👥 멤버쉽 서비스', action: 'message', messageText: '멤버쉽' }
    ]
  };
}

export const handlers: HandlerMap = {
  'start': (message: string, session: UserSession) => handleStart(session),
  'select_service': (message: string, session: UserSession) => handleSelectService(message, session),
  ...installHandlers,
  ...rentalHandlers,
  ...membershipHandlers,
  ...commonHandlers
};