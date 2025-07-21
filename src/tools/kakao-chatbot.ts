import express from 'express';
import bodyParser from 'body-parser';
import { calculateMultiLEDQuote, calculateRentalLEDQuote } from './calculate-quote.js';
import { notionMCPTool } from './notion-mcp.js';
import { Client } from '@notionhq/client';

// Express 라우터 생성
export const skillRouter = express.Router();
const notion = new Client({ auth: process.env.NOTION_API_KEY });

// 사용자 세션 인터페이스
interface UserSession {
 step: string;
 serviceType?: '설치' | '렌탈' | '멤버쉽';
 data: {
   // 공통 정보
   eventName?: string;
   venue?: string;
   customerName?: string;
   eventStartDate?: string;
   eventEndDate?: string;
   contactName?: string;
   contactTitle?: string;
   contactPhone?: string;
   additionalRequests?: string;
   
   // 설치 서비스 관련
   installEnvironment?: '실내' | '실외';
   installRegion?: string;
   requiredTiming?: string;
   
   // 렌탈 서비스 관련
   supportStructureType?: '목공 설치' | '단독 설치';
   rentalPeriod?: number;
   
   // 멤버쉽 관련
   memberCode?: string;
   
   // LED 정보
   ledSpecs: Array<{
     size: string;
     stageHeight?: number;
     needOperator: boolean;
     operatorDays: number;
     prompterConnection?: boolean;
     relayConnection?: boolean;
   }>;
 };
 ledCount: number;
 currentLED: number;
 lastMessage?: string;
}

// 사용자 세션 관리
const userSessions: { [key: string]: UserSession } = {};

// ===== 유틸리티 함수들 =====

// LED 크기 검증 함수
function validateAndNormalizeLEDSize(input: string): { valid: boolean; size?: string; error?: string } {
 if (!input || typeof input !== 'string') {
   return { valid: false, error: 'LED 크기를 입력해주세요.' };
 }
 
 const cleanInput = input.replace(/\s/g, '').toLowerCase();
 const patterns = [
   /^(\d+)[x×*](\d+)$/,
   /^(\d+)[x×*]\s*(\d+)$/,
   /^(\d+)\s*[x×*]\s*(\d+)$/,
   /^(\d+)[x×*](\d+)mm$/,
   /^(\d+)mm[x×*](\d+)mm$/
 ];
 
 for (const pattern of patterns) {
   const match = cleanInput.match(pattern);
   if (match) {
     const [, widthStr, heightStr] = match;
     const width = parseInt(widthStr);
     const height = parseInt(heightStr);
     
     if (width % 500 !== 0 || height % 500 !== 0) {
       return { 
         valid: false, 
         error: `LED 크기는 500mm 단위로 입력해주세요.\n입력하신 크기: ${width}x${height}\n가까운 크기: ${Math.round(width/500)*500}x${Math.round(height/500)*500}` 
       };
     }
     
     if (width < 500 || height < 500) {
       return { valid: false, error: 'LED 크기는 최소 500x500mm 이상이어야 합니다.' };
     }
     
     return { valid: true, size: `${width}x${height}` };
   }
 }
 
 return { 
   valid: false, 
   error: 'LED 크기 형식이 올바르지 않습니다.\n예시: 6000x3000, 4000*3000, 4000×2500' 
 };
}

// 무대 높이 검증 함수
function validateStageHeight(input: string): { valid: boolean; height?: number; error?: string } {
  if (!input || typeof input !== 'string') {
    return { valid: false, error: '무대 높이를 입력해주세요.' };
  }
  
  const cleanInput = input.replace(/\s/g, '').toLowerCase();
  
  // 버튼 클릭 텍스트 직접 처리
  const buttonValues: { [key: string]: number } = {
    '0mm': 0,
    '600mm': 600,
    '800mm': 800,
    '1000mm': 1000
  };
  
  if (buttonValues[cleanInput]) {
    return { valid: true, height: buttonValues[cleanInput] };
  }
  
  const patterns = [
    /^(\d+)$/,
    /^(\d+)mm$/,
    /^(\d+)cm$/,
    /^(\d+)m$/,
    /^(\d+\.\d+)m$/
  ];
  
  for (const pattern of patterns) {
    const match = cleanInput.match(pattern);
    if (match) {
      let height = parseFloat(match[1]);
      
      if (cleanInput.includes('cm')) {
        height = height * 10;
      } else if (cleanInput.includes('m') && !cleanInput.includes('mm')) {
        height = height * 1000;
      }
      
      // 최소값 0으로 변경
      if (height < 0 || height > 10000) {
        return { 
          valid: false, 
          error: '무대 높이는 0mm ~ 10000mm(10m) 사이로 입력해주세요.' 
        };
      }
      
      return { valid: true, height: Math.round(height) };
    }
  }
  
  return { 
    valid: false, 
    error: '무대 높이 형식이 올바르지 않습니다.\n예시: 0, 600, 600mm, 60cm, 0.6m' 
  };
}

// 행사 기간 검증 함수
function validateEventPeriod(input: string): { valid: boolean; startDate?: string; endDate?: string; days?: number; error?: string } {
 if (!input || typeof input !== 'string') {
   return { valid: false, error: '행사 기간을 입력해주세요.' };
 }
 
 const cleanInput = input.replace(/\s/g, '');
 const patterns = [
   /^(\d{4}-\d{2}-\d{2})~(\d{4}-\d{2}-\d{2})$/,
   /^(\d{4}-\d{2}-\d{2})-(\d{4}-\d{2}-\d{2})$/,
   /^(\d{4}-\d{2}-\d{2})부터(\d{4}-\d{2}-\d{2})까지$/,
   /^(\d{4}-\d{2}-\d{2})에서(\d{4}-\d{2}-\d{2})$/
 ];
 
 for (const pattern of patterns) {
   const match = cleanInput.match(pattern);
   if (match) {
     const [, startDate, endDate] = match;
     
     // 날짜 형식 검증
     const datePattern = /^\d{4}-\d{2}-\d{2}$/;
     if (!datePattern.test(startDate) || !datePattern.test(endDate)) {
       continue;
     }
     
     // 날짜 유효성 검증
     const start = new Date(startDate);
     const end = new Date(endDate);
     
     if (isNaN(start.getTime()) || isNaN(end.getTime())) {
       return { valid: false, error: '유효하지 않은 날짜입니다.' };
     }
     
     if (start > end) {
       return { valid: false, error: '시작일이 종료일보다 늦을 수 없습니다.' };
     }
     
     // 일수 계산 (시작일과 종료일 포함)
     const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
     
     return { valid: true, startDate, endDate, days };
   }
 }
 
 return { 
   valid: false, 
   error: '행사 기간 형식이 올바르지 않습니다.\n예시: 2025-07-09 ~ 2025-07-11' 
 };
}

