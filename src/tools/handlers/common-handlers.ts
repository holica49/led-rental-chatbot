import { UserSession, KakaoResponse, QuoteResult, RentalQuoteResult } from '../../types/index.js';
import { validatePhoneNumber } from '../validators/index.js';
import { calculateRentalLEDQuote, calculateMultiLEDQuote } from '../calculate-quote.js';
import { notionMCPTool } from '../notion-mcp.js';
import { prepareNotionData } from '../services/notion-service.js';
import { calculateScheduleDates } from '../utils/date-utils.js';
import { addMentionToPage } from '../services/mention-service.js';
import { MESSAGES, BUTTONS, VALIDATION_ERRORS } from '../../constants/messages.js';
import { 
  confirmAndAsk, 
  errorMessage, 
  createQuickReplies,
  validateNotEmpty,
  createLEDSummary,
  serviceSelectedMessage,
  createLEDSizePrompt,
  outdoorEventNotice,
  eventInfoConfirmed,
  memberCodeConfirmed,
  askWithProgress
} from '../../utils/handler-utils.js';
import { EMOJI, DIVIDER } from '../../utils/message-utils.js';
import { restorePreviousStep, hasPreviousStep } from '../../utils/session-utils.js';
import { lineWorksNotification } from '../services/lineworks-notification-service.js';


// 리셋 요청 체크 함수
export function checkResetRequest(message: string, session: UserSession): KakaoResponse | null {
  const resetKeywords = ['처음', '처음부터', '처음으로', '다시', '취소', '초기화'];
  
  if (resetKeywords.some(keyword => message.includes(keyword))) {
    return handleResetRequest(session);
  }
  
  return null;
}

// 공통 리셋 요청 처리 함수
export function handleResetRequest(session: UserSession): KakaoResponse {
  session.step = 'select_service';
  session.serviceType = undefined;
  session.data = { ledSpecs: [] };
  session.ledCount = 0;
  session.currentLED = 1;
  
  return {
    text: `처음부터 다시 시작합니다.\n\n${MESSAGES.GREETING}`,
    quickReplies: createQuickReplies([
      { label: BUTTONS.SERVICE_INSTALL, value: '설치' },
      { label: BUTTONS.SERVICE_RENTAL, value: '렌탈' },
      { label: BUTTONS.SERVICE_MEMBERSHIP, value: '멤버쉽' }
    ])
  };
}

/**
 * 이전 단계로 돌아가기 요청 체크
 */
export function checkPreviousRequest(message: string, session: UserSession): KakaoResponse | null {
  const previousKeywords = ['이전', '뒤로', '돌아가', '전으로', '전 단계'];
  
  if (previousKeywords.some(keyword => message.includes(keyword))) {
    return handlePreviousRequest(session);
  }
  
  return null;
}

/**
 * 이전 단계로 돌아가기 처리
 */
export function handlePreviousRequest(session: UserSession): KakaoResponse {
  if (!hasPreviousStep(session)) {
    return {
      text: '이전 단계가 없습니다.\n처음으로 돌아가시려면 "처음으로"라고 입력해주세요.',
      quickReplies: createQuickReplies([
        { label: BUTTONS.START_OVER, value: '처음으로' }
      ])
    };
  }

  const restored = restorePreviousStep(session);
  
  if (!restored) {
    return {
      text: '이전 단계로 돌아갈 수 없습니다.',
      quickReplies: []
    };
  }

  // 이전 단계의 질문을 다시 표시
  return getQuestionForStep(session);
}

export function handleAdditionalRequests(message: string, session: UserSession): KakaoResponse {
  if (message.trim() === '없음' || message.trim() === '') {
    session.data.additionalRequests = '없음';
  } else {
    session.data.additionalRequests = message.trim();
  }
  
  session.step = session.serviceType === '멤버쉽' ? 'get_contact_name' : 'get_customer_company';
  
  return {
    text: askWithProgress(
      session.serviceType === '멤버쉽' ? MESSAGES.INPUT_NAME : MESSAGES.INPUT_COMPANY,
      session
    ),
    quickReplies: []
  };
}

export function handleCustomerCompany(message: string, session: UserSession): KakaoResponse {
  const validation = validateNotEmpty(message, '고객사명');
  if (!validation.valid) {
    return {
      text: validation.error || MESSAGES.INPUT_COMPANY,
      quickReplies: []
    };
  }
  
  session.data.customerName = message.trim();
  session.step = 'get_contact_name';
  
  return {
    text: askWithProgress(MESSAGES.INPUT_NAME, session),
    quickReplies: []
  };
}

