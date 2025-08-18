// src/index.ts (고도화된 MCP 교육 적용 버전)
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';

// 환경 변수 로드
dotenv.config();

// 도구 임포트
import { kakaoChatbotTool } from './tools/kakao-chatbot.js';
import { notionMCPTool } from './tools/notion-mcp.js';
import { enhancedExcelTool } from './tools/enhanced-excel.js';
import { lineWorksCalendarTool } from './tools/lineworks-calendar-mcp.js';
import { notionProjectTool } from './tools/notion-project-mcp.js'; // 🆕 프로젝트 관리 도구
import { ToolDefinition } from './types/index.js';

// 도구 타입 정의
interface Tool {
  name: string;
  description: string;
  inputSchema: ToolDefinition['inputSchema'];
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

// 환경 변수 검증
function validateEnvironment(): void {
  const requiredEnvVars = [
    'NOTION_API_KEY',
    'NOTION_DATABASE_ID'
  ];

  const optionalEnvVars = [
    'LINEWORKS_BOT_ID',
    'LINEWORKS_BOT_SECRET', 
    'LINEWORKS_CLIENT_ID',
    'LINEWORKS_CLIENT_SECRET',
    'LINEWORKS_DOMAIN_ID',
    'LINEWORKS_SERVICE_ACCOUNT_ID',
    'LINEWORKS_PRIVATE_KEY',
    'NOTION_USER_DATABASE_ID' // 🆕 사용자 관리 DB
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('Missing required environment variables:', missingVars.join(', '));
    console.error('Please create a .env file with the required variables.');
    process.exit(1);
  }

  // LINE WORKS 환경 변수 확인 (경고만)
  const missingLineWorksVars = optionalEnvVars.filter(varName => !process.env[varName]);
  if (missingLineWorksVars.length > 0) {
    console.warn('Missing optional environment variables:', missingLineWorksVars.join(', '));
    console.warn('일부 고급 기능이 제한될 수 있습니다.');
  }
}

// 🆕 고도화된 도구 설명 생성
function createEnhancedToolDescriptions(): Map<string, Tool> {
  const tools = new Map<string, Tool>();

  // 🔥 notion_project 도구 - 고도화된 자연어 처리 교육 적용
  const enhancedNotionProjectTool = {
    ...notionProjectTool,
    description: `🤖 Notion 데이터베이스에서 LED 렌탈/설치 프로젝트를 생성, 업데이트, 검색합니다. 

📋 **핵심 기능**:
- 복수 LED 정보를 자동으로 파싱하여 적절한 LED1, LED2, LED3 필드에 저장
- 자연어 기반 프로젝트 생성/업데이트
- 대화형 정보 수집과 연동하여 완전한 데이터 생성

🧠 **고도화된 자연어 처리**:

**날짜 범위 인식**:
- "8월25일~8월29일이야" → "2025-08-25 ~ 2025-08-29"
- "25일부터 29일까지" → 동일한 범위 형식
- "8월 말경", "다음주 내내" → 대략적 기간 추정
- "8월25일~29일" → 단축 표현 인식
- 단일 날짜와 범위 날짜 모두 처리하여 "행사 일정" 필드에 저장

**자연어 표현 확장**:
- "큰 LED" → 일반적인 대형 크기(6000x3500 이상) 추정 또는 추가 질문 유도
- "작은 LED" → 소형 크기(4000x2500 이하) 추정
- "메인 화면", "주 화면" → LED1으로 분류
- "서브 화면", "보조 화면" → LED2로 분류
- "둘 다 같은 높이", "모든 무대높이 600mm" → 모든 LED에 동일 무대높이 적용
- "전부", "모두", "다" → 복수 LED에 동일 속성 적용

**LED 개수 및 크기 인식**:
- "2개소이고, LED크기는 6000x3500, 4000x2000" → LED1: 6000x3500, LED2: 4000x2000
- "3개 LED, 큰 거 하나, 작은 거 둘" → 자동 크기 분배
- "6미터급 2대" → 6000mm 기준 크기로 2개 LED 생성
- "대형 1개소, 중형 2개소" → 크기별 분류하여 LED 필드 배정

**속성 외 정보 fallback 처리**:
다음과 같은 정보는 모두 "문의요청사항" 필드에 자동 저장:
- "처음 써봐서 친절한 설명 부탁드려요"
- "예산이 빠듯합니다"
- "급하게 필요해요"
- "설치 경험이 없어서 도움이 필요합니다"
- "안전에 특히 신경써주세요"
- "소음을 최소화해주세요"
- "당일 설치 가능한지 확인 부탁드려요"
- LED 크기, 무대높이, 고객사, 장소, 일정 외의 모든 추가 정보

**복합 정보 파싱**:
- "코엑스팝업은 2개소이고, LED크기는 6000x3500, 4000x2000이야. 무대높이는 둘 다 600mm야" 
  → LED1: 6000x3500/600mm, LED2: 4000x2000/600mm로 정확 분리
- "Samsung 프로젝트, 킨텍스에서 8월25일~29일, 처음이라 친절하게 부탁해"
  → 고객사: Samsung, 장소: 킨텍스, 일정: 범위, 문의요청사항: "처음이라 친절하게 부탁해"

**고객사 및 장소 인식 확장**:
- "삼성", "Samsung" → 삼성전자로 정규화
- "LG", "엘지" → LG전자로 정규화  
- "코엑스", "COEX" → 코엑스로 통일
- "킨텍스", "KINTEX" → 킨텍스로 통일

**상태 업데이트 패턴**:
- "견적 완료했어", "견적 승인받았어" → "견적 승인" 상태
- "설치 시작했어" → "설치 중" 상태
- "행사 시작됐어" → "운영 중" 상태
- "철거 들어갔어" → "철거 중" 상태

⚠️ **중요 제약사항**:
- Notion 필드명은 절대 변경하지 말 것: "행사명", "고객사", "LED1 크기", "LED1 무대 높이" 등
- 무대 높이는 0mm 허용됨
- 알 수 없는 정보는 반드시 "문의요청사항"에 누적 저장
- 서비스 타입: 설치, 렌탈, 멤버쉽 (정확히 이 명칭 사용)`
  } as unknown as Tool;

  // 🔥 lineworks_calendar 도구 - 고도화된 일정 관리 교육 적용
  const enhancedCalendarTool = {
    ...lineWorksCalendarTool,
    description: `📅 LINE WORKS 캘린더에 일정을 등록하고 Notion에 동시 저장합니다.

🧠 **고도화된 자연어 일정 처리**:

**날짜 인식 패턴**:
- "내일", "모레", "다음주 화요일" → 정확한 날짜 계산
- "8월 19일", "8월19일", "8/19" → 2025-08-19
- "이번주 금요일", "다음달 첫째주" → 상대적 날짜 계산
- "연말", "8월 말경" → 대략적 날짜 추정

**시간 인식 패턴**:
- "오후 5시", "17시", "오후5시" → 17:00
- "아침", "점심시간", "저녁" → 기본 시간대 매핑
- "오전 9시 30분", "14:30" → 정확한 시간 파싱
- "시간 미정", "TBD" → 시간 없이 일정 생성

**참석자 인식 및 이메일 매핑**:
- "김대리와", "박과장과" → 사용자 DB에서 실제 이메일 자동 매핑
- "홍길동, 김영희와" → 복수 참석자 처리
- "팀장님과", "사장님과" → 직급 기반 인식
- 미등록 사용자는 이름만 기록하고 이메일 매핑 생략

**장소 인식**:
- "강남 스타벅스", "2층 회의실", "코엑스" → 정확한 장소 정보
- "현장", "고객사", "외부" → 일반적 장소 표현 인식
- "온라인", "화상", "Zoom" → 온라인 회의 표시

**회의 유형 자동 분류**:
- "고객 미팅", "프레젠테이션" → customer 타입
- "팀 회의", "내부 논의" → internal 타입
- "교육", "세미나" → training 타입
- "면접", "인터뷰" → interview 타입

**우선순위 감지**:
- "중요한", "긴급", "urgent" → high 우선순위
- "간단한", "가벼운" → low 우선순위
- 기본값: normal 우선순위

**알림 설정**:
- "30분 전 알림", "1시간 전에 알려줘" → 정확한 알림 시간 설정
- "당일 알림", "하루 전" → 상대적 알림 시간
- 기본값: 15분 전 알림

**준비물/메모 추출**:
- "PPT 준비", "자료 가져오기" → 준비물로 분류
- "예산 논의", "계약서 검토" → 회의 안건으로 분류
- 모든 추가 정보는 메모 필드에 저장

**복합 일정 처리 예시**:
"다음 주 화요일 오후 3시에 강남 스타벅스에서 김대리와 중요한 프로젝트 회의, 30분 전 알림, PPT 자료 준비"
→ 날짜: 다음주 화요일, 시간: 15:00, 장소: 강남 스타벅스, 참석자: 김대리(이메일 자동매핑), 우선순위: high, 알림: 30분전, 메모: "PPT 자료 준비"`
  } as unknown as Tool;

  // 기존 도구들 등록
  tools.set('kakao_chatbot', kakaoChatbotTool as Tool);
  tools.set('create_notion_estimate', notionMCPTool as unknown as Tool);
  tools.set('generate_excel', enhancedExcelTool as Tool);
  
  // 🔥 고도화된 도구들 등록
  tools.set('lineworks_calendar', enhancedCalendarTool);
  tools.set('notion_project', enhancedNotionProjectTool);

  return tools;
}

// 서버 클래스
class LEDRentalMCPServer {
  private server: Server;
  private tools: Map<string, Tool>;