// 전화번호 검증 함수
function validatePhoneNumber(input: string): { valid: boolean; phone?: string; error?: string } {
 if (!input || typeof input !== 'string') {
   return { valid: false, error: '전화번호를 입력해주세요.' };
 }
 
 const cleanInput = input.replace(/[-\s]/g, '');
 const patterns = [
   /^010\d{8}$/,
   /^02\d{7,8}$/,
   /^0[3-9]\d{8,9}$/,
   /^070\d{8}$/
 ];
 
 for (const pattern of patterns) {
   if (pattern.test(cleanInput)) {
     // 전화번호 포맷팅
     if (cleanInput.startsWith('010')) {
       return { valid: true, phone: cleanInput.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3') };
     } else if (cleanInput.startsWith('02')) {
       if (cleanInput.length === 9) {
         return { valid: true, phone: cleanInput.replace(/(\d{2})(\d{3})(\d{4})/, '$1-$2-$3') };
       } else {
         return { valid: true, phone: cleanInput.replace(/(\d{2})(\d{4})(\d{4})/, '$1-$2-$3') };
       }
     } else {
       return { valid: true, phone: cleanInput.replace(/(\d{3})(\d{3,4})(\d{4})/, '$1-$2-$3') };
     }
   }
 }
 
 return { 
   valid: false, 
   error: '올바른 전화번호 형식이 아닙니다.\n예시: 010-1234-5678, 02-1234-5678' 
 };
}

// 숫자 입력 검증 함수
function validateNumber(input: string, min: number = 1, max: number = 10): { valid: boolean; value?: number; error?: string } {
 const num = parseInt(input);
 
 if (isNaN(num)) {
   return { valid: false, error: '숫자를 입력해주세요.' };
 }
 
 if (num < min || num > max) {
   return { valid: false, error: `${min}에서 ${max} 사이의 숫자를 입력해주세요.` };
 }
 
 return { valid: true, value: num };
}

// 날짜 계산 함수
function calculateScheduleDates(startDate: string, endDate: string) {
 const start = new Date(startDate);
 const end = new Date(endDate);
 
 // 설치 일정: 시작일 하루 전
 const installDate = new Date(start);
 installDate.setDate(installDate.getDate() - 1);
 
 // 리허설 일정: 시작일 하루 전 (설치일과 같음)
 const rehearsalDate = new Date(installDate);
 
 // 철거 일정: 마지막 날
 const dismantleDate = new Date(end);
 
 return {
   eventSchedule: `${startDate} ~ ${endDate}`,
   installSchedule: installDate.toISOString().split('T')[0],
   rehearsalSchedule: rehearsalDate.toISOString().split('T')[0],
   dismantleSchedule: dismantleDate.toISOString().split('T')[0]
 };
}

// 담당자 언급 알림 함수
async function addMentionToPage(pageId: string, eventData: any) {
 try {
   // 환경변수에서 담당자 정보 가져오기
   const managersConfig = JSON.parse(process.env.MANAGERS_CONFIG || '{"managers":[]}');
   const activeManagers = managersConfig.managers.filter((m: any) => m.isActive);
   
   if (activeManagers.length === 0) {
     console.warn('활성화된 담당자가 없습니다.');
     return;
   }
   
   // 댓글 내용 구성 (올바른 Notion API 타입)
   const richTextContent: any[] = [
     {
       type: 'text',
       text: { content: '🚨 새로운 견적 요청이 접수되었습니다!\n\n' },
       annotations: { bold: true, color: 'red' }
     },
     {
       type: 'text',
       text: { content: `🔖 서비스 유형: ${eventData.serviceType}\n` },
       annotations: { bold: true }
     },
     {
       type: 'text',
       text: { content: `📋 행사명: ${eventData.eventName}\n` },
       annotations: { bold: true }
     },
     {
       type: 'text',
       text: { content: `🏢 고객사: ${eventData.customerName}\n` }
     },
     {
       type: 'text',
       text: { content: `👤 담당자: ${eventData.contactName} (${eventData.contactTitle})\n` }
     },
     {
       type: 'text',
       text: { content: `📞 연락처: ${eventData.contactPhone}\n` }
     },
     {
       type: 'text',
       text: { content: `📅 행사기간: ${eventData.eventPeriod}\n` }
     },
     {
       type: 'text',
       text: { content: `🎪 행사장: ${eventData.venue}\n` }
     },
     {
       type: 'text',
       text: { content: `💰 견적금액: ${eventData.totalAmount?.toLocaleString() || '계산중'}원\n\n` }
     }
   ];
   
   // LED 사양 정보 추가
   if (eventData.ledSpecs && eventData.ledSpecs.length > 0) {
     richTextContent.push({
       type: 'text',
       text: { content: '📺 LED 사양:\n' },
       annotations: { bold: true }
     });
     
     eventData.ledSpecs.forEach((spec: any, index: number) => {
       const [w, h] = spec.size.split('x').map(Number);
       const moduleCount = (w / 500) * (h / 500);
       richTextContent.push({
         type: 'text',
         text: { content: `${index + 1}. ${spec.size} (무대높이: ${spec.stageHeight}mm, ${moduleCount}개)\n` }
       });
     });
   }
   
   // 구분선
   richTextContent.push({
     type: 'text',
     text: { content: '\n' + '─'.repeat(30) + '\n' }
   });
   
   // 담당자 언급
   richTextContent.push({
     type: 'text',
     text: { content: '담당자 확인 요청: ' },
     annotations: { bold: true }
   });
   
   // 각 담당자를 언급
   activeManagers.forEach((manager: any, index: number) => {
     richTextContent.push({
       type: 'mention',
       mention: {
         type: 'user',
         user: { id: manager.notionId }
       }
     });
     
     if (manager.department) {
       richTextContent.push({
         type: 'text',
         text: { content: `(${manager.department})` }
       });
     }
     
     if (index < activeManagers.length - 1) {
       richTextContent.push({
         type: 'text',
         text: { content: ', ' }
       });
     }
   });
   
   // 마감 안내
   richTextContent.push({
     type: 'text',
     text: { content: '\n\n⏰ 빠른 확인 부탁드립니다!' },
     annotations: { bold: true }
   });
   
   // Notion 댓글 추가
   await notion.comments.create({
     parent: { page_id: pageId },
     rich_text: richTextContent
   });
   
   console.log('✅ 담당자 언급 알림 완료');
   
 } catch (error) {
   console.error('❌ 담당자 언급 실패:', error);
 }
}

// 수정 요청 감지
function isModificationRequest(message: string): boolean {
 const modificationKeywords = [
   '수정', '바꾸', '변경', '다시', '틀렸', '잘못', '돌아가', '이전',
   '고쳐', '바꿔', '뒤로', '취소'
 ];
 return modificationKeywords.some(keyword => message.includes(keyword));
}

// 초기화 요청 감지
function isResetRequest(message: string): boolean {
 const resetKeywords = ['처음부터', '처음부터 시작', '초기화', '새로', '다시 시작'];
 return resetKeywords.some(keyword => message.includes(keyword));
}

// ===== 핸들러 함수들 =====

// 수정 요청 처리
function handleModificationRequest(_message: string, _session: UserSession) {
 return {
   text: '처음부터 다시 시작하시겠습니까?',
   quickReplies: [
     { label: '예, 처음부터', action: 'message', messageText: '처음부터 시작' },
     { label: '아니요, 계속', action: 'message', messageText: '계속' }
   ]
 };
}

// 초기화 처리
function handleResetRequest(session: UserSession) {
 session.step = 'start';
 session.serviceType = undefined;
 session.data = { ledSpecs: [] };
 session.ledCount = 0;
 session.currentLED = 1;
 
 return {
   text: '처음부터 다시 시작합니다.\n\n안녕하세요! LED 전문 기업 오비스입니다. 😊\n\n어떤 서비스를 도와드릴까요?',
   quickReplies: [
     { label: '🏗️ LED 설치', action: 'message', messageText: '설치' },
     { label: '📦 LED 렌탈', action: 'message', messageText: '렌탈' },
     { label: '👥 멤버쉽 서비스', action: 'message', messageText: '멤버쉽' }
   ]
 };
}

// 시작 처리
function handleStart(session: UserSession) {
 session.step = 'select_service';
 
 return {
   text: '안녕하세요! LED 전문 기업 오비스입니다. 😊\n\n어떤 서비스를 도와드릴까요?',
   quickReplies: [
     { label: '🏗️ LED 설치', action: 'message', messageText: '설치' },
     { label: '📦 LED 렌탈', action: 'message', messageText: '렌탈' },
     { label: '👥 멤버쉽 서비스', action: 'message', messageText: '멤버쉽' }
   ]
 };
}

// 서비스 선택
function handleSelectService(message: string, session: UserSession) {
 if (message.includes('설치')) {
   session.serviceType = '설치';
   session.step = 'install_environment';
   return {
     text: '🏗️ LED 설치 서비스를 선택하셨습니다.\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n설치 환경을 선택해주세요.',
     quickReplies: [
       { label: '🏢 실내 설치', action: 'message', messageText: '실내' },
       { label: '🌳 실외 설치', action: 'message', messageText: '실외' }
     ]
   };
 } else if (message.includes('렌탈')) {
   session.serviceType = '렌탈';
   session.step = 'rental_indoor_outdoor';
   session.data.customerName = '메쎄이상';
   return {
     text: '📦 LED 렌탈 서비스를 선택하셨습니다.\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n행사명과 행사장을 알려주세요.\n예: 커피박람회 / 수원메쎄 2홀',
     quickReplies: []
   };
 } else if (message.includes('멤버쉽')) {
   session.serviceType = '멤버쉽';
   session.step = 'membership_code';
   return {
     text: '👥 멤버쉽 서비스를 선택하셨습니다.\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n멤버 코드를 입력해주세요.',
     quickReplies: []
   };
 } else {
   return {
     text: '서비스를 선택해주세요.',
     quickReplies: [
       { label: '🏗️ LED 설치', action: 'message', messageText: '설치' },
       { label: '📦 LED 렌탈', action: 'message', messageText: '렌탈' },
       { label: '👥 멤버쉽 서비스', action: 'message', messageText: '멤버쉽' }
     ]
   };
 }
}

// ===== 설치 서비스 핸들러 =====
function handleInstallEnvironment(message: string, session: UserSession) {
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
   text: `✅ ${session.data.installEnvironment} 설치로 선택하셨습니다.\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n설치하실 지역을 입력해주세요.\n예: 서울, 경기, 부산 등`,
   quickReplies: []
 };
}

