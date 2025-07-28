import { UserSession, KakaoResponse } from '../../types/index.js';
import { 
  validateNumber, 
  validateAndNormalizeLEDSize, 
  validateStageHeight, 
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
  memberCodeConfirmed,
  eventInfoConfirmed
} from '../../utils/handler-utils.js';
import { handleResetRequest, checkResetRequest, checkPreviousRequest } from './common-handlers.js';

export function handleMembershipCode(message: string, session: UserSession): KakaoResponse {
  // 처음으로 돌아가기 체크
  const resetResponse = checkResetRequest(message, session);
  if (resetResponse) return resetResponse;
  
  // 이전으로 돌아가기 체크
  const previousResponse = checkPreviousRequest(message, session);
  if (previousResponse) return previousResponse;

  const code = message.trim();
  
  if (code === '001') {
    session.data.memberCode = code;
    session.data.customerName = '메쎄이상';
    session.step = 'membership_event_info';
    
    return {
      text: memberCodeConfirmed(code),
      quickReplies: []
    };
  } else {
    return {
      text: errorMessage(VALIDATION_ERRORS.MEMBER_CODE),
      quickReplies: createQuickReplies([
        { label: BUTTONS.START_OVER, value: '처음부터' }
      ])
    };
  }
}

export function handleMembershipEventInfo(message: string, session: UserSession): KakaoResponse {
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
  session.step = 'membership_led_count';
  
  return {
    text: eventInfoConfirmed(
      session.data.eventName,
      session.data.venue,
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

export function handleMembershipLEDCount(message: string, session: UserSession): KakaoResponse {
  // 처음으로 돌아가기 체크
  const resetResponse = checkResetRequest(message, session);
  if (resetResponse) return resetResponse;
  
  // 이전으로 돌아가기 체크
  const previousResponse = checkPreviousRequest(message, session);
  if (previousResponse) return previousResponse;

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
  session.step = 'membership_led_specs';
  
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

export function handleMembershipLEDSpecs(message: string, session: UserSession): KakaoResponse {
  // 처음으로 돌아가기 체크
  const resetResponse = checkResetRequest(message, session);
  if (resetResponse) return resetResponse;
  
  // 이전으로 돌아가기 체크
  const previousResponse = checkPreviousRequest(message, session);
  if (previousResponse) return previousResponse;

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
  session.step = 'membership_stage_height';
  
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

export function handleMembershipStageHeight(message: string, session: UserSession): KakaoResponse {
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
  
  session.step = 'membership_operator_needs';
  
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

export function handleMembershipOperatorNeeds(message: string, session: UserSession): KakaoResponse {
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
    session.step = 'membership_operator_days';
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
    session.step = 'membership_prompter';
    return {
      text: confirmAndAsk('오퍼레이터 불필요', '', MESSAGES.ASK_PROMPTER),
      quickReplies: createQuickReplies([
        { label: BUTTONS.YES, value: '네' },
        { label: BUTTONS.NO, value: '아니요' }
      ])
    };
  }
}

export function handleMembershipOperatorDays(message: string, session: UserSession): KakaoResponse {
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
  
  session.step = 'membership_prompter';
  
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

export function handleMembershipPrompter(message: string, session: UserSession): KakaoResponse {
  // 처음으로 돌아가기 체크
  const resetResponse = checkResetRequest(message, session);
  if (resetResponse) return resetResponse;
  
  // 이전으로 돌아가기 체크
  const previousResponse = checkPreviousRequest(message, session);
  if (previousResponse) return previousResponse;

  const currentLedIndex = getCurrentLEDIndex(session);
  const needsPrompter = message.includes('네') || message.includes('필요');
  
  session.data.ledSpecs[currentLedIndex].prompterConnection = needsPrompter;
  
  session.step = 'membership_relay';
  
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

export function handleMembershipRelay(message: string, session: UserSession): KakaoResponse {
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
    session.step = 'membership_led_specs';
    
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
    session.step = 'membership_period';
    
    return {
      text: createLEDCompleteMessage(session) + '\n\n' + MESSAGES.INPUT_PERIOD,
      quickReplies: []
    };
  }
}

export function handleMembershipPeriod(message: string, session: UserSession): KakaoResponse {
  // 처음으로 돌아가기 체크
  const resetResponse = checkResetRequest(message, session);
  if (resetResponse) return resetResponse;
  
  // 이전으로 돌아가기 체크
  const previousResponse = checkPreviousRequest(message, session);
  if (previousResponse) return previousResponse;

  const validation = validateEventPeriod(message);
  
  if (!validation.valid || !validation.startDate || !validation.endDate) {
    return {
      text: errorMessage(validation.error || VALIDATION_ERRORS.PERIOD),
      quickReplies: []
    };
  }
  
  session.data.eventStartDate = validation.startDate;
  session.data.eventEndDate = validation.endDate;
  
  session.step = 'get_additional_requests';
  
  return {
    text: confirmAndAsk(
      '행사 기간',
      `${validation.startDate} ~ ${validation.endDate}`,
      MESSAGES.REQUEST_ADDITIONAL
    ),
    quickReplies: createQuickReplies([
      { label: BUTTONS.NONE, value: '없음' }
    ])
  };
}

export const membershipHandlers = {
  'membership_code': handleMembershipCode,
  'membership_event_info': handleMembershipEventInfo,
  'membership_led_count': handleMembershipLEDCount,
  'membership_led_specs': handleMembershipLEDSpecs,
  'membership_stage_height': handleMembershipStageHeight,
  'membership_operator_needs': handleMembershipOperatorNeeds,
  'membership_operator_days': handleMembershipOperatorDays,
  'membership_prompter': handleMembershipPrompter,
  'membership_relay': handleMembershipRelay,
  'membership_period': handleMembershipPeriod
};