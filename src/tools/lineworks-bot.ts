// src/tools/lineworks-bot.ts
import axios from 'axios';
import { LineWorksAuth } from '../config/lineworks-auth.js';
import { sessionManager } from './session/session-manager.js';
import { UserSession } from '../types/index.js';
import { prepareNotionData } from './services/notion-service.js';
import { Client } from '@notionhq/client';

// LINE WORKS 관련 타입 정의
export interface LineWorksEvent {
  type: 'message' | 'postback' | 'join' | 'leave';
  source: {
    userId: string;
    domainId: number;
  };
  message?: {
    type: 'text' | 'image' | 'file';
    text?: string;
    id?: string;
  };
  postback?: {
    data: string;
  };
  timestamp: string;
}

export interface LineWorksMessage {
  content: {
    type: 'text' | 'button_template' | 'flex';
    text?: string;
    contentText?: string;
    altText?: string;
    actions?: any[];
    contents?: any;
  };
}

export class LineWorksBot {
  private auth: LineWorksAuth;
  private baseUrl = 'https://www.worksapis.com/v1.0';
  private notion: Client;

  constructor() {
    this.auth = new LineWorksAuth();
    this.notion = new Client({ auth: process.env.NOTION_API_KEY! });
  }

  /**
   * Webhook 이벤트 처리
   */
  async handleWebhook(body: any, signature: string): Promise<void> {
    // 서명 검증
    const isValid = this.auth.verifySignature(JSON.stringify(body), signature);
    if (!isValid) {
      throw new Error('Invalid signature');
    }

    // 이벤트 타입별 처리
    const event = body as LineWorksEvent;
    
    switch (event.type) {
      case 'message':
        await this.handleMessage(event);
        break;
      case 'postback':
        await this.handlePostback(event);
        break;
      default:
        console.log('Unhandled event type:', event.type);
    }
  }

  /**
   * 메시지 이벤트 처리
   */
  private async handleMessage(event: LineWorksEvent): Promise<void> {
    const { source, message } = event;
    const userId = source.userId;
    const text = message?.text || '';

    console.log(`메시지 수신: ${userId} - ${text}`);

    // 세션 관리
    let session = sessionManager.getSession(userId);
    if (!session || text === '처음' || text === '시작') {
      session = this.createNewSession(userId);
    }

    // 자연어 처리
    const response = await this.processBusinessQuery(text, session);
    
    // 응답 전송
    await this.sendMessage(userId, response);
  }

  /**
   * Postback 이벤트 처리
   */
  private async handlePostback(event: LineWorksEvent): Promise<void> {
    const { source, postback } = event;
    const userId = source.userId;
    const data = postback?.data || '';

    console.log(`Postback 수신: ${userId} - ${data}`);

    // Postback 데이터에 따른 처리
    const response = await this.processPostbackData(data);
    await this.sendMessage(userId, response);
  }

  /**
   * 업무 관련 쿼리 처리
   */
  private async processBusinessQuery(text: string, session: UserSession): Promise<LineWorksMessage> {
    // 프로젝트 현황 조회
    if (text.includes('프로젝트') || text.includes('현황')) {
      return await this.getProjectStatus(text);
    }
    
    // 일정 조회
    if (text.includes('일정') || text.includes('스케줄')) {
      return await this.getSchedule(text);
    }
    
    // 재고 현황
    if (text.includes('재고') || text.includes('LED')) {
      return await this.getInventoryStatus();
    }
    
    // 기본 응답
    return this.createWelcomeMessage();
  }

  /**
   * Postback 데이터 처리
   */
  private async processPostbackData(data: string): Promise<LineWorksMessage> {
    // Postback 데이터 파싱 (예: action=project&id=123)
    const params = new URLSearchParams(data);
    const action = params.get('action');

    switch (action) {
      case 'project':
        const projectId = params.get('id');
        return await this.getProjectById(projectId);
      case 'schedule':
        return await this.getTodaySchedule();
      default:
        return this.createTextMessage('알 수 없는 요청입니다.');
    }
  }

  /**
   * 프로젝트 현황 조회
   */
  private async getProjectStatus(query: string): Promise<LineWorksMessage> {
    // 프로젝트명 추출
    const projectName = this.extractProjectName(query);
    
    if (projectName) {
      // 특정 프로젝트 조회
      const project = await this.findProjectByName(projectName);
      if (project) {
        return this.createProjectCard(project);
      }
    }
    
    // 전체 프로젝트 목록
    const projects = await this.getActiveProjects();
    return this.createProjectListMessage(projects);
  }

