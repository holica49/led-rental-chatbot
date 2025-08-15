// src/tools/lineworks-calendar-mcp.ts
import { LineWorksAuth } from '../config/lineworks-auth.js';
import { parseCalendarText } from '../utils/nlp-calendar-parser.js';
import axios from 'axios';

interface CalendarEventRequest {
  userId: string;
  text: string;
  userEmail?: string;
}

interface CalendarEvent {
  summary: string;
  description?: string;
  startDateTime: string;
  endDateTime: string;
  location?: string;
  isAllDay?: boolean;
  visibility?: 'PUBLIC' | 'PRIVATE';
  reminder?: {
    remindBefore: number;
  };
}

class LineWorksCalendarMCP {
  private auth: LineWorksAuth;

  constructor() {
    this.auth = new LineWorksAuth();
  }

  /**
   * 자연어를 파싱하여 LINE WORKS 캘린더에 일정 생성
   */
  async createCalendarEvent(args: CalendarEventRequest): Promise<any> {
    try {
      console.log('📅 MCP 캘린더 일정 생성 시작');
      console.log('- Request:', args);

      // 1. 자연어 파싱
      const parsed = parseCalendarText(args.text);
      if (!parsed) {
        return {
          success: false,
          message: '일정을 이해할 수 없습니다. 예시: "내일 오후 2시 고객 미팅"'
        };
      }

      console.log('- 파싱 결과:', parsed);

      // 2. 사용자 이메일 결정
      let targetEmail = args.userEmail;
      if (!targetEmail) {
        // userId를 기반으로 이메일 추출 또는 기본값 설정
        targetEmail = await this.getUserEmailFromUserId(args.userId);
      }

      console.log('- 대상 이메일:', targetEmail);

      // 3. 캘린더 이벤트 생성
      const calendarEvent = this.convertToCalendarEvent(parsed);
      console.log('- 캘린더 이벤트:', calendarEvent);

      // 4. Service Account로 LINE WORKS API 호출
      const result = await this.createEventWithServiceAccount(targetEmail, calendarEvent);
      
      if (result.success) {
        return {
          success: true,
          message: this.formatSuccessMessage(parsed),
          eventId: result.eventId,
          event: calendarEvent
        };
      } else {
        return {
          success: false,
          message: '캘린더 일정 생성에 실패했습니다.',
          error: result.error
        };
      }

    } catch (error) {
      console.error('❌ MCP 캘린더 오류:', error);
      return {
        success: false,
        message: '일정 처리 중 오류가 발생했습니다.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Service Account로 캘린더 이벤트 생성
   */
  private async createEventWithServiceAccount(userEmail: string, event: CalendarEvent): Promise<{ success: boolean; eventId?: string; error?: any }> {
    try {
      console.log('📅 Service Account로 캘린더 API 호출');

      // Service Account 토큰 획득
      const accessToken = await this.auth.getAccessToken();
      console.log('- Service Account 토큰 획득 완료');

      // LINE WORKS Calendar API v1.0 사용
      const endpoint = `https://www.worksapis.com/v1.0/users/${userEmail}/calendars/primary/events`;
      console.log('- API Endpoint:', endpoint);

      const response = await axios.post(endpoint, event, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('✅ Service Account 캘린더 API 성공:', response.data);
      return {
        success: true,
        eventId: response.data.eventId || response.data.id
      };

    } catch (error: any) {
      console.error('❌ Service Account 캘린더 API 오류:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        headers: error.response?.headers
      });

      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  /**
   * userId에서 사용자 이메일 추출
   */
  private async getUserEmailFromUserId(userId: string): Promise<string> {
    try {
      // Service Account로 사용자 정보 조회
      const accessToken = await this.auth.getAccessToken();
      
      const response = await axios.get(`https://www.worksapis.com/v1.0/users/${userId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      return response.data.email;
    } catch (error) {
      console.error('사용자 이메일 조회 실패:', error);
      // 실패 시 기본값 또는 추정값 반환
      return `${userId}@anyractive.co.kr`;
    }
  }

  /**
   * 파싱된 이벤트를 LINE WORKS 캘린더 형식으로 변환
   */
  private convertToCalendarEvent(parsed: any): CalendarEvent {
    // ISO 8601 형식으로 변환 (Asia/Seoul 타임존)
    const startDateTime = new Date(`${parsed.date}T${parsed.time}:00+09:00`).toISOString();
    const endDateTime = new Date(new Date(startDateTime).getTime() + (parsed.duration || 60) * 60000).toISOString();

    const event: CalendarEvent = {
      summary: parsed.title,
      startDateTime: startDateTime,
      endDateTime: endDateTime,
      isAllDay: false,
      visibility: 'PRIVATE'
    };

    // 설명 추가
    event.description = `LINE WORKS 봇에서 등록된 일정`;

    // 장소 추가
    if (parsed.location) {
      event.location = parsed.location;
    }

    // 알림 설정
    if (parsed.reminder) {
      event.reminder = {
        remindBefore: parsed.reminder
      };
    }

    return event;
  }

  /**
   * 성공 메시지 포맷팅
   */
  private formatSuccessMessage(parsed: any): string {
    let message = `✅ 캘린더 일정이 등록되었습니다!\n\n`;
    message += `📅 날짜: ${parsed.date}\n`;
    message += `⏰ 시간: ${parsed.time}\n`;
    message += `📌 제목: ${parsed.title}`;
    
    if (parsed.location) {
      message += `\n📍 장소: ${parsed.location}`;
    }
    
    if (parsed.reminder) {
      message += `\n🔔 알림: ${parsed.reminder}분 전`;
    }
    
    return message;
  }

  /**
   * 일정 조회
   */
  async getEvents(args: { userId: string; userEmail?: string; range: 'today' | 'week' }): Promise<any> {
    try {
      const accessToken = await this.auth.getAccessToken();
      
      let targetEmail = args.userEmail;
      if (!targetEmail) {
        targetEmail = await this.getUserEmailFromUserId(args.userId);
      }

      const timeMin = new Date();
      const timeMax = new Date();
      
      if (args.range === 'today') {
        timeMax.setDate(timeMax.getDate() + 1);
      } else {
        timeMax.setDate(timeMax.getDate() + 7);
      }

      const endpoint = `https://www.worksapis.com/v1.0/users/${targetEmail}/calendars/primary/events`;
      
      const response = await axios.get(endpoint, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        params: {
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString(),
          orderBy: 'startTime'
        }
      });

      return {
        success: true,
        events: response.data.items || response.data.events || []
      };

    } catch (error) {
      console.error('일정 조회 오류:', error);
      return {
        success: false,
        events: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// MCP 도구 정의 (ToolDefinition 타입 사용하지 않음)
export const lineWorksCalendarTool = {
  name: 'lineworks_calendar',
  description: 'LINE WORKS 캘린더에 일정을 생성하거나 조회합니다. 자연어로 입력된 일정을 파싱하여 캘린더에 저장합니다.',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['create', 'get'],
        description: '수행할 작업 (create: 일정 생성, get: 일정 조회)'
      },
      userId: {
        type: 'string',
        description: 'LINE WORKS 사용자 ID'
      },
      text: {
        type: 'string',
        description: '자연어로 입력된 일정 내용 (예: "내일 오후 2시 고객 미팅")'
      },
      userEmail: {
        type: 'string',
        description: '사용자 이메일 (선택사항)'
      },
      range: {
        type: 'string',
        enum: ['today', 'week'],
        description: '조회 범위 (get 액션용)'
      }
    },
    required: ['action', 'userId']
  },
  handler: async (args: Record<string, unknown>) => {
    const calendarService = new LineWorksCalendarMCP();
    
    if (args.action === 'create') {
      if (!args.text) {
        throw new Error('일정 내용(text)이 필요합니다.');
      }
      return calendarService.createCalendarEvent({
        userId: args.userId as string,
        text: args.text as string,
        userEmail: args.userEmail as string | undefined
      });
    } else if (args.action === 'get') {
      return calendarService.getEvents({
        userId: args.userId as string,
        userEmail: args.userEmail as string | undefined,
        range: (args.range as 'today' | 'week') || 'week'
      });
    } else {
      throw new Error('지원되지 않는 액션입니다.');
    }
  }
};