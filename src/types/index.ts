// src/types/index.ts

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
  stageHeight: number; // optional 제거 - 기본값 0
  needOperator: boolean;
  operatorDays: number;
  prompterConnection: boolean; // optional 제거 - 기본값 false
  relayConnection: boolean; // optional 제거 - 기본값 false
}

// LED 견적 요청
export interface LEDQuoteRequest {
  ledSpecs: LEDSpec[];
  customerName: string;
  rentalDays?: number;
}

// LED 견적 응답
export interface LEDQuoteResponse {
  quote: QuoteResult | RentalQuoteResult; // any 대신 구체적 타입
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

// 카카오톡 사용자 정보
export interface KakaoUser {
  id: string;
  type: string;
  properties: Record<string, unknown>; // any 대신 unknown
}

// 카카오톡 스킬 요청
export interface KakaoSkillRequest {
  userRequest: {
    user: KakaoUser;
    utterance: string;
    params: Record<string, unknown>; // any 대신 unknown
    lang: string;
    timezone: string;
  };
  contexts: Array<Record<string, unknown>>; // any[] 대신
  bot: {
    id: string;
    name: string;
  };
  action: {
    name: string;
    clientExtra: Record<string, unknown> | null; // any 대신
    params: Record<string, unknown>; // any 대신
    id: string;
    detailParams: Record<string, unknown>; // any 대신
  };
}

// ===== Notion 관련 타입 =====

// Notion Rich Text
export interface NotionRichText {
  type: 'text';
  text: {
    content: string;
    link?: { url: string } | null;
  };
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
    code?: boolean;
    color?: string;
  };
  plain_text?: string;
  href?: string | null;
}

// Notion 페이지 속성 타입들
export interface NotionTitle {
  title: NotionRichText[];
}

export interface NotionRichTextProperty {
  rich_text: NotionRichText[];
}

export interface NotionSelectProperty {
  select: {
    name: string;
  } | null;
}

export interface NotionStatusProperty {
  status: {
    name: string;
  } | null;
}

export interface NotionNumberProperty {
  number: number | null;
}

export interface NotionCheckboxProperty {
  checkbox: boolean;
}

export interface NotionPhoneProperty {
  phone_number: string | null;
}

export interface NotionDateProperty {
  date: {
    start: string;
    end?: string | null;
  } | null;
}

export interface NotionFilesProperty {
  files: Array<{
    name: string;
    type: 'external' | 'file';
    external?: { url: string };
    file?: { url: string; expiry_time: string };
  }>;
}

// Notion 페이지 속성
export interface NotionProperties {
  // 기본 정보
  '행사명': NotionTitle;
  '고객사': NotionSelectProperty;
  '고객명': NotionRichTextProperty;
  '고객 연락처': NotionPhoneProperty;
  '행사장': NotionRichTextProperty;
  
  // 서비스 정보
  '서비스 유형': NotionSelectProperty;
  '행사 상태': NotionStatusProperty;
  '멤버 코드'?: NotionRichTextProperty;
  
  // 금액 정보
  '견적 금액'?: NotionNumberProperty;
  'LED 모듈 비용'?: NotionNumberProperty;
  '지지구조물 비용'?: NotionNumberProperty;
  '컨트롤러 및 스위치 비용'?: NotionNumberProperty;
  '파워 비용'?: NotionNumberProperty;
  '설치철거인력 비용'?: NotionNumberProperty;
  '오퍼레이터 비용'?: NotionNumberProperty;
  '운반 비용'?: NotionNumberProperty;
  '기간 할증 비용'?: NotionNumberProperty;
  
  // 일정 정보
  '행사 일정'?: NotionRichTextProperty;  // 텍스트 타입
  '설치 일정'?: NotionDateProperty;
  '리허설 일정'?: NotionDateProperty;
  '철거 일정'?: NotionDateProperty;
  
  // 설치/렌탈 정보
  '설치 환경'?: NotionSelectProperty;
  '설치 공간'?: NotionSelectProperty;
  '설치 예산'?: NotionSelectProperty;
  '문의 목적'?: NotionSelectProperty;
  '지지구조물 방식'?: NotionSelectProperty;
  
