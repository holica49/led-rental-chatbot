import { UserSession, KakaoResponse } from '../../types/index.js';
import { validatePhoneNumber } from '../validators/index.js';
import { calculateRentalLEDQuote, calculateMultiLEDQuote } from '../calculate-quote.js';
import { notionMCPTool } from '../notion-mcp.js';
import { prepareNotionData } from '../services/notion-service.js';
import { calculateScheduleDates } from '../utils/date-utils.js';
import { addMentionToPage } from '../services/mention-service.js';

export function handleAdditionalRequests(message: string, session: UserSession): KakaoResponse {
  if (message.trim() === '없음' || message.trim() === '') {
    session.data.additionalRequests = '없음';
  } else {
    session.data.additionalRequests = message.trim();
  }
  
  if (session.serviceType === '렌탈') {
    session.step = 'get_customer_company';
    return {
      text: `✅ 요청사항이 저장되었습니다.\n\n━━━━━━\n\n🏢 고객사명을 알려주세요.`,
      quickReplies: []
    };
  }
  
  if (session.serviceType === '설치') {
    session.step = 'get_contact_name';
    return {
      text: `✅ 요청사항이 저장되었습니다.\n\n━━━━━━\n\n🏢 고객사명을 알려주세요.`,
      quickReplies: []
    };
  }
  
  session.step = 'get_contact_name';
  return {
    text: `✅ 요청사항이 저장되었습니다.\n\n━━━━━━\n\n👤 담당자님의 성함을 알려주세요.`,
    quickReplies: []
  };
}

export function handleCustomerCompany(message: string, session: UserSession): KakaoResponse {
  if (!message || message.trim().length === 0) {
    return {
      text: '고객사명을 입력해주세요.',
      quickReplies: []
    };
  }
  
  session.data.customerName = message.trim();
  session.step = 'get_contact_name';
  
  return {
    text: `✅ 고객사: ${session.data.customerName}\n\n━━━━━━\n\n👤 담당자님의 성함을 알려주세요.`,
    quickReplies: []
  };
}

export function handleContactName(message: string, session: UserSession): KakaoResponse {
  if (session.serviceType === '설치' && !session.data.customerName) {
    if (!message || message.trim().length === 0) {
      return {
        text: '고객사명을 입력해주세요.',
        quickReplies: []
      };
    }
    
    session.data.customerName = message.trim();
    
    return {
      text: `✅ 고객사: ${session.data.customerName}\n\n━━━━━━\n\n👤 담당자님의 성함을 알려주세요.`,
      quickReplies: []
    };
  }
  
  if (!message || message.trim().length === 0) {
    return {
      text: '담당자 성함을 입력해주세요.',
      quickReplies: []
    };
  }
  
  session.data.contactName = message.trim();
  session.step = 'get_contact_title';
  
  return {
    text: `✅ 담당자: ${session.data.contactName}님\n\n━━━━━━\n\n💼 직급을 알려주세요.`,
    quickReplies: [
      { label: '매니저', action: 'message', messageText: '매니저' },
      { label: '책임', action: 'message', messageText: '책임' },
      { label: '팀장', action: 'message', messageText: '팀장' },
      { label: '이사', action: 'message', messageText: '이사' }
    ]
  };
}

export function handleContactTitle(message: string, session: UserSession): KakaoResponse {
  if (!message || message.trim().length === 0) {
    return {
      text: '직급을 입력해주세요.',
      quickReplies: [
        { label: '매니저', action: 'message', messageText: '매니저' },
        { label: '책임', action: 'message', messageText: '책임' },
        { label: '팀장', action: 'message', messageText: '팀장' },
        { label: '이사', action: 'message', messageText: '이사' }
      ]
    };
  }
  
  session.data.contactTitle = message.trim();
  session.step = 'get_contact_phone';
  
  return {
    text: `✅ 직급: ${session.data.contactTitle}\n\n━━━━━━\n\n📞 연락처를 알려주세요.\n예: 010-1234-5678`,
    quickReplies: []
  };
}

