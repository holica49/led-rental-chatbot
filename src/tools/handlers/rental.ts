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
  eventInfoConfirmed
} from '../../utils/handler-utils.js';

export function handleRentalIndoorOutdoor(message: string, session: UserSession): KakaoResponse {
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
  if (message.includes('실외')) {
    session.data.installEnvironment = '실외';
    session.step = 'rental_led_count';
    
    return {
      text: outdoorEventNotice(),
      quickReplies: createQuickReplies([
        { label: BUTTONS.CONTINUE, value: '목공 설치' },
        { label: BUTTONS.START_OVER, value: '처음부터' }
      ])
    };
  } else {
    session.data.installEnvironment = '실내';
  }
  
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

export function handleRentalLEDCount(message: string, session: UserSession): KakaoResponse {
  if (message.includes('목공')) {
    session.data.supportStructureType = '목공 설치';
  } else if (message.includes('단독')) {
    session.data.supportStructureType = '단독 설치';
  } else {
    return {
      text: '지지구조물 타입을 선택해주세요.',
      quickReplies: [
        { label: '🔨 목공 설치', action: 'message', messageText: '목공 설치' },
        { label: '🏗️ 단독 설치', action: 'message', messageText: '단독 설치' }
      ]
    };
  }
  
  session.step = 'rental_led_specs';
  return {
    text: `✅ 지지구조물: ${session.data.supportStructureType}\n\n━━━━━━\n\n몇 개소의 LED디스플레이가 필요하신가요? (1-5개)`,
    quickReplies: [
      { label: '1개', action: 'message', messageText: '1' },
      { label: '2개', action: 'message', messageText: '2' },
      { label: '3개', action: 'message', messageText: '3' },
      { label: '4개', action: 'message', messageText: '4' },
      { label: '5개', action: 'message', messageText: '5' }
    ]
  };
}

export function handleRentalLEDSpecs(message: string, session: UserSession): KakaoResponse {
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
      `LED ${session.currentLED}번`,
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
  const validation = validateStageHeight(message);
  
  if (!validation.valid || validation.height === undefined) {
    return {
      text: `❌ ${validation.error}\n\n다시 입력해주세요.`,
      quickReplies: [
        { label: '0mm', action: 'message', messageText: '0mm' },
        { label: '600mm', action: 'message', messageText: '600mm' },
        { label: '800mm', action: 'message', messageText: '800mm' },
        { label: '1000mm', action: 'message', messageText: '1000mm' }
      ]
    };
  }
  
  const currentLedIndex = session.data.ledSpecs.length - 1;
  session.data.ledSpecs[currentLedIndex].stageHeight = validation.height;
  
  session.step = 'rental_operator_needs';
  
  return {
    text: `✅ 무대 높이: ${validation.height}mm\n\n━━━━━━\n\n👨‍💼 오퍼레이터가 필요하신가요?`,
    quickReplies: [
      { label: '네, 필요합니다', action: 'message', messageText: '네' },
      { label: '아니요', action: 'message', messageText: '아니요' }
    ]
  };
}

export function handleRentalOperatorNeeds(message: string, session: UserSession): KakaoResponse {
  const currentLedIndex = session.data.ledSpecs.length - 1;
  const needsOperator = message.includes('네') || message.includes('필요');
  
  session.data.ledSpecs[currentLedIndex].needOperator = needsOperator;
  
  if (needsOperator) {
    session.step = 'rental_operator_days';
    return {
      text: `✅ 오퍼레이터 필요\n\n━━━━━━\n\n📅 오퍼레이터가 몇 일 동안 필요하신가요?`,
      quickReplies: [
        { label: '1일', action: 'message', messageText: '1' },
        { label: '2일', action: 'message', messageText: '2' },
        { label: '3일', action: 'message', messageText: '3' },
        { label: '4일', action: 'message', messageText: '4' },
        { label: '5일', action: 'message', messageText: '5' }
      ]
    };
  } else {
    session.step = 'rental_prompter';
    return {
      text: `✅ 오퍼레이터 불필요\n\n━━━━━━\n\n📺 프롬프터 연결이 필요하신가요?`,
      quickReplies: [
        { label: '네, 필요합니다', action: 'message', messageText: '네' },
        { label: '아니요', action: 'message', messageText: '아니요' }
      ]
    };
  }
}

export function handleRentalOperatorDays(message: string, session: UserSession): KakaoResponse {
  const validation = validateNumber(message, 1, 10);
  
  if (!validation.valid || !validation.value) {
    return {
      text: `❌ ${validation.error}`,
      quickReplies: [
        { label: '1일', action: 'message', messageText: '1' },
        { label: '2일', action: 'message', messageText: '2' },
        { label: '3일', action: 'message', messageText: '3' },
        { label: '4일', action: 'message', messageText: '4' },
        { label: '5일', action: 'message', messageText: '5' }
      ]
    };
  }
  
  const currentLedIndex = session.data.ledSpecs.length - 1;
  session.data.ledSpecs[currentLedIndex].operatorDays = validation.value;
  
  session.step = 'rental_prompter';
  
  return {
    text: `✅ 오퍼레이터 ${validation.value}일\n\n━━━━━━\n\n📺 프롬프터 연결이 필요하신가요?`,
    quickReplies: [
      { label: '네, 필요합니다', action: 'message', messageText: '네' },
      { label: '아니요', action: 'message', messageText: '아니요' }
    ]
  };
}

export function handleRentalPrompter(message: string, session: UserSession): KakaoResponse {
  const currentLedIndex = session.data.ledSpecs.length - 1;
  const needsPrompter = message.includes('네') || message.includes('필요');
  
  session.data.ledSpecs[currentLedIndex].prompterConnection = needsPrompter;
  
  session.step = 'rental_relay';
  
  return {
    text: `✅ 프롬프터 연결 ${needsPrompter ? '필요' : '불필요'}\n\n━━━━━━\n\n📹 중계카메라 연결이 필요하신가요?`,
    quickReplies: [
      { label: '네, 필요합니다', action: 'message', messageText: '네' },
      { label: '아니요', action: 'message', messageText: '아니요' }
    ]
  };
}

export function handleRentalRelay(message: string, session: UserSession): KakaoResponse {
  const currentLedIndex = getCurrentLEDIndex(session);
  const needsRelay = message.includes('네') || message.includes('필요');
  
  session.data.ledSpecs[currentLedIndex].relayConnection = needsRelay;
  
  if (shouldContinueToNextLED(session)) {
    session.currentLED++;
    session.step = 'rental_led_specs';
    
    return {
      text: confirmAndAsk(
        `LED ${session.currentLED - 1}번 설정 완료`,
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

export const rentalHandlers = {
  'rental_indoor_outdoor': handleRentalIndoorOutdoor,
  'rental_structure_type': handleRentalStructureType,
  'rental_led_count': handleRentalLEDCount,
  'rental_led_specs': handleRentalLEDSpecs,
  'rental_stage_height': handleRentalStageHeight,
  'rental_operator_needs': handleRentalOperatorNeeds,
  'rental_operator_days': handleRentalOperatorDays,
  'rental_prompter': handleRentalPrompter,
  'rental_relay': handleRentalRelay,
  'rental_period': handleRentalPeriod
};