  // 기타
  '문의요청 사항'?: NotionRichTextProperty;
  '담당자'?: NotionPeopleProperty;  // people 타입 추가
  '총 LED 모듈 수량'?: NotionNumberProperty;
  
  // 파일
  '견적서'?: NotionFilesProperty;
  '요청서'?: NotionFilesProperty;
  
  // LED 정보 (1-5)
  'LED1 크기'?: NotionRichTextProperty;
  'LED2 크기'?: NotionRichTextProperty;
  'LED3 크기'?: NotionRichTextProperty;
  'LED4 크기'?: NotionRichTextProperty;
  'LED5 크기'?: NotionRichTextProperty;
  
  'LED1 무대 높이'?: NotionNumberProperty;
  'LED2 무대 높이'?: NotionNumberProperty;
  'LED3 무대 높이'?: NotionNumberProperty;
  'LED4 무대 높이'?: NotionNumberProperty;
  'LED5 무대 높이'?: NotionNumberProperty;
  
  'LED1 오퍼레이터 필요'?: NotionCheckboxProperty;
  'LED2 오퍼레이터 필요'?: NotionCheckboxProperty;
  'LED3 오퍼레이터 필요'?: NotionCheckboxProperty;
  'LED4 오퍼레이터 필요'?: NotionCheckboxProperty;
  'LED5 오퍼레이터 필요'?: NotionCheckboxProperty;
  
  'LED1 오퍼레이터 일수'?: NotionNumberProperty;
  'LED2 오퍼레이터 일수'?: NotionNumberProperty;
  'LED3 오퍼레이터 일수'?: NotionNumberProperty;
  'LED4 오퍼레이터 일수'?: NotionNumberProperty;
  'LED5 오퍼레이터 일수'?: NotionNumberProperty;
  
  'LED1 프롬프터 연결'?: NotionCheckboxProperty;
  'LED2 프롬프터 연결'?: NotionCheckboxProperty;
  'LED3 프롬프터 연결'?: NotionCheckboxProperty;
  'LED4 프롬프터 연결'?: NotionCheckboxProperty;
  'LED5 프롬프터 연결'?: NotionCheckboxProperty;
  
  'LED1 중계카메라 연결'?: NotionCheckboxProperty;
  'LED2 중계카메라 연결'?: NotionCheckboxProperty;
  'LED3 중계카메라 연결'?: NotionCheckboxProperty;
  'LED4 중계카메라 연결'?: NotionCheckboxProperty;
  'LED5 중계카메라 연결'?: NotionCheckboxProperty;
  
  'LED1 모듈 수량'?: NotionNumberProperty;
  'LED2 모듈 수량'?: NotionNumberProperty;
  'LED3 모듈 수량'?: NotionNumberProperty;
  'LED4 모듈 수량'?: NotionNumberProperty;
  'LED5 모듈 수량'?: NotionNumberProperty;
  
  // 추가 LED 정보 (실제 DB에 존재)
  'LED1 대각선 인치'?: NotionRichTextProperty;
  'LED2 대각선 인치'?: NotionRichTextProperty;
  'LED3 대각선 인치'?: NotionRichTextProperty;
  'LED4 대각선 인치'?: NotionRichTextProperty;
  'LED5 대각선 인치'?: NotionRichTextProperty;
  
  'LED1 해상도'?: NotionRichTextProperty;
  'LED2 해상도'?: NotionRichTextProperty;
  'LED3 해상도'?: NotionRichTextProperty;
  'LED4 해상도'?: NotionRichTextProperty;
  'LED5 해상도'?: NotionRichTextProperty;
  
  'LED1 소비전력'?: NotionRichTextProperty;
  'LED2 소비전력'?: NotionRichTextProperty;
  'LED3 소비전력'?: NotionRichTextProperty;
  'LED4 소비전력'?: NotionRichTextProperty;
  'LED5 소비전력'?: NotionRichTextProperty;
  