export function handleContactName(message: string, session: UserSession): KakaoResponse {
  // 설치 서비스에서 고객사명이 없는 경우 먼저 처리
  if (session.serviceType === '설치' && !session.data.customerName) {
    const validation = validateNotEmpty(message, '고객사명');
    if (!validation.valid) {
      return {
        text: validation.error || MESSAGES.INPUT_COMPANY,
        quickReplies: []
      };
    }
    
    session.data.customerName = message.trim();
    
    return {
      text: askWithProgress(MESSAGES.INPUT_NAME, session),
      quickReplies: []
    };
  }
  
  const validation = validateNotEmpty(message, '담당자 성함');
  if (!validation.valid) {
    return {
      text: validation.error || MESSAGES.INPUT_NAME,
      quickReplies: []
    };
  }
  
  session.data.contactName = message.trim();
  session.step = 'get_contact_title';
  
  return {
    text: askWithProgress(MESSAGES.INPUT_TITLE, session),
    quickReplies: createQuickReplies([
      { label: BUTTONS.TITLE_MANAGER, value: '매니저' },
      { label: BUTTONS.TITLE_SENIOR, value: '책임' },
      { label: BUTTONS.TITLE_TEAM_LEADER, value: '팀장' },
      { label: BUTTONS.TITLE_DIRECTOR, value: '이사' }
    ])
  };
}

export function handleContactTitle(message: string, session: UserSession): KakaoResponse {
  const validation = validateNotEmpty(message, '직급');
  if (!validation.valid) {
    return {
      text: validation.error || MESSAGES.INPUT_TITLE,
      quickReplies: createQuickReplies([
        { label: BUTTONS.TITLE_MANAGER, value: '매니저' },
        { label: BUTTONS.TITLE_SENIOR, value: '책임' },
        { label: BUTTONS.TITLE_TEAM_LEADER, value: '팀장' },
        { label: BUTTONS.TITLE_DIRECTOR, value: '이사' }
      ])
    };
  }
  
  session.data.contactTitle = message.trim();
  session.step = 'get_contact_phone';
  
  return {
    text: askWithProgress(MESSAGES.INPUT_PHONE, session),
    quickReplies: []
  };
}

export function handleContactPhone(message: string, session: UserSession): KakaoResponse {
  const validation = validatePhoneNumber(message);
  
  if (!validation.valid || !validation.phone) {
    return {
      text: errorMessage(validation.error || VALIDATION_ERRORS.PHONE),
      quickReplies: []
    };
  }
  
  session.data.contactPhone = validation.phone;
  session.step = 'final_confirmation';
  
  return {
    text: createFinalConfirmationMessage(session),
    quickReplies: createQuickReplies([
      { label: BUTTONS.CONFIRM, value: '네' },
      { label: BUTTONS.CANCEL, value: '취소' }
    ])
  };
}
/**
 * 각 단계별 질문 반환 (이전 단계로 돌아갔을 때 사용)
 */
