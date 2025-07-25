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
    { label: MESSAGES.BUTTONS.SERVICE_INSTALL, value: '설치' },
    { label: MESSAGES.BUTTONS.SERVICE_RENTAL, value: '렌탈' },
    { label: MESSAGES.BUTTONS.SERVICE_MEMBERSHIP, value: '멤버쉽' },
  ],
  
  ENVIRONMENT_SELECT: [
    { label: MESSAGES.BUTTONS.INDOOR, value: '실내' },
    { label: MESSAGES.BUTTONS.OUTDOOR, value: '실외' },
  ],
  
  SPACE_SELECT: [
    { label: MESSAGES.BUTTONS.SPACE_CORPORATE, value: '기업' },
    { label: MESSAGES.BUTTONS.SPACE_RETAIL, value: '상가' },
    { label: MESSAGES.BUTTONS.SPACE_HOSPITAL, value: '병원' },
    { label: MESSAGES.BUTTONS.SPACE_PUBLIC, value: '공공' },
    { label: MESSAGES.BUTTONS.SPACE_HOTEL, value: '숙박' },
    { label: MESSAGES.BUTTONS.SPACE_EXHIBITION, value: '전시홀' },
    { label: MESSAGES.BUTTONS.SPACE_OTHER, value: '기타' },
  ],
  
  PURPOSE_SELECT: [
    { label: MESSAGES.BUTTONS.PURPOSE_RESEARCH, value: '정보 조사' },
    { label: MESSAGES.BUTTONS.PURPOSE_PLANNING, value: '아이디어 기획' },
    { label: MESSAGES.BUTTONS.PURPOSE_QUOTE, value: '견적' },
    { label: MESSAGES.BUTTONS.PURPOSE_PURCHASE, value: '구매' },
    { label: MESSAGES.BUTTONS.PURPOSE_OTHER, value: '기타' },
  ],
  
  BUDGET_SELECT: [
    { label: MESSAGES.BUTTONS.BUDGET_UNDER_10M, value: '1000만원 이하' },
    { label: MESSAGES.BUTTONS.BUDGET_10M_30M, value: '1000~3000만원' },
    { label: MESSAGES.BUTTONS.BUDGET_30M_50M, value: '3000~5000만원' },
    { label: MESSAGES.BUTTONS.BUDGET_50M_100M, value: '5000만원~1억' },
    { label: MESSAGES.BUTTONS.BUDGET_OVER_100M, value: '1억 이상' },
    { label: MESSAGES.BUTTONS.BUDGET_UNDECIDED, value: '미정' },
  ],
  
  STRUCTURE_SELECT: [
    { label: MESSAGES.BUTTONS.STRUCTURE_WOOD, value: '목공 설치' },
    { label: MESSAGES.BUTTONS.STRUCTURE_STANDALONE, value: '단독 설치' },
  ],
  
  LED_COUNT_SELECT: [
    { label: MESSAGES.BUTTONS.LED_COUNT_1, value: '1' },
    { label: MESSAGES.BUTTONS.LED_COUNT_2, value: '2' },
    { label: MESSAGES.BUTTONS.LED_COUNT_3, value: '3' },
    { label: MESSAGES.BUTTONS.LED_COUNT_4, value: '4' },
    { label: MESSAGES.BUTTONS.LED_COUNT_5, value: '5' },
  ],
  
  LED_SIZE_SELECT: [
    { label: MESSAGES.BUTTONS.LED_SIZE_6000_3000, value: '6000x3000' },
    { label: MESSAGES.BUTTONS.LED_SIZE_4000_3000, value: '4000x3000' },
    { label: MESSAGES.BUTTONS.LED_SIZE_4000_2500, value: '4000x2500' },
  ],
  
  STAGE_HEIGHT_SELECT: [
    { label: MESSAGES.BUTTONS.STAGE_HEIGHT_0, value: '0mm' },
    { label: MESSAGES.BUTTONS.STAGE_HEIGHT_600, value: '600mm' },
    { label: MESSAGES.BUTTONS.STAGE_HEIGHT_800, value: '800mm' },
    { label: MESSAGES.BUTTONS.STAGE_HEIGHT_1000, value: '1000mm' },
  ],
  
  YES_NO_SELECT: [
    { label: MESSAGES.BUTTONS.YES, value: '네' },
    { label: MESSAGES.BUTTONS.NO, value: '아니요' },
  ],
  
  TITLE_SELECT: [
    { label: MESSAGES.BUTTONS.TITLE_MANAGER, value: '매니저' },
    { label: MESSAGES.BUTTONS.TITLE_SENIOR, value: '책임' },
    { label: MESSAGES.BUTTONS.TITLE_TEAM_LEADER, value: '팀장' },
    { label: MESSAGES.BUTTONS.TITLE_DIRECTOR, value: '이사' },
  ],
  
  DAYS_SELECT: [
    { label: MESSAGES.BUTTONS.DAYS_1, value: '1' },
    { label: MESSAGES.BUTTONS.DAYS_2, value: '2' },
    { label: MESSAGES.BUTTONS.DAYS_3, value: '3' },
    { label: MESSAGES.BUTTONS.DAYS_4, value: '4' },
    { label: MESSAGES.BUTTONS.DAYS_5, value: '5' },
  ],
  
  NONE_SELECT: [
    { label: MESSAGES.BUTTONS.NONE, value: '없음' },
  ],
  
  CONFIRM_SELECT: [
    { label: MESSAGES.BUTTONS.CONFIRM, value: '네' },
    { label: MESSAGES.BUTTONS.CANCEL, value: '취소' },
  ],
  
  START_OVER_SELECT: [
    { label: MESSAGES.BUTTONS.START_OVER, value: '처음부터' },
  ],
  
  NEW_QUOTE_SELECT: [
    { label: MESSAGES.BUTTONS.NEW_QUOTE, value: '처음부터' },
  ],
} as const;

// messages.ts import 필요
import { MESSAGES } from '../constants/messages';