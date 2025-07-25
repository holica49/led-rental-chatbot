// src/constants/messages.ts

import { EMOJI } from '../utils/message-utils.js';

/**
 * 챗봇 메시지 상수 (간소화 버전)
 * 포맷팅은 message-utils.ts에서 처리
 */

export const MESSAGES = {
  // 기본 메시지
  GREETING: '안녕하세요! LED 전문 기업 오비스입니다. 😊\n\n어떤 서비스를 도와드릴까요?',
  ERROR: '죄송합니다. 일시적인 오류가 발생했습니다.\n잠시 후 다시 시도해주세요.',
  CANCEL: '요청이 취소되었습니다.\n\n처음부터 다시 시작하시려면 아무 메시지나 입력해주세요.',
  
  // 프롬프트
  REQUEST_ADDITIONAL: '별도 요청사항이 있으신가요?\n\n없으시면 "없음"이라고 입력해주세요.',
  SELECT_ENVIRONMENT: '설치 환경을 선택해주세요.',
  INPUT_REGION: '설치하실 지역을 입력해주세요.\n예: 서울, 경기, 부산 등',
  SELECT_SPACE: '어떤 공간에 설치하실 예정인가요?',
  SELECT_PURPOSE: '문의 목적을 알려주세요.',
  SELECT_BUDGET: '예상 설치 예산을 알려주세요.',
  INPUT_SCHEDULE: '언제 설치가 필요하신가요?\n예: 2025년 8월, 3개월 후, 내년 상반기 등',
  INPUT_EVENT_INFO: '행사명과 행사장을 알려주세요.\n예: 커피박람회 / 수원메쎄 2홀',
  SELECT_INDOOR_OUTDOOR: '실내 행사인가요, 실외 행사인가요?',
  SELECT_STRUCTURE: '지지구조물 타입을 선택해주세요.',
  SELECT_LED_COUNT: '몇 개소의 LED디스플레이가 필요하신가요? (1-5개)',
  INPUT_STAGE_HEIGHT: `${EMOJI.RULER} 무대 높이를 알려주세요. (mm 단위)`,
  ASK_OPERATOR: `${EMOJI.MANAGER} 오퍼레이터가 필요하신가요?`,
  ASK_OPERATOR_DAYS: `${EMOJI.CALENDAR} 오퍼레이터가 몇 일 동안 필요하신가요?`,
  ASK_PROMPTER: `${EMOJI.TV} 프롬프터 연결이 필요하신가요?`,
  ASK_RELAY: `${EMOJI.CAMERA} 중계카메라 연결이 필요하신가요?`,
  INPUT_PERIOD: `${EMOJI.CALENDAR} 행사 기간을 알려주세요.\n예: 2025-07-09 ~ 2025-07-11`,
  INPUT_COMPANY: `${EMOJI.COMPANY} 고객사명을 알려주세요.`,
  INPUT_NAME: `${EMOJI.PERSON} 담당자님의 성함을 알려주세요.`,
  INPUT_TITLE: '💼 직급을 알려주세요.',
  INPUT_PHONE: `${EMOJI.PHONE} 연락처를 알려주세요.\n예: 010-1234-5678`,
  INPUT_MEMBER_CODE: '멤버 코드를 입력해주세요.',
  
  // 성공 메시지 템플릿
  INSTALL_SUCCESS_TEMPLATE: (company: string, name: string, phone: string) =>
    `✅ 상담 요청이 접수되었습니다!\n\n${DIVIDER}\n\n🏢 고객사: ${company}\n👤 고객: ${name}\n📞 연락처: ${phone}\n\n👤 담당자: 유준수 구축팀장\n📞 담당자 연락처: 010-7333-3336\n\n곧 담당자가 연락드릴 예정입니다.\n\n💡 설치 사례 보러가기:\nhttps://blog.naver.com/PostList.naver?blogId=oriondisplay_&from=postList&categoryNo=8\n\n감사합니다! 😊`,
  
  RENTAL_OUTDOOR_SUCCESS_TEMPLATE: (event: string, company: string, name: string, title: string, phone: string) =>
    `✅ 견적 요청이 접수되었습니다!\n\n📋 ${event}\n🏢 ${company}\n👤 고객: ${name} ${title}\n📞 연락처: ${phone}\n🌳 실외 행사\n\n📝 최수삼 렌탈팀장이 별도로 연락드릴 예정입니다.\n📞 담당자 직통: 010-2797-2504`,
  
  RENTAL_INDOOR_SUCCESS_TEMPLATE: (event: string, company: string, name: string, title: string, phone: string, amount: number) =>
    `✅ 견적 요청이 접수되었습니다!\n\n📋 ${event}\n🏢 ${company}\n👤 고객: ${name} ${title}\n📞 연락처: ${phone}\n💰 예상 견적 금액: ${amount.toLocaleString()}원 (VAT 포함)\n\n📝 담당자에게 전달 중입니다...\n\n⚠️ 상기 금액은 예상 견적이며, 담당자와 협의 후 조정될 수 있습니다.`,
  
  MEMBERSHIP_SUCCESS_TEMPLATE: (event: string, name: string, title: string, phone: string, amount: number) =>
    `✅ 견적 요청이 접수되었습니다!\n\n📋 ${event}\n👤 고객: ${name} ${title}\n📞 연락처: ${phone}\n💰 예상 견적 금액: ${amount.toLocaleString()}원 (VAT 포함)\n\n📝 상세 견적은 담당자가 연락드릴 예정입니다...`,
};

