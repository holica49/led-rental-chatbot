// src/config/process-config.ts

/**
 * 챗봇 프로세스 플로우 설정
 * 각 서비스별 대화 흐름을 정의합니다.
 */

export interface ProcessStep {
  id: string;
  nextStep: string | ((data: any) => string);
  required: boolean;
  validation?: string; // validator function name
}

export interface ServiceProcess {
  name: string;
  initialStep: string;
  steps: Record<string, ProcessStep>;
}

// 서비스별 총 단계 수 (최종 확인 제외)
export const SERVICE_TOTAL_STEPS = {
  INSTALL: 10,    // 환경~연락처까지
  RENTAL: 12,     // 실내 기준 (LED 1개 기준)
  RENTAL_OUTDOOR: 13,  // 실외는 예산/목적 추가
  MEMBERSHIP: 11  // 멤버코드~연락처까지 (LED 1개 기준)
} as const;

// 서비스별 단계 번호 계산 함수
export function getStepNumber(serviceType: string, currentStep: string, ledCount: number = 1, currentLED: number = 1): number {
  // LED 관련 단계들
  const ledSteps = ['led_specs', 'stage_height', 'operator_needs', 'operator_days', 'prompter', 'relay'];
  
  // 현재 단계가 LED 관련 단계인지 확인
  const isLedStep = ledSteps.some(step => currentStep.includes(step));
  
  if (isLedStep && ledCount > 1) {
    // LED 단계 기본 번호 계산
    const baseStepMap: Record<string, number> = {
      'rental_led_specs': 5,
      'rental_stage_height': 5,
      'rental_operator_needs': 5,
      'rental_operator_days': 5,
      'rental_prompter': 5,
      'rental_relay': 5,
      'membership_led_specs': 4,
      'membership_stage_height': 4,
      'membership_operator_needs': 4,
      'membership_operator_days': 4,
      'membership_prompter': 4,
      'membership_relay': 4,
    };
    
    const baseStep = baseStepMap[currentStep] || 5;
    // LED별로 6개 단계씩 추가
    return baseStep + (currentLED - 1) * 6;
  }
  
  // 일반 단계 매핑
  const stepMap: Record<string, number> = {
    // 설치
    'install_environment': 1,
    'install_region': 2,
    'install_space': 3,
    'install_inquiry_purpose': 4,
    'install_budget': 5,
    'install_schedule': 6,
    'get_additional_requests': 7,
    'get_customer_company': 8,
    'get_contact_name': 9,
    'get_contact_title': 10,
    'get_contact_phone': 10,
    
    // 렌탈
    'rental_indoor_outdoor': 1,
    'rental_structure_type': 2,
    'rental_inquiry_purpose': 3,  // 실외만
    'rental_outdoor_budget': 4,    // 실외만
    'rental_led_count': 3,         // 실내는 3, 실외는 5
    'rental_period': 6 + (ledCount - 1) * 6,
    
    // 멤버쉽
    'membership_code': 1,
    'membership_event_info': 2,
    'membership_led_count': 3,
    'membership_period': 4 + (ledCount - 1) * 6,
  };
  
  return stepMap[currentStep] || 1;
}