export function handleContactPhone(message: string, session: UserSession): KakaoResponse {
  const validation = validatePhoneNumber(message);
  
  if (!validation.valid || !validation.phone) {
    return {
      text: `❌ ${validation.error}\n\n다시 입력해주세요.`,
      quickReplies: []
    };
  }
  
  session.data.contactPhone = validation.phone;
  session.step = 'final_confirmation';
  
  let confirmationMessage = '';
  
  if (session.serviceType === '설치') {
    confirmationMessage = `✅ 모든 정보가 입력되었습니다!\n\n📋 최종 확인\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n🔖 서비스: LED 설치\n🏗️ 설치 환경: ${session.data.installEnvironment}\n📍 설치 지역: ${session.data.installRegion}\n🏢 설치 공간: ${session.data.installSpace}\n🎯 문의 목적: ${session.data.inquiryPurpose}\n💰 설치 예산: ${session.data.installBudget}\n📅 설치 일정: ${session.data.installSchedule}\n💬 요청사항: ${session.data.additionalRequests}\n\n🏢 고객사: ${session.data.customerName}\n👤 담당자: ${session.data.contactName}\n💼 직급: ${session.data.contactTitle}\n📞 연락처: ${session.data.contactPhone}\n\n상담 요청을 진행하시겠습니까?`;
  } else if (session.serviceType === '렌탈') {
    const ledSummary = session.data.ledSpecs.map((led: any, index: number) => {
      const [w, h] = led.size.split('x').map(Number);
      const moduleCount = (w / 500) * (h / 500);
      return `LED${index + 1}: ${led.size} (${moduleCount}개)`;
    }).join('\n');
    
    confirmationMessage = `✅ 모든 정보가 입력되었습니다!\n\n📋 최종 확인\n\n━━━━━━\n\n🔖 서비스: LED 렌탈\n🏢 고객사: ${session.data.customerName}\n📋 행사명: ${session.data.eventName}\n📍 행사장: ${session.data.venue}\n📅 행사 기간: ${session.data.eventStartDate} ~ ${session.data.eventEndDate} (${session.data.rentalPeriod}일)\n🔧 지지구조물: ${session.data.supportStructureType}\n\n🖥️ LED 사양:\n${ledSummary}\n\n👤 담당자: ${session.data.contactName}\n💼 직급: ${session.data.contactTitle}\n📞 연락처: ${session.data.contactPhone}\n💬 요청사항: ${session.data.additionalRequests}\n\n견적을 요청하시겠습니까?`;
  } else {
    const ledSummary = session.data.ledSpecs.map((led: any, index: number) => {
      const [w, h] = led.size.split('x').map(Number);
      const moduleCount = (w / 500) * (h / 500);
      const power = calculateLEDPower(led.size);
      return `LED${index + 1}: ${led.size} (${moduleCount}개, ${power})`;
    }).join('\n');
   
    confirmationMessage = `✅ 모든 정보가 입력되었습니다!\n\n📋 최종 확인\n\n━━━━━━\n\n🔖 서비스: 멤버쉽 (${session.data.memberCode})\n🏢 고객사: ${session.data.customerName}\n📋 행사명: ${session.data.eventName}\n📍 행사장: ${session.data.venue}\n📅 행사 기간: ${session.data.eventStartDate} ~ ${session.data.eventEndDate}\n\n🖥️ LED 사양:\n${ledSummary}\n\n👤 담당자: ${session.data.contactName}\n💼 직급: ${session.data.contactTitle}\n📞 연락처: ${session.data.contactPhone}\n💬 요청사항: ${session.data.additionalRequests}\n\n예상 견적을 요청하시겠습니까?`;
  }
  
  return {
    text: confirmationMessage,
    quickReplies: [
      { label: '네, 요청합니다', action: 'message', messageText: '네' },
      { label: '취소', action: 'message', messageText: '취소' }
    ]
  };
}

