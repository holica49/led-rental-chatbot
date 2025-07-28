import { EMOJI } from '../utils/message-utils.js';

/**
 * 챗봇 메시지 상수 (간결한 버전)
 * 이모지 최소화, 핵심 정보 중심
 */

export const MESSAGES = {
  // 기본 메시지
  GREETING: `안녕하세요! 오리온디스플레이입니다.
어떤 서비스를 도와드릴까요?

🏢 설치 - 매장이나 건물에 LED를 고정 설치
📅 렌탈 - 행사나 이벤트용으로 단기간 대여
⭐ 멤버쉽 - VIP 회원 전용 특별 할인 서비스`,

  ERROR: '죄송합니다. 일시적인 오류가 발생했습니다.\n잠시 후 다시 시도해주세요.',
  CANCEL: '요청이 취소되었습니다.\n\n처음부터 다시 시작하시려면 아무 메시지나 입력해주세요.',
  
  // 프롬프트
  REQUEST_ADDITIONAL: `추가로 문의하실 내용이 있으신가요?

💡 설치 위치에 대한 자세한 설명이나 특별한 요청사항을 남겨주세요.

없으시면 '없음'이라고 입력해 주세요.`,

  SELECT_ENVIRONMENT: `설치 환경을 선택해 주세요.

💡 실내: 날씨로부터 보호되는 내부 공간
🌳 실외: 날씨에 노출되는 외부 공간`,

  INPUT_REGION: '설치하실 지역을 입력해주세요.\n예: 서울, 경기, 부산',
  
  SELECT_SPACE: `어떤 공간에 설치하실 예정인가요?

💡 설치 공간에 따라 최적의 LED 솔루션을 제안해 드립니다.`,

  SELECT_PURPOSE: '문의 목적을 알려주세요.',
  
  SELECT_BUDGET: `예산 범위를 알려주세요.

💡 대략적인 범위로 말씀해 주시면 
예산에 맞는 최적의 솔루션을 제안해 드리겠습니다.`,

  INPUT_SCHEDULE: '설치 희망 시기를 알려주세요.\n\n💡 예: 3개월 내, 8월경, 2025-07-10까지 등',

  INPUT_EVENT_INFO: `행사명과 행사장을 알려주세요.

💡 형식: 행사명 / 행사장
예시: 커피박람회 / 수원메쎄 2홀`,

  SELECT_INDOOR_OUTDOOR: '실내 행사인가요, 실외 행사인가요?',
  
  SELECT_STRUCTURE: `지지구조물 타입을 선택해주세요.

💡 목공 설치: 안정적이고 견고한 설치
단독 설치: 독립적인 스탠드 방식`,

  SELECT_LED_COUNT: `몇 개소의 LED 디스플레이가 필요하신가요?

💡 예: 무대 정면 1개, 측면 2개 = 총 3개소`,

  INPUT_STAGE_HEIGHT: `무대 높이를 알려주세요. (단위: mm)

💡 바닥에 설치하시면 0을 입력해 주세요.`,

  ASK_OPERATOR: `오퍼레이터가 필요하신가요?

💡 오퍼레이터는 행사 중 LED 화면을 전문적으로 운영하는 기술자입니다.`,

  ASK_OPERATOR_DAYS: `오퍼레이터가 몇 일 동안 필요하신가요?

💡 보통 리허설 1일 + 행사 기간으로 계산합니다.`,

  ASK_PROMPTER: `프롬프터 연결이 필요하신가요?

💡 프롬프터는 발표자가 원고를 볼 수 있는 장치입니다.`,

  ASK_RELAY: `중계카메라가 있으신 경우, 연결이 필요하신가요?

💡 무대나 행사장을 촬영하여 LED에 실시간으로 송출할 수 있습니다.`,

  INPUT_PERIOD: `행사 기간을 알려주세요.

💡 예시: 2025-07-09 ~ 2025-07-11`,

  INPUT_COMPANY: `고객사명을 알려주세요.`,

  INPUT_NAME: `담당자님의 성함을 알려주세요.`,

  INPUT_TITLE: `직급을 알려주세요.

💡 견적서와 공식 서류에 기재됩니다.`,

  INPUT_PHONE: `연락 가능한 전화번호를 알려주세요.

💡 예: 010-1234-5678`,

  INPUT_MEMBER_CODE: `VIP 회원님, 환영합니다!
멤버쉽 코드를 입력해 주세요.

💡 코드를 모르시면 담당자에게 문의해 주세요.`,
  
  // 성공 메시지 템플릿 - 서비스별 차별화
  INSTALL_SUCCESS_TEMPLATE: (company: string, name: string, phone: string) =>
    `✅ LED 설치 상담 요청이 완료되었습니다! 🎉
${DIVIDER}
📌 접수 정보
🏢 고객사: ${company}
👤 고객명: ${name}님
📞 연락처: ${phone}
${DIVIDER}
🏆 최고의 전문가 배정
👨‍💼 유준수 구축팀장
📞 010-7333-3336
⏰ 빠르게 연락드리겠습니다.
${DIVIDER}
기다리시는 동안 적합한 사례가 있다면 말씀해주세요.
📸 설치 포트폴리오 보기:
https://blog.naver.com/PostList.naver?blogId=oriondisplay_&from=postList&categoryNo=8

믿고 맡겨주셔서 감사합니다! 😊
최고의 LED 솔루션을 제공하겠습니다.`,
  
  RENTAL_OUTDOOR_SUCCESS_TEMPLATE: (event: string, company: string, name: string, title: string, phone: string) =>
    `✅ 실외 행사 견적 요청이 접수되었습니다! 🌟
${DIVIDER}
📋 행사 정보
• 행사명: ${event}
• 고객사: ${company}
• 고객명: ${name} ${title}님
• 연락처: ${phone}
• 환경: 🌳 실외 행사
${DIVIDER}
🏆 최고의 전문가 배정
👨‍💼 최수삼 렌탈팀장
📞 010-2797-2504
${DIVIDER}
전문가가 곧 연락드려 맞춤 견적을 안내하겠습니다.
감사합니다! 😊`,
  
  RENTAL_INDOOR_SUCCESS_TEMPLATE: (event: string, company: string, name: string, title: string, phone: string, amount: number) =>
    `✅ LED 렌탈 견적이 산출되었습니다! 💼
${DIVIDER}
📋 행사 정보
• 행사명: ${event}
• 고객사: ${company}
• 고객명: ${name} ${title}님
• 연락처: ${phone}
${DIVIDER}
💰 예상 견적
• 총 금액: ${amount.toLocaleString()}원 (VAT 포함)
• 포함 사항: LED, 설치/철거, 기본 운영
* 해당 금액은 예상 금액이며, 전문가 상담 후 변경될 수 있습니다.
${DIVIDER}
📞 다음 단계
1. 전문가가 확인 후 연락드립니다
2. 상세 견적서 이메일 발송
3. 현장 답사 일정 협의 (필요시)

💡 추가 할인 가능 항목
• 장기 렌탈 할인 (7일 이상)
• 다수 행사 패키지
• 조기 예약 할인

빠른 상담으로 보답하겠습니다.
감사합니다! 🙏`,
  
  MEMBERSHIP_SUCCESS_TEMPLATE: (event: string, name: string, title: string, phone: string, amount: number) =>
    `✅ 메쎄이상 멤버쉽 견적이 준비되었습니다! 👑
${DIVIDER}
🌟 고객 정보
• 행사명: ${event}
• 고객사: 메쎄이상
• 고객명: ${name} ${title}님
• 연락처: ${phone}
${DIVIDER}
💎 ${event} 빠른 견적
• 예상 견적가: ${amount.toLocaleString()}원 (VAT 포함)
* 해당 금액은 예상 금액이며, 전문가 상담 후 변경될 수 있습니다.
${DIVIDER}
📞 최고의 전문가
👨‍💼 최수삼 렌탈팀장
📞 010-2797-2504

오리온디스플레이의 VIP께
최상의 서비스로 보답하겠습니다! 🙏`,
};