  'LED1 전기설치 방식'?: NotionRichTextProperty;
  'LED2 전기설치 방식'?: NotionRichTextProperty;
  'LED3 전기설치 방식'?: NotionRichTextProperty;
  'LED4 전기설치 방식'?: NotionRichTextProperty;
  'LED5 전기설치 방식'?: NotionRichTextProperty;
  
  // 기타 필드들
  [key: string]: unknown; // 나머지 필드들
}

// Notion 댓글
export interface NotionComment {
  parent: {
    page_id: string;
  };
  rich_text: Array<NotionRichText | NotionMention>;
}

// Notion 멘션
export interface NotionMention {
  type: 'mention';
  mention: {
    type: 'user';
    user: {
      id: string;
    };
  };
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
  installSpace?: string;
  inquiryPurpose?: string;
  installBudget?: string;
  installSchedule?: string;
  
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

// NotionPeopleProperty 타입 추가
export interface NotionPeopleProperty {
  people: Array<{
    id: string;
    object: 'user';
    name?: string;
    avatar_url?: string | null;
    type?: string;
    person?: {
      email?: string;
    };
  }>;
}

// ===== 환경 변수 타입 =====

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production' | 'test';
      PORT: string;
      NOTION_API_KEY: string;
      NOTION_DATABASE_ID: string;
      MANAGERS_CONFIG?: string;
      STORAGE_ADDRESS?: string;
    }
  }
}

// ===== 유틸리티 타입 =====

// API 응답
export interface ApiResponse<T = unknown> {
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
    type: 'object';
    properties: Record<string, {
      type: string;
      description?: string;
      enum?: string[];
    }>;
    required?: string[];
  };
}

// MCP 도구 핸들러 결과
export interface ToolHandlerResult {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
}

// MCP 도구 핸들러
export type ToolHandler<T = Record<string, unknown>> = (args: T) => Promise<ToolHandlerResult>;

// MCP 도구
export interface Tool<T = Record<string, unknown>> {
  definition: ToolDefinition;
  handler: ToolHandler<T>;
}

// ===== 견적 관련 타입 =====

export interface QuoteModule {
  count: number;
  price: number;
}

export interface QuoteStructure {
  unitPrice: number;
  totalPrice: number;
  description: string;
  area?: number; // 추가
}

export interface QuoteController {
  count: number;
  totalPrice: number;
}

export interface QuotePower {
  requiredCount: number;
  totalPrice: number;
  totalPower: number;
}

export interface QuoteInstallation {
  workers: number;
  workerRange: string;
  totalPrice: number;
}

export interface QuoteOperation {
  days: number;
  totalPrice: number;
}

export interface QuoteTransport {
  price: number;
  range: string;
  trucks: number;
}

export interface QuoteResult {
  totalModuleCount: number;
  ledModules: QuoteModule;
  structure: QuoteStructure;
  controller: QuoteController;
  power: QuotePower;
  installation: QuoteInstallation;
  operation: QuoteOperation;
  transport: QuoteTransport;
  subtotal: number;
  vat: number;
  total: number;
  maxStageHeight: number;
  installationWorkers: number;
  installationWorkerRange: string;
  controllerCount: number;
  powerRequiredCount: number;
  transportRange: string;
  structureUnitPrice: number;
  structureUnitPriceDescription: string;
}

export interface RentalQuoteResult extends QuoteResult {
  periodSurcharge: {
    rate: number;
    surchargeAmount: number;
  };
  rentalDays: number;
}

// ===== 핸들러 관련 타입 =====

export type HandlerFunction = (
  message: string, 
  session: UserSession
) => KakaoResponse | Promise<KakaoResponse>;

export interface HandlerMap {
  [key: string]: HandlerFunction;
}

// ===== 검증 관련 타입 =====

export interface ValidationResult<T = unknown> {
  valid: boolean;
  value?: T;
  error?: string;
}

export interface LEDValidationResult extends ValidationResult<string> {
  size?: string;
}

export interface StageHeightValidationResult extends ValidationResult<number> {
  height?: number;
}

export interface PhoneValidationResult extends ValidationResult<string> {
  phone?: string;
}

export interface EventPeriodValidationResult extends ValidationResult {
  startDate?: string;
  endDate?: string;
  days?: number;
}