import { UserSession, KakaoResponse } from '../../types/index.js';
import { MESSAGES, BUTTONS, VALIDATION_ERRORS } from '../../constants/messages.js';
import { 
  confirmAndAsk, 
  serviceSelectedMessage,
  createQuickReplies,
  validateNotEmpty,
  validateSelection,
  createInstallProjectName,
  askWithProgress
} from '../../utils/handler-utils.js';
import { checkResetRequest, checkPreviousRequest } from './common-handlers.js';

export function handleInstallEnvironment(message: string, session: UserSession): KakaoResponse {
  // 처음으로 돌아가기 체크
  const resetResponse = checkResetRequest(message, session);
  if (resetResponse) return resetResponse;
  
  // 이전으로 돌아가기 체크
  const previousResponse = checkPreviousRequest(message, session);
  if (previousResponse) return previousResponse;

  if (message.includes('실내')) {
    session.data.installEnvironment = '실내';
  } else if (message.includes('실외')) {
    session.data.installEnvironment = '실외';
  } else {
    return {
      text: askWithProgress(MESSAGES.SELECT_ENVIRONMENT, session),
      quickReplies: createQuickReplies([
        { label: BUTTONS.INDOOR_SIMPLE, value: '실내' },
        { label: BUTTONS.OUTDOOR_SIMPLE, value: '실외' }
      ])
    };
  }
  
  session.step = 'install_region';
  return {
    text: askWithProgress(MESSAGES.INPUT_REGION, session),
    quickReplies: []
  };
}

export function handleInstallRegion(message: string, session: UserSession): KakaoResponse {
  // 처음으로 돌아가기 체크
  const resetResponse = checkResetRequest(message, session);
  if (resetResponse) return resetResponse;
  
  // 이전으로 돌아가기 체크
  const previousResponse = checkPreviousRequest(message, session);
  if (previousResponse) return previousResponse;

  const validation = validateNotEmpty(message, '설치 지역');
  if (!validation.valid) {
    return {
      text: validation.error || MESSAGES.INPUT_REGION,
      quickReplies: []
    };
  }
  
  session.data.installRegion = message.trim();
  session.data.venue = message.trim();
  session.step = 'install_space';

  return {
    text: askWithProgress(MESSAGES.SELECT_SPACE, session),
    quickReplies: createQuickReplies([
      { label: BUTTONS.SPACE_CORPORATE, value: '기업' },
      { label: BUTTONS.SPACE_RETAIL, value: '상가' },
      { label: BUTTONS.SPACE_HOSPITAL, value: '병원' },
      { label: BUTTONS.SPACE_PUBLIC, value: '공공' },
      { label: BUTTONS.SPACE_HOTEL, value: '숙박' },
      { label: BUTTONS.SPACE_EXHIBITION, value: '전시홀' },
      { label: BUTTONS.SPACE_OTHER, value: '기타' }
    ])
  };
}

export function handleInstallSpace(message: string, session: UserSession): KakaoResponse {
  // 처음으로 돌아가기 체크
  const resetResponse = checkResetRequest(message, session);
  if (resetResponse) return resetResponse;
  
  // 이전으로 돌아가기 체크
  const previousResponse = checkPreviousRequest(message, session);
  if (previousResponse) return previousResponse;

  const validSpaces = ['기업', '상가', '병원', '공공', '숙박', '전시홀', '기타'];
  const validation = validateSelection(message, validSpaces, MESSAGES.SELECT_SPACE, session);
  
  if (!validation.valid && validation.response) {
    return validation.response;
  }
  
  session.data.installSpace = message.trim();
  session.step = 'install_inquiry_purpose';
  
  return {
    text: askWithProgress(MESSAGES.SELECT_PURPOSE, session),
    quickReplies: createQuickReplies([
      { label: BUTTONS.PURPOSE_RESEARCH, value: '정보 조사' },
      { label: BUTTONS.PURPOSE_PLANNING, value: '아이디어 기획' },
      { label: BUTTONS.PURPOSE_QUOTE, value: '견적' },
      { label: BUTTONS.PURPOSE_PURCHASE, value: '구매' },
      { label: BUTTONS.PURPOSE_OTHER, value: '기타' }
    ])
  };
}