function handleInstallRegion(message: string, session: UserSession) {
 if (!message || message.trim().length === 0) {
   return {
     text: '설치 지역을 입력해주세요.\n예: 서울, 경기, 부산 등',
     quickReplies: []
   };
 }
 
 session.data.installRegion = message.trim();
 session.data.venue = message.trim(); // 행사장으로도 사용
 session.step = 'install_timing';
 
 return {
   text: `✅ 설치 지역: ${session.data.installRegion}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n언제 필요하신가요?\n예: 2025년 8월, 3개월 후, 내년 상반기 등`,
   quickReplies: []
 };
}

function handleInstallTiming(message: string, session: UserSession) {
 if (!message || message.trim().length === 0) {
   return {
     text: '필요 시기를 입력해주세요.\n예: 2025년 8월, 3개월 후, 내년 상반기 등',
     quickReplies: []
   };
 }
 
 session.data.requiredTiming = message.trim();
 session.data.eventName = `LED 설치 프로젝트`; // 기본 행사명
 session.step = 'get_additional_requests';
 
 return {
   text: `✅ 필요 시기: ${session.data.requiredTiming}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n별도 요청사항이 있으신가요?\n\n없으시면 "없음"이라고 입력해주세요.`,
   quickReplies: [
     { label: '없음', action: 'message', messageText: '없음' }
   ]
 };
}

// ===== 렌탈 서비스 핸들러 =====
function handleRentalIndoorOutdoor(message: string, session: UserSession) {
 const parts = message.split('/').map(part => part.trim());
 
 if (parts.length >= 2) {
   session.data.eventName = parts[0];
   session.data.venue = parts[1];
   session.step = 'rental_structure_type';
   
   return {
     text: `✅ 행사 정보 확인\n📋 행사명: ${session.data.eventName}\n📍 행사장: ${session.data.venue}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n실내 행사인가요, 실외 행사인가요?`,
     quickReplies: [
       { label: '🏢 실내', action: 'message', messageText: '실내' },
       { label: '🌳 실외', action: 'message', messageText: '실외' }
     ]
   };
 } else {
   return {
     text: '❌ 형식이 올바르지 않습니다.\n\n올바른 형식으로 다시 입력해주세요:\n📝 행사명 / 행사장\n\n예시:\n• 커피박람회 / 수원메쎄 2홀\n• 전시회 / 킨텍스 1홀',
     quickReplies: []
   };
 }
}

function handleRentalStructureType(message: string, session: UserSession) {
 if (message.includes('실외')) {
   // 실외 선택 시 최수삼 팀장 안내
   session.step = 'start';
   session.data = { ledSpecs: [] };
   
   return {
     text: `🌳 실외 행사는 별도 상담이 필요합니다.\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n👤 담당: 최수삼 팀장\n📞 연락처: 010-2797-2504\n\n위 담당자에게 직접 연락 부탁드립니다.\n감사합니다! 😊`,
     quickReplies: [
       { label: '처음으로', action: 'message', messageText: '처음부터' }
     ]
   };
 }
 
 session.step = 'rental_led_count';
 return {
   text: `✅ 실내 행사로 확인되었습니다.\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n지지구조물 타입을 선택해주세요.`,
   quickReplies: [
     { label: '🔨 목공 설치', action: 'message', messageText: '목공 설치' },
     { label: '🏗️ 단독 설치', action: 'message', messageText: '단독 설치' }
   ]
 };
}

function handleRentalLEDCount(message: string, session: UserSession) {
 if (message.includes('목공')) {
   session.data.supportStructureType = '목공 설치';
 } else if (message.includes('단독')) {
   session.data.supportStructureType = '단독 설치';
 } else {
   return {
     text: '지지구조물 타입을 선택해주세요.',
     quickReplies: [
       { label: '🔨 목공 설치', action: 'message', messageText: '목공 설치' },
       { label: '🏗️ 단독 설치', action: 'message', messageText: '단독 설치' }
     ]
   };
 }
 
 session.step = 'rental_led_specs';
 return {
   text: `✅ 지지구조물: ${session.data.supportStructureType}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n몇 개의 LED가 필요하신가요? (1-5개)`,
   quickReplies: [
     { label: '1개', action: 'message', messageText: '1' },
     { label: '2개', action: 'message', messageText: '2' },
     { label: '3개', action: 'message', messageText: '3' },
     { label: '4개', action: 'message', messageText: '4' },
     { label: '5개', action: 'message', messageText: '5' }
   ]
 };
}