export async function handleFinalConfirmation(message: string, session: UserSession): Promise<KakaoResponse> {
  if (message.includes('취소')) {
    session.step = 'start';
    session.data = { ledSpecs: [] };
    
    return {
      text: '요청이 취소되었습니다.\n\n처음부터 다시 시작하시려면 아무 메시지나 입력해주세요.',
      quickReplies: [
        { label: '처음으로', action: 'message', messageText: '처음부터' }
      ]
    };
  }
  
  if (message.includes('네') || message.includes('요청')) {
    try {
      const sessionCopy: UserSession = JSON.parse(JSON.stringify(session));
      
      let quote: any = null;
      let schedules: any = null;

      if (sessionCopy.serviceType === '렌탈' && sessionCopy.data.rentalPeriod) {
        quote = calculateRentalLEDQuote(sessionCopy.data.ledSpecs, sessionCopy.data.rentalPeriod);
        schedules = calculateScheduleDates(sessionCopy.data.eventStartDate!, sessionCopy.data.eventEndDate!);
      } else if (sessionCopy.serviceType === '멤버쉽') {
        quote = calculateMultiLEDQuote(sessionCopy.data.ledSpecs);
        schedules = calculateScheduleDates(sessionCopy.data.eventStartDate!, sessionCopy.data.eventEndDate!);
      }

      const responseText = sessionCopy.serviceType === '설치' 
        ? `✅ 상담 요청이 접수되었습니다!\n\n━━━━━━\n\n🏢 고객사: ${sessionCopy.data.customerName}\n👤 고객: ${sessionCopy.data.contactName} ${sessionCopy.data.contactTitle}\n📞 연락처: ${sessionCopy.data.contactPhone}\n🏗️ 설치 환경: ${sessionCopy.data.installEnvironment}\n📍 설치 지역: ${sessionCopy.data.installRegion}\n📅 필요 시기: ${sessionCopy.data.requiredTiming}\n\n👤 담당자: 유준수 구축팀장\n📞 담당자 연락처: 010-7333-3336\n\n곧 담당자가 연락드릴 예정입니다.\n\n💡 설치 사례 보러가기:\nhttps://blog.naver.com/PostList.naver?blogId=oriondisplay_&from=postList&categoryNo=8\n\n감사합니다! 😊`
        : sessionCopy.serviceType === '렌탈'
        ? sessionCopy.data.installEnvironment === '실외'
          ? `✅ 견적 요청이 접수되었습니다!\n\n📋 ${sessionCopy.data.eventName}\n🏢 ${sessionCopy.data.customerName}\n👤 고객: ${sessionCopy.data.contactName} ${sessionCopy.data.contactTitle}\n📞 연락처: ${sessionCopy.data.contactPhone}\n🌳 실외 행사\n\n📝 최수삼 렌탈팀장이 별도로 연락드릴 예정입니다.\n📞 담당자 직통: 010-2797-2504`
          : `✅ 견적 요청이 접수되었습니다!\n\n📋 ${sessionCopy.data.eventName}\n🏢 ${sessionCopy.data.customerName}\n👤 고객: ${sessionCopy.data.contactName} ${sessionCopy.data.contactTitle}\n📞 연락처: ${sessionCopy.data.contactPhone}\n💰 예상 견적 금액: ${quote?.total?.toLocaleString() || '계산중'}원 (VAT 포함)\n\n📝 담당자에게 전달 중입니다...\n\n⚠️ 상기 금액은 예상 견적이며, 담당자와 협의 후 조정될 수 있습니다.`
        : `✅ 견적 요청이 접수되었습니다!\n\n📋 ${sessionCopy.data.eventName}\n👤 고객: ${sessionCopy.data.contactName} ${sessionCopy.data.contactTitle}\n📞 연락처: ${sessionCopy.data.contactPhone}\n💰 예상 견적 금액: ${quote?.total?.toLocaleString() || '계산중'}원 (VAT 포함)\n\n📝 상세 견적은 담당자가 연락드릴 예정입니다...`;

      session.step = 'start';
      session.data = { ledSpecs: [] };
      session.serviceType = undefined;
      
      setImmediate(async () => {
        try {
          const notionData = prepareNotionData(sessionCopy, quote, schedules);
          const notionResult = await notionMCPTool.handler(notionData);
          
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
        quickReplies: [
          { label: '새 견적 요청', action: 'message', messageText: '처음부터' }
        ]
      };
      
    } catch (error) {
      console.error('견적 처리 실패:', error);
      return {
        text: `❌ 견적 처리 중 오류가 발생했습니다.\n\n다시 시도해주세요.`,
        quickReplies: [
          { label: '다시 시도', action: 'message', messageText: '네' },
          { label: '처음부터', action: 'message', messageText: '처음부터' }
        ]
      };
    }
  }
  
  return {
    text: '요청을 진행하시겠습니까?',
    quickReplies: [
      { label: '네, 요청합니다', action: 'message', messageText: '네' },
      { label: '취소', action: 'message', messageText: '취소' }
    ]
  };
}

function calculateLEDPower(size: string): string {
  if (!size) return '';
  const [width, height] = size.split('x').map(Number);
  const moduleCount = (width / 500) * (height / 500);
  const totalPower = moduleCount * 0.2;
  return `${totalPower.toFixed(1)}kW`;
}