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
  MEMBERSHIP: 11  // 멤버쉽 코드~연락처까지 (LED 1개 기준)
} as const;

// 서비스별 단계 번호 계산 함수
export function getStepNumber(serviceType: string, currentStep: string, ledCount: number = 1, currentLED: number = 1): number {
  const serviceTypeUpper = serviceType.toUpperCase();
  const isOutdoor = currentStep.includes('outdoor') || currentStep === 'rental_inquiry_purpose' || currentStep === 'rental_outdoor_budget';
  
  // LED 관련 단계들
  const ledSteps = ['led_specs', 'stage_height', 'operator_needs', 'operator_days', 'prompter', 'relay'];
  
  // 현재 단계가 LED 관련 단계인지 확인
  const isLedStep = ledSteps.some(step => currentStep.includes(step));
  
  // LED 단계가 끝난 후의 단계들 (기본 번호에 LED 추가 단계를 더해야 함)
  const postLedSteps = ['period', 'get_additional_requests', 'get_customer_company', 'get_contact_name', 'get_contact_title', 'get_contact_phone'];
  const isPostLedStep = postLedSteps.some(step => currentStep.includes(step));
  
  // LED로 인한 추가 단계 수
  const ledAdditionalSteps = (ledCount - 1) * 6;
  
  if (isLedStep && ledCount > 1) {
    // LED 단계 기본 번호 계산
    const baseStepMap: Record<string, number> = {
      // 렌탈 실내
      'rental_led_specs': 4,
      'rental_stage_height': 4,
      'rental_operator_needs': 4,
      'rental_operator_days': 4,
      'rental_prompter': 4,
      'rental_relay': 4,
      // 렌탈 실외
      'rental_led_specs_outdoor': 6,
      'rental_stage_height_outdoor': 6,
      'rental_operator_needs_outdoor': 6,
      'rental_operator_days_outdoor': 6,
      'rental_prompter_outdoor': 6,
      'rental_relay_outdoor': 6,
      // 멤버쉽
      'membership_led_specs': 4,
      'membership_stage_height': 4,
      'membership_operator_needs': 4,
      'membership_operator_days': 4,
      'membership_prompter': 4,
      'membership_relay': 4,
    };
    
    const baseStep = baseStepMap[currentStep] || 4;
    // 현재 LED 번호에 따른 단계 계산
    return baseStep + (currentLED - 1) * 6;
  }
  
  // 일반 단계 매핑
  let stepMap: Record<string, number> = {};
  
  if (serviceTypeUpper === 'INSTALL') {
    stepMap = {
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
    };
  } else if (serviceTypeUpper === 'RENTAL') {
    if (isOutdoor) {
      // 실외 렌탈
      stepMap = {
        'rental_indoor_outdoor': 1,
        'rental_structure_type': 2,
        'rental_inquiry_purpose': 3,
        'rental_outdoor_budget': 4,
        'rental_period': 5,
        'rental_led_count': 6,
        'rental_led_specs': 7,
        'rental_stage_height': 7,
        'rental_operator_needs': 7,
        'rental_operator_days': 7,
        'rental_prompter': 7,
        'rental_relay': 7,
        'get_additional_requests': 8 + ledAdditionalSteps,
        'get_customer_company': 9 + ledAdditionalSteps,
        'get_contact_name': 10 + ledAdditionalSteps,
        'get_contact_title': 11 + ledAdditionalSteps,
        'get_contact_phone': 12 + ledAdditionalSteps,
        'final_confirmation': 13 + ledAdditionalSteps,
      };
    } else {
      // 실내 렌탈
      stepMap = {
        'rental_indoor_outdoor': 1,
        'rental_structure_type': 2,
        'rental_led_count': 3,
        'rental_led_specs': 4,
        'rental_stage_height': 4,
        'rental_operator_needs': 4,
        'rental_operator_days': 4,
        'rental_prompter': 4,
        'rental_relay': 4,
        'rental_period': 5 + ledAdditionalSteps,
        'get_additional_requests': 6 + ledAdditionalSteps,
        'get_customer_company': 7 + ledAdditionalSteps,
        'get_contact_name': 8 + ledAdditionalSteps,
        'get_contact_title': 9 + ledAdditionalSteps,
        'get_contact_phone': 10 + ledAdditionalSteps,
        'final_confirmation': 11 + ledAdditionalSteps,
      };
    }
  } else if (serviceTypeUpper === 'MEMBERSHIP') {
    stepMap = {
      'membership_code': 1,
      'membership_event_info': 2,
      'membership_led_count': 3,
      'membership_led_specs': 4,
      'membership_stage_height': 4,
      'membership_operator_needs': 4,
      'membership_operator_days': 4,
      'membership_prompter': 4,
      'membership_relay': 4,
      'membership_period': 5 + ledAdditionalSteps,
      'get_additional_requests': 6 + ledAdditionalSteps,
      'get_contact_name': 7 + ledAdditionalSteps,
      'get_contact_title': 8 + ledAdditionalSteps,
      'get_contact_phone': 9 + ledAdditionalSteps,
      'final_confirmation': 10 + ledAdditionalSteps,
    };
  }
  
  // LED 단계 이후의 단계들은 추가 단계를 고려
  if (isPostLedStep && !isLedStep) {
    const baseStep = stepMap[currentStep] || 1;
    return baseStep;
  }
  
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
      rental_inquiry_purpose: {
        id: 'rental_inquiry_purpose',
        nextStep: 'rental_outdoor_budget',
        required: true,
      },
      rental_outdoor_budget: {
        id: 'rental_outdoor_budget',
        nextStep: 'rental_period',
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