// src/tools/lineworks-calendar-mcp.ts (권한 해결 버전)
import axios from 'axios';
import { LineWorksAuth } from '../config/lineworks-auth.js';
import { parseCalendarText } from '../utils/nlp-calendar-parser.js';

interface CalendarEventRequest {
  userId: string;
  text: string;
  userEmail?: string;
}

interface CalendarEvent {
  eventId?: string;
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
   * MCP에서 캘린더 일정 생성 (Claude가 직접 호출)
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
        targetEmail = await this.getUserEmailFromUserId(args.userId);
      }

      console.log('- 대상 이메일:', targetEmail);

      // 3. 캘린더 이벤트 생성
      const calendarEvent = this.convertToCalendarEvent(parsed);
      console.log('- 캘린더 이벤트:', calendarEvent);

      // 4. LINE WORKS 캘린더 API 호출 (Domain Admin 권한 필요)
      const result = await this.createEventWithDomainAccess(targetEmail, calendarEvent);
      
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
          message: 'LINE WORKS 캘린더 일정 생성에 실패했습니다.',
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
   * Domain Admin 권한으로 캘린더 이벤트 생성 (올바른 LINE WORKS API 형식)
   */
  private async createEventWithDomainAccess(userEmail: string, event: CalendarEvent): Promise<{ success: boolean; eventId?: string; error?: any }> {
    try {
      console.log('📅 LINE WORKS 캘린더 API 호출 (공식 JSON 형식)');

      // Service Account 토큰 획득 (calendar scope 포함)
      const accessToken = await this.auth.getAccessTokenWithCalendarScope();
      console.log('- 캘린더 토큰 획득 완료');

      // 필수 정보 확인
      const API_ID = process.env.LINEWORKS_API_ID || process.env.LINEWORKS_CLIENT_ID;
      if (!API_ID) {
        throw new Error('LINEWORKS_API_ID가 설정되지 않았습니다.');
      }

      // LINE WORKS Calendar API v1 정확한 엔드포인트
      const calendarId = 'primary'; // 기본 캘린더
      const endpoint = `https://apis.worksmobile.com/r/${API_ID}/calendar/v1/${userEmail}/calendars/${calendarId}/events`;
      console.log('- API Endpoint:', endpoint);

      // LINE WORKS Calendar API 공식 JSON 형식
      const eventData = {
        eventComponents: [
          {
            eventId: `claude-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            summary: event.summary,
            description: event.description || 'Claude MCP에서 등록된 일정',
            location: event.location,
            start: {
              dateTime: event.startDateTime.replace('Z', ''),
              timeZone: 'Asia/Seoul'
            },
            end: {
              dateTime: event.endDateTime.replace('Z', ''),
              timeZone: 'Asia/Seoul'
            },
            transparency: 'OPAQUE',
            visibility: event.visibility?.toUpperCase() || 'PRIVATE',
            sequence: 1,
            reminders: event.reminder ? [
              {
                method: 'DISPLAY',
                trigger: `-PT${event.reminder.remindBefore}M`
              }
            ] : [],
            priority: 0
          }
        ],
        sendNotification: false
      };

      console.log('- 요청 데이터:', JSON.stringify(eventData, null, 2));

      // API 호출
      const response = await axios.post(endpoint, eventData, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'consumerKey': process.env.LINEWORKS_CONSUMER_KEY || process.env.LINEWORKS_CLIENT_ID
        }
      });

      console.log('✅ LINE WORKS 캘린더 API 성공:', response.data);
      return {
        success: true,
        eventId: response.data.eventComponents?.[0]?.eventId || response.data.returnValue || 'success'
      };

    } catch (error: any) {
      console.error('❌ LINE WORKS 캘린더 API 오류:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        headers: error.response?.headers
      });

      // 상세 오류 분석
      if (error.response?.status === 403) {
        console.log('❌ 권한 부족: calendar scope 또는 API 권한을 확인하세요.');
      } else if (error.response?.status === 404) {
        console.log('❌ API 엔드포인트를 찾을 수 없습니다. API_ID를 확인하세요.');
      } else if (error.response?.status === 401) {
        console.log('❌ 인증 실패: Access Token 또는 Consumer Key를 확인하세요.');
      } else if (error.response?.status === 400) {
        console.log('❌ 요청 형식 오류: 날짜 형식이나 필수 필드를 확인하세요.');
      }

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
      // 실패 시 기본값 반환
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
    event.description = `Claude MCP에서 등록된 일정`;

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
    let message = `✅ MCP에서 LINE WORKS 캘린더에 일정을 등록했습니다!\n\n`;
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
   * 일정 조회 (MCP 전용)
   */
  async getEvents(args: { userId: string; userEmail?: string; range: 'today' | 'week' }): Promise<any> {
    try {
      const accessToken = await this.auth.getAccessTokenWithCalendarScope();
      
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

      const endpoint = `https://www.worksapis.com/v1.0/users/${targetEmail}/calendar/events`;
      
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
  description: 'LINE WORKS 캘린더에 일정을 생성하거나 조회합니다. 자연어로 입력된 일정을 파싱하여 캘린더에 저장합니다. (MCP 전용 - 권한 해결됨)',
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