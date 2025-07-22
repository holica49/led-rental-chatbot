// ===== 공통 타입 =====

// 배차 정보
export interface TransportInfo {
 truckType: string;
 truckCount: number;
 plateBoxCount: number;
}

// ===== LED 관련 타입 =====

// LED 사양
export interface LEDSpec {
 size: string;
 stageHeight?: number;
 needOperator: boolean;
 operatorDays: number;
 prompterConnection?: boolean;
 relayConnection?: boolean;
}

// LED 견적 요청
export interface LEDQuoteRequest {
 ledSpecs: LEDSpec[];
 customerName: string;
 rentalDays?: number;
}

// LED 견적 응답
export interface LEDQuoteResponse {
 quote: any;
 transport: TransportInfo;
 ledSummary: string;
 summary: string;
}

// ===== 서비스 타입 =====

export type ServiceType = '설치' | '렌탈' | '멤버쉽';

// ===== 카카오톡 관련 타입 =====

// 카카오톡 빠른 응답
export interface QuickReply {
 label: string;
 action: 'message' | 'block';
 messageText?: string;
 blockId?: string;
}

// 카카오톡 응답
export interface KakaoResponse {
 text: string;
 quickReplies?: QuickReply[];
}

// 카카오톡 스킬 요청
export interface KakaoSkillRequest {
 userRequest: {
   user: {
     id: string;
     type: string;
     properties: any;
   };
   utterance: string;
   params: any;
   lang: string;
   timezone: string;
 };
 contexts: any[];
 bot: {
   id: string;
   name: string;
 };
 action: {
   name: string;
   clientExtra: any;
   params: any;
   id: string;
   detailParams: any;
 };
}

// ===== Notion 관련 타입 =====

// Notion 페이지 속성
export interface NotionProperties {
 [key: string]: any;
}

// Notion 댓글
export interface NotionComment {
 parent: {
   page_id: string;
 };
 rich_text: any[];
}

// ===== 세션 관련 타입 =====

// 사용자 세션 데이터
export interface SessionData {
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
 installSpace?: string;      // 추가: 설치 공간
 inquiryPurpose?: string;    // 추가: 문의 목적
 installBudget?: string;     // 추가: 설치 예산
 installSchedule?: string;   // 추가: 설치 일정
 
 // 렌탈 서비스 관련
 supportStructureType?: '목공 설치' | '단독 설치';
 rentalPeriod?: number;
 
 // 멤버쉽 관련
 memberCode?: string;
 
 // LED 정보
 ledSpecs: LEDSpec[];
}

// 사용자 세션
export interface UserSession {
 step: string;
 serviceType?: ServiceType;
 data: SessionData;
 ledCount: number;
 currentLED: number;
 lastMessage?: string;
}

// ===== 환경 변수 타입 =====

declare global {
 namespace NodeJS {
   interface ProcessEnv {
     NODE_ENV: 'development' | 'production' | 'test';
     PORT: string;
     NOTION_API_KEY: string;
     NOTION_DATABASE_ID: string;
     MANAGERS_CONFIG: string;
   }
 }
}

// ===== 유틸리티 타입 =====

// API 응답
export interface ApiResponse<T = any> {
 success: boolean;
 data?: T;
 error?: string;
 message?: string;
}

// 에러 응답
export interface ErrorResponse {
 success: false;
 error: string;
 code?: string;
}

// ===== MCP 도구 타입 =====

// MCP 도구 정의
export interface ToolDefinition {
 name: string;
 description: string;
 inputSchema: {
   type: string;
   properties: Record<string, any>;
   required?: string[];
 };
}

// MCP 도구 핸들러
export interface ToolHandler {
 (args: any): Promise<{
   content: Array<{
     type: string;
     text: string;
   }>;
   isError?: boolean;
 }>;
}

// MCP 도구
export interface Tool {
 definition: ToolDefinition;
 handler: ToolHandler;
}