export function handleInquiryPurpose(message: string, session: UserSession): KakaoResponse {
  // 처음으로 돌아가기 체크
  const resetResponse = checkResetRequest(message, session);
  if (resetResponse) return resetResponse;
  
  // 이전으로 돌아가기 체크
  const previousResponse = checkPreviousRequest(message, session);
  if (previousResponse) return previousResponse;

  const validPurposes = ['정보 조사', '아이디어 기획', '견적', '구매', '기타'];
  const validation = validateSelection(message, validPurposes, MESSAGES.SELECT_PURPOSE, session);
  
  if (!validation.valid && validation.response) {
    return validation.response;
  }
  
  session.data.inquiryPurpose = message.trim();
  session.step = 'install_budget';
  
  return {
    text: askWithProgress(MESSAGES.SELECT_BUDGET, session),
    quickReplies: createQuickReplies([
      { label: BUTTONS.BUDGET_UNDER_10M, value: '1000만원 이하' },
      { label: BUTTONS.BUDGET_10M_30M, value: '1000~3000만원' },
      { label: BUTTONS.BUDGET_30M_50M, value: '3000~5000만원' },
      { label: BUTTONS.BUDGET_50M_100M, value: '5000만원~1억' },
      { label: BUTTONS.BUDGET_OVER_100M, value: '1억 이상' },
      { label: BUTTONS.BUDGET_UNDECIDED, value: '미정' }
    ])
  };
}

export function handleInstallBudget(message: string, session: UserSession): KakaoResponse {
  // 처음으로 돌아가기 체크
  const resetResponse = checkResetRequest(message, session);
  if (resetResponse) return resetResponse;
  
  // 이전으로 돌아가기 체크
  const previousResponse = checkPreviousRequest(message, session);
  if (previousResponse) return previousResponse;

  const validBudgets = ['1000만원 이하', '1000~3000만원', '3000~5000만원', '5000만원~1억', '1억 이상', '미정'];
  const validation = validateSelection(message, validBudgets, MESSAGES.SELECT_BUDGET, session);
  
  if (!validation.valid && validation.response) {
    return validation.response;
  }
  
  session.data.installBudget = message.trim();
  session.step = 'install_schedule';
  
  return {
    text: askWithProgress(MESSAGES.INPUT_SCHEDULE, session),
    quickReplies: []
  };
}

export function handleInstallSchedule(message: string, session: UserSession): KakaoResponse {
  // 처음으로 돌아가기 체크
  const resetResponse = checkResetRequest(message, session);
  if (resetResponse) return resetResponse;
  
  // 이전으로 돌아가기 체크
  const previousResponse = checkPreviousRequest(message, session);
  if (previousResponse) return previousResponse;

  const validation = validateNotEmpty(message, '설치 일정');
  if (!validation.valid) {
    return {
      text: validation.error || MESSAGES.INPUT_SCHEDULE,
      quickReplies: []
    };
  }
  
  session.data.installSchedule = message.trim();
  session.data.eventName = createInstallProjectName(session.data.installRegion || '');
  session.step = 'get_additional_requests';
  
  return {
    text: askWithProgress(MESSAGES.REQUEST_ADDITIONAL, session),
    quickReplies: createQuickReplies([
      { label: BUTTONS.NONE, value: '없음' }
    ])
  };
}

export const installHandlers = {
  'install_environment': handleInstallEnvironment,
  'install_region': handleInstallRegion,
  'install_space': handleInstallSpace,
  'install_inquiry_purpose': handleInquiryPurpose,
  'install_budget': handleInstallBudget,
  'install_schedule': handleInstallSchedule
};