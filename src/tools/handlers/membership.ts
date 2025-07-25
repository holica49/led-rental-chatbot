import { UserSession, KakaoResponse } from '../../types/index.js';
import { 
  validateNumber, 
  validateAndNormalizeLEDSize, 
  validateStageHeight, 
  validateEventPeriod 
} from '../validators/index.js';

export function handleMembershipCode(message: string, session: UserSession): KakaoResponse {
  const code = message.trim();
  
  if (code === '001') {
    session.data.memberCode = code;
    session.data.customerName = '메쎄이상';
    session.step = 'membership_event_info';
    
    return {
      text: `✅ 멤버 코드 확인: ${code} (메쎄이상)\n\n━━━━━━\n\n행사명과 행사장을 알려주세요.\n예: 커피박람회 / 수원메쎄 2홀`,
      quickReplies: []
    };
  } else {
    return {
      text: `❌ 유효하지 않은 멤버 코드입니다.\n\n다시 확인 후 입력해주세요.`,
      quickReplies: [
        { label: '처음으로', action: 'message', messageText: '처음부터' }
      ]
    };
  }
}

export function handleMembershipEventInfo(message: string, session: UserSession): KakaoResponse {
  const parts = message.split('/').map(part => part.trim());
  
  if (parts.length >= 2) {
    session.data.eventName = parts[0];
    session.data.venue = parts[1];
    session.step = 'membership_led_count';
    
    return {
      text: `✅ 행사 정보 확인\n📋 행사명: ${session.data.eventName}\n📍 행사장: ${session.data.venue}\n\n━━━━━━\n\n몇 개소의 LED가 필요하신가요? (1-5개소)`,
      quickReplies: [
        { label: '1개소', action: 'message', messageText: '1' },
        { label: '2개소', action: 'message', messageText: '2' },
        { label: '3개소', action: 'message', messageText: '3' },
        { label: '4개소', action: 'message', messageText: '4' },
        { label: '5개소', action: 'message', messageText: '5' }
      ]
    };
  } else {
    return {
      text: '❌ 형식이 올바르지 않습니다.\n\n올바른 형식으로 다시 입력해주세요:\n📝 행사명 / 행사장',
      quickReplies: []
    };
  }
}

export function handleMembershipLEDCount(message: string, session: UserSession): KakaoResponse {
  const validation = validateNumber(message, 1, 5);
  
  if (!validation.valid || !validation.value) {
    return {
      text: `❌ ${validation.error}`,
      quickReplies: [
        { label: '1개소', action: 'message', messageText: '1' },
        { label: '2개소', action: 'message', messageText: '2' },
        { label: '3개소', action: 'message', messageText: '3' },
        { label: '4개소', action: 'message', messageText: '4' },
        { label: '5개소', action: 'message', messageText: '5' }
      ]
    };
  }
  
  session.ledCount = validation.value;
  session.currentLED = 1;
  session.data.ledSpecs = [];
  session.step = 'membership_led_specs';
  
  return {
    text: `✅ 총 ${session.ledCount}개소의 LED 설정을 진행하겠습니다.\n\n━━━━━━\n\n🖥️ LED ${session.currentLED}번째 개소의 크기를 알려주세요.`,
    quickReplies: [
      { label: '6000x3000', action: 'message', messageText: '6000x3000' },
      { label: '4000x3000', action: 'message', messageText: '4000x3000' },
      { label: '4000x2500', action: 'message', messageText: '4000x2500' }
    ]
  };
}

export function handleMembershipLEDSpecs(message: string, session: UserSession): KakaoResponse {
  const validation = validateAndNormalizeLEDSize(message);
  
  if (!validation.valid || !validation.size) {
    return {
      text: `❌ ${validation.error}`,
      quickReplies: [
        { label: '6000x3000', action: 'message', messageText: '6000x3000' },
        { label: '4000x3000', action: 'message', messageText: '4000x3000' },
        { label: '4000x2500', action: 'message', messageText: '4000x2500' }
      ]
    };
  }
  
  session.data.ledSpecs.push({
    size: validation.size,
    needOperator: false,
    operatorDays: 0,
    prompterConnection: false,
    relayConnection: false
  });
  
  session.step = 'membership_stage_height';
  
  return {
    text: `✅ LED ${session.currentLED}번째 개소: ${validation.size}\n\n━━━━━━\n\n📐 이 LED의 무대 높이를 알려주세요.`,
    quickReplies: [
      { label: '600mm', action: 'message', messageText: '600mm' },
      { label: '800mm', action: 'message', messageText: '800mm' },
      { label: '1000mm', action: 'message', messageText: '1000mm' }
    ]
  };
}