function handleRentalLEDSpecs(message: string, session: UserSession) {
 // LED 개수 입력
 if (session.ledCount === 0) {
   const validation = validateNumber(message, 1, 5);
   if (!validation.valid || !validation.value) {
     return {
       text: `❌ ${validation.error}\n\n1-5개 사이의 숫자를 선택해주세요.`,
       quickReplies: [
         { label: '1개', action: 'message', messageText: '1' },
         { label: '2개', action: 'message', messageText: '2' },
         { label: '3개', action: 'message', messageText: '3' },
         { label: '4개', action: 'message', messageText: '4' },
         { label: '5개', action: 'message', messageText: '5' }
       ]
     };
   }
   
   session.ledCount = validation.value;
   session.currentLED = 1;
   session.data.ledSpecs = [];
   
   return {
     text: `✅ 총 ${session.ledCount}개의 LED 설정을 진행하겠습니다.\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n🖥️ LED ${session.currentLED}번의 크기를 알려주세요.\n\n예시: 4000x2500, 6000x3000`,
     quickReplies: [
       { label: '6000x3000', action: 'message', messageText: '6000x3000' },
       { label: '4000x3000', action: 'message', messageText: '4000x3000' },
       { label: '4000x2500', action: 'message', messageText: '4000x2500' }
     ]
   };
 }
 
 // LED 크기 입력
 const validation = validateAndNormalizeLEDSize(message);
 if (!validation.valid || !validation.size) {
   return {
     text: `❌ ${validation.error}\n\n다시 입력해주세요.`,
     quickReplies: [
       { label: '6000x3000', action: 'message', messageText: '6000x3000' },
       { label: '4000x3000', action: 'message', messageText: '4000x3000' },
       { label: '4000x2500', action: 'message', messageText: '4000x2500' }
     ]
   };
 }
 
 session.data.ledSpecs.push({
   size: validation.size,
   needOperator: false,
   operatorDays: 0,
   prompterConnection: false,
   relayConnection: false
 });
 
 session.step = 'rental_stage_height';
 
 return {
   text: `✅ LED ${session.currentLED}번: ${validation.size}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📐 무대 높이를 알려주세요. (mm 단위)`,
   quickReplies: [
     { label: '600mm', action: 'message', messageText: '600mm' },
     { label: '800mm', action: 'message', messageText: '800mm' },
     { label: '1000mm', action: 'message', messageText: '1000mm' }
     ]
 };
}

function handleRentalStageHeight(message: string, session: UserSession) {
 const validation = validateStageHeight(message);
 
 if (!validation.valid || validation.height === undefined) {
   return {
     text: `❌ ${validation.error}\n\n다시 입력해주세요.`,
     quickReplies: [
       { label: '0mm', action: 'message', messageText: '0mm' },
       { label: '600mm', action: 'message', messageText: '600mm' },
       { label: '800mm', action: 'message', messageText: '800mm' },
       { label: '1000mm', action: 'message', messageText: '1000mm' }
     ]
   };
 }
 
 const currentLedIndex = session.data.ledSpecs.length - 1;
 session.data.ledSpecs[currentLedIndex].stageHeight = validation.height;
 
 session.step = 'rental_operator_needs';
 
 return {
   text: `✅ 무대 높이: ${validation.height}mm\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n👨‍💼 오퍼레이터가 필요하신가요?`,
   quickReplies: [
     { label: '네, 필요합니다', action: 'message', messageText: '네' },
     { label: '아니요', action: 'message', messageText: '아니요' }
   ]
 };
}

function handleRentalOperatorNeeds(message: string, session: UserSession) {
 const currentLedIndex = session.data.ledSpecs.length - 1;
 const needsOperator = message.includes('네') || message.includes('필요');
 
 session.data.ledSpecs[currentLedIndex].needOperator = needsOperator;
 
 if (needsOperator) {
   session.step = 'rental_operator_days';
   return {
     text: `✅ 오퍼레이터 필요\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📅 오퍼레이터가 몇 일 동안 필요하신가요?`,
     quickReplies: [
       { label: '1일', action: 'message', messageText: '1' },
       { label: '2일', action: 'message', messageText: '2' },
       { label: '3일', action: 'message', messageText: '3' },
       { label: '4일', action: 'message', messageText: '4' },
       { label: '5일', action: 'message', messageText: '5' }
     ]
   };
 } else {
   session.step = 'rental_prompter';
   return {
     text: `✅ 오퍼레이터 불필요\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📺 프롬프터 연결이 필요하신가요?`,
     quickReplies: [
       { label: '네, 필요합니다', action: 'message', messageText: '네' },
       { label: '아니요', action: 'message', messageText: '아니요' }
     ]
   };
 }
}

function handleRentalOperatorDays(message: string, session: UserSession) {
 const validation = validateNumber(message, 1, 10);
 
 if (!validation.valid || !validation.value) {
   return {
     text: `❌ ${validation.error}`,
     quickReplies: [
       { label: '1일', action: 'message', messageText: '1' },
       { label: '2일', action: 'message', messageText: '2' },
       { label: '3일', action: 'message', messageText: '3' },
       { label: '4일', action: 'message', messageText: '4' },
       { label: '5일', action: 'message', messageText: '5' }
     ]
   };
 }
 
 const currentLedIndex = session.data.ledSpecs.length - 1;
 session.data.ledSpecs[currentLedIndex].operatorDays = validation.value;
 
 session.step = 'rental_prompter';
 
 return {
   text: `✅ 오퍼레이터 ${validation.value}일\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📺 프롬프터 연결이 필요하신가요?`,
   quickReplies: [
     { label: '네, 필요합니다', action: 'message', messageText: '네' },
     { label: '아니요', action: 'message', messageText: '아니요' }
   ]
 };
}

function handleRentalPrompter(message: string, session: UserSession) {
 const currentLedIndex = session.data.ledSpecs.length - 1;
 const needsPrompter = message.includes('네') || message.includes('필요');
 
 session.data.ledSpecs[currentLedIndex].prompterConnection = needsPrompter;
 
 session.step = 'rental_relay';
 
 return {
   text: `✅ 프롬프터 연결 ${needsPrompter ? '필요' : '불필요'}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📹 중계카메라 연결이 필요하신가요?`,
   quickReplies: [
     { label: '네, 필요합니다', action: 'message', messageText: '네' },
     { label: '아니요', action: 'message', messageText: '아니요' }
   ]
 };
}

function handleRentalRelay(message: string, session: UserSession) {
 const currentLedIndex = session.data.ledSpecs.length - 1;
 const needsRelay = message.includes('네') || message.includes('필요');
 
 session.data.ledSpecs[currentLedIndex].relayConnection = needsRelay;
 
 // 다음 LED로 이동 또는 행사 기간으로
 if (session.currentLED < session.ledCount) {
   session.currentLED++;
   session.step = 'rental_led_specs';
   
   return {
     text: `✅ LED ${session.currentLED - 1}번 설정 완료\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n🖥️ LED ${session.currentLED}번의 크기를 알려주세요.`,
     quickReplies: [
       { label: '6000x3000', action: 'message', messageText: '6000x3000' },
       { label: '4000x3000', action: 'message', messageText: '4000x3000' },
       { label: '4000x2500', action: 'message', messageText: '4000x2500' }
     ]
   };
 } else {
   session.step = 'rental_period';
   
   return {
     text: `✅ 모든 LED 설정이 완료되었습니다!\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📅 행사 기간을 알려주세요.\n예: 2025-07-09 ~ 2025-07-11`,
     quickReplies: []
   };
 }
}