export const PROCESS_CONFIG: Record<string, ServiceProcess> = {
  // 설치 서비스 프로세스
  INSTALL: {
    name: '설치',
    initialStep: 'install_environment',
    steps: {
      install_environment: {
        id: 'install_environment',
        nextStep: 'install_region',
        required: true,
      },
      install_region: {
        id: 'install_region',
        nextStep: 'install_space',
        required: true,
      },
      install_space: {
        id: 'install_space',
        nextStep: 'inquiry_purpose',
        required: true,
      },
      inquiry_purpose: {
        id: 'inquiry_purpose',
        nextStep: 'install_budget',
        required: true,
      },
      install_budget: {
        id: 'install_budget',
        nextStep: 'install_schedule',
        required: true,
      },
      install_schedule: {
        id: 'install_schedule',
        nextStep: 'get_additional_requests',
        required: true,
      },
      get_additional_requests: {
        id: 'get_additional_requests',
        nextStep: 'get_customer_company',
        required: false,
      },
      get_customer_company: {
        id: 'get_customer_company',
        nextStep: 'get_contact_name',
        required: true,
      },
      get_contact_name: {
        id: 'get_contact_name',
        nextStep: 'get_contact_title',
        required: true,
      },
      get_contact_title: {
        id: 'get_contact_title',
        nextStep: 'get_contact_phone',
        required: true,
      },
      get_contact_phone: {
        id: 'get_contact_phone',
        nextStep: 'final_confirmation',
        required: true,
        validation: 'validatePhoneNumber',
      },
      final_confirmation: {
        id: 'final_confirmation',
        nextStep: 'complete',
        required: true,
      },
    },
  },

  // 렌탈 서비스 프로세스
  RENTAL: {
    name: '렌탈',
    initialStep: 'rental_indoor_outdoor',
    steps: {
      rental_indoor_outdoor: {
        id: 'rental_indoor_outdoor',
        nextStep: 'rental_structure_type',
        required: true,
      },
      rental_structure_type: {
        id: 'rental_structure_type',
        nextStep: 'rental_led_count',
        required: true,
      },
      rental_led_count: {
        id: 'rental_led_count',
        nextStep: 'rental_led_specs',
        required: true,
        validation: 'validateNumber',
      },
      rental_led_specs: {
        id: 'rental_led_specs',
        nextStep: 'rental_stage_height',
        required: true,
        validation: 'validateAndNormalizeLEDSize',
      },
      rental_stage_height: {
        id: 'rental_stage_height',
        nextStep: 'rental_operator_needs',
        required: true,
        validation: 'validateStageHeight',
      },
      rental_operator_needs: {
        id: 'rental_operator_needs',
        nextStep: (data: any) => data.needOperator ? 'rental_operator_days' : 'rental_prompter',
        required: true,
      },
      rental_operator_days: {
        id: 'rental_operator_days',
        nextStep: 'rental_prompter',
        required: true,
        validation: 'validateNumber',
      },
      rental_prompter: {
        id: 'rental_prompter',
        nextStep: 'rental_relay',
        required: true,
      },
      rental_relay: {
        id: 'rental_relay',
        nextStep: (data: any) => data.currentLED < data.ledCount ? 'rental_led_specs' : 'rental_period',
        required: true,
      },
      rental_period: {
        id: 'rental_period',
        nextStep: 'get_additional_requests',
        required: true,
        validation: 'validateEventPeriod',
      },
      get_additional_requests: {
        id: 'get_additional_requests',
        nextStep: 'get_customer_company',
        required: false,
      },
      get_customer_company: {
        id: 'get_customer_company',
        nextStep: 'get_contact_name',
        required: true,
      },
      get_contact_name: {
        id: 'get_contact_name',
        nextStep: 'get_contact_title',
        required: true,
      },
      get_contact_title: {
        id: 'get_contact_title',
        nextStep: 'get_contact_phone',
        required: true,
      },
      get_contact_phone: {
        id: 'get_contact_phone',
        nextStep: 'final_confirmation',
        required: true,
        validation: 'validatePhoneNumber',
      },
      final_confirmation: {
        id: 'final_confirmation',
        nextStep: 'complete',
        required: true,
      },
    },
  },

  // 멤버쉽 서비스 프로세스
  MEMBERSHIP: {
    name: '멤버쉽',
    initialStep: 'membership_code',
    steps: {
      membership_code: {
        id: 'membership_code',
        nextStep: 'membership_event_info',
        required: true,
      },
      membership_event_info: {
        id: 'membership_event_info',
        nextStep: 'membership_led_count',
        required: true,
      },
      membership_led_count: {
        id: 'membership_led_count',
        nextStep: 'membership_led_specs',
        required: true,
        validation: 'validateNumber',
      },
      membership_led_specs: {
        id: 'membership_led_specs',
        nextStep: 'membership_stage_height',
        required: true,
        validation: 'validateAndNormalizeLEDSize',
      },
      membership_stage_height: {
        id: 'membership_stage_height',
        nextStep: 'membership_operator_needs',
        required: true,
        validation: 'validateStageHeight',
      },
      membership_operator_needs: {
        id: 'membership_operator_needs',
        nextStep: (data: any) => data.needOperator ? 'membership_operator_days' : 'membership_prompter',
        required: true,
      },
      membership_operator_days: {
        id: 'membership_operator_days',
        nextStep: 'membership_prompter',
        required: true,
        validation: 'validateNumber',
      },
      membership_prompter: {
        id: 'membership_prompter',
        nextStep: 'membership_relay',
        required: true,
      },
      membership_relay: {
        id: 'membership_relay',
        nextStep: (data: any) => data.currentLED < data.ledCount ? 'membership_led_specs' : 'membership_period',
        required: true,
      },
      membership_period: {
        id: 'membership_period',
        nextStep: 'get_additional_requests',
        required: true,
        validation: 'validateEventPeriod',
      },
      get_additional_requests: {
        id: 'get_additional_requests',
        nextStep: 'get_contact_name',
        required: false,
      },
      get_contact_name: {
        id: 'get_contact_name',
        nextStep: 'get_contact_title',
        required: true,
      },
      get_contact_title: {
        id: 'get_contact_title',
        nextStep: 'get_contact_phone',
        required: true,
      },
      get_contact_phone: {
        id: 'get_contact_phone',
        nextStep: 'final_confirmation',
        required: true,
        validation: 'validatePhoneNumber',
      },
      final_confirmation: {
        id: 'final_confirmation',
        nextStep: 'complete',
        required: true,
      },
    },
  },
} as const;

