// src/index.ts (캘린더 도구 추가)
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
import { lineWorksCalendarTool } from './tools/lineworks-calendar-mcp.js'; // 새로 추가
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
    'LINEWORKS_PRIVATE_KEY'
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
    console.warn('Missing LINE WORKS environment variables:', missingLineWorksVars.join(', '));
    console.warn('LINE WORKS 캘린더 기능이 제한될 수 있습니다.');
  }
}

// 서버 클래스
class LEDRentalMCPServer {
  private server: Server;
  private tools: Map<string, Tool>;

  constructor() {
    this.server = new Server(
      {
        name: 'led-rental-mcp',
        version: '1.1.0', // 버전 업데이트
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // 도구 등록
    this.tools = new Map<string, Tool>();
    this.tools.set('kakao_chatbot', kakaoChatbotTool as Tool);
    this.tools.set('create_notion_estimate', notionMCPTool as unknown as Tool);
    this.tools.set('generate_excel', enhancedExcelTool as Tool);
    this.tools.set('lineworks_calendar', lineWorksCalendarTool as unknown as Tool); // 새로 추가

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
        console.error(`Executing tool: ${request.params.name}`);
        console.error(`Arguments:`, JSON.stringify(request.params.arguments, null, 2));
        
        const result = await tool.handler(request.params.arguments || {});
        
        return {
          content: [
            {
              type: 'text',
              text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
            }
          ]
        };
      } catch (error) {
        console.error(`Tool execution error: ${error}`);
        
        if (error instanceof McpError) {
          throw error;
        }
        
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    });

    // 에러 핸들러
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    // 프로세스 종료 핸들러
    process.on('SIGINT', async () => {
      console.error('Shutting down MCP server...');
      await this.server.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.error('Shutting down MCP server...');
      await this.server.close();
      process.exit(0);
    });
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    
    console.error('Starting LED Rental MCP Server...');
    console.error('Available tools:', Array.from(this.tools.keys()).join(', '));
    
    await this.server.connect(transport);
    console.error('LED Rental MCP Server running on stdio');
  }
}

// 메인 함수
async function main(): Promise<void> {
  try {
    // 환경 변수 검증
    validateEnvironment();
    
    // 서버 시작
    const server = new LEDRentalMCPServer();
    await server.start();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// 서버 실행
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}