function handleRentalPeriod(message: string, session: UserSession) {
 const validation = validateEventPeriod(message);
 
 if (!validation.valid || !validation.startDate || !validation.endDate || !validation.days) {
   return {
     text: `❌ ${validation.error}\n\n다시 입력해주세요.\n예: 2025-07-09 ~ 2025-07-11`,
     quickReplies: []
   };
 }
 
 session.data.eventStartDate = validation.startDate;
 session.data.eventEndDate = validation.endDate;
 session.data.rentalPeriod = validation.days;
 
 session.step = 'get_additional_requests';
 
 return {
   text: `✅ 행사 기간: ${validation.startDate} ~ ${validation.endDate} (${validation.days}일)\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n별도 요청사항이 있으신가요?\n\n없으시면 "없음"이라고 입력해주세요.`,
   quickReplies: [
     { label: '없음', action: 'message', messageText: '없음' }
   ]
 };
}

// ===== 멤버쉽 서비스 핸들러 =====
function handleMembershipCode(message: string, session: UserSession) {
 const code = message.trim();
 
 if (code === '001') {
   session.data.memberCode = code;
   session.data.customerName = '메쎄이상';
   session.step = 'membership_event_info';
   
   return {
     text: `✅ 멤버 코드 확인: ${code} (메쎄이상)\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n행사명과 행사장을 알려주세요.\n예: 커피박람회 / 수원메쎄 2홀`,
     quickReplies: []
   };
 } else {
   return {
     text: `❌ 유효하지 않은 멤버 코드입니다.\n\n다시 확인 후 입력해주세요.`,
     quickReplies: [
       { label: '처음으로', action: 'message', messageText: '처음부터' }
     ]
   };
 }
}

// 멤버쉽 이벤트 정보부터는 기존 프로세스와 동일
function handleMembershipEventInfo(message: string, session: UserSession) {
 const parts = message.split('/').map(part => part.trim());
 
 if (parts.length >= 2) {
   session.data.eventName = parts[0];
   session.data.venue = parts[1];
   session.step = 'membership_led_count';
   
   return {
     text: `✅ 행사 정보 확인\n📋 행사명: ${session.data.eventName}\n📍 행사장: ${session.data.venue}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n몇 개소의 LED가 필요하신가요? (1-5개소)`,
     quickReplies: [
       { label: '1개소', action: 'message', messageText: '1' },
       { label: '2개소', action: 'message', messageText: '2' },
       { label: '3개소', action: 'message', messageText: '3' },
       { label: '4개소', action: 'message', messageText: '4' },
       { label: '5개소', action: 'message', messageText: '5' }
     ]
   };
 } else {
   return {
     text: '❌ 형식이 올바르지 않습니다.\n\n올바른 형식으로 다시 입력해주세요:\n📝 행사명 / 행사장',
     quickReplies: []
   };
 }
}

// 나머지 멤버쉽 핸들러들은 렌탈과 유사하지만 step 이름이 다름
function handleMembershipLEDCount(message: string, session: UserSession) {
 const validation = validateNumber(message, 1, 5);
 
 if (!validation.valid || !validation.value) {
   return {
     text: `❌ ${validation.error}`,
     quickReplies: [
       { label: '1개소', action: 'message', messageText: '1' },
       { label: '2개소', action: 'message', messageText: '2' },
       { label: '3개소', action: 'message', messageText: '3' },
       { label: '4개소', action: 'message', messageText: '4' },
       { label: '5개소', action: 'message', messageText: '5' }
     ]
   };
 }
 
 session.ledCount = validation.value;
 session.currentLED = 1;
 session.data.ledSpecs = [];
 session.step = 'membership_led_specs';
 
 return {
   text: `✅ 총 ${session.ledCount}개소의 LED 설정을 진행하겠습니다.\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n🖥️ LED ${session.currentLED}번째 개소의 크기를 알려주세요.`,
   quickReplies: [
     { label: '6000x3000', action: 'message', messageText: '6000x3000' },
     { label: '4000x3000', action: 'message', messageText: '4000x3000' },
     { label: '4000x2500', action: 'message', messageText: '4000x2500' }
   ]
 };
}

function handleMembershipLEDSpecs(message: string, session: UserSession) {
 const validation = validateAndNormalizeLEDSize(message);
 
 if (!validation.valid || !validation.size) {
   return {
     text: `❌ ${validation.error}`,
     quickReplies: [
       { label: '6000x3000', action: 'message', messageText: '6000x3000' },
       { label: '4000x3000', action: 'message', messageText: '4000x3000' },
       { label: '4000x2500', action: 'message', messageText: '4000x2500' }
     ]
   };
 }
 
 session.data.ledSpecs.push({
   size: validation.size,
   needOperator: false,
   operatorDays: 0,
   prompterConnection: false,
   relayConnection: false
 });
 
 session.step = 'membership_stage_height';
 
 return {
   text: `✅ LED ${session.currentLED}번째 개소: ${validation.size}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📐 이 LED의 무대 높이를 알려주세요.`,
   quickReplies: [
     { label: '600mm', action: 'message', messageText: '600mm' },
     { label: '800mm', action: 'message', messageText: '800mm' },
     { label: '1000mm', action: 'message', messageText: '1000mm' }
   ]
 };
}

function handleMembershipStageHeight(message: string, session: UserSession) {
 const validation = validateStageHeight(message);
 
 if (!validation.valid || validation.height === undefined) {
   return {
     text: `❌ ${validation.error}`,
     quickReplies: [
       { label: '0mm', action: 'message', messageText: '0mm' },
       { label: '600mm', action: 'message', messageText: '600mm' },
       { label: '800mm', action: 'message', messageText: '800mm' },
       { label: '1000mm', action: 'message', messageText: '1000mm' }
     ]
   };
 }
 
 const currentLedIndex = session.data.ledSpecs.length - 1;
 session.data.ledSpecs[currentLedIndex].stageHeight = validation.height;
 
 session.step = 'membership_operator_needs';
 
 return {
   text: `✅ LED ${session.currentLED}번째 개소 무대 높이: ${validation.height}mm\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n👨‍💼 이 LED에 오퍼레이터가 필요하신가요?`,
   quickReplies: [
     { label: '네, 필요합니다', action: 'message', messageText: '네' },
     { label: '아니요', action: 'message', messageText: '아니요' }
   ]
 };
}

