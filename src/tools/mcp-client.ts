// src/tools/mcp-client.ts - Claude MCP Server와 통신하는 클라이언트

import { spawn } from 'child_process';

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
  private mcpProcess: any = null;
  private isConnected: boolean = false;

  /**
   * MCP 서버 시작
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      console.log('🚀 Claude MCP Server 연결 시작...');
      
      // MCP 서버 프로세스 시작
      this.mcpProcess = spawn('node', ['dist/index.js'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd()
      });

      this.mcpProcess.stderr.on('data', (data: Buffer) => {
        const message = data.toString();
        console.log('[MCP Server]', message);
      });

      this.mcpProcess.on('error', (error: Error) => {
        console.error('❌ MCP Server 프로세스 오류:', error);
        this.isConnected = false;
      });

      this.mcpProcess.on('close', (code: number) => {
        console.log(`MCP Server 프로세스 종료, 코드: ${code}`);
        this.isConnected = false;
      });

      // 초기화 대기
      await new Promise((resolve) => setTimeout(resolve, 2000));
      this.isConnected = true;
      
      console.log('✅ Claude MCP Server 연결 완료');
    } catch (error) {
      console.error('❌ MCP Server 연결 실패:', error);
      throw error;
    }
  }

  /**
   * MCP 도구 호출
   */
  async callTool(request: MCPRequest): Promise<MCPResponse> {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      console.log('📞 MCP 도구 호출:', request);

      // MCP 요청 메시지 생성
      const mcpMessage = {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: request.tool,
          arguments: request.arguments
        }
      };

      // MCP 서버로 요청 전송
      const response = await this.sendMCPRequest(mcpMessage);
      
      console.log('📨 MCP 응답 수신:', response);

      if (response.error) {
        return {
          success: false,
          error: response.error.message || 'MCP 요청 실패'
        };
      }

      return {
        success: true,
        result: response.result
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
   * MCP 서버로 요청 전송 및 응답 수신
   */
  private async sendMCPRequest(message: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.mcpProcess || !this.mcpProcess.stdin) {
        reject(new Error('MCP 프로세스가 준비되지 않았습니다.'));
        return;
      }

      const messageStr = JSON.stringify(message) + '\n';
      
      // 응답 리스너 설정
      const responseHandler = (data: Buffer) => {
        try {
          const response = JSON.parse(data.toString().trim());
          this.mcpProcess.stdout.removeListener('data', responseHandler);
          resolve(response);
        } catch (error) {
          // JSON 파싱 실패 시 계속 대기
        }
      };

      this.mcpProcess.stdout.on('data', responseHandler);

      // 요청 전송
      this.mcpProcess.stdin.write(messageStr);

      // 타임아웃 설정 (10초)
      setTimeout(() => {
        this.mcpProcess.stdout.removeListener('data', responseHandler);
        reject(new Error('MCP 요청 타임아웃'));
      }, 10000);
    });
  }

  /**
   * 연결 해제
   */
  async disconnect(): Promise<void> {
    if (this.mcpProcess) {
      this.mcpProcess.kill();
      this.mcpProcess = null;
    }
    this.isConnected = false;
    console.log('🔌 MCP Server 연결 해제');
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