import { UserSession, KakaoResponse } from '../../types/index.js';
import { 
  validateAndNormalizeLEDSize, 
  validateStageHeight, 
  validateNumber, 
  validateEventPeriod 
} from '../validators/index.js';

export function handleRentalIndoorOutdoor(message: string, session: UserSession): KakaoResponse {
  const parts = message.split('/').map(part => part.trim());
  
  if (parts.length >= 2) {
    session.data.eventName = parts[0];
    session.data.venue = parts[1];
    session.step = 'rental_structure_type';
    
    return {
      text: `✅ 행사 정보 확인\n📋 행사명: ${session.data.eventName}\n📍 행사장: ${session.data.venue}\n\n━━━━━━\n\n실내 행사인가요, 실외 행사인가요?`,
      quickReplies: [
        { label: '🏢 실내', action: 'message', messageText: '실내' },
        { label: '🌳 실외', action: 'message', messageText: '실외' }
      ]
    };
  } else {
    return {
      text: '❌ 형식이 올바르지 않습니다.\n\n올바른 형식으로 다시 입력해주세요:\n📝 행사명 / 행사장\n\n예시:\n• 커피박람회 / 수원메쎄 2홀\n• 전시회 / 킨텍스 1홀',
      quickReplies: []
    };
  }
}

export function handleRentalStructureType(message: string, session: UserSession): KakaoResponse {
  if (message.includes('실외')) {
    session.data.installEnvironment = '실외';
    session.step = 'rental_led_count';
    
    return {
      text: `🌳 실외 행사로 확인되었습니다.\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n실외 행사는 최수삼 팀장이 별도로 상담을 도와드립니다.\n\n👤 담당: 최수삼 팀장\n📞 연락처: 010-2797-2504\n\n견적 요청은 계속 진행하시겠습니까?`,
      quickReplies: [
        { label: '네, 진행합니다', action: 'message', messageText: '목공 설치' },
        { label: '처음으로', action: 'message', messageText: '처음부터' }
      ]
    };
  } else {
    session.data.installEnvironment = '실내';
  }
  
  session.step = 'rental_led_count';
  return {
    text: `✅ 실내 행사로 확인되었습니다.\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n지지구조물 타입을 선택해주세요.`,
    quickReplies: [
      { label: '🔨 목공 설치', action: 'message', messageText: '목공 설치' },
      { label: '🏗️ 단독 설치', action: 'message', messageText: '단독 설치' }
    ]
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
        text: `❌ ${validation.error}\n\n1-5개 사이의 숫자를 선택해주세요.`,
        quickReplies: [
          { label: '1개', action: 'message', messageText: '1' },
          { label: '2개', action: 'message', messageText: '2' },
          { label: '3개', action: 'message', messageText: '3' },
          { label: '4개', action: 'message', messageText: '4' },
          { label: '5개', action: 'message', messageText: '5' }
        ]
      };
    }
    
    session.ledCount = validation.value;
    session.currentLED = 1;
    session.data.ledSpecs = [];
    
    return {
      text: `✅ 총 ${session.ledCount}개소의 LED 설정을 진행하겠습니다.\n\n━━━━━━\n\n🖥️ LED ${session.currentLED}번의 크기를 알려주세요.\n\n예시: 4000x2500, 6000x3000`,
      quickReplies: [
        { label: '6000x3000', action: 'message', messageText: '6000x3000' },
        { label: '4000x3000', action: 'message', messageText: '4000x3000' },
        { label: '4000x2500', action: 'message', messageText: '4000x2500' }
      ]
    };
  }
  
  const validation = validateAndNormalizeLEDSize(message);
  if (!validation.valid || !validation.size) {
    return {
      text: `❌ ${validation.error}\n\n다시 입력해주세요.`,
      quickReplies: [
        { label: '6000x3000', action: 'message', messageText: '6000x3000' },
        { label: '4000x3000', action: 'message', messageText: '4000x3000' },
        { label: '4000x2500', action: 'message', messageText: '4000x2500' }
      ]
    };
  }
  
session.data.ledSpecs.push({
  size: validation.size,
  stageHeight: 0,  // 이 줄 추가
  needOperator: false,
  operatorDays: 0,
  prompterConnection: false,
  relayConnection: false
});
  
  session.step = 'rental_stage_height';
  
  return {
    text: `✅ LED ${session.currentLED}번: ${validation.size}\n\n━━━━━━\n\n📐 무대 높이를 알려주세요. (mm 단위)`,
    quickReplies: [
      { label: '0mm', action: 'message', messageText: '0mm' },
      { label: '600mm', action: 'message', messageText: '600mm' },
      { label: '800mm', action: 'message', messageText: '800mm' },
      { label: '1000mm', action: 'message', messageText: '1000mm' }
    ]
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
  const currentLedIndex = session.data.ledSpecs.length - 1;
  const needsRelay = message.includes('네') || message.includes('필요');
  
  session.data.ledSpecs[currentLedIndex].relayConnection = needsRelay;
  
  if (session.currentLED < session.ledCount) {
    session.currentLED++;
    session.step = 'rental_led_specs';
    
    return {
      text: `✅ LED ${session.currentLED - 1}번 설정 완료\n\n━━━━━━\n\n🖥️ LED ${session.currentLED}번의 크기를 알려주세요.`,
      quickReplies: [
        { label: '6000x3000', action: 'message', messageText: '6000x3000' },
        { label: '4000x3000', action: 'message', messageText: '4000x3000' },
        { label: '4000x2500', action: 'message', messageText: '4000x2500' }
      ]
    };
  } else {
    session.step = 'rental_period';
    
    return {
      text: `✅ 모든 LED 설정이 완료되었습니다!\n\n━━━━━━\n\n📅 행사 기간을 알려주세요.\n예: 2025-07-09 ~ 2025-07-11`,
      quickReplies: []
    };
  }
}

export function handleRentalPeriod(message: string, session: UserSession): KakaoResponse {
  const validation = validateEventPeriod(message);
  
  if (!validation.valid || !validation.startDate || !validation.endDate || !validation.days) {
    return {
      text: `❌ ${validation.error}\n\n다시 입력해주세요.\n예: 2025-07-09 ~ 2025-07-11`,
      quickReplies: []
    };
  }
  
  session.data.eventStartDate = validation.startDate;
  session.data.eventEndDate = validation.endDate;
  session.data.rentalPeriod = validation.days;
  
  session.step = 'get_additional_requests';
  
  return {
    text: `✅ 행사 기간: ${validation.startDate} ~ ${validation.endDate} (${validation.days}일)\n\n━━━━━━\n\n별도 요청사항이 있으신가요?\n\n없으시면 "없음"이라고 입력해주세요.`,
    quickReplies: [
      { label: '없음', action: 'message', messageText: '없음' }
    ]
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