export function getQuestionForStep(session: UserSession): KakaoResponse {
  switch (session.step) {
    // 공통 단계
    case 'select_service':
      return {
        text: MESSAGES.GREETING,
        quickReplies: createQuickReplies([
          { label: BUTTONS.SERVICE_INSTALL, value: '설치' },
          { label: BUTTONS.SERVICE_RENTAL, value: '렌탈' },
          { label: BUTTONS.SERVICE_MEMBERSHIP, value: '멤버쉽' }
        ])
      };
    
    // 설치 서비스 단계
    case 'install_environment':
      return {
        text: serviceSelectedMessage('LED 설치', MESSAGES.SELECT_ENVIRONMENT),
        quickReplies: createQuickReplies([
          { label: BUTTONS.INDOOR_SIMPLE, value: '실내' },
          { label: BUTTONS.OUTDOOR_SIMPLE, value: '실외' }
        ])
      };
    
    case 'install_region':
      return {
        text: confirmAndAsk(
          `${session.data.installEnvironment} 설치로 선택하셨습니다`,
          '',
          MESSAGES.INPUT_REGION
        ),
        quickReplies: []
      };
    
    case 'install_space':
      return {
        text: confirmAndAsk('설치 지역', session.data.installRegion || '', MESSAGES.SELECT_SPACE),
        quickReplies: createQuickReplies([
          { label: BUTTONS.SPACE_CORPORATE, value: '기업' },
          { label: BUTTONS.SPACE_RETAIL, value: '상가' },
          { label: BUTTONS.SPACE_HOSPITAL, value: '병원' },
          { label: BUTTONS.SPACE_PUBLIC, value: '공공' },
          { label: BUTTONS.SPACE_HOTEL, value: '숙박' },
          { label: BUTTONS.SPACE_EXHIBITION, value: '전시홀' },
          { label: BUTTONS.SPACE_OTHER, value: '기타' }
        ])
      };
    
    case 'inquiry_purpose':
      const prevConfirm = session.serviceType === '설치' 
        ? confirmAndAsk('설치 공간', session.data.installSpace || '', MESSAGES.SELECT_PURPOSE)
        : confirmAndAsk('문의 목적', session.data.inquiryPurpose || '', MESSAGES.SELECT_PURPOSE);
      
      return {
        text: prevConfirm,
        quickReplies: createQuickReplies([
          { label: BUTTONS.PURPOSE_RESEARCH, value: '정보 조사' },
          { label: BUTTONS.PURPOSE_PLANNING, value: '아이디어 기획' },
          { label: BUTTONS.PURPOSE_QUOTE, value: '견적' },
          { label: BUTTONS.PURPOSE_PURCHASE, value: '구매' },
          { label: BUTTONS.PURPOSE_OTHER, value: '기타' }
        ])
      };
    
    case 'install_budget':
    case 'rental_outdoor_budget':
      return {
        text: confirmAndAsk('문의 목적', session.data.inquiryPurpose || '', MESSAGES.SELECT_BUDGET),
        quickReplies: createQuickReplies([
          { label: BUTTONS.BUDGET_UNDER_10M, value: '1000만원 이하' },
          { label: BUTTONS.BUDGET_10M_30M, value: '1000~3000만원' },
          { label: BUTTONS.BUDGET_30M_50M, value: '3000~5000만원' },
          { label: BUTTONS.BUDGET_50M_100M, value: '5000만원~1억' },
          { label: BUTTONS.BUDGET_OVER_100M, value: '1억 이상' },
          { label: BUTTONS.BUDGET_UNDECIDED, value: '미정' }
        ])
      };
    
    case 'install_schedule':
      return {
        text: confirmAndAsk('설치 예산', session.data.installBudget || '', MESSAGES.INPUT_SCHEDULE),
        quickReplies: []
      };
    
    // 렌탈 서비스 단계
    case 'rental_indoor_outdoor':
      return {
        text: serviceSelectedMessage('LED 렌탈', MESSAGES.INPUT_EVENT_INFO),
        quickReplies: []
      };
    
    case 'rental_structure_type':
      return {
        text: eventInfoConfirmed(
          session.data.eventName || '', 
          session.data.venue || '', 
          MESSAGES.SELECT_INDOOR_OUTDOOR
        ),
        quickReplies: createQuickReplies([
          { label: BUTTONS.INDOOR, value: '실내' },
          { label: BUTTONS.OUTDOOR, value: '실외' }
        ])
      };
    
    case 'rental_led_count':
      if (session.data.installEnvironment === '실외') {
        return {
          text: confirmAndAsk(
            '행사 기간',
            `${session.data.eventStartDate} ~ ${session.data.eventEndDate} (${session.data.rentalPeriod}일)`,
            MESSAGES.SELECT_LED_COUNT
          ),
          quickReplies: createQuickReplies([
            { label: BUTTONS.LED_COUNT[0], value: '1' },
            { label: BUTTONS.LED_COUNT[1], value: '2' },
            { label: BUTTONS.LED_COUNT[2], value: '3' },
            { label: BUTTONS.LED_COUNT[3], value: '4' },
            { label: BUTTONS.LED_COUNT[4], value: '5' }
          ])
        };
      } else {
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
    
    case 'rental_led_specs':
      if (session.ledCount && session.currentLED <= session.ledCount) {
        return {
          text: createLEDSizePrompt(session.currentLED),
          quickReplies: createQuickReplies([
            { label: BUTTONS.LED_SIZE_6000_3000, value: '6000x3000' },
            { label: BUTTONS.LED_SIZE_4000_3000, value: '4000x3000' },
            { label: BUTTONS.LED_SIZE_4000_2500, value: '4000x2500' }
          ])
        };
      }
      return {
        text: MESSAGES.SELECT_LED_COUNT,
        quickReplies: createQuickReplies([
          { label: BUTTONS.LED_COUNT[0], value: '1' },
          { label: BUTTONS.LED_COUNT[1], value: '2' },
          { label: BUTTONS.LED_COUNT[2], value: '3' },
          { label: BUTTONS.LED_COUNT[3], value: '4' },
          { label: BUTTONS.LED_COUNT[4], value: '5' }
        ])
      };
    
    case 'rental_stage_height':
    case 'membership_stage_height':
      const currentLed = session.data.ledSpecs[session.currentLED - 1];
      return {
        text: confirmAndAsk(
          `LED ${session.currentLED}번째 개소`,
          currentLed?.size || '',
          MESSAGES.INPUT_STAGE_HEIGHT
        ),
        quickReplies: createQuickReplies([
          { label: BUTTONS.STAGE_HEIGHT_0, value: '0mm' },
          { label: BUTTONS.STAGE_HEIGHT_600, value: '600mm' },
          { label: BUTTONS.STAGE_HEIGHT_800, value: '800mm' },
          { label: BUTTONS.STAGE_HEIGHT_1000, value: '1000mm' }
        ])
      };
    
    case 'rental_operator_needs':
    case 'membership_operator_needs':
      return {
        text: confirmAndAsk(
          `LED ${session.currentLED}번째 개소 무대 높이`,
          `${session.data.ledSpecs[session.currentLED - 1]?.stageHeight || 0}mm`,
          MESSAGES.ASK_OPERATOR
        ),
        quickReplies: createQuickReplies([
          { label: BUTTONS.YES, value: '네' },
          { label: BUTTONS.NO, value: '아니요' }
        ])
      };
    
    case 'rental_operator_days':
    case 'membership_operator_days':
      return {
        text: confirmAndAsk('오퍼레이터 필요', '', MESSAGES.ASK_OPERATOR_DAYS),
        quickReplies: createQuickReplies([
          { label: BUTTONS.DAYS[0], value: '1' },
          { label: BUTTONS.DAYS[1], value: '2' },
          { label: BUTTONS.DAYS[2], value: '3' },
          { label: BUTTONS.DAYS[3], value: '4' },
          { label: BUTTONS.DAYS[4], value: '5' }
        ])
      };
    
    case 'rental_prompter':
    case 'membership_prompter':
      const needsOp = session.data.ledSpecs[session.currentLED - 1]?.needOperator;
      const opDays = session.data.ledSpecs[session.currentLED - 1]?.operatorDays;
      const prevText = needsOp 
        ? confirmAndAsk('오퍼레이터', `${opDays}일`, MESSAGES.ASK_PROMPTER)
        : confirmAndAsk('오퍼레이터 불필요', '', MESSAGES.ASK_PROMPTER);
      
      return {
        text: prevText,
        quickReplies: createQuickReplies([
          { label: BUTTONS.YES, value: '네' },
          { label: BUTTONS.NO, value: '아니요' }
        ])
      };
    
    case 'rental_relay':
    case 'membership_relay':
      const needsPrompter = session.data.ledSpecs[session.currentLED - 1]?.prompterConnection;
      return {
        text: confirmAndAsk(
          `프롬프터 연결 ${needsPrompter ? '필요' : '불필요'}`,
          '',
          MESSAGES.ASK_RELAY
        ),
        quickReplies: createQuickReplies([
          { label: BUTTONS.YES, value: '네' },
          { label: BUTTONS.NO, value: '아니요' }
        ])
      };
    
    case 'rental_period':
      if (session.data.installEnvironment === '실외') {
        return {
          text: confirmAndAsk('설치 예산', session.data.installBudget || '', MESSAGES.INPUT_PERIOD),
          quickReplies: []
        };
      } else {
        return {
          text: createLEDCompleteMessage(session) + '\n\n' + MESSAGES.INPUT_PERIOD,
          quickReplies: []
        };
      }
    
    // 멤버쉽 서비스 단계
    case 'membership_code':
      return {
        text: serviceSelectedMessage('멤버쉽', MESSAGES.INPUT_MEMBER_CODE),
        quickReplies: []
      };
    
    case 'membership_event_info':
      return {
        text: memberCodeConfirmed(session.data.memberCode || '001'),
        quickReplies: []
      };
    
    case 'membership_led_count':
      return {
        text: eventInfoConfirmed(
          session.data.eventName || '',
          session.data.venue || '',
          MESSAGES.SELECT_LED_COUNT
        ),
        quickReplies: createQuickReplies([
          { label: BUTTONS.LED_COUNT[0], value: '1' },
          { label: BUTTONS.LED_COUNT[1], value: '2' },
          { label: BUTTONS.LED_COUNT[2], value: '3' },
          { label: BUTTONS.LED_COUNT[3], value: '4' },
          { label: BUTTONS.LED_COUNT[4], value: '5' }
        ])
      };
    
    case 'membership_led_specs':
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
    
    case 'membership_period':
      return {
        text: createLEDCompleteMessage(session) + '\n\n' + MESSAGES.INPUT_PERIOD,
        quickReplies: []
      };
    
    // 공통 단계 (고객 정보)
    case 'get_additional_requests':
      const prevStepText = session.serviceType === '설치' 
        ? confirmAndAsk('설치 일정', session.data.installSchedule || '', MESSAGES.REQUEST_ADDITIONAL)
        : confirmAndAsk(
            '행사 기간',
            `${session.data.eventStartDate} ~ ${session.data.eventEndDate}`,
            MESSAGES.REQUEST_ADDITIONAL
          );
      
      return {
        text: prevStepText,
        quickReplies: createQuickReplies([
          { label: BUTTONS.NONE, value: '없음' }
        ])
      };
    
    case 'get_customer_company':
      return {
        text: confirmAndAsk('요청사항이 저장되었습니다', '', MESSAGES.INPUT_COMPANY),
        quickReplies: []
      };
    
    case 'get_contact_name':
      if (session.serviceType === '멤버쉽') {
        return {
          text: confirmAndAsk('요청사항이 저장되었습니다', '', MESSAGES.INPUT_NAME),
          quickReplies: []
        };
      } else {
        return {
          text: confirmAndAsk('고객사', session.data.customerName || '', MESSAGES.INPUT_NAME),
          quickReplies: []
        };
      }
    
    case 'get_contact_title':
      return {
        text: confirmAndAsk('담당자', `${session.data.contactName}님` || '', MESSAGES.INPUT_TITLE),
        quickReplies: createQuickReplies([
          { label: BUTTONS.TITLE_MANAGER, value: '매니저' },
          { label: BUTTONS.TITLE_SENIOR, value: '책임' },
          { label: BUTTONS.TITLE_TEAM_LEADER, value: '팀장' },
          { label: BUTTONS.TITLE_DIRECTOR, value: '이사' }
        ])
      };
    
    case 'get_contact_phone':
      return {
        text: confirmAndAsk('직급', session.data.contactTitle || '', MESSAGES.INPUT_PHONE),
        quickReplies: []
      };
    
    case 'final_confirmation':
      return {
        text: createFinalConfirmationMessage(session),
        quickReplies: createQuickReplies([
          { label: BUTTONS.CONFIRM, value: '네' },
          { label: BUTTONS.CANCEL, value: '취소' }
        ])
      };
    
    default:
      // 기본 처리 - 서비스 선택으로
      return {
        text: MESSAGES.GREETING,
        quickReplies: createQuickReplies([
          { label: BUTTONS.SERVICE_INSTALL, value: '설치' },
          { label: BUTTONS.SERVICE_RENTAL, value: '렌탈' },
          { label: BUTTONS.SERVICE_MEMBERSHIP, value: '멤버쉽' }
        ])
      };
  }
}

export async function handleFinalConfirmation(message: string, session: UserSession): Promise<KakaoResponse> {
  if (message.includes('취소')) {
    session.step = 'start';
    session.data = { ledSpecs: [] };
    
    return {
      text: MESSAGES.CANCEL,
      quickReplies: createQuickReplies([
        { label: BUTTONS.START_OVER, value: '처음부터' }
      ])
    };
  }
  
  if (message.includes('네') || message.includes('요청')) {
    try {
      const sessionCopy: UserSession = JSON.parse(JSON.stringify(session));
      
      let quote: QuoteResult | RentalQuoteResult | null = null;
      let schedules: { eventSchedule: string; installSchedule: string; rehearsalSchedule: string; dismantleSchedule: string } | null = null;

      if (sessionCopy.serviceType === '렌탈' && sessionCopy.data.rentalPeriod) {
        const isIndoor = sessionCopy.data.installEnvironment === '실내';
        quote = calculateRentalLEDQuote(sessionCopy.data.ledSpecs, sessionCopy.data.rentalPeriod, isIndoor);
        schedules = calculateScheduleDates(sessionCopy.data.eventStartDate!, sessionCopy.data.eventEndDate!);
      } else if (sessionCopy.serviceType === '멤버쉽') {
        quote = calculateMultiLEDQuote(sessionCopy.data.ledSpecs, true);
        schedules = calculateScheduleDates(sessionCopy.data.eventStartDate!, sessionCopy.data.eventEndDate!);
      }

      const responseText = getSuccessResponseText(sessionCopy, quote);

      session.step = 'select_service';
      session.data = { ledSpecs: [] };
      session.serviceType = undefined;
      session.ledCount = 0;
      session.currentLED = 1;
      
      // 비동기 Notion 저장 및 LINE WORKS 알림
      setImmediate(async () => {
        try {
          const notionData = prepareNotionData(sessionCopy, quote, schedules);
          const notionResult = await notionMCPTool.handler(notionData as any);
          
          // 기존 Notion 멘션 추가
          await addMentionToPage(notionResult.id, {
            serviceType: sessionCopy.serviceType,
            eventName: notionData.eventName,
            customerName: notionData.customerName,
            contactName: notionData.contactName,
            contactTitle: notionData.contactTitle,
            contactPhone: notionData.contactPhone,
            eventPeriod: notionData.eventSchedule || notionData.requiredTiming,
            venue: notionData.venue || notionData.installRegion,
            totalAmount: notionData.totalQuoteAmount,
            ledSpecs: sessionCopy.data.ledSpecs,
            installSpace: notionData.installSpace,
            installEnvironment: notionData.installEnvironment,
            installSchedule: notionData.eventSchedule || notionData.installSchedule,
            installBudget: notionData.installBudget,
            inquiryPurpose: notionData.inquiryPurpose,
            additionalRequests: notionData.additionalRequests
          });
          
          console.log('✅ Notion 저장 완료');
          
          // LINE WORKS 알림 발송
          await lineWorksNotification.sendNewRequestNotification({
            serviceType: sessionCopy.serviceType,
            eventName: notionData.eventName || '미정',
            customerName: notionData.customerName || '미정',
            contactName: notionData.contactName,
            venue: notionData.venue || notionData.installRegion,
            eventPeriod: notionData.eventSchedule || notionData.requiredTiming,
            notionPageId: notionResult.id,
            notionUrl: notionResult.url,
            totalAmount: notionData.totalQuoteAmount
          });
          
          console.log('✅ LINE WORKS 알림 발송 완료');
          
          // LINE WORKS 알림 발송
          await lineWorksNotification.sendNewRequestNotification({
            serviceType: sessionCopy.serviceType,
            eventName: notionData.eventName || '미정',
            customerName: notionData.customerName || '미정',
            contactName: notionData.contactName,
            venue: notionData.venue || notionData.installRegion,
            eventPeriod: notionData.eventSchedule || notionData.requiredTiming,
            notionPageId: notionResult.id,
            notionUrl: notionResult.url, // Notion API가 URL을 반환하는 경우
            totalAmount: notionData.totalQuoteAmount
          });
          
          console.log('✅ LINE WORKS 알림 발송 완료');
          
        } catch (error) {
          console.error('❌ Notion 저장 또는 LINE WORKS 알림 실패:', error);
        }
      });
      
      return {
        text: responseText,
        quickReplies: createQuickReplies([
          { label: BUTTONS.NEW_QUOTE, value: '처음부터' }
        ])
      };
      
    } catch (error) {
      console.error('견적 처리 실패:', error);
      return {
        text: errorMessage('견적 처리 중 오류가 발생했습니다.\n\n다시 시도해주세요.'),
        quickReplies: createQuickReplies([
          { label: '다시 시도', value: '네' },
          { label: BUTTONS.START_OVER, value: '처음부터' }
        ])
      };
    }
  }
  
  return {
    text: '요청을 진행하시겠습니까?',
    quickReplies: createQuickReplies([
      { label: BUTTONS.CONFIRM, value: '네' },
      { label: BUTTONS.CANCEL, value: '취소' }
    ])
  };
}

// Helper Functions

export function createFinalConfirmationMessage(session: UserSession): string {
  const header = `${EMOJI.CHECK} 모든 정보가 입력되었습니다!\n${EMOJI.INFO} 최종 확인\n${DIVIDER}`;
  
  let content = '';
  let footer = '';
  
  if (session.serviceType === '설치') {
    content = createInstallConfirmation(session);
    footer = '\n상담 요청을 진행하시겠습니까?';
  } else if (session.serviceType === '렌탈') {
    if (session.data.installEnvironment === '실외') {
      content = createRentalOutdoorConfirmation(session);
      footer = '\n상담을 요청하시겠습니까?';
    } else {
      content = createRentalIndoorConfirmation(session);
      footer = '\n견적을 요청하시겠습니까?(견적을 요청하시면 예상 견적이 나옵니다.)';
    }
  } else {
    content = createMembershipConfirmation(session);
    footer = '\n견적을 요청하시겠습니까?(견적을 요청하시면 예상 견적이 나옵니다.)';
  }
  
  return `${header}\n${content}${footer}`;
}

export function createInstallConfirmation(session: UserSession): string {
  return `🔖 서비스: LED 설치
${EMOJI.TOOL} 설치 환경: ${session.data.installEnvironment}
${EMOJI.INFO} 설치 지역: ${session.data.installRegion}
${EMOJI.COMPANY} 설치 공간: ${session.data.installSpace}
🎯 문의 목적: ${session.data.inquiryPurpose}
${EMOJI.MONEY} 설치 예산: ${session.data.installBudget}
${EMOJI.CALENDAR} 설치 일정: ${session.data.installSchedule}
${EMOJI.INFO} 요청사항: ${session.data.additionalRequests}
${EMOJI.COMPANY} 고객사: ${session.data.customerName}
${EMOJI.PERSON} 고객명: ${session.data.contactName} ${session.data.contactTitle}
${EMOJI.PHONE} 연락처: ${session.data.contactPhone}`;
}

export function createRentalIndoorConfirmation(session: UserSession): string {
  const ledSummary = session.data.ledSpecs.map((led: any, index: number) => {
    const [w, h] = led.size.split('x').map(Number);
    const widthPixels = Math.round((w / 500) * 168);
    const heightPixels = Math.round((h / 500) * 168);
    
    let details = `LED${index + 1}: ${led.size}mm (${widthPixels}x${heightPixels}px`;
    
    if (led.stageHeight !== undefined) {
      details += `, 무대높이 : ${led.stageHeight}mm`;
    }
    
    // 추가 옵션 표시
    if (led.needOperator) {
      details += `, 오퍼레이터 ${led.operatorDays}일`;
    }
    if (led.prompterConnection) {
      details += ', 프롬프터 연결';
    }
    if (led.relayConnection) {
      details += ', 중계카메라 연결';
    }
    
    details += ')';
    
    return details;
  }).join('\n');
  
  return `🔖 서비스: LED 렌탈
${EMOJI.INFO} 행사명: ${session.data.eventName}
${EMOJI.INFO} 행사장: ${session.data.venue}
${EMOJI.CALENDAR} 행사 기간: ${session.data.eventStartDate} ~ ${session.data.eventEndDate} (${session.data.rentalPeriod}일)
${EMOJI.TOOL} 지지구조물: ${session.data.supportStructureType}
${EMOJI.MONITOR} LED 사양:
${ledSummary}
${EMOJI.INFO} 요청사항: ${session.data.additionalRequests}
${EMOJI.COMPANY} 고객사: ${session.data.customerName}
${EMOJI.PERSON} 고객명: ${session.data.contactName} ${session.data.contactTitle}
${EMOJI.PHONE} 연락처: ${session.data.contactPhone}`;
}

export function createRentalOutdoorConfirmation(session: UserSession): string {
  const ledSummary = session.data.ledSpecs.map((led: any, index: number) => {
    let details = `LED${index + 1}: ${led.size}`;
    
    if (led.stageHeight !== undefined) {
      details += ` (무대높이 : ${led.stageHeight}mm)`;
    }
    
    return details;
  }).join('\n');
  
  return `🔖 서비스: LED 렌탈
${EMOJI.INFO} 행사명: ${session.data.eventName}
${EMOJI.INFO} 행사장: ${session.data.venue}
${EMOJI.CALENDAR} 행사 기간: ${session.data.eventStartDate} ~ ${session.data.eventEndDate} (${session.data.rentalPeriod}일)
🎯 문의 목적: ${session.data.inquiryPurpose}
${EMOJI.MONEY} 설치 예산: ${session.data.installBudget}
${EMOJI.MONITOR} LED 사양:
${ledSummary}
${EMOJI.INFO} 요청사항: ${session.data.additionalRequests}
${EMOJI.COMPANY} 고객사: ${session.data.customerName}
${EMOJI.PERSON} 고객명: ${session.data.contactName} ${session.data.contactTitle}
${EMOJI.PHONE} 연락처: ${session.data.contactPhone}`;
}

export function createMembershipConfirmation(session: UserSession): string {
  const ledSummary = session.data.ledSpecs.map((led: any, index: number) => {
    const [w, h] = led.size.split('x').map(Number);
    const widthPixels = Math.round((w / 500) * 168);
    const heightPixels = Math.round((h / 500) * 168);
    const power = calculateLEDPower(led.size);
    
    let details = `LED${index + 1}: ${led.size}mm (${widthPixels}x${heightPixels}px, ${power}`;
    
    // 추가 옵션 표시
    if (led.needOperator) {
      details += `, 오퍼레이터 ${led.operatorDays}일`;
    }
    if (led.prompterConnection) {
      details += ', 프롬프터 연결';
    }
    if (led.relayConnection) {
      details += ', 중계카메라 연결';
    }
    
    details += ')';
    
    return details;
  }).join('\n');
  
  return `🔖 서비스: 멤버쉽 (${session.data.memberCode})
${EMOJI.INFO} 행사명: ${session.data.eventName}
${EMOJI.INFO} 행사장: ${session.data.venue}
${EMOJI.CALENDAR} 행사 기간: ${session.data.eventStartDate} ~ ${session.data.eventEndDate}
${EMOJI.MONITOR} LED 사양:
${ledSummary}
${EMOJI.INFO} 요청사항: ${session.data.additionalRequests}
${EMOJI.COMPANY} 고객사: 메쎄이상
${EMOJI.PERSON} 고객명: ${session.data.contactName} ${session.data.contactTitle}
${EMOJI.PHONE} 연락처: ${session.data.contactPhone}`;
}

export function createLEDCompleteMessage(session: UserSession): string {
  const summary = createLEDSummary(session.data.ledSpecs);
  return `✅ 모든 LED 설정이 완료되었습니다!\n\n📋 설정 요약:\n${summary}`;
}

export function getSuccessResponseText(session: UserSession, quote: QuoteResult | RentalQuoteResult | null): string {
  if (session.serviceType === '설치') {
    return MESSAGES.INSTALL_SUCCESS_TEMPLATE(
      session.data.customerName || '',
      session.data.contactName || '' + (session.data.contactTitle ? ` ${session.data.contactTitle}` : ''),
      session.data.contactPhone || ''
    );
  } else if (session.serviceType === '렌탈') {
    if (session.data.installEnvironment === '실외') {
      return MESSAGES.RENTAL_OUTDOOR_SUCCESS_TEMPLATE(
        session.data.eventName || '',
        session.data.customerName || '',
        session.data.contactName || '',
        session.data.contactTitle || '',
        session.data.contactPhone || ''
      );
    } else {
      return MESSAGES.RENTAL_INDOOR_SUCCESS_TEMPLATE(
        session.data.eventName || '',
        session.data.customerName || '',
        session.data.contactName || '',
        session.data.contactTitle || '',
        session.data.contactPhone || '',
        quote?.total || 0
      );
    }
  } else {
    return MESSAGES.MEMBERSHIP_SUCCESS_TEMPLATE(
      session.data.eventName || '',
      session.data.contactName || '',
      session.data.contactTitle || '',
      session.data.contactPhone || '',
      quote?.total || 0
    );
  }
}

export function calculateLEDPower(size: string): string {
  if (!size) return '';
  const [width, height] = size.split('x').map(Number);
  const moduleCount = (width / 500) * (height / 500);
  const totalPower = moduleCount * 0.2;
  return `${totalPower.toFixed(1)}kW`;
}