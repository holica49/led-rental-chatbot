import { UserSession, KakaoResponse } from '../../types';

export function handleInstallEnvironment(message: string, session: UserSession): KakaoResponse {
  if (message.includes('실내')) {
    session.data.installEnvironment = '실내';
  } else if (message.includes('실외')) {
    session.data.installEnvironment = '실외';
  } else {
    return {
      text: '설치 환경을 선택해주세요.',
      quickReplies: [
        { label: '🏢 실내 설치', action: 'message', messageText: '실내' },
        { label: '🌳 실외 설치', action: 'message', messageText: '실외' }
      ]
    };
  }
  
  session.step = 'install_region';
  return {
    text: `✅ ${session.data.installEnvironment} 설치로 선택하셨습니다.\n\n━━━━━━\n\n설치하실 지역을 입력해주세요.\n예: 서울, 경기, 부산 등`,
    quickReplies: []
  };
}

export function handleInstallRegion(message: string, session: UserSession): KakaoResponse {
  if (!message || message.trim().length === 0) {
    return {
      text: '설치 지역을 입력해주세요.\n예: 서울, 경기, 부산 등',
      quickReplies: []
    };
  }
  
  session.data.installRegion = message.trim();
  session.data.venue = message.trim();
  session.step = 'install_space';

  return {
    text: `✅ 설치 지역: ${session.data.installRegion}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n어떤 공간에 설치하실 예정인가요?`,
    quickReplies: [
      { label: '🏢 기업', action: 'message', messageText: '기업' },
      { label: '🏪 상가', action: 'message', messageText: '상가' },
      { label: '🏥 병원', action: 'message', messageText: '병원' },
      { label: '🏛️ 공공', action: 'message', messageText: '공공' },
      { label: '🏨 숙박', action: 'message', messageText: '숙박' },
      { label: '🎪 전시홀', action: 'message', messageText: '전시홀' },
      { label: '🔸 기타', action: 'message', messageText: '기타' }
    ]
  };
}

export function handleInstallSpace(message: string, session: UserSession): KakaoResponse {
  const validSpaces = ['기업', '상가', '병원', '공공', '숙박', '전시홀', '기타'];
  
  if (!validSpaces.includes(message.trim())) {
    return {
      text: '설치 공간을 선택해주세요.',
      quickReplies: [
        { label: '🏢 기업', action: 'message', messageText: '기업' },
        { label: '🏪 상가', action: 'message', messageText: '상가' },
        { label: '🏥 병원', action: 'message', messageText: '병원' },
        { label: '🏛️ 공공', action: 'message', messageText: '공공' },
        { label: '🏨 숙박', action: 'message', messageText: '숙박' },
        { label: '🎪 전시홀', action: 'message', messageText: '전시홀' },
        { label: '🔸 기타', action: 'message', messageText: '기타' }
      ]
    };
  }
  
  session.data.installSpace = message.trim();
  session.step = 'inquiry_purpose';
  
  return {
    text: `✅ 설치 공간: ${session.data.installSpace}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n문의 목적을 알려주세요.`,
    quickReplies: [
      { label: '🔍 정보 조사', action: 'message', messageText: '정보 조사' },
      { label: '💡 아이디어 기획', action: 'message', messageText: '아이디어 기획' },
      { label: '💰 견적', action: 'message', messageText: '견적' },
      { label: '🛒 구매', action: 'message', messageText: '구매' },
      { label: '🔸 기타', action: 'message', messageText: '기타' }
    ]
  };
}

export function handleInquiryPurpose(message: string, session: UserSession): KakaoResponse {
  const validPurposes = ['정보 조사', '아이디어 기획', '견적', '구매', '기타'];
  
  if (!validPurposes.includes(message.trim())) {
    return {
      text: '문의 목적을 선택해주세요.',
      quickReplies: [
        { label: '🔍 정보 조사', action: 'message', messageText: '정보 조사' },
        { label: '💡 아이디어 기획', action: 'message', messageText: '아이디어 기획' },
        { label: '💰 견적', action: 'message', messageText: '견적' },
        { label: '🛒 구매', action: 'message', messageText: '구매' },
        { label: '🔸 기타', action: 'message', messageText: '기타' }
      ]
    };
  }
  
  session.data.inquiryPurpose = message.trim();
  session.step = 'install_budget';
  
  return {
    text: `✅ 문의 목적: ${session.data.inquiryPurpose}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n예상 설치 예산을 알려주세요.`,
    quickReplies: [
      { label: '1000만원 이하', action: 'message', messageText: '1000만원 이하' },
      { label: '1000~3000만원', action: 'message', messageText: '1000~3000만원' },
      { label: '3000~5000만원', action: 'message', messageText: '3000~5000만원' },
      { label: '5000만원~1억', action: 'message', messageText: '5000만원~1억' },
      { label: '1억 이상', action: 'message', messageText: '1억 이상' },
      { label: '미정', action: 'message', messageText: '미정' }
    ]
  };
}

export function handleInstallBudget(message: string, session: UserSession): KakaoResponse {
  const validBudgets = ['1000만원 이하', '1000~3000만원', '3000~5000만원', '5000만원~1억', '1억 이상', '미정'];
  
  if (!validBudgets.includes(message.trim())) {
    return {
      text: '설치 예산을 선택해주세요.',
      quickReplies: [
        { label: '1000만원 이하', action: 'message', messageText: '1000만원 이하' },
        { label: '1000~3000만원', action: 'message', messageText: '1000~3000만원' },
        { label: '3000~5000만원', action: 'message', messageText: '3000~5000만원' },
        { label: '5000만원~1억', action: 'message', messageText: '5000만원~1억' },
        { label: '1억 이상', action: 'message', messageText: '1억 이상' },
        { label: '미정', action: 'message', messageText: '미정' }
      ]
    };
  }
  
  session.data.installBudget = message.trim();
  session.step = 'install_schedule';
  
  return {
    text: `✅ 설치 예산: ${session.data.installBudget}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n언제 설치가 필요하신가요?\n예: 2025년 8월, 3개월 후, 내년 상반기 등`,
    quickReplies: []
  };
}

export function handleInstallSchedule(message: string, session: UserSession): KakaoResponse {
  if (!message || message.trim().length === 0) {
    return {
      text: '설치 일정을 입력해주세요.\n예: 2025년 8월, 3개월 후, 내년 상반기 등',
      quickReplies: []
    };
  }
  
  session.data.installSchedule = message.trim();
  session.data.eventName = `${session.data.installRegion} 프로젝트`;
  session.step = 'get_additional_requests';
  
  return {
    text: `✅ 설치 일정: ${session.data.installSchedule}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n별도 요청사항이 있으신가요?\n\n없으시면 "없음"이라고 입력해주세요.`,
    quickReplies: [
      { label: '없음', action: 'message', messageText: '없음' }
    ]
  };
}

export const installHandlers = {
  'install_environment': handleInstallEnvironment,
  'install_region': handleInstallRegion,
  'install_space': handleInstallSpace,
  'inquiry_purpose': handleInquiryPurpose,
  'install_budget': handleInstallBudget,
  'install_schedule': handleInstallSchedule
};