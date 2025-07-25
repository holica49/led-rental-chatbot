// src/tools/handlers/common-handlers.ts

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
  createLEDSummary
} from '../../utils/handler-utils.js';
import { EMOJI, DIVIDER } from '../../utils/message-utils.js';

export function handleAdditionalRequests(message: string, session: UserSession): KakaoResponse {
  if (message.trim() === '없음' || message.trim() === '') {
    session.data.additionalRequests = '없음';
  } else {
    session.data.additionalRequests = message.trim();
  }
  
  session.step = session.serviceType === '멤버쉽' ? 'get_contact_name' : 'get_customer_company';
  
  return {
    text: confirmAndAsk(
      '요청사항이 저장되었습니다',
      '',
      session.serviceType === '멤버쉽' ? MESSAGES.INPUT_NAME : MESSAGES.INPUT_COMPANY
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
    text: confirmAndAsk('고객사', session.data.customerName, MESSAGES.INPUT_NAME),
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
      text: confirmAndAsk('고객사', session.data.customerName, MESSAGES.INPUT_NAME),
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
    text: confirmAndAsk('담당자', `${session.data.contactName}님`, MESSAGES.INPUT_TITLE),
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
    text: confirmAndAsk('직급', session.data.contactTitle, MESSAGES.INPUT_PHONE),
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
        quote = calculateRentalLEDQuote(sessionCopy.data.ledSpecs, sessionCopy.data.rentalPeriod);
        schedules = calculateScheduleDates(sessionCopy.data.eventStartDate!, sessionCopy.data.eventEndDate!);
      } else if (sessionCopy.serviceType === '멤버쉽') {
        quote = calculateMultiLEDQuote(sessionCopy.data.ledSpecs);
        schedules = calculateScheduleDates(sessionCopy.data.eventStartDate!, sessionCopy.data.eventEndDate!);
      }

      const responseText = getSuccessResponseText(sessionCopy, quote);

      session.step = 'start';
      session.data = { ledSpecs: [] };
      session.serviceType = undefined;
      
      // 비동기 Notion 저장
      setImmediate(async () => {
        try {
          const notionData = prepareNotionData(sessionCopy, quote, schedules);
          const notionResult = await notionMCPTool.handler(notionData as any);
          
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
            ledSpecs: sessionCopy.data.ledSpecs
          });
          
          console.log('✅ Notion 저장 완료');
        } catch (error) {
          console.error('❌ Notion 저장 실패:', error);
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

function createFinalConfirmationMessage(session: UserSession): string {
  const header = `${EMOJI.CHECK} 모든 정보가 입력되었습니다!\n\n${EMOJI.INFO} 최종 확인\n\n${DIVIDER}`;
  
  let content = '';
  
  if (session.serviceType === '설치') {
    content = createInstallConfirmation(session);
  } else if (session.serviceType === '렌탈') {
    content = createRentalConfirmation(session);
  } else {
    content = createMembershipConfirmation(session);
  }
  
  const footer = '\n\n상담 요청을 진행하시겠습니까?';
  if (session.serviceType !== '설치') {
    return `${header}\n\n${content}\n\n견적을 요청하시겠습니까?`;
  }
  
  return `${header}\n\n${content}${footer}`;
}

function createInstallConfirmation(session: UserSession): string {
  return `🔖 서비스: LED 설치
${EMOJI.TOOL} 설치 환경: ${session.data.installEnvironment}
${EMOJI.INFO} 설치 지역: ${session.data.installRegion}
${EMOJI.COMPANY} 설치 공간: ${session.data.installSpace}
🎯 문의 목적: ${session.data.inquiryPurpose}
${EMOJI.MONEY} 설치 예산: ${session.data.installBudget}
${EMOJI.CALENDAR} 설치 일정: ${session.data.installSchedule}
${EMOJI.INFO} 요청사항: ${session.data.additionalRequests}

${EMOJI.COMPANY} 고객사: ${session.data.customerName}
${EMOJI.PERSON} 담당자: ${session.data.contactName}
💼 직급: ${session.data.contactTitle}
${EMOJI.PHONE} 연락처: ${session.data.contactPhone}`;
}

function createRentalConfirmation(session: UserSession): string {
  const ledSummary = createLEDSummary(session.data.ledSpecs);
  
  return `🔖 서비스: LED 렌탈
${EMOJI.COMPANY} 고객사: ${session.data.customerName}
${EMOJI.INFO} 행사명: ${session.data.eventName}
${EMOJI.INFO} 행사장: ${session.data.venue}
${EMOJI.CALENDAR} 행사 기간: ${session.data.eventStartDate} ~ ${session.data.eventEndDate} (${session.data.rentalPeriod}일)
${EMOJI.TOOL} 지지구조물: ${session.data.supportStructureType}

${EMOJI.MONITOR} LED 사양:
${ledSummary}

${EMOJI.PERSON} 담당자: ${session.data.contactName}
💼 직급: ${session.data.contactTitle}
${EMOJI.PHONE} 연락처: ${session.data.contactPhone}
${EMOJI.INFO} 요청사항: ${session.data.additionalRequests}`;
}

function createMembershipConfirmation(session: UserSession): string {
  const ledSummary = session.data.ledSpecs.map((led: any, index: number) => {
    const [w, h] = led.size.split('x').map(Number);
    const moduleCount = (w / 500) * (h / 500);
    const power = calculateLEDPower(led.size);
    return `LED${index + 1}: ${led.size} (${moduleCount}개, ${power})`;
  }).join('\n');
  
  return `🔖 서비스: 멤버쉽 (${session.data.memberCode})
${EMOJI.COMPANY} 고객사: ${session.data.customerName}
${EMOJI.INFO} 행사명: ${session.data.eventName}
${EMOJI.INFO} 행사장: ${session.data.venue}
${EMOJI.CALENDAR} 행사 기간: ${session.data.eventStartDate} ~ ${session.data.eventEndDate}

${EMOJI.MONITOR} LED 사양:
${ledSummary}

${EMOJI.PERSON} 담당자: ${session.data.contactName}
💼 직급: ${session.data.contactTitle}
${EMOJI.PHONE} 연락처: ${session.data.contactPhone}
${EMOJI.INFO} 요청사항: ${session.data.additionalRequests}`;
}

function getSuccessResponseText(session: UserSession, quote: QuoteResult | RentalQuoteResult | null): string {
  if (session.serviceType === '설치') {
    return MESSAGES.INSTALL_SUCCESS_TEMPLATE(
      session.data.customerName || '',
      session.data.contactName || '',
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

function calculateLEDPower(size: string): string {
  if (!size) return '';
  const [width, height] = size.split('x').map(Number);
  const moduleCount = (width / 500) * (height / 500);
  const totalPower = moduleCount * 0.2;
  return `${totalPower.toFixed(1)}kW`;
}