export function handleMembershipStageHeight(message: string, session: UserSession): KakaoResponse {
  const validation = validateStageHeight(message);
  
  if (!validation.valid || validation.height === undefined) {
    return {
      text: `❌ ${validation.error}`,
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
  
  session.step = 'membership_operator_needs';
  
  return {
    text: `✅ LED ${session.currentLED}번째 개소 무대 높이: ${validation.height}mm\n\n━━━━━━\n\n👨‍💼 이 LED에 오퍼레이터가 필요하신가요?`,
    quickReplies: [
      { label: '네, 필요합니다', action: 'message', messageText: '네' },
      { label: '아니요', action: 'message', messageText: '아니요' }
    ]
  };
}

export function handleMembershipOperatorNeeds(message: string, session: UserSession): KakaoResponse {
  const currentLedIndex = session.data.ledSpecs.length - 1;
  const needsOperator = message.includes('네') || message.includes('필요');
  
  session.data.ledSpecs[currentLedIndex].needOperator = needsOperator;
  
  if (needsOperator) {
    session.step = 'membership_operator_days';
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
    session.step = 'membership_prompter';
    return {
      text: `✅ 오퍼레이터 불필요\n\n━━━━━━\n\n📺 프롬프터 연결이 필요하신가요?`,
      quickReplies: [
        { label: '네, 필요합니다', action: 'message', messageText: '네' },
        { label: '아니요', action: 'message', messageText: '아니요' }
      ]
    };
  }
}

export function handleMembershipOperatorDays(message: string, session: UserSession): KakaoResponse {
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
  
  session.step = 'membership_prompter';
  
  return {
    text: `✅ 오퍼레이터 ${validation.value}일\n\n━━━━━━\n\n📺 프롬프터 연결이 필요하신가요?`,
    quickReplies: [
      { label: '네, 필요합니다', action: 'message', messageText: '네' },
      { label: '아니요', action: 'message', messageText: '아니요' }
    ]
  };
}

export function handleMembershipPrompter(message: string, session: UserSession): KakaoResponse {
  const currentLedIndex = session.data.ledSpecs.length - 1;
  const needsPrompter = message.includes('네') || message.includes('필요');
  
  session.data.ledSpecs[currentLedIndex].prompterConnection = needsPrompter;
  
  session.step = 'membership_relay';
  
  return {
    text: `✅ 프롬프터 연결 ${needsPrompter ? '필요' : '불필요'}\n\n━━━━━━\n\n📹 중계카메라 연결이 필요하신가요?`,
    quickReplies: [
      { label: '네, 필요합니다', action: 'message', messageText: '네' },
      { label: '아니요', action: 'message', messageText: '아니요' }
    ]
  };
}

export function handleMembershipRelay(message: string, session: UserSession): KakaoResponse {
  const currentLedIndex = session.data.ledSpecs.length - 1;
  const needsRelay = message.includes('네') || message.includes('필요');
  
  session.data.ledSpecs[currentLedIndex].relayConnection = needsRelay;
  
  if (session.currentLED < session.ledCount) {
    session.currentLED++;
    session.step = 'membership_led_specs';
    
    return {
      text: `✅ LED ${session.currentLED - 1}번째 개소 설정 완료\n\n━━━━━━\n\n🖥️ LED ${session.currentLED}번째 개소의 크기를 알려주세요.`,
      quickReplies: [
        { label: '6000x3000', action: 'message', messageText: '6000x3000' },
        { label: '4000x3000', action: 'message', messageText: '4000x3000' },
        { label: '4000x2500', action: 'message', messageText: '4000x2500' }
      ]
    };
  } else {
    session.step = 'membership_period';
    
    const ledSummary = session.data.ledSpecs.map((led, index) => {
      const [w, h] = led.size.split('x').map(Number);
      const moduleCount = (w / 500) * (h / 500);
      return `LED${index + 1}: ${led.size} (${led.stageHeight}mm, ${moduleCount}개)`;
    }).join('\n');
    
    return {
      text: `✅ 모든 LED 설정이 완료되었습니다!\n\n📋 설정 요약:\n${ledSummary}\n\n━━━━━━\n\n📅 행사 기간을 알려주세요.\n예: 2025-07-09 ~ 2025-07-11`,
      quickReplies: []
    };
  }
}

export function handleMembershipPeriod(message: string, session: UserSession): KakaoResponse {
  const validation = validateEventPeriod(message);
  
  if (!validation.valid || !validation.startDate || !validation.endDate) {
    return {
      text: `❌ ${validation.error}\n\n다시 입력해주세요.\n예: 2025-07-09 ~ 2025-07-11`,
      quickReplies: []
    };
  }
  
  session.data.eventStartDate = validation.startDate;
  session.data.eventEndDate = validation.endDate;
  
  session.step = 'get_additional_requests';
  
  return {
    text: `✅ 행사 기간: ${validation.startDate} ~ ${validation.endDate}\n\n━━━━━━\n\n별도 요청사항이 있으신가요?\n\n없으시면 "없음"이라고 입력해주세요.`,
      quickReplies: [
        { label: '없음', action: 'message', messageText: '없음' }
      ]
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