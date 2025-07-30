import { HandlerMap } from './types.js';
import { commonHandlers } from './common.js';
import { installHandlers } from './install.js';
import { rentalHandlers } from './rental.js';
import { membershipHandlers } from './membership.js';
import { UserSession, KakaoResponse } from '../../types/index.js';
import { MESSAGES, BUTTONS } from '../../constants/messages.js';
import { createQuickReplies, serviceSelectedMessage } from '../../utils/handler-utils.js';

// common-handlers에서 필요한 함수들 export
export { 
  handleResetRequest, 
  checkResetRequest,
  checkPreviousRequest  // 추가
} from './common-handlers.js';

export function handleStart(session: UserSession): KakaoResponse {
  session.step = 'select_service';
  
  return {
    text: MESSAGES.GREETING,
    quickReplies: createQuickReplies([
      { label: BUTTONS.SERVICE_INSTALL, value: '설치' },
      { label: BUTTONS.SERVICE_RENTAL, value: '렌탈' },
      { label: BUTTONS.SERVICE_MEMBERSHIP, value: '멤버쉽' }
    ])
  };
}

export function handleSelectService(message: string, session: UserSession): KakaoResponse {
  if (message.includes('설치')) {
    session.serviceType = '설치';
    session.step = 'install_environment';
    
    return {
      text: serviceSelectedMessage('LED 설치', MESSAGES.SELECT_ENVIRONMENT),
      quickReplies: createQuickReplies([
        { label: BUTTONS.INDOOR_SIMPLE, value: '실내' },
        { label: BUTTONS.OUTDOOR_SIMPLE, value: '실외' }
      ])
    };
  } else if (message.includes('렌탈')) {
    session.serviceType = '렌탈';
    session.step = 'rental_indoor_outdoor';
    session.data.customerName = '메쎄이상';
    
    return {
      text: serviceSelectedMessage('LED 렌탈', MESSAGES.INPUT_EVENT_INFO),
      quickReplies: []
    };
  } else if (message.includes('멤버쉽')) {
    session.serviceType = '멤버쉽';
    session.step = 'membership_code';
    
    return {
      text: serviceSelectedMessage('멤버쉽', MESSAGES.INPUT_MEMBER_CODE),
      quickReplies: []
    };
  } else {
    return {
      text: MESSAGES.GREETING,
      quickReplies: createQuickReplies([
        { label: BUTTONS.SERVICE_INSTALL, value: '설치' },
        { label: BUTTONS.SERVICE_RENTAL, value: '렌탈' },
        { label: BUTTONS.SERVICE_MEMBERSHIP, value: '멤버쉽' }
      ])
    };
  }
}

export function handleDefault(session: UserSession): KakaoResponse {
  // 세션 초기화
  session.step = 'start';
  session.serviceType = undefined;
  session.data = { ledSpecs: [] };
  session.ledCount = 0;
  session.currentLED = 1;
  
  return handleStart(session);
}

// 모든 핸들러 통합 - 순서 중요: 공통 핸들러를 먼저, 서비스별 핸들러를 나중에
export const handlers: HandlerMap = {
  'start': (_message: string, session: UserSession) => handleStart(session),
  'select_service': (message: string, session: UserSession) => handleSelectService(message, session),
  ...commonHandlers,
  ...installHandlers,
  ...rentalHandlers,
  ...membershipHandlers
};