  /**
   * 일정 조회
   */
  private async getSchedule(query: string): Promise<LineWorksMessage> {
    // 오늘 일정 조회
    if (query.includes('오늘')) {
      return await this.getTodaySchedule();
    }
    
    // 이번 주 일정
    if (query.includes('이번주') || query.includes('이번 주')) {
      return await this.getWeeklySchedule();
    }
    
    // 기본: 오늘 일정
    return await this.getTodaySchedule();
  }

  /**
   * 재고 현황 조회
   */
  private async getInventoryStatus(): Promise<LineWorksMessage> {
    // TODO: 실제 재고 데이터 연동
    return this.createTextMessage(
      '📦 LED 재고 현황\n\n' +
      '• P2.5: 320개 (80%)\n' +
      '• P3: 150개 (50%)\n' +
      '• P4: 40개 (13%) ⚠️\n' +
      '• P5: 200개 (67%)\n\n' +
      '⚠️ P4 재고가 부족합니다.'
    );
  }

  /**
   * 오늘 일정 조회
   */
  private async getTodaySchedule(): Promise<LineWorksMessage> {
    const today = new Date().toISOString().split('T')[0];
    const events = await this.getEventsByDate(today);
    
    if (events.length === 0) {
      return this.createTextMessage('오늘은 예정된 일정이 없습니다.');
    }
    
    let message = '📅 오늘의 일정\n\n';
    events.forEach((event: any) => {
      const name = event.properties['행사명']?.title?.[0]?.text?.content || '제목 없음';
      const location = event.properties['행사장']?.rich_text?.[0]?.text?.content || '장소 미정';
      message += `• ${name}\n  📍 ${location}\n\n`;
    });
    
    return this.createTextMessage(message);
  }

  /**
   * 주간 일정 조회
   */
  private async getWeeklySchedule(): Promise<LineWorksMessage> {
    // TODO: 주간 일정 조회 구현
    return this.createTextMessage('이번 주 일정을 조회합니다...');
  }

  /**
   * ID로 프로젝트 조회
   */
  private async getProjectById(projectId: string | null): Promise<LineWorksMessage> {
    if (!projectId) {
      return this.createTextMessage('프로젝트 ID가 없습니다.');
    }
    
    // TODO: ID로 프로젝트 조회
    return this.createTextMessage(`프로젝트 ${projectId}를 조회합니다...`);
  }

