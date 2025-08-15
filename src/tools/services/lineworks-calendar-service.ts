// src/tools/services/lineworks-calendar-service.ts (수정된 버전)
import axios from 'axios';
import { LineWorksAuth } from '../../config/lineworks-auth.js';
import { parseCalendarText } from '../../utils/nlp-calendar-parser.js';

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

export class LineWorksCalendarService {
  private auth: LineWorksAuth;

  constructor() {
    this.auth = new LineWorksAuth();
  }

  /**
   * 자연어로 일정 생성 (올바른 LINE WORKS API 사용)
   */
  async createCalendarEvent(args: CalendarEventRequest): Promise<{ success: boolean; message: string; eventId?: string; needAuth?: boolean }> {
    try {
      console.log('📅 MCP 캘린더 일정 생성 시작 (올바른 API 형식)');
      console.log('- userId:', args.userId);
      console.log('- text:', args.text);
      
      // 1. 자연어 파싱
      const parsedEvent = parseCalendarText(args.text);
      console.log('- 파싱 결과:', parsedEvent);
      
      if (!parsedEvent) {
        return {
          success: false,
          message: '일정을 이해할 수 없습니다. 예시: "내일 오후 2시 고객 미팅"'
        };
      }

      // 2. 캘린더 이벤트 생성
      const calendarEvent = this.convertToCalendarEvent(parsedEvent);
      console.log('- 캘린더 이벤트:', JSON.stringify(calendarEvent, null, 2));

      // 3. LINE WORKS Calendar API 호출 (올바른 형식)
      const result = await this.createEventWithCorrectAPI(args.userId, calendarEvent);
      console.log('- API 결과:', result);

      if (result.success) {
        return {
          success: true,
          message: this.formatSuccessMessage(parsedEvent),
          eventId: result.eventId
        };
      } else {
        return {
          success: false,
          message: 'LINE WORKS 캘린더 일정 생성에 실패했습니다.'
        };
      }

    } catch (error) {
      console.error('❌ MCP 캘린더 오류:', error);
      return {
        success: false,
        message: '일정 처리 중 오류가 발생했습니다.'
      };
    }
  }

  /**
   * 올바른 LINE WORKS Calendar API로 이벤트 생성 (문서 기준)
   */
  private async createEventWithCorrectAPI(userId: string, event: CalendarEvent): Promise<{ success: boolean; eventId?: string; error?: any }> {
    try {
      console.log('📅 올바른 LINE WORKS Calendar API 호출');

      // Service Account 토큰 획득 (calendar scope 포함)
      const accessToken = await this.auth.getAccessTokenWithCalendarScope();
      console.log('✅ LINE WORKS 캘린더 Access Token 발급 성공');

      // 기본 캘린더 사용 (문서 기준)
      const endpoint = `https://www.worksapis.com/v1.0/users/${userId}/calendar/events`;
      console.log('- 올바른 API Endpoint:', endpoint);
      console.log('- User ID:', userId);

      // LINE WORKS Calendar API 문서 기준 JSON 형식
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
            visibility: event.visibility?.toUpperCase() || 'PRIVATE'
          }
        ]
      };

      console.log('- 요청 데이터:', JSON.stringify(eventData, null, 2));

      // API 호출 (문서 기준 헤더)
      const response = await axios.post(endpoint, eventData, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('✅ LINE WORKS 캘린더 API 성공:', response.data);
      return {
        success: true,
        eventId: response.data.eventComponents?.[0]?.eventId || 'success'
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
        console.log('💡 LINE WORKS Console > API 2.0 > Service Account에서 calendar scope 추가 필요');
      } else if (error.response?.status === 404) {
        console.log('❌ API 엔드포인트를 찾을 수 없습니다. userId를 확인하세요.');
      } else if (error.response?.status === 401) {
        console.log('❌ 인증 실패: Access Token을 확인하세요.');
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
   * 파싱된 이벤트를 LINE WORKS 캘린더 형식으로 변환 (간단한 형식)
   */
  private convertToCalendarEvent(parsed: any): CalendarEvent {
    // LINE WORKS 표준 날짜 형식으로 변환
    const startDate = new Date(`${parsed.date}T${parsed.time}:00+09:00`);
    const endDate = new Date(startDate.getTime() + (parsed.duration || 60) * 60000);
    
    // YYYY-MM-DDTHH:mm:ss 형식
    const formatDateTime = (date: Date) => {
      return date.toISOString().slice(0, 19); // 2025-08-16T14:00:00
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
    
    return message;
  }

  /**
   * 일정 조회 (기본 캘린더 사용)
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

      // 기본 캘린더 조회 (문서 기준)
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