function handleMembershipOperatorNeeds(message: string, session: UserSession) {
 const currentLedIndex = session.data.ledSpecs.length - 1;
 const needsOperator = message.includes('네') || message.includes('필요');
 
 session.data.ledSpecs[currentLedIndex].needOperator = needsOperator;
 
 if (needsOperator) {
   session.step = 'membership_operator_days';
   return {
     text: `✅ 오퍼레이터 필요\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📅 오퍼레이터가 몇 일 동안 필요하신가요?`,
     quickReplies: [
       { label: '1일', action: 'message', messageText: '1' },
       { label: '2일', action: 'message', messageText: '2' },
       { label: '3일', action: 'message', messageText: '3' },
       { label: '4일', action: 'message', messageText: '4' },
       { label: '5일', action: 'message', messageText: '5' }
     ]
   };
 } else {
   session.step = 'membership_prompter';
   return {
     text: `✅ 오퍼레이터 불필요\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📺 프롬프터 연결이 필요하신가요?`,
     quickReplies: [
       { label: '네, 필요합니다', action: 'message', messageText: '네' },
       { label: '아니요', action: 'message', messageText: '아니요' }
     ]
   };
 }
}

function handleMembershipOperatorDays(message: string, session: UserSession) {
 const validation = validateNumber(message, 1, 10);
 
 if (!validation.valid || !validation.value) {
   return {
     text: `❌ ${validation.error}`,
     quickReplies: [
       { label: '1일', action: 'message', messageText: '1' },
       { label: '2일', action: 'message', messageText: '2' },
       { label: '3일', action: 'message', messageText: '3' },
       { label: '4일', action: 'message', messageText: '4' },
       { label: '5일', action: 'message', messageText: '5' }
     ]
   };
 }
 
 const currentLedIndex = session.data.ledSpecs.length - 1;
 session.data.ledSpecs[currentLedIndex].operatorDays = validation.value;
 
 session.step = 'membership_prompter';
 
 return {
   text: `✅ 오퍼레이터 ${validation.value}일\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📺 프롬프터 연결이 필요하신가요?`,
   quickReplies: [
     { label: '네, 필요합니다', action: 'message', messageText: '네' },
     { label: '아니요', action: 'message', messageText: '아니요' }
   ]
 };
}

function handleMembershipPrompter(message: string, session: UserSession) {
 const currentLedIndex = session.data.ledSpecs.length - 1;
 const needsPrompter = message.includes('네') || message.includes('필요');
 
 session.data.ledSpecs[currentLedIndex].prompterConnection = needsPrompter;
 
 session.step = 'membership_relay';
 
 return {
   text: `✅ 프롬프터 연결 ${needsPrompter ? '필요' : '불필요'}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📹 중계카메라 연결이 필요하신가요?`,
   quickReplies: [
     { label: '네, 필요합니다', action: 'message', messageText: '네' },
     { label: '아니요', action: 'message', messageText: '아니요' }
   ]
 };
}

function handleMembershipRelay(message: string, session: UserSession) {
 const currentLedIndex = session.data.ledSpecs.length - 1;
 const needsRelay = message.includes('네') || message.includes('필요');
 
 session.data.ledSpecs[currentLedIndex].relayConnection = needsRelay;
 
 // 다음 LED로 이동 또는 행사 기간으로
 if (session.currentLED < session.ledCount) {
   session.currentLED++;
   session.step = 'membership_led_specs';
   
   return {
     text: `✅ LED ${session.currentLED - 1}번째 개소 설정 완료\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n🖥️ LED ${session.currentLED}번째 개소의 크기를 알려주세요.`,
     quickReplies: [
       { label: '6000x3000', action: 'message', messageText: '6000x3000' },
       { label: '4000x3000', action: 'message', messageText: '4000x3000' },
       { label: '4000x2500', action: 'message', messageText: '4000x2500' }
     ]
   };
 } else {
   session.step = 'membership_period';
   
   const ledSummary = session.data.ledSpecs.map((led, index) => {
     const [w, h] = led.size.split('x').map(Number);
     const moduleCount = (w / 500) * (h / 500);
     return `LED${index + 1}: ${led.size} (${led.stageHeight}mm, ${moduleCount}개)`;
   }).join('\n');
   
   return {
     text: `✅ 모든 LED 설정이 완료되었습니다!\n\n📋 설정 요약:\n${ledSummary}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📅 행사 기간을 알려주세요.\n예: 2025-07-09 ~ 2025-07-11`,
     quickReplies: []
   };
 }
}

function handleMembershipPeriod(message: string, session: UserSession) {
 const validation = validateEventPeriod(message);
 
 if (!validation.valid || !validation.startDate || !validation.endDate) {
   return {
     text: `❌ ${validation.error}\n\n다시 입력해주세요.\n예: 2025-07-09 ~ 2025-07-11`,
     quickReplies: []
   };
 }
 
 session.data.eventStartDate = validation.startDate;
 session.data.eventEndDate = validation.endDate;
 
 session.step = 'get_additional_requests';
 
 return {
   text: `✅ 행사 기간: ${validation.startDate} ~ ${validation.endDate}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n별도 요청사항이 있으신가요?\n\n없으시면 "없음"이라고 입력해주세요.`,
   quickReplies: [
     { label: '없음', action: 'message', messageText: '없음' }
   ]
 };
}

// ===== 공통 핸들러 =====
function handleAdditionalRequests(message: string, session: UserSession) {
 if (message.trim() === '없음' || message.trim() === '') {
   session.data.additionalRequests = '없음';
 } else {
   session.data.additionalRequests = message.trim();
 }
 
 // 설치 서비스는 담당자 정보를 기본값으로 설정
 if (session.serviceType === '설치') {
   session.step = 'get_contact_name';
   
   return {
     text: `✅ 요청사항이 저장되었습니다.\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n🏢 고객사명을 알려주세요.`,
     quickReplies: []
   };
 }
 
 session.step = 'get_contact_name';
 
 return {
   text: `✅ 요청사항이 저장되었습니다.\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n👤 담당자님의 성함을 알려주세요.`,
   quickReplies: []
 };
}

// 담당자 이름 처리
function handleContactName(message: string, session: UserSession) {
 // 설치 서비스에서 고객사명 입력 처리
 if (session.serviceType === '설치' && !session.data.customerName) {
   if (!message || message.trim().length === 0) {
     return {
       text: '고객사명을 입력해주세요.',
       quickReplies: []
     };
   }
   
   session.data.customerName = message.trim();
   
   return {
     text: `✅ 고객사: ${session.data.customerName}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n👤 담당자님의 성함을 알려주세요.`,
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
   text: `✅ 담당자: ${session.data.contactName}님\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n💼 직급을 알려주세요.`,
   quickReplies: [
     { label: '매니저', action: 'message', messageText: '매니저' },
     { label: '책임', action: 'message', messageText: '책임' },
     { label: '팀장', action: 'message', messageText: '팀장' },
     { label: '이사', action: 'message', messageText: '이사' }
   ]
 };
}

// 담당자 직급 처리
function handleContactTitle(message: string, session: UserSession) {
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
   text: `✅ 직급: ${session.data.contactTitle}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📞 연락처를 알려주세요.\n예: 010-1234-5678`,
   quickReplies: []
 };
}

