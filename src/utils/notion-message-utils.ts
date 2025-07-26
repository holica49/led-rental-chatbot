// src/utils/notion-message-utils.ts

import { 
  STATUS_MESSAGES, 
  FILE_MESSAGES, 
  ERROR_MESSAGES,
  SERVICE_TERMINOLOGY,
  getNotionServiceType,
  NotionServiceType 
} from '../constants/notion-messages.js';

/**
 * 메시지 템플릿에서 변수를 치환하는 함수
 */
export function replaceMessageVariables(template: string, variables: Record<string, any>): string {
  let message = template;
  
  Object.entries(variables).forEach(([key, value]) => {
    message = message.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
  });
  
  // 타임스탬프 자동 치환
  message = message.replace('{{timestamp}}', `⏰ 자동화 실행 시간: ${new Date().toLocaleString()}`);
  
  return message;
}

/**
 * 서비스 타입에 따른 상태 변경 메시지 가져오기
 */
export function getStatusChangeMessage(
  serviceType: string,
  fromStatus: string,
  toStatus: string,
  variables: Record<string, any>
): string {
  const notionServiceType = getNotionServiceType(serviceType);
  
  // 상태 변경 키 생성 (예: QUOTE_REQUEST_TO_REVIEW)
  const statusKey = `${normalizeStatus(fromStatus)}_TO_${normalizeStatus(toStatus)}`;
  
  // 메시지 템플릿 찾기
  const messageTemplates = (STATUS_MESSAGES as any)[statusKey];
  if (!messageTemplates) {
    return `상태 변경: ${fromStatus} → ${toStatus}`;
  }
  
  const template = messageTemplates[notionServiceType];
  if (!template) {
    return `상태 변경: ${fromStatus} → ${toStatus}`;
  }
  
  return replaceMessageVariables(template, variables);
}

/**
 * 파일 업로드 메시지 가져오기
 */
export function getFileUploadMessage(
  serviceType: string,
  messageType: 'PARTIAL_UPLOAD' | 'AUTO_APPROVAL',
  variables: Record<string, any>
): string {
  const notionServiceType = getNotionServiceType(serviceType);
  
  const messageTemplates = FILE_MESSAGES[messageType];
  
  // PARTIAL_UPLOAD는 ALL만 있고, AUTO_APPROVAL은 서비스별로 있음
  let template: string | undefined;
  
  if (messageType === 'PARTIAL_UPLOAD') {
    template = (messageTemplates as any).ALL;
  } else {
    // AUTO_APPROVAL의 경우
    template = (messageTemplates as any)[notionServiceType];
    // INSTALL은 AUTO_APPROVAL이 없으므로 기본 메시지
    if (!template && notionServiceType === 'INSTALL') {
      return '견적이 승인되었습니다.';
    }
  }
  
  if (!template) {
    return '파일 업로드 상태가 변경되었습니다.';
  }
  
  return replaceMessageVariables(template, variables);
}

/**
 * 에러 메시지 가져오기
 */
export function getErrorMessage(
  errorType: 'AUTOMATION_ERROR' | 'FILE_APPROVAL_ERROR',
  variables: Record<string, any>
): string {
  const template = ERROR_MESSAGES[errorType];
  
  if (!template) {
    return '오류가 발생했습니다.';
  }
  
  return replaceMessageVariables(template, variables);
}

/**
 * LED 사양 포맷팅
 */
export function formatLEDSpecs(ledSpecs: any[]): string {
  if (!ledSpecs || ledSpecs.length === 0) {
    return '정보 없음';
  }
  
  return ledSpecs.map((led, index) => {
    if (!led.size) return `LED${index + 1}: 정보 없음`;
    
    const [w, h] = led.size.split('x').map(Number);
    const moduleCount = (w / 500) * (h / 500);
    const operatorText = led.needOperator ? ` (오퍼레이터 ${led.operatorDays}일)` : '';
    const prompterText = led.prompterConnection ? ', 프롬프터 연결' : '';
    const relayText = led.relayConnection ? ', 중계카메라 연결' : '';
    
    return `LED${index + 1}: ${led.size} / 무대높이 ${led.stageHeight}mm / ${moduleCount}개${operatorText}${prompterText}${relayText}`;
  }).join('\n');
}

/**
 * 견적 세부내역 포맷팅
 */
export function formatQuoteDetails(quote: any): string {
  const items = [
    { label: 'LED 모듈', value: quote.ledModules?.price },
    { label: '구조물', value: quote.structure?.totalPrice },
    { label: '컨트롤러', value: quote.controller?.totalPrice },
    { label: '파워', value: quote.power?.totalPrice },
    { label: '설치인력', value: quote.installation?.totalPrice },
    { label: '오퍼레이터', value: quote.operation?.totalPrice },
    { label: '운반비', value: quote.transport?.price },
    { label: '기간 할증', value: quote.periodSurcharge?.surchargeAmount }
  ];
  
  return items
    .filter(item => item.value && item.value > 0)
    .map(item => `- ${item.label}: ${item.value.toLocaleString()}원`)
    .join('\n');
}

/**
 * 배차 정보 포맷팅
 */
export function formatTruckInfo(totalModules: number): {
  truckCount: number;
  truckDescription: string;
  plateBoxCount: number;
} {
  let truckCount: number;
  let truckDescription: string;
  const plateBoxCount = Math.ceil(totalModules / 8);
  
  if (totalModules <= 80) {
    truckCount = 1;
    truckDescription = '1.4톤 리프트 화물차';
  } else if (totalModules <= 208) {
    truckCount = 1;
    truckDescription = '3.5톤 리프트 화물차';
  } else if (totalModules <= 288) {
    truckCount = 2;
    truckDescription = '3.5톤 리프트 화물차 1대, 1.4톤 리프트 화물차 1대';
  } else if (totalModules <= 416) {
    truckCount = 2;
    truckDescription = '3.5톤 리프트 화물차 2대';
  } else {
    truckCount = Math.ceil(totalModules / 208);
    truckDescription = `3.5톤 리프트 화물차 ${truckCount}대`;
  }
  
  return { truckCount, truckDescription, plateBoxCount };
}

/**
 * 상태명 정규화 (한글 → 영문 키)
 */
function normalizeStatus(status: string): string {
  const statusMap: Record<string, string> = {
    '견적 요청': 'QUOTE_REQUEST',
    '견적 검토': 'QUOTE_REVIEW',
    '견적 승인': 'APPROVED',
    '배차 완료': 'DISPATCH',
    '구인 완료': 'RECRUITMENT',
    '설치 중': 'INSTALLING',
    '운영 중': 'OPERATING',
    '철거 중': 'DISMANTLING',
    '완료': 'COMPLETE'
  };
  
  return statusMap[status] || status.toUpperCase().replace(/ /g, '_');
}

/**
 * 서비스별 용어 가져오기 - 반환 타입 수정
 */
export function getServiceTerms(serviceType: string) {
  const notionServiceType = getNotionServiceType(serviceType);
  return SERVICE_TERMINOLOGY[notionServiceType];
}