  /**
   * 프로젝트 목록 메시지 생성
   */
  private createProjectListMessage(projects: any[]): LineWorksMessage {
    if (projects.length === 0) {
      return this.createTextMessage('진행 중인 프로젝트가 없습니다.');
    }

    // Carousel 형태로 프로젝트 목록 표시
    const bubbles = projects.slice(0, 5).map(project => {
      const properties = project.properties;
      const name = properties['행사명']?.title?.[0]?.text?.content || '프로젝트';
      const status = properties['행사 상태']?.status?.name || '미정';
      const customer = properties['고객사']?.select?.name || '미정';
      
      return {
        type: 'bubble',
        size: 'micro',
        header: {
          type: 'box',
          layout: 'vertical',
          contents: [{
            type: 'text',
            text: name,
            weight: 'bold',
            size: 'sm',
            wrap: true
          }]
        },
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: status,
              size: 'xs',
              color: this.getStatusColor(status)
            },
            {
              type: 'text',
              text: customer,
              size: 'xs',
              color: '#999999'
            }
          ]
        }
      };
    });

    return {
      content: {
        type: 'flex',
        altText: '프로젝트 목록',
        contents: {
          type: 'carousel',
          contents: bubbles
        }
      }
    };
  }

  /**
   * 메시지 전송
   */
  async sendMessage(userId: string, message: LineWorksMessage): Promise<void> {
    try {
      const headers = await this.auth.getAuthHeaders();
      const url = `${this.baseUrl}/bots/${process.env.LINEWORKS_BOT_ID}/users/${userId}/messages`;
      
      await axios.post(url, message, { headers });
      console.log('메시지 전송 성공');
    } catch (error: any) {
      console.error('메시지 전송 실패:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * 텍스트 메시지 생성
   */
  private createTextMessage(text: string): LineWorksMessage {
    return {
      content: {
        type: 'text',
        text: text
      }
    };
  }

  /**
   * 환영 메시지 생성
   */
  private createWelcomeMessage(): LineWorksMessage {
    return {
      content: {
        type: 'button_template',
        contentText: '안녕하세요! 업무 관리 봇입니다.\n무엇을 도와드릴까요?',
        actions: [
          {
            type: 'message',
            label: '📊 프로젝트 현황',
            text: '프로젝트 현황'
          },
          {
            type: 'message',
            label: '📅 오늘 일정',
            text: '오늘 일정'
          },
          {
            type: 'message',
            label: '📦 LED 재고',
            text: 'LED 재고 현황'
          },
          {
            type: 'message',
            label: '📈 주간 보고서',
            text: '주간 보고서'
          }
        ]
      }
    };
  }

  /**
   * 프로젝트 카드 생성
   */
  private createProjectCard(project: any): LineWorksMessage {
    const properties = project.properties;
    const status = properties['행사 상태']?.status?.name || '미정';
    const customer = properties['고객사']?.select?.name || '미정';
    const eventDate = properties['행사 일정']?.rich_text?.[0]?.text?.content || '미정';
    
    return {
      content: {
        type: 'flex',
        altText: `${properties['행사명']?.title?.[0]?.text?.content} 현황`,
        contents: {
          type: 'bubble',
          header: {
            type: 'box',
            layout: 'vertical',
            contents: [{
              type: 'text',
              text: properties['행사명']?.title?.[0]?.text?.content || '프로젝트',
              weight: 'bold',
              size: 'xl'
            }]
          },
          body: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  { type: 'text', text: '상태', flex: 1, weight: 'bold' },
                  { type: 'text', text: status, flex: 2, color: this.getStatusColor(status) }
                ]
              },
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  { type: 'text', text: '고객사', flex: 1, weight: 'bold' },
                  { type: 'text', text: customer, flex: 2 }
                ]
              },
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  { type: 'text', text: '일정', flex: 1, weight: 'bold' },
                  { type: 'text', text: eventDate, flex: 2 }
                ]
              }
            ],
            spacing: 'sm'
          },
          footer: {
            type: 'box',
            layout: 'horizontal',
            contents: [{
              type: 'button',
              action: {
                type: 'uri',
                label: 'Notion에서 보기',
                uri: `https://notion.so/${project.id.replace(/-/g, '')}`
              }
            }]
          }
        }
      }
    };
  }

  /**
   * 새 세션 생성
   */
  private createNewSession(userId: string): UserSession {
    sessionManager.clearSession(userId); // 기존 세션 삭제
    
    // 새 세션 생성 및 반환
    return sessionManager.getSession(userId);
  }
  
  /**
   * 프로젝트명 추출
   */
  private extractProjectName(text: string): string | null {
    // "강남LED 프로젝트 현황" → "강남LED"
    const match = text.match(/([가-힣A-Za-z0-9]+)\s*(프로젝트|현황|상태)/);
    return match ? match[1] : null;
  }

  /**
   * 상태별 색상
   */
  private getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      '견적 요청': '#FF6B6B',
      '견적 검토': '#4ECDC4',
      '견적 승인': '#45B7D1',
      '진행중': '#06C755',
      '완료': '#95A5A6'
    };
    return colors[status] || '#000000';
  }

  /**
   * 프로젝트명으로 조회
   */
  private async findProjectByName(projectName: string): Promise<any> {
    try {
      const response = await this.notion.databases.query({
        database_id: process.env.NOTION_DATABASE_ID!,
        filter: {
          property: '행사명',
          title: {
            contains: projectName
          }
        }
      });
      
      return response.results[0] || null;
    } catch (error) {
      console.error('프로젝트 조회 오류:', error);
      return null;
    }
  }
  
  /**
   * 활성 프로젝트 목록 조회
   */
  private async getActiveProjects(): Promise<any[]> {
    try {
      const response = await this.notion.databases.query({
        database_id: process.env.NOTION_DATABASE_ID!,
        filter: {
          property: '행사 상태',
          status: {
            does_not_equal: '완료'
          }
        },
        sorts: [{
          property: '행사 일정',
          direction: 'ascending'
        }]
      });
      
      return response.results;
    } catch (error) {
      console.error('프로젝트 목록 조회 오류:', error);
      return [];
    }
  }
  
  /**
   * 날짜별 이벤트 조회
   */
  private async getEventsByDate(date: string): Promise<any[]> {
    try {
      const response = await this.notion.databases.query({
        database_id: process.env.NOTION_DATABASE_ID!,
        filter: {
          property: '행사 일정',
          rich_text: {
            contains: date
          }
        }
      });
      
      return response.results;
    } catch (error) {
      console.error('일정 조회 오류:', error);
      return [];
    }
  }
}