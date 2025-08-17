// src/tools/mcp-client.ts - 간단한 MCP 클라이언트 구현

interface MCPRequest {
  tool: string;
  arguments: Record<string, unknown>;
}

interface MCPResponse {
  success: boolean;
  result?: any;
  error?: string;
}

export class MCPClient {
  private isConnected: boolean = false;

  /**
   * MCP 서버 연결 (임시 구현)
   */
  async connect(): Promise<void> {
    console.log('🚀 MCP 클라이언트 연결 시뮬레이션...');
    
    // 임시로 항상 성공으로 처리
    this.isConnected = true;
    console.log('✅ MCP 클라이언트 연결 완료 (시뮬레이션)');
  }

  /**
   * MCP 도구 호출 (임시 구현 - 직접 호출)
   */
  async callTool(request: MCPRequest): Promise<MCPResponse> {
    try {
      console.log('📞 MCP 도구 호출 (직접):', request);

      // notion_project 도구 직접 호출
      if (request.tool === 'notion_project') {
        const { notionProjectTool } = await import('./notion-project-mcp.js');
        const result = await notionProjectTool.handler(request.arguments);
        
        return {
          success: true,
          result: {
            content: [
              {
                type: 'text',
                text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
              }
            ]
          }
        };
      }

      // lineworks_calendar 도구 직접 호출
      if (request.tool === 'lineworks_calendar') {
        const { lineWorksCalendarTool } = await import('./lineworks-calendar-mcp.js');
        const result = await lineWorksCalendarTool.handler(request.arguments);
        
        return {
          success: true,
          result: {
            content: [
              {
                type: 'text', 
                text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
              }
            ]
          }
        };
      }

      return {
        success: false,
        error: `지원되지 않는 도구: ${request.tool}`
      };

    } catch (error) {
      console.error('❌ MCP 도구 호출 오류:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 연결 해제
   */
  async disconnect(): Promise<void> {
    this.isConnected = false;
    console.log('🔌 MCP 클라이언트 연결 해제');
  }

  /**
   * 연결 상태 확인
   */
  getConnectionStatus(): boolean {
    return this.isConnected;
  }
}

// 싱글톤 인스턴스
let mcpClientInstance: MCPClient | null = null;

export function getMCPClient(): MCPClient {
  if (!mcpClientInstance) {
    mcpClientInstance = new MCPClient();
  }
  return mcpClientInstance;
}

// 프로세스 종료 시 정리
process.on('SIGTERM', async () => {
  if (mcpClientInstance) {
    await mcpClientInstance.disconnect();
  }
});

process.on('SIGINT', async () => {
  if (mcpClientInstance) {
    await mcpClientInstance.disconnect();
  }
});