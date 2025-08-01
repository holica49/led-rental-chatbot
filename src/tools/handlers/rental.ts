// src/tools/handlers/rental.ts

import { UserSession, KakaoResponse } from '../../types/index.js';
import { 
  validateAndNormalizeLEDSize, 
  validateStageHeight, 
  validateNumber, 
  validateEventPeriod 
} from '../validators/index.js';
import { MESSAGES, BUTTONS, VALIDATION_ERRORS } from '../../constants/messages.js';
import { 
  confirmAndAsk,
  errorMessage,
  createQuickReplies,
  parseEventInfo,
  createLEDSizePrompt,
  saveLEDSpec,
  getCurrentLEDIndex,
  shouldContinueToNextLED,
  createLEDCompleteMessage,
  outdoorEventNotice,
  eventInfoConfirmed,
  validateSelection
} from '../../utils/handler-utils.js';
import { handleResetRequest, checkResetRequest, checkPreviousRequest } from './common-handlers.js';

export function handleRentalIndoorOutdoor(message: string, session: UserSession): KakaoResponse {
  // 처음으로 돌아가기 체크
  const resetResponse = checkResetRequest(message, session);
  if (resetResponse) return resetResponse;
  
  // 이전으로 돌아가기 체크
  const previousResponse = checkPreviousRequest(message, session);
  if (previousResponse) return previousResponse;
  
  const result = parseEventInfo(message);
  
  if (result.error) {
    return {
      text: errorMessage(result.error),
      quickReplies: []
    };
  }
  
  session.data.eventName = result.eventName!;
  session.data.venue = result.venue!;
  session.step = 'rental_structure_type';
  
  return {
    text: eventInfoConfirmed(
      session.data.eventName, 
      session.data.venue, 
      MESSAGES.SELECT_INDOOR_OUTDOOR
    ),
    quickReplies: createQuickReplies([
      { label: BUTTONS.INDOOR, value: '실내' },
      { label: BUTTONS.OUTDOOR, value: '실외' }
    ])
  };
}

export function handleRentalStructureType(message: string, session: UserSession): KakaoResponse {
  // 처음으로 돌아가기 체크
  const resetResponse = checkResetRequest(message, session);
  if (resetResponse) return resetResponse;
  
  // 이전으로 돌아가기 체크
  const previousResponse = checkPreviousRequest(message, session);
  if (previousResponse) return previousResponse;
  
  if (message.includes('실외')) {
    session.data.installEnvironment = '실외';
    session.step = 'rental_inquiry_purpose';  // 변경: inquiry_purpose -> rental_inquiry_purpose
    
    return {
      text: outdoorEventNotice() + '\n\n' + MESSAGES.SELECT_PURPOSE,
      quickReplies: createQuickReplies([
        { label: BUTTONS.PURPOSE_RESEARCH, value: '정보 조사' },
        { label: BUTTONS.PURPOSE_PLANNING, value: '아이디어 기획' },
        { label: BUTTONS.PURPOSE_QUOTE, value: '견적' },
        { label: BUTTONS.PURPOSE_PURCHASE, value: '구매' },
        { label: BUTTONS.PURPOSE_OTHER, value: '기타' }
      ])
    };
  } else {
    session.data.installEnvironment = '실내';
    session.step = 'rental_led_count';
    
    return {
      text: confirmAndAsk(
        '실내 행사로 확인되었습니다',
        '',
        MESSAGES.SELECT_STRUCTURE
      ),
      quickReplies: createQuickReplies([
        { label: BUTTONS.STRUCTURE_WOOD, value: '목공 설치' },
        { label: BUTTONS.STRUCTURE_STANDALONE, value: '단독 설치' }
      ])
    };
  }
}