// 버튼 라벨
export const BUTTONS = {
  // 서비스
  SERVICE_INSTALL: `${EMOJI.BUILDING} LED 설치`,
  SERVICE_RENTAL: `${EMOJI.PACKAGE} LED 렌탈`,
  SERVICE_MEMBERSHIP: `${EMOJI.PEOPLE} 멤버쉽 서비스`,
  
  // 환경
  INDOOR: `${EMOJI.INDOOR} 실내`,
  OUTDOOR: `${EMOJI.OUTDOOR} 실외`,
  INDOOR_SIMPLE: '🏢 실내 설치',
  OUTDOOR_SIMPLE: '🌳 실외 설치',
  
  // 구조물
  STRUCTURE_WOOD: `${EMOJI.TOOL} 목공 설치`,
  STRUCTURE_STANDALONE: `${EMOJI.STRUCTURE} 단독 설치`,
  
  // 공간
  SPACE_CORPORATE: '🏢 기업',
  SPACE_RETAIL: '🏪 상가',
  SPACE_HOSPITAL: '🏥 병원',
  SPACE_PUBLIC: '🏛️ 공공',
  SPACE_HOTEL: '🏨 숙박',
  SPACE_EXHIBITION: '🎪 전시홀',
  SPACE_OTHER: '🔸 기타',
  
  // 목적
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
  
  // LED 개수
  LED_COUNT: ['1개', '2개', '3개', '4개', '5개'],
  
  // LED 크기
  LED_SIZE_6000_3000: '6000x3000',
  LED_SIZE_4000_3000: '4000x3000',
  LED_SIZE_4000_2500: '4000x2500',
  
  // 무대 높이
  STAGE_HEIGHT_0: '0mm',
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
};

// 검증 에러 메시지
export const VALIDATION_ERRORS = {
  PHONE: '올바른 전화번호 형식이 아닙니다.\n예시: 010-1234-5678, 02-1234-5678',
  LED_SIZE: 'LED 크기 형식이 올바르지 않습니다.\n예시: 6000x3000, 4000*3000, 4000×2500',
  LED_SIZE_UNIT: (width: number, height: number) => 
    `LED 크기는 500mm 단위로 입력해주세요.\n입력하신 크기: ${width}x${height}\n가까운 크기: ${Math.round(width/500)*500}x${Math.round(height/500)*500}`,
  LED_SIZE_MIN: 'LED 크기는 최소 500x500mm 이상이어야 합니다.',
  STAGE_HEIGHT: '무대 높이 형식이 올바르지 않습니다.\n예시: 0, 600, 600mm, 60cm, 0.6m',
  STAGE_HEIGHT_RANGE: '무대 높이는 0mm ~ 10000mm(10m) 사이로 입력해주세요.',
  NUMBER: '숫자를 입력해주세요.',
  NUMBER_RANGE: (min: number, max: number) => `${min}에서 ${max} 사이의 숫자를 입력해주세요.`,
  PERIOD: '행사 기간 형식이 올바르지 않습니다.\n예시: 2025-07-09 ~ 2025-07-11',
  DATE: '유효하지 않은 날짜입니다.',
  DATE_ORDER: '시작일이 종료일보다 늦을 수 없습니다.',
  EVENT_INFO: '형식이 올바르지 않습니다.\n\n올바른 형식으로 다시 입력해주세요:\n📝 행사명 / 행사장\n\n예시:\n• 커피박람회 / 수원메쎄 2홀\n• 전시회 / 킨텍스 1홀',
  MEMBER_CODE: '유효하지 않은 멤버 코드입니다.\n\n다시 확인 후 입력해주세요.',
  REQUIRED_FIELD: (fieldName: string) => `${fieldName}을(를) 입력해주세요.`,
};

// 구분선 import
import { DIVIDER } from '../utils/message-utils.js';