// Quick Reply 설정
export const QUICK_REPLIES_CONFIG = {
  SERVICE_SELECT: [
    { label: BUTTONS.SERVICE_INSTALL, value: '설치' },
    { label: BUTTONS.SERVICE_RENTAL, value: '렌탈' },
    { label: BUTTONS.SERVICE_MEMBERSHIP, value: '멤버쉽' },
  ],
  
  ENVIRONMENT_SELECT: [
    { label: BUTTONS.INDOOR, value: '실내' },
    { label: BUTTONS.OUTDOOR, value: '실외' },
  ],
  
  SPACE_SELECT: [
    { label: BUTTONS.SPACE_CORPORATE, value: '기업' },
    { label: BUTTONS.SPACE_RETAIL, value: '상가' },
    { label: BUTTONS.SPACE_HOSPITAL, value: '병원' },
    { label: BUTTONS.SPACE_PUBLIC, value: '공공' },
    { label: BUTTONS.SPACE_HOTEL, value: '숙박' },
    { label: BUTTONS.SPACE_EXHIBITION, value: '전시홀' },
    { label: BUTTONS.SPACE_OTHER, value: '기타' },
  ],
  
  PURPOSE_SELECT: [
    { label: BUTTONS.PURPOSE_RESEARCH, value: '정보 조사' },
    { label: BUTTONS.PURPOSE_PLANNING, value: '아이디어 기획' },
    { label: BUTTONS.PURPOSE_QUOTE, value: '견적' },
    { label: BUTTONS.PURPOSE_PURCHASE, value: '구매' },
    { label: BUTTONS.PURPOSE_OTHER, value: '기타' },
  ],
  
  BUDGET_SELECT: [
    { label: BUTTONS.BUDGET_UNDER_10M, value: '1000만원 이하' },
    { label: BUTTONS.BUDGET_10M_30M, value: '1000~3000만원' },
    { label: BUTTONS.BUDGET_30M_50M, value: '3000~5000만원' },
    { label: BUTTONS.BUDGET_50M_100M, value: '5000만원~1억' },
    { label: BUTTONS.BUDGET_OVER_100M, value: '1억 이상' },
    { label: BUTTONS.BUDGET_UNDECIDED, value: '미정' },
  ],
  
  STRUCTURE_SELECT: [
    { label: BUTTONS.STRUCTURE_WOOD, value: '목공 설치' },
    { label: BUTTONS.STRUCTURE_STANDALONE, value: '단독 설치' },
  ],
  
  LED_COUNT_SELECT: [
    { label: BUTTONS.LED_COUNT[0], value: '1' },
    { label: BUTTONS.LED_COUNT[1], value: '2' },
    { label: BUTTONS.LED_COUNT[2], value: '3' },
    { label: BUTTONS.LED_COUNT[3], value: '4' },
    { label: BUTTONS.LED_COUNT[4], value: '5' },
  ],
  
  LED_SIZE_SELECT: [
    { label: BUTTONS.LED_SIZE_6000_3000, value: '6000x3000' },
    { label: BUTTONS.LED_SIZE_4000_3000, value: '4000x3000' },
    { label: BUTTONS.LED_SIZE_4000_2500, value: '4000x2500' },
  ],
  
  STAGE_HEIGHT_SELECT: [
    { label: BUTTONS.STAGE_HEIGHT_0, value: '0mm' },
    { label: BUTTONS.STAGE_HEIGHT_600, value: '600mm' },
    { label: BUTTONS.STAGE_HEIGHT_800, value: '800mm' },
    { label: BUTTONS.STAGE_HEIGHT_1000, value: '1000mm' },
  ],
  
  YES_NO_SELECT: [
    { label: BUTTONS.YES, value: '네' },
    { label: BUTTONS.NO, value: '아니요' },
  ],
  
  TITLE_SELECT: [
    { label: BUTTONS.TITLE_MANAGER, value: '매니저' },
    { label: BUTTONS.TITLE_SENIOR, value: '책임' },
    { label: BUTTONS.TITLE_TEAM_LEADER, value: '팀장' },
    { label: BUTTONS.TITLE_DIRECTOR, value: '이사' },
  ],
  
  DAYS_SELECT: [
    { label: BUTTONS.DAYS[0], value: '1' },
    { label: BUTTONS.DAYS[1], value: '2' },
    { label: BUTTONS.DAYS[2], value: '3' },
    { label: BUTTONS.DAYS[3], value: '4' },
    { label: BUTTONS.DAYS[4], value: '5' },
  ],
  
  NONE_SELECT: [
    { label: BUTTONS.NONE, value: '없음' },
  ],
  
  CONFIRM_SELECT: [
    { label: BUTTONS.CONFIRM, value: '네' },
    { label: BUTTONS.CANCEL, value: '취소' },
  ],
  
  START_OVER_SELECT: [
    { label: BUTTONS.START_OVER, value: '처음부터' },
  ],
  
  NEW_QUOTE_SELECT: [
    { label: BUTTONS.NEW_QUOTE, value: '처음부터' },
  ],
} as const;

// messages.ts import 필요
import { MESSAGES, BUTTONS } from '../constants/messages.js';