export function handleRentalOutdoorPurpose(message: string, session: UserSession): KakaoResponse {
  // 처음으로 돌아가기 체크
  const resetResponse = checkResetRequest(message, session);
  if (resetResponse) return resetResponse;
  
  // 이전으로 돌아가기 체크
  const previousResponse = checkPreviousRequest(message, session);
  if (previousResponse) return previousResponse;

  const validPurposes = ['정보 조사', '아이디어 기획', '견적', '구매', '기타'];
  const validation = validateSelection(message, validPurposes, MESSAGES.SELECT_PURPOSE);
  
  if (!validation.valid && validation.response) {
    return validation.response;
  }
  
  session.data.inquiryPurpose = message.trim();
  session.step = 'rental_outdoor_budget';
  
  return {
    text: confirmAndAsk('문의 목적', session.data.inquiryPurpose, MESSAGES.SELECT_BUDGET),
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

export function handleRentalOutdoorBudget(message: string, session: UserSession): KakaoResponse {
  // 처음으로 돌아가기 체크
  const resetResponse = checkResetRequest(message, session);
  if (resetResponse) return resetResponse;
  
  // 이전으로 돌아가기 체크
  const previousResponse = checkPreviousRequest(message, session);
  if (previousResponse) return previousResponse;

  const validBudgets = ['1000만원 이하', '1000~3000만원', '3000~5000만원', '5000만원~1억', '1억 이상', '미정'];
  const validation = validateSelection(message, validBudgets, MESSAGES.SELECT_BUDGET);
  
  if (!validation.valid && validation.response) {
    return validation.response;
  }
  
  session.data.installBudget = message.trim();
  session.step = 'rental_period';
  
  return {
    text: confirmAndAsk('설치 예산', session.data.installBudget, MESSAGES.INPUT_PERIOD),
    quickReplies: []
  };
}

export function handleRentalLEDCount(message: string, session: UserSession): KakaoResponse {
  // 처음으로 돌아가기 체크
  const resetResponse = checkResetRequest(message, session);
  if (resetResponse) return resetResponse;
  
  // 이전으로 돌아가기 체크
  const previousResponse = checkPreviousRequest(message, session);
  if (previousResponse) return previousResponse;
  
  // 실외 렌탈인 경우 - LED 개수만 처리
  if (session.data.installEnvironment === '실외') {
    const validation = validateNumber(message, 1, 5);
    if (!validation.valid || !validation.value) {
      return {
        text: errorMessage(validation.error || VALIDATION_ERRORS.NUMBER_RANGE(1, 5)),
        quickReplies: createQuickReplies([
          { label: BUTTONS.LED_COUNT[0], value: '1' },
          { label: BUTTONS.LED_COUNT[1], value: '2' },
          { label: BUTTONS.LED_COUNT[2], value: '3' },
          { label: BUTTONS.LED_COUNT[3], value: '4' },
          { label: BUTTONS.LED_COUNT[4], value: '5' }
        ])
      };
    }
    
    session.ledCount = validation.value;
    session.currentLED = 1;
    session.data.ledSpecs = [];
    session.step = 'rental_led_specs';
    
    return {
      text: confirmAndAsk(
        `총 ${session.ledCount}개소의 LED 설정을 진행하겠습니다`,
        '',
        createLEDSizePrompt(session.currentLED)
      ),
      quickReplies: createQuickReplies([
        { label: BUTTONS.LED_SIZE_6000_3000, value: '6000x3000' },
        { label: BUTTONS.LED_SIZE_4000_3000, value: '4000x3000' },
        { label: BUTTONS.LED_SIZE_4000_2500, value: '4000x2500' }
      ])
    };
  }
  
  // 실내 렌탈인 경우 - 기존 로직 (지지구조물 선택 포함)
  // 지지구조물 선택 처리
  if (message.includes('목공')) {
    session.data.supportStructureType = '목공 설치';
  } else if (message.includes('단독')) {
    session.data.supportStructureType = '단독 설치';
  } else if (!session.data.supportStructureType) {
    return {
      text: MESSAGES.SELECT_STRUCTURE,
      quickReplies: createQuickReplies([
        { label: BUTTONS.STRUCTURE_WOOD, value: '목공 설치' },
        { label: BUTTONS.STRUCTURE_STANDALONE, value: '단독 설치' }
      ])
    };
  }
  
  session.step = 'rental_led_specs';
  return {
    text: confirmAndAsk(
      '지지구조물',
      session.data.supportStructureType,
      MESSAGES.SELECT_LED_COUNT
    ),
    quickReplies: createQuickReplies([
      { label: BUTTONS.LED_COUNT[0], value: '1' },
      { label: BUTTONS.LED_COUNT[1], value: '2' },
      { label: BUTTONS.LED_COUNT[2], value: '3' },
      { label: BUTTONS.LED_COUNT[3], value: '4' },
      { label: BUTTONS.LED_COUNT[4], value: '5' }
    ])
  };
}

export function handleRentalLEDSpecs(message: string, session: UserSession): KakaoResponse {
  // 처음으로 돌아가기 체크
  const resetResponse = checkResetRequest(message, session);
  if (resetResponse) return resetResponse;
  
  // 이전으로 돌아가기 체크
  const previousResponse = checkPreviousRequest(message, session);
  if (previousResponse) return previousResponse;
  
  // LED 개수 설정이 안되어 있으면 먼저 처리
  if (session.ledCount === 0) {
    const validation = validateNumber(message, 1, 5);
    if (!validation.valid || !validation.value) {
      return {
        text: errorMessage(validation.error || VALIDATION_ERRORS.NUMBER_RANGE(1, 5)),
        quickReplies: createQuickReplies([
          { label: BUTTONS.LED_COUNT[0], value: '1' },
          { label: BUTTONS.LED_COUNT[1], value: '2' },
          { label: BUTTONS.LED_COUNT[2], value: '3' },
          { label: BUTTONS.LED_COUNT[3], value: '4' },
          { label: BUTTONS.LED_COUNT[4], value: '5' }
        ])
      };
    }
    
    session.ledCount = validation.value;
    session.currentLED = 1;
    session.data.ledSpecs = [];
    
    return {
      text: confirmAndAsk(
        `총 ${session.ledCount}개소의 LED 설정을 진행하겠습니다`,
        '',
        createLEDSizePrompt(session.currentLED)
      ),
      quickReplies: createQuickReplies([
        { label: BUTTONS.LED_SIZE_6000_3000, value: '6000x3000' },
        { label: BUTTONS.LED_SIZE_4000_3000, value: '4000x3000' },
        { label: BUTTONS.LED_SIZE_4000_2500, value: '4000x2500' }
      ])
    };
  }
  
  // LED 크기 검증
  const validation = validateAndNormalizeLEDSize(message);
  if (!validation.valid || !validation.size) {
    return {
      text: errorMessage(validation.error || VALIDATION_ERRORS.LED_SIZE),
      quickReplies: createQuickReplies([
        { label: BUTTONS.LED_SIZE_6000_3000, value: '6000x3000' },
        { label: BUTTONS.LED_SIZE_4000_3000, value: '4000x3000' },
        { label: BUTTONS.LED_SIZE_4000_2500, value: '4000x2500' }
      ])
    };
  }
  
  saveLEDSpec(session, validation.size);
  session.step = 'rental_stage_height';
  
  return {
    text: confirmAndAsk(
      `LED ${session.currentLED}번째 개소`,
      validation.size,
      MESSAGES.INPUT_STAGE_HEIGHT
    ),
    quickReplies: createQuickReplies([
      { label: BUTTONS.STAGE_HEIGHT_0, value: '0mm' },
      { label: BUTTONS.STAGE_HEIGHT_600, value: '600mm' },
      { label: BUTTONS.STAGE_HEIGHT_800, value: '800mm' },
      { label: BUTTONS.STAGE_HEIGHT_1000, value: '1000mm' }
    ])
  };
}

export function handleRentalStageHeight(message: string, session: UserSession): KakaoResponse {
  // 처음으로 돌아가기 체크
  const resetResponse = checkResetRequest(message, session);
  if (resetResponse) return resetResponse;
  
  // 이전으로 돌아가기 체크
  const previousResponse = checkPreviousRequest(message, session);
  if (previousResponse) return previousResponse;
  
  const validation = validateStageHeight(message);
  
  if (!validation.valid || validation.height === undefined) {
    return {
      text: errorMessage(validation.error || VALIDATION_ERRORS.STAGE_HEIGHT),
      quickReplies: createQuickReplies([
        { label: BUTTONS.STAGE_HEIGHT_0, value: '0mm' },
        { label: BUTTONS.STAGE_HEIGHT_600, value: '600mm' },
        { label: BUTTONS.STAGE_HEIGHT_800, value: '800mm' },
        { label: BUTTONS.STAGE_HEIGHT_1000, value: '1000mm' }
      ])
    };
  }
  
  const currentLedIndex = getCurrentLEDIndex(session);
  session.data.ledSpecs[currentLedIndex].stageHeight = validation.height;
  
  session.step = 'rental_operator_needs';
  
  return {
    text: confirmAndAsk(
      `LED ${session.currentLED}번째 개소 무대 높이`,
      `${validation.height}mm`,
      MESSAGES.ASK_OPERATOR
    ),
    quickReplies: createQuickReplies([
      { label: BUTTONS.YES, value: '네' },
      { label: BUTTONS.NO, value: '아니요' }
    ])
  };
}

export function handleRentalOperatorNeeds(message: string, session: UserSession): KakaoResponse {
  // 처음으로 돌아가기 체크
  const resetResponse = checkResetRequest(message, session);
  if (resetResponse) return resetResponse;
  
  // 이전으로 돌아가기 체크
  const previousResponse = checkPreviousRequest(message, session);
  if (previousResponse) return previousResponse;
  
  const currentLedIndex = getCurrentLEDIndex(session);
  const needsOperator = message.includes('네') || message.includes('필요');
  
  session.data.ledSpecs[currentLedIndex].needOperator = needsOperator;
  
  if (needsOperator) {
    session.step = 'rental_operator_days';
    return {
      text: confirmAndAsk('오퍼레이터 필요', '', MESSAGES.ASK_OPERATOR_DAYS),
      quickReplies: createQuickReplies([
        { label: BUTTONS.DAYS[0], value: '1' },
        { label: BUTTONS.DAYS[1], value: '2' },
        { label: BUTTONS.DAYS[2], value: '3' },
        { label: BUTTONS.DAYS[3], value: '4' },
        { label: BUTTONS.DAYS[4], value: '5' }
      ])
    };
  } else {
    session.step = 'rental_prompter';
    return {
      text: confirmAndAsk('오퍼레이터 불필요', '', MESSAGES.ASK_PROMPTER),
      quickReplies: createQuickReplies([
        { label: BUTTONS.YES, value: '네' },
        { label: BUTTONS.NO, value: '아니요' }
      ])
    };
  }
}

export function handleRentalOperatorDays(message: string, session: UserSession): KakaoResponse {
  // 처음으로 돌아가기 체크
  const resetResponse = checkResetRequest(message, session);
  if (resetResponse) return resetResponse;
  
  // 이전으로 돌아가기 체크
  const previousResponse = checkPreviousRequest(message, session);
  if (previousResponse) return previousResponse;
  
  const validation = validateNumber(message, 1, 10);
  
  if (!validation.valid || !validation.value) {
    return {
      text: errorMessage(validation.error || VALIDATION_ERRORS.NUMBER_RANGE(1, 10)),
      quickReplies: createQuickReplies([
        { label: BUTTONS.DAYS[0], value: '1' },
        { label: BUTTONS.DAYS[1], value: '2' },
        { label: BUTTONS.DAYS[2], value: '3' },
        { label: BUTTONS.DAYS[3], value: '4' },
        { label: BUTTONS.DAYS[4], value: '5' }
      ])
    };
  }
  
  const currentLedIndex = getCurrentLEDIndex(session);
  session.data.ledSpecs[currentLedIndex].operatorDays = validation.value;
  
  session.step = 'rental_prompter';
  
  return {
    text: confirmAndAsk(
      '오퍼레이터',
      `${validation.value}일`,
      MESSAGES.ASK_PROMPTER
    ),
    quickReplies: createQuickReplies([
      { label: BUTTONS.YES, value: '네' },
      { label: BUTTONS.NO, value: '아니요' }
    ])
  };
}

export function handleRentalPrompter(message: string, session: UserSession): KakaoResponse {
  // 처음으로 돌아가기 체크
  const resetResponse = checkResetRequest(message, session);
  if (resetResponse) return resetResponse;
  
  // 이전으로 돌아가기 체크
  const previousResponse = checkPreviousRequest(message, session);
  if (previousResponse) return previousResponse;
  
  const currentLedIndex = getCurrentLEDIndex(session);
  const needsPrompter = message.includes('네') || message.includes('필요');
  
  session.data.ledSpecs[currentLedIndex].prompterConnection = needsPrompter;
  
  session.step = 'rental_relay';
  
  return {
    text: confirmAndAsk(
      `프롬프터 연결 ${needsPrompter ? '필요' : '불필요'}`,
      '',
      MESSAGES.ASK_RELAY
    ),
    quickReplies: createQuickReplies([
      { label: BUTTONS.YES, value: '네' },
      { label: BUTTONS.NO, value: '아니요' }
    ])
  };
}

export function handleRentalRelay(message: string, session: UserSession): KakaoResponse {
  // 처음으로 돌아가기 체크
  const resetResponse = checkResetRequest(message, session);
  if (resetResponse) return resetResponse;
  
  // 이전으로 돌아가기 체크
  const previousResponse = checkPreviousRequest(message, session);
  if (previousResponse) return previousResponse;
  
  const currentLedIndex = getCurrentLEDIndex(session);
  const needsRelay = message.includes('네') || message.includes('필요');
  
  session.data.ledSpecs[currentLedIndex].relayConnection = needsRelay;
  
  if (shouldContinueToNextLED(session)) {
    session.currentLED++;
    session.step = 'rental_led_specs';
    
    return {
      text: confirmAndAsk(
        `LED ${session.currentLED - 1}번째 개소 설정 완료`,
        '',
        createLEDSizePrompt(session.currentLED)
      ),
      quickReplies: createQuickReplies([
        { label: BUTTONS.LED_SIZE_6000_3000, value: '6000x3000' },
        { label: BUTTONS.LED_SIZE_4000_3000, value: '4000x3000' },
        { label: BUTTONS.LED_SIZE_4000_2500, value: '4000x2500' }
      ])
    };
  } else {
    session.step = 'rental_period';
    
    return {
      text: createLEDCompleteMessage(session) + '\n\n' + MESSAGES.INPUT_PERIOD,
      quickReplies: []
    };
  }
}

export function handleRentalPeriod(message: string, session: UserSession): KakaoResponse {
  // 처음으로 돌아가기 체크
  const resetResponse = checkResetRequest(message, session);
  if (resetResponse) return resetResponse;
  
  // 이전으로 돌아가기 체크
  const previousResponse = checkPreviousRequest(message, session);
  if (previousResponse) return previousResponse;
  
  const validation = validateEventPeriod(message);
  
  if (!validation.valid || !validation.startDate || !validation.endDate || !validation.days) {
    return {
      text: errorMessage(validation.error || VALIDATION_ERRORS.PERIOD),
      quickReplies: []
    };
  }
  
  session.data.eventStartDate = validation.startDate;
  session.data.eventEndDate = validation.endDate;
  session.data.rentalPeriod = validation.days;
  
  // 실외인 경우 LED 개수 선택으로
  if (session.data.installEnvironment === '실외') {
    session.step = 'rental_led_count';
    
    return {
      text: confirmAndAsk(
        '행사 기간',
        `${validation.startDate} ~ ${validation.endDate} (${validation.days}일)`,
        MESSAGES.SELECT_LED_COUNT
      ),
      quickReplies: createQuickReplies([
        { label: BUTTONS.LED_COUNT[0], value: '1' },
        { label: BUTTONS.LED_COUNT[1], value: '2' },
        { label: BUTTONS.LED_COUNT[2], value: '3' },
        { label: BUTTONS.LED_COUNT[3], value: '4' },
        { label: BUTTONS.LED_COUNT[4], value: '5' }
      ])
    };
  } else {
    // 실내는 기존대로 추가 요청사항으로
    session.step = 'get_additional_requests';
    
    return {
      text: confirmAndAsk(
        '행사 기간',
        `${validation.startDate} ~ ${validation.endDate} (${validation.days}일)`,
        MESSAGES.REQUEST_ADDITIONAL
      ),
      quickReplies: createQuickReplies([
        { label: BUTTONS.NONE, value: '없음' }
      ])
    };
  }
}

export const rentalHandlers = {
  'rental_indoor_outdoor': handleRentalIndoorOutdoor,
  'rental_structure_type': handleRentalStructureType,
  'rental_inquiry_purpose': handleRentalOutdoorPurpose,  // 변경: inquiry_purpose -> rental_inquiry_purpose
  'rental_outdoor_budget': handleRentalOutdoorBudget,
  'rental_led_count': handleRentalLEDCount,
  'rental_led_specs': handleRentalLEDSpecs,
  'rental_stage_height': handleRentalStageHeight,
  'rental_operator_needs': handleRentalOperatorNeeds,
  'rental_operator_days': handleRentalOperatorDays,
  'rental_prompter': handleRentalPrompter,
  'rental_relay': handleRentalRelay,
  'rental_period': handleRentalPeriod
};