// 담당자 연락처 처리
function handleContactPhone(message: string, session: UserSession) {
 const validation = validatePhoneNumber(message);
 
 if (!validation.valid || !validation.phone) {
   return {
     text: `❌ ${validation.error}\n\n다시 입력해주세요.`,
     quickReplies: []
   };
 }
 
 session.data.contactPhone = validation.phone;
 session.step = 'final_confirmation';
 
 // 서비스별 최종 확인 메시지 생성
 let confirmationMessage = '';
 
 if (session.serviceType === '설치') {
   confirmationMessage = `✅ 모든 정보가 입력되었습니다!\n\n📋 최종 확인\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n🔖 서비스: LED 설치\n🏗️ 설치 환경: ${session.data.installEnvironment}\n📍 설치 지역: ${session.data.installRegion}\n📅 필요 시기: ${session.data.requiredTiming}\n💬 요청사항: ${session.data.additionalRequests}\n\n🏢 고객사: ${session.data.customerName}\n👤 담당자: ${session.data.contactName}\n💼 직급: ${session.data.contactTitle}\n📞 연락처: ${session.data.contactPhone}\n\n상담 요청을 진행하시겠습니까?`;
 } else if (session.serviceType === '렌탈') {
   const ledSummary = session.data.ledSpecs.map((led: any, index: number) => {
     const [w, h] = led.size.split('x').map(Number);
     const moduleCount = (w / 500) * (h / 500);
     return `LED${index + 1}: ${led.size} (${moduleCount}개)`;
   }).join('\n');
   
   confirmationMessage = `✅ 모든 정보가 입력되었습니다!\n\n📋 최종 확인\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n🔖 서비스: LED 렌탈\n📋 행사명: ${session.data.eventName}\n📍 행사장: ${session.data.venue}\n📅 행사 기간: ${session.data.eventStartDate} ~ ${session.data.eventEndDate} (${session.data.rentalPeriod}일)\n🔧 지지구조물: ${session.data.supportStructureType}\n\n🖥️ LED 사양:\n${ledSummary}\n\n👤 담당자: ${session.data.contactName}\n💼 직급: ${session.data.contactTitle}\n📞 연락처: ${session.data.contactPhone}\n💬 요청사항: ${session.data.additionalRequests}\n\n견적을 요청하시겠습니까?`;
 } else {
   const ledSummary = session.data.ledSpecs.map((led: any, index: number) => {
     const [w, h] = led.size.split('x').map(Number);
     const moduleCount = (w / 500) * (h / 500);
     return `LED${index + 1}: ${led.size} (${moduleCount}개)`;
   }).join('\n');
   
   confirmationMessage = `✅ 모든 정보가 입력되었습니다!\n\n📋 최종 확인\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n🔖 서비스: 멤버쉽 (${session.data.memberCode})\n🏢 고객사: ${session.data.customerName}\n📋 행사명: ${session.data.eventName}\n📍 행사장: ${session.data.venue}\n📅 행사 기간: ${session.data.eventStartDate} ~ ${session.data.eventEndDate}\n\n🖥️ LED 사양:\n${ledSummary}\n\n👤 담당자: ${session.data.contactName}\n💼 직급: ${session.data.contactTitle}\n📞 연락처: ${session.data.contactPhone}\n💬 요청사항: ${session.data.additionalRequests}\n\n견적을 요청하시겠습니까?`;
 }
 
 return {
   text: confirmationMessage,
   quickReplies: [
     { label: '네, 요청합니다', action: 'message', messageText: '네' },
     { label: '취소', action: 'message', messageText: '취소' }
   ]
 };
}

