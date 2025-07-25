// src/constants/messages.ts

/**
 * 챗봇 메시지 중앙 관리
 * 모든 사용자 대화 문구를 이곳에서 관리합니다.
 */

export const MESSAGES = {
  // 공통 메시지
  COMMON: {
    GREETING: '안녕하세요! LED 전문 기업 오비스입니다. 😊\n\n어떤 서비스를 도와드릴까요?',
    ERROR: '죄송합니다. 일시적인 오류가 발생했습니다.\n잠시 후 다시 시도해주세요.',
    INVALID_INPUT: '올바르지 않은 입력입니다. 다시 입력해주세요.',
    CANCEL: '요청이 취소되었습니다.\n\n처음부터 다시 시작하시려면 아무 메시지나 입력해주세요.',
    CONFIRM_SUBMIT: '견적을 요청하시겠습니까?',
    SUBMIT_SUCCESS: '✅ 견적 요청이 접수되었습니다!',
    REQUEST_ADDITIONAL: '별도 요청사항이 있으신가요?\n\n없으시면 "없음"이라고 입력해주세요.',
  },

  // 서비스 선택
  SERVICE: {
    SELECT_PROMPT: '어떤 서비스를 도와드릴까요?',
    INSTALL_SELECTED: '🏗️ LED 설치 서비스를 선택하셨습니다.\n\n━━━━━━\n\n설치 환경을 선택해주세요.',
    RENTAL_SELECTED: '📦 LED 렌탈 서비스를 선택하셨습니다.\n\n━━━━━━\n\n행사명과 행사장을 알려주세요.\n예: 커피박람회 / 수원메쎄 2홀',
    MEMBERSHIP_SELECTED: '👥 멤버쉽 서비스를 선택하셨습니다.\n\n━━━━━━\n\n멤버 코드를 입력해주세요.',
  },

  // 설치 서비스 메시지
  INSTALL: {
    SELECT_ENVIRONMENT: '설치 환경을 선택해주세요.',
    INPUT_REGION: '설치하실 지역을 입력해주세요.\n예: 서울, 경기, 부산 등',
    SELECT_SPACE: '어떤 공간에 설치하실 예정인가요?',
    SELECT_PURPOSE: '문의 목적을 알려주세요.',
    SELECT_BUDGET: '예상 설치 예산을 알려주세요.',
    INPUT_SCHEDULE: '언제 설치가 필요하신가요?\n예: 2025년 8월, 3개월 후, 내년 상반기 등',
    SUCCESS_MESSAGE: (customerName: string, contactName: string, contactPhone: string) =>
      `✅ 상담 요청이 접수되었습니다!\n\n━━━━━━\n\n🏢 고객사: ${customerName}\n👤 고객: ${contactName}\n📞 연락처: ${contactPhone}\n\n👤 담당자: 유준수 구축팀장\n📞 담당자 연락처: 010-7333-3336\n\n곧 담당자가 연락드릴 예정입니다.\n\n💡 설치 사례 보러가기:\nhttps://blog.naver.com/PostList.naver?blogId=oriondisplay_&from=postList&categoryNo=8\n\n감사합니다! 😊`,
  },

  // 렌탈 서비스 메시지
  RENTAL: {
    INPUT_EVENT_INFO: '행사명과 행사장을 알려주세요.\n예: 커피박람회 / 수원메쎄 2홀',
    INVALID_EVENT_FORMAT: '❌ 형식이 올바르지 않습니다.\n\n올바른 형식으로 다시 입력해주세요:\n📝 행사명 / 행사장\n\n예시:\n• 커피박람회 / 수원메쎄 2홀\n• 전시회 / 킨텍스 1홀',
    SELECT_INDOOR_OUTDOOR: '실내 행사인가요, 실외 행사인가요?',
    OUTDOOR_NOTICE: '🌳 실외 행사로 확인되었습니다.\n\n━━━━━━\n\n실외 행사는 최수삼 팀장이 별도로 상담을 도와드립니다.\n\n👤 담당: 최수삼 팀장\n📞 연락처: 010-2797-2504\n\n견적 요청은 계속 진행하시겠습니까?',
    SELECT_STRUCTURE: '지지구조물 타입을 선택해주세요.',
    SELECT_LED_COUNT: '몇 개소의 LED디스플레이가 필요하신가요? (1-5개)',
    INPUT_LED_SIZE: (ledNumber: number) => `🖥️ LED ${ledNumber}번의 크기를 알려주세요.\n\n예시: 4000x2500, 6000x3000`,
    INPUT_STAGE_HEIGHT: '📐 무대 높이를 알려주세요. (mm 단위)',
    ASK_OPERATOR: '👨‍💼 오퍼레이터가 필요하신가요?',
    ASK_OPERATOR_DAYS: '📅 오퍼레이터가 몇 일 동안 필요하신가요?',
    ASK_PROMPTER: '📺 프롬프터 연결이 필요하신가요?',
    ASK_RELAY: '📹 중계카메라 연결이 필요하신가요?',
    INPUT_PERIOD: '📅 행사 기간을 알려주세요.\n예: 2025-07-09 ~ 2025-07-11',
    OUTDOOR_SUCCESS: (eventName: string, customerName: string, contactName: string, contactTitle: string, contactPhone: string) =>
      `✅ 견적 요청이 접수되었습니다!\n\n📋 ${eventName}\n🏢 ${customerName}\n👤 고객: ${contactName} ${contactTitle}\n📞 연락처: ${contactPhone}\n🌳 실외 행사\n\n📝 최수삼 렌탈팀장이 별도로 연락드릴 예정입니다.\n📞 담당자 직통: 010-2797-2504`,
    INDOOR_SUCCESS: (eventName: string, customerName: string, contactName: string, contactTitle: string, contactPhone: string, totalAmount: number) =>
      `✅ 견적 요청이 접수되었습니다!\n\n📋 ${eventName}\n🏢 ${customerName}\n👤 고객: ${contactName} ${contactTitle}\n📞 연락처: ${contactPhone}\n💰 예상 견적 금액: ${totalAmount.toLocaleString()}원 (VAT 포함)\n\n📝 담당자에게 전달 중입니다...\n\n⚠️ 상기 금액은 예상 견적이며, 담당자와 협의 후 조정될 수 있습니다.`,
  },

  // 멤버쉽 서비스 메시지
  MEMBERSHIP: {
    INPUT_CODE: '멤버 코드를 입력해주세요.',
    INVALID_CODE: '❌ 유효하지 않은 멤버 코드입니다.\n\n다시 확인 후 입력해주세요.',
    CODE_CONFIRMED: (code: string) => `✅ 멤버 코드 확인: ${code} (메쎄이상)\n\n━━━━━━\n\n행사명과 행사장을 알려주세요.\n예: 커피박람회 / 수원메쎄 2홀`,
    SUCCESS_MESSAGE: (eventName: string, contactName: string, contactTitle: string, contactPhone: string, totalAmount: number) =>
      `✅ 견적 요청이 접수되었습니다!\n\n📋 ${eventName}\n👤 고객: ${contactName} ${contactTitle}\n📞 연락처: ${contactPhone}\n💰 예상 견적 금액: ${totalAmount.toLocaleString()}원 (VAT 포함)\n\n📝 상세 견적은 담당자가 연락드릴 예정입니다...`,
  },

  // 고객 정보 입력
  CUSTOMER: {
    INPUT_COMPANY: '🏢 고객사명을 알려주세요.',
    INPUT_NAME: '👤 담당자님의 성함을 알려주세요.',
    INPUT_TITLE: '💼 직급을 알려주세요.',
    INPUT_PHONE: '📞 연락처를 알려주세요.\n예: 010-1234-5678',
    COMPANY_CONFIRMED: (company: string) => `✅ 고객사: ${company}`,
    NAME_CONFIRMED: (name: string) => `✅ 담당자: ${name}님`,
    TITLE_CONFIRMED: (title: string) => `✅ 직급: ${title}`,
    PHONE_CONFIRMED: (phone: string) => `✅ 연락처: ${phone}`,
  },

  // 검증 에러 메시지
  VALIDATION: {
    PHONE_INVALID: '올바른 전화번호 형식이 아닙니다.\n예시: 010-1234-5678, 02-1234-5678',
    LED_SIZE_INVALID: 'LED 크기 형식이 올바르지 않습니다.\n예시: 6000x3000, 4000*3000, 4000×2500',
    LED_SIZE_NOT_500: (width: number, height: number) => 
      `LED 크기는 500mm 단위로 입력해주세요.\n입력하신 크기: ${width}x${height}\n가까운 크기: ${Math.round(width/500)*500}x${Math.round(height/500)*500}`,
    LED_SIZE_TOO_SMALL: 'LED 크기는 최소 500x500mm 이상이어야 합니다.',
    STAGE_HEIGHT_INVALID: '무대 높이 형식이 올바르지 않습니다.\n예시: 0, 600, 600mm, 60cm, 0.6m',
    STAGE_HEIGHT_OUT_OF_RANGE: '무대 높이는 0mm ~ 10000mm(10m) 사이로 입력해주세요.',
    NUMBER_INVALID: '숫자를 입력해주세요.',
    NUMBER_OUT_OF_RANGE: (min: number, max: number) => `${min}에서 ${max} 사이의 숫자를 입력해주세요.`,
    PERIOD_INVALID: '행사 기간 형식이 올바르지 않습니다.\n예시: 2025-07-09 ~ 2025-07-11',
    DATE_INVALID: '유효하지 않은 날짜입니다.',
    DATE_ORDER_INVALID: '시작일이 종료일보다 늦을 수 없습니다.',
  },

  // 버튼 라벨
  BUTTONS: {
    // 서비스 선택
    SERVICE_INSTALL: '🏗️ LED 설치',
    SERVICE_RENTAL: '📦 LED 렌탈',
    SERVICE_MEMBERSHIP: '👥 멤버쉽 서비스',
    
    // 설치 환경
    INDOOR: '🏢 실내',
    OUTDOOR: '🌳 실외',
    
    // 설치 공간
    SPACE_CORPORATE: '🏢 기업',
    SPACE_RETAIL: '🏪 상가',
    SPACE_HOSPITAL: '🏥 병원',
    SPACE_PUBLIC: '🏛️ 공공',
    SPACE_HOTEL: '🏨 숙박',
    SPACE_EXHIBITION: '🎪 전시홀',
    SPACE_OTHER: '🔸 기타',
    
    // 문의 목적
    PURPOSE_RESEARCH: '🔍 정보 조사',
    PURPOSE_PLANNING: '💡 아이디어 기획',
    PURPOSE_QUOTE: '💰 견적',
    PURPOSE_PURCHASE: '🛒 구매',
    PURPOSE_OTHER: '🔸 기타',
    
    // 예산
    BUDGET_UNDER_10M: '1000만원 이하',
    BUDGET_10M_30M: '1000~3000만원',
    BUDGET_30M_50M: '3000~5000만원',
    BUDGET_50M_100M: '5000만원~1억',
    BUDGET_OVER_100M: '1억 이상',
    BUDGET_UNDECIDED: '미정',
    
    // 지지구조물
    STRUCTURE_WOOD: '🔨 목공 설치',
    STRUCTURE_STANDALONE: '🏗️ 단독 설치',
    
    // LED 개수
    LED_COUNT_1: '1개',
    LED_COUNT_2: '2개',
    LED_COUNT_3: '3개',
    LED_COUNT_4: '4개',
    LED_COUNT_5: '5개',
    
    // LED 크기 (자주 사용되는 크기)
    LED_SIZE_6000_3000: '6000x3000',
    LED_SIZE_4000_3000: '4000x3000',
    LED_SIZE_4000_2500: '4000x2500',
    
    // 무대 높이
    STAGE_HEIGHT_0: '0mm',
    STAGE_HEIGHT_600: '600mm',
    STAGE_HEIGHT_800: '800mm',
    STAGE_HEIGHT_1000: '1000mm',
    
    // 예/아니오
    YES: '네, 필요합니다',
    NO: '아니요',
    
    // 직급
    TITLE_MANAGER: '매니저',
    TITLE_SENIOR: '책임',
    TITLE_TEAM_LEADER: '팀장',
    TITLE_DIRECTOR: '이사',
    
    // 일수
    DAYS_1: '1일',
    DAYS_2: '2일',
    DAYS_3: '3일',
    DAYS_4: '4일',
    DAYS_5: '5일',
    
    // 기타
    NONE: '없음',
    CONFIRM: '네, 요청합니다',
    CANCEL: '취소',
    START_OVER: '처음으로',
    CONTINUE: '네, 진행합니다',
    NEW_QUOTE: '새 견적 요청',
  },
} as const;

// 타입 추출
export type MessageKey = keyof typeof MESSAGES;
export type ServiceMessageKey = keyof typeof MESSAGES.SERVICE;
export type ButtonKey = keyof typeof MESSAGES.BUTTONS;