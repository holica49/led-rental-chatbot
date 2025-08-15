// src/tools/lineworks-calendar-mcp.ts (수정된 버전)
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
   * MCP에서 캘린더 일정 생성 (문서 기준 API 사용)
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

      // 2. 캘린더 이벤트 생성
      const calendarEvent = this.convertToCalendarEvent(parsed);
      console.log('- 캘린더 이벤트:', calendarEvent);

      // 3. LINE WORKS 캘린더 API 호출 (문서 기준)
      const result = await this.createEventWithBasicCalendar(args.userId, calendarEvent);
      
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
   * 기본 캘린더에 이벤트 생성 (문서 기준)
   */
  private async createEventWithBasicCalendar(userId: string, event: CalendarEvent): Promise<{ success: boolean; eventId?: string; error?: any }> {
    try {
      console.log('📅 MCP 캘린더 일정 생성 시작 (올바른 API 형식)');

      // Service Account 토큰 획득 (calendar scope 포함)
      const accessToken = await this.auth.getAccessTokenWithCalendarScope();
      console.log('✅ LINE WORKS 캘린더 Access Token 발급 성공');

      // 문서 기준: 기본 캘린더 사용
      const endpoint = `https://www.worksapis.com/v1.0/users/${userId}/calendar/events`;
      console.log('- API Endpoint:', endpoint);
      console.log('- domainId:', process.env.LINEWORKS_DOMAIN_ID);
      console.log('- User ID:', userId);

      // 문서 기준 JSON 형식
      const eventData = {
        eventComponents: [
          {
            eventId: `claude-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            summary: event.summary,
            description: event.description || 'Claude MCP에서 등록된 일정',
            location: event.location,
            start: {
              dateTime: event.startDateTime,
              timeZone: 'Asia/Seoul'
            },
            end: {
              dateTime: event.endDateTime,
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

      // API 호출 (문서 기준)
      const response = await axios.post(endpoint, eventData, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('✅ LINE WORKS 캘린더 API 성공:', response.data);
      return {
        success: true,
        eventId: response.data.eventComponents?.[0]?.eventId || response.data.returnValue || 'success'
      };

    } catch (error: any) {
      console.error('❌ 올바른 LINE WORKS 캘린더 API 오류:', {
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
   * 파싱된 이벤트를 LINE WORKS 캘린더 형식으로 변환 (시간대 수정)
   */
  private convertToCalendarEvent(parsed: any): CalendarEvent {
    // 한국 시간으로 Date 객체 생성 (시간대 지정 없이)
    const startDate = new Date(`${parsed.date}T${parsed.time}:00`);
    const endDate = new Date(startDate.getTime() + (parsed.duration || 60) * 60000);
    
    // 한국 시간대 기준으로 포맷팅 (로컬 시간 그대로 사용)
    const formatDateTime = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      
      return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
    };

    const event: CalendarEvent = {
      summary: parsed.title,
      startDateTime: formatDateTime(startDate),
      endDateTime: formatDateTime(endDate),
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
      
      const timeMin = new Date();
      const timeMax = new Date();
      
      if (args.range === 'today') {
        timeMax.setDate(timeMax.getDate() + 1);
      } else {
        timeMax.setDate(timeMax.getDate() + 7);
      }

      const endpoint = `https://www.worksapis.com/v1.0/users/${args.userId}/calendar/events`;
      
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
        events: response.data.eventComponents || response.data.events || []
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

// MCP 도구 정의
export const lineWorksCalendarTool = {
  name: 'lineworks_calendar',
  description: 'LINE WORKS 캘린더에 일정을 생성하거나 조회합니다. 자연어로 입력된 일정을 파싱하여 캘린더에 저장합니다. (문서 기준 API 사용)',
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