// 최종 확인 처리
async function handleFinalConfirmation(message: string, session: UserSession) {
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
     // 세션 데이터를 복사 (세션 초기화 전에)
     const sessionCopy: UserSession = JSON.parse(JSON.stringify(session));
     
     // 견적 계산 (빠른 처리) - 설치 서비스는 제외
     let quote: any = null;
     let schedules: any = null;

     if (sessionCopy.serviceType === '렌탈' && sessionCopy.data.rentalPeriod) {
       quote = calculateRentalLEDQuote(sessionCopy.data.ledSpecs, sessionCopy.data.rentalPeriod);
       schedules = calculateScheduleDates(sessionCopy.data.eventStartDate!, sessionCopy.data.eventEndDate!);
     } else if (sessionCopy.serviceType === '멤버쉽') {
       quote = calculateMultiLEDQuote(sessionCopy.data.ledSpecs);
       schedules = calculateScheduleDates(sessionCopy.data.eventStartDate!, sessionCopy.data.eventEndDate!);
     }
     // 설치 서비스는 견적 계산하지 않음

     // 빠른 응답 반환 
     const responseText = sessionCopy.serviceType === '설치' 
       ? `✅ 상담 요청이 접수되었습니다!\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n🏢 고객사: ${sessionCopy.data.customerName}\n👤 고객: ${sessionCopy.data.contactName} ${sessionCopy.data.contactTitle}\n📞 연락처: ${sessionCopy.data.contactPhone}\n🏗️ 설치 환경: ${sessionCopy.data.installEnvironment}\n📍 설치 지역: ${sessionCopy.data.installRegion}\n📅 필요 시기: ${sessionCopy.data.requiredTiming}\n\n👤 담당자: 유준수 구축팀장\n📞 담당자 연락처: 010-7333-3336\n\n곧 담당자가 연락드릴 예정입니다.\n감사합니다! 😊`
       : `✅ 견적 요청이 접수되었습니다!\n\n📋 ${sessionCopy.data.eventName}\n👤 고객: ${sessionCopy.data.contactName} ${sessionCopy.data.contactTitle}\n📞 연락처: ${sessionCopy.data.contactPhone}\n💰 견적 금액: ${quote?.total?.toLocaleString() || '계산중'}원 (VAT 포함)\n\n📝 담당자에게 전달 중입니다...`;
 
     // 세션 초기화
     session.step = 'start';
     session.data = { ledSpecs: [] };
     session.serviceType = undefined;
     
     // Notion 저장은 비동기로 처리 (응답 후 백그라운드에서)
     setImmediate(async () => {
       try {
         const notionData = prepareNotionData(sessionCopy, quote, schedules);
         const notionResult = await notionMCPTool.handler(notionData);
         
         // 담당자 언급 알림
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

// Notion 데이터 준비 함수 (분리)
// prepareNotionData 함수 찾아서 아래 코드로 교체

// Notion 데이터 준비 함수 (분리)
function prepareNotionData(session: UserSession, quote: any, schedules: any): any {
  let notionData: any = {
    serviceType: session.serviceType || '',
    eventName: session.data.eventName || 'LED 프로젝트',
    customerName: session.data.customerName || '고객사',
    venue: session.data.venue || '',
    contactName: session.data.contactName || '',
    contactTitle: session.data.contactTitle || '',
    contactPhone: session.data.contactPhone || '',
    additionalRequests: session.data.additionalRequests || ''
  };
  
  if (session.serviceType === '설치') {
    notionData = {
      ...notionData,
      installEnvironment: session.data.installEnvironment || '',
      venue: session.data.installRegion || '', // 설치 지역을 행사장으로
      eventSchedule: session.data.requiredTiming || '', // 필요 시기를 행사 일정으로
      totalQuoteAmount: 0,
      // 고객 정보는 contactName, contactTitle 필드에 그대로 유지
      // Notion에서는 "고객명"으로 저장됨
    };
  } else if (session.serviceType === '렌탈') {
    notionData = {
      ...notionData,
      supportStructureType: session.data.supportStructureType || '',
      eventSchedule: session.data.rentalPeriod ? `${session.data.rentalPeriod}일` : '',
      periodSurchargeAmount: quote?.periodSurcharge?.surchargeAmount || 0,
      ...session.data.ledSpecs.reduce((acc: any, led: any, index: number) => {
        acc[`led${index + 1}`] = led;
        return acc;
      }, {}),
      totalQuoteAmount: quote?.total || 0,
      totalModuleCount: quote?.totalModuleCount || 0,
      ledModuleCost: quote?.ledModules?.price || 0,
      transportCost: quote?.transport?.price || 0
    };
  } else if (session.serviceType === '멤버쉽') {
    notionData = {
      ...notionData,
      memberCode: session.data.memberCode || '',
      eventSchedule: schedules?.eventSchedule || '',
      ...session.data.ledSpecs.reduce((acc: any, led: any, index: number) => {
        acc[`led${index + 1}`] = led;
        return acc;
      }, {}),
      totalQuoteAmount: quote?.total || 0,
      totalModuleCount: quote?.totalModuleCount || 0,
      ledModuleCost: quote?.ledModules?.price || 0,
      structureCost: quote?.structure?.totalPrice || 0,
      controllerCost: quote?.controller?.totalPrice || 0,
      powerCost: quote?.power?.totalPrice || 0,
      installationCost: quote?.installation?.totalPrice || 0,
      operatorCost: quote?.operation?.totalPrice || 0,
      transportCost: quote?.transport?.price || 0,
      maxStageHeight: quote?.maxStageHeight || 0,
      installationWorkers: quote?.installationWorkers || 0,
      installationWorkerRange: quote?.installationWorkerRange || '',
      controllerCount: quote?.controllerCount || 0,
      powerRequiredCount: quote?.powerRequiredCount || 0,
      transportRange: quote?.transportRange || '',
      structureUnitPrice: quote?.structureUnitPrice || 0,
      structureUnitPriceDescription: quote?.structureUnitPriceDescription || ''
    };
  }
  
  return notionData;
}

// 기본 처리
function handleDefault(session: UserSession) {
 session.step = 'start';
 return {
   text: '안녕하세요! LED 전문 기업 오비스입니다.\n\n어떤 서비스를 도와드릴까요?',
   quickReplies: [
     { label: '🏗️ LED 설치', action: 'message', messageText: '설치' },
     { label: '📦 LED 렌탈', action: 'message', messageText: '렌탈' },
     { label: '👥 멤버쉽 서비스', action: 'message', messageText: '멤버쉽' }
   ]
 };
}

// 사용자 메시지 처리 함수
async function processUserMessage(message: string, session: UserSession) {
 // 수정 요청 처리
 if (isModificationRequest(message)) {
   return handleModificationRequest(message, session);
 }
 
 // 초기화 요청 처리
 if (isResetRequest(message)) {
   return handleResetRequest(session);
 }
 
 switch (session.step) {
   // 공통 단계
   case 'start':
     return handleStart(session);
   case 'select_service':
     return handleSelectService(message, session);
   
   // 설치 서비스 단계
   case 'install_environment':
     return handleInstallEnvironment(message, session);
   case 'install_region':
     return handleInstallRegion(message, session);
   case 'install_timing':
     return handleInstallTiming(message, session);
   
   // 렌탈 서비스 단계
   case 'rental_indoor_outdoor':
     return handleRentalIndoorOutdoor(message, session);
   case 'rental_structure_type':
     return handleRentalStructureType(message, session);
   case 'rental_led_count':
     return handleRentalLEDCount(message, session);
   case 'rental_led_specs':
     return handleRentalLEDSpecs(message, session);
   case 'rental_stage_height':
     return handleRentalStageHeight(message, session);
   case 'rental_operator_needs':
     return handleRentalOperatorNeeds(message, session);
   case 'rental_operator_days':
     return handleRentalOperatorDays(message, session);
   case 'rental_prompter':
     return handleRentalPrompter(message, session);
   case 'rental_relay':
     return handleRentalRelay(message, session);
   case 'rental_period':
     return handleRentalPeriod(message, session);
   
   // 멤버쉽 서비스 단계
   case 'membership_code':
     return handleMembershipCode(message, session);
   case 'membership_event_info':
     return handleMembershipEventInfo(message, session);
   case 'membership_led_count':
     return handleMembershipLEDCount(message, session);
   case 'membership_led_specs':
     return handleMembershipLEDSpecs(message, session);
   case 'membership_stage_height':
     return handleMembershipStageHeight(message, session);
   case 'membership_operator_needs':
     return handleMembershipOperatorNeeds(message, session);
   case 'membership_operator_days':
     return handleMembershipOperatorDays(message, session);
   case 'membership_prompter':
     return handleMembershipPrompter(message, session);
   case 'membership_relay':
     return handleMembershipRelay(message, session);
   case 'membership_period':
     return handleMembershipPeriod(message, session);
   
   // 공통 마지막 단계
   case 'get_additional_requests':
     return handleAdditionalRequests(message, session);
   case 'get_contact_name':
     return handleContactName(message, session);
   case 'get_contact_title':
     return handleContactTitle(message, session);
   case 'get_contact_phone':
     return handleContactPhone(message, session);
   case 'final_confirmation':
     return handleFinalConfirmation(message, session);
     
   default:
     return handleDefault(session);
 }
}

// ===== API 엔드포인트 =====

// 테스트 엔드포인트
skillRouter.get('/test', (_req, res) => {
 res.json({
   message: "서버가 정상 작동 중입니다!",
   timestamp: new Date().toISOString()
 });
});

// 카카오 스킬 서버 엔드포인트
skillRouter.post('/skill', async (req, res) => {
 try {
   const { userRequest } = req.body;
   const userId = userRequest?.user?.id || 'default_user';
   const userMessage = userRequest?.utterance || '안녕하세요';
   
   console.log(`📥 요청 받음 - User: ${userId}, Message: ${userMessage}`);
   
   // 사용자 세션 초기화
   if (!userSessions[userId]) {
     userSessions[userId] = {
       step: 'start',
       data: { ledSpecs: [] },
       ledCount: 0,
       currentLED: 1
     };
   }
   
   const session = userSessions[userId];
   session.lastMessage = userMessage;
   
   // 즉시 처리 가능한 응답 생성
   let response;
   try {
     response = await processUserMessage(userMessage, session);
   } catch (error) {
     console.error('메시지 처리 오류:', error);
     response = {
       text: '죄송합니다. 일시적인 오류가 발생했습니다. 다시 시도해주세요.',
       quickReplies: [
         { label: '처음으로', action: 'message', messageText: '처음부터' }
       ]
     };
   }
   
   // 카카오 스킬 응답 형식
   const result: any = {
     version: "2.0",
     template: {
       outputs: [
         {
           simpleText: {
             text: response.text
           }
         }
       ]
     }
   };
   
   if (response.quickReplies && response.quickReplies.length > 0) {
     result.template.quickReplies = response.quickReplies;
   }
   
   // 즉시 응답 반환
   res.json(result);
   console.log(`✅ 응답 전송 완료`);
   
 } catch (error) {
   console.error('스킬 처리 오류:', error);
   // 에러 시에도 5초 이내 응답
   res.json({
     version: "2.0",
     template: {
       outputs: [
         {
           simpleText: {
             text: "시스템 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
           }
         }
       ]
     }
   });
 }
});