// 버튼 라벨
export const BUTTONS = {
  // 서비스
  SERVICE_INSTALL: '🏢 LED 설치',
  SERVICE_RENTAL: '📅 LED 렌탈',
  SERVICE_MEMBERSHIP: '⭐ 멤버쉽 서비스',
  
  // 환경
  INDOOR: '실내',
  OUTDOOR: '실외',
  INDOOR_SIMPLE: '실내 설치',
  OUTDOOR_SIMPLE: '실외 설치',
  
  // 구조물
  STRUCTURE_WOOD: '목공 설치',
  STRUCTURE_STANDALONE: '단독 설치',
  
  // 공간
  SPACE_CORPORATE: '기업',
  SPACE_RETAIL: '상가',
  SPACE_HOSPITAL: '병원',
  SPACE_PUBLIC: '공공',
  SPACE_HOTEL: '숙박',
  SPACE_EXHIBITION: '전시홀',
  SPACE_OTHER: '기타',
  
  // 목적
  PURPOSE_RESEARCH: '정보 조사',
  PURPOSE_PLANNING: '아이디어 기획',
  PURPOSE_QUOTE: '견적',
  PURPOSE_PURCHASE: '구매',
  PURPOSE_OTHER: '기타',
  
  // 예산
  BUDGET_UNDER_10M: '1000만원 이하',
  BUDGET_10M_30M: '1000~3000만원',
  BUDGET_30M_50M: '3000~5000만원',
  BUDGET_50M_100M: '5000만원~1억',
  BUDGET_OVER_100M: '1억 이상',
  BUDGET_UNDECIDED: '미정',
  
  // LED 개수
  LED_COUNT: ['1개', '2개', '3개', '4개', '5개'],
  
  // LED 크기
  LED_SIZE_6000_3000: '6000x3000',
  LED_SIZE_4000_3000: '4000x3000',
  LED_SIZE_4000_2500: '4000x2500',
  
  // 무대 높이
  STAGE_HEIGHT_0: '0mm (바닥)',
  STAGE_HEIGHT_600: '600mm',
  STAGE_HEIGHT_800: '800mm',
  STAGE_HEIGHT_1000: '1000mm',
  
  // 직급
  TITLE_MANAGER: '매니저',
  TITLE_SENIOR: '책임',
  TITLE_TEAM_LEADER: '팀장',
  TITLE_DIRECTOR: '이사',
  
  // 일수
  DAYS: ['1일', '2일', '3일', '4일', '5일'],
  
  // 공통
  YES: '네, 필요합니다',
  NO: '아니요',
  NONE: '없음',
  CONFIRM: '네, 요청합니다',
  CANCEL: '취소',
  START_OVER: '처음으로',
  NEW_QUOTE: '새 견적 요청',
  CONTINUE: '네, 진행합니다',
  PREVIOUS: '이전',  // 추가
};