  constructor() {
    this.server = new Server(
      {
        name: 'led-rental-mcp',
        version: '1.3.0', // 🆕 고도화된 자연어 처리 교육으로 버전 업데이트
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // 🔥 고도화된 도구 등록
    this.tools = createEnhancedToolDescriptions();
    
    this.setupHandlers();
  }

  private setupHandlers(): void {
    // 도구 목록 핸들러
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: Array.from(this.tools.values()).map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema
      }))
    }));

    // 도구 실행 핸들러
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const tool = this.tools.get(request.params.name);
      
      if (!tool) {
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${request.params.name}`
        );
      }

      try {
        console.error(`🔧 Executing enhanced tool: ${request.params.name}`);
        console.error(`📋 Arguments:`, JSON.stringify(request.params.arguments, null, 2));
        
        // 🧠 도구별 고도화된 처리 로그
        if (request.params.name === 'notion_project') {
          console.error('🤖 Claude AI 고도화된 자연어 프로젝트 관리 시작');
          console.error('📊 지원 패턴: 날짜범위, 복합LED정보, fallback처리, 자연어표현확장');
        } else if (request.params.name === 'lineworks_calendar') {
          console.error('📅 Claude AI 고도화된 일정 관리 시작');
          console.error('🎯 지원 기능: 참석자매핑, 회의유형분류, 우선순위감지, 복합일정처리');
        }
        
        const result = await tool.handler(request.params.arguments || {});
        
        console.error(`✅ Enhanced tool execution completed: ${request.params.name}`);
        
        return {
          content: [
            {
              type: 'text',
              text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
            }
          ]
        };
      } catch (error) {
        console.error(`❌ Enhanced tool execution error [${request.params.name}]:`, error);
        
        if (error instanceof McpError) {
          throw error;
        }
        
        throw new McpError(
          ErrorCode.InternalError,
          `Enhanced tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    });

    // 에러 핸들러
    this.server.onerror = (error) => {
      console.error('[Enhanced MCP Error]', error);
    };

    // 프로세스 종료 핸들러
    process.on('SIGINT', async () => {
      console.error('🛑 Shutting down Enhanced MCP server...');
      await this.server.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.error('🛑 Shutting down Enhanced MCP server...');
      await this.server.close();
      process.exit(0);
    });
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    
    console.error('🚀 Starting Enhanced LED Rental MCP Server...');
    console.error('📋 Available enhanced tools:', Array.from(this.tools.keys()).join(', '));
    console.error('🆕 Enhanced features:');
    console.error('  🤖 notion_project: 고도화된 AI 자연어 프로젝트 관리');
    console.error('    - 날짜 범위 인식: "8월25일~29일"');
    console.error('    - 복합 LED 정보: "2개소, LED크기는 6000x3500, 4000x2000"');
    console.error('    - fallback 처리: 모든 추가 정보 → "문의요청사항"');
    console.error('    - 자연어 표현: "큰 LED", "메인 화면", "둘 다 같은 높이"');
    console.error('  📅 lineworks_calendar: 고도화된 일정 관리');
    console.error('    - 참석자 자동 매핑: "김대리" → 실제 이메일');
    console.error('    - 회의 유형 분류: customer/internal/training/interview');
    console.error('    - 우선순위 감지: "중요한" → high priority');
    console.error('    - 복합 일정: 시간+장소+참석자+메모 동시 처리');
    console.error('  💬 대화형 정보 수집: 부족한 정보 자동 질문');
    console.error('  🔗 사용자 관리 시스템: Notion 기반 체계적 관리');
    
    await this.server.connect(transport);
    console.error('✅ Enhanced LED Rental MCP Server running on stdio');
    console.error('🧠 Claude AI가 고도화된 자연어 처리로 더욱 똑똑하게 동작합니다!');
  }
}

// 메인 함수
async function main(): Promise<void> {
  try {
    // 환경 변수 검증
    validateEnvironment();
    
    console.error('🧠 Enhanced MCP Server 시작 중...');
    console.error('📚 적용된 고도화 교육:');
    console.error('  - 날짜 범위 처리 패턴 확장');
    console.error('  - LED 정보 복합 파싱');
    console.error('  - 자연어 표현 확장 ("큰 LED", "메인 화면" 등)');
    console.error('  - fallback 정보 분류 (→ 문의요청사항)');
    console.error('  - 참석자 자동 이메일 매핑');
    console.error('  - 회의 유형 및 우선순위 자동 감지');
    
    // 서버 시작
    const server = new LEDRentalMCPServer();
    await server.start();
  } catch (error) {
    console.error('💥 Enhanced server startup failed:', error);
    process.exit(1);
  }
}

// 서버 실행
if (require.main === module) {
  main().catch((error) => {
    console.error('💥 Enhanced server fatal error:', error);
    process.exit(1);
  });
}