// 검증 에러 메시지
export const VALIDATION_ERRORS = {
  PHONE: '올바른 전화번호 형식이 아닙니다.\n예시: 010-1234-5678',
  
  LED_SIZE: `LED 크기 형식이 올바르지 않습니다.

💡 올바른 형식: 가로x세로 (단위: mm)
예시: 6000x3000, 4000x3000`,

  LED_SIZE_UNIT: (width: number, height: number) => 
    `LED 크기는 500mm 단위로 입력해주세요.
입력하신 크기: ${width}x${height}
가까운 크기: ${Math.round(width/500)*500}x${Math.round(height/500)*500}`,

  LED_SIZE_MIN: 'LED 크기는 최소 500x500mm 이상이어야 합니다.',
  
  STAGE_HEIGHT: `무대 높이 형식이 올바르지 않습니다.

💡 숫자만 입력하거나 단위를 포함해서 입력해 주세요.
예시: 0, 600, 600mm`,

  STAGE_HEIGHT_RANGE: '무대 높이는 0mm ~ 10000mm(10m) 사이로 입력해주세요.',
  NUMBER: '숫자를 입력해주세요.',
  NUMBER_RANGE: (min: number, max: number) => `${min}에서 ${max} 사이의 숫자를 입력해주세요.`,
  
  PERIOD: `행사 기간 형식이 올바르지 않습니다.

💡 올바른 형식: YYYY-MM-DD ~ YYYY-MM-DD
예시: 2025-07-09 ~ 2025-07-11`,

  DATE: '유효하지 않은 날짜입니다.',
  DATE_ORDER: '시작일이 종료일보다 늦을 수 없습니다.',
  
  EVENT_INFO: `형식이 올바르지 않습니다.

💡 올바른 형식: 행사명 / 행사장
예시: 커피박람회 / 수원메쎄 2홀`,

  MEMBER_CODE: `유효하지 않은 멤버 코드입니다.

다시 확인 후 입력해주세요.
💡 코드를 모르시면 담당자(010-2797-2504)에게 문의해 주세요.`,

  REQUIRED_FIELD: (fieldName: string) => `${fieldName}을(를) 입력해주세요.`,
};

// 구분선 import
import { DIVIDER } from '../utils/message-utils.js';