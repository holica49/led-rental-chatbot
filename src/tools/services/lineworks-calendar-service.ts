// src/tools/services/lineworks-calendar-service.ts (완전 교체용)
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
   * 자연어로 일정 생성 (MCP 전용 - 올바른 LINE WORKS API 사용)
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

      // 2. 사용자 이메일 결정
      let targetEmail = args.userEmail;
      if (!targetEmail) {
        targetEmail = await this.getUserEmailFromUserId(args.userId);
      }

      console.log('- 대상 이메일:', targetEmail);

      // 3. 캘린더 이벤트 생성
      const calendarEvent = this.convertToCalendarEvent(parsedEvent);
      console.log('- 캘린더 이벤트:', JSON.stringify(calendarEvent, null, 2));

      // 4. LINE WORKS Calendar API 호출 (올바른 형식)
      const result = await this.createEventWithCorrectAPI(targetEmail, calendarEvent);
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
   * 올바른 LINE WORKS Calendar API로 이벤트 생성
   */
  private async createEventWithCorrectAPI(userEmail: string, event: CalendarEvent): Promise<{ success: boolean; eventId?: string; error?: any }> {
    try {
      console.log('📅 올바른 LINE WORKS Calendar API 호출');

      // Service Account 토큰 획득 (calendar scope 포함)
      const accessToken = await this.auth.getAccessTokenWithCalendarScope();
      console.log('- 캘린더 토큰 획득 완료');

      // 필수 정보 확인
      const API_ID = process.env.LINEWORKS_API_ID || process.env.LINEWORKS_CLIENT_ID;
      if (!API_ID) {
        console.error('❌ LINEWORKS_API_ID가 설정되지 않았습니다.');
        return { success: false, error: 'LINEWORKS_API_ID 필요' };
      }

      // 실제 캘린더 ID (제공해주신 링크에서 추출)
      const calendarId = '7a7c9e7c-6ce7-4757-8241-84413c32a245';
      
      // LINE WORKS Calendar API v1 올바른 엔드포인트
      const endpoint = `https://apis.worksmobile.com/r/${API_ID}/calendar/v1/${userEmail}/calendars/${calendarId}/events`;
      console.log('- 올바른 API Endpoint:', endpoint);
      console.log('- 캘린더 ID:', calendarId);
      console.log('- API_ID:', API_ID);

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
          'consumerKey': process.env.LINEWORKS_CONSUMER_KEY || API_ID
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
        console.log('💡 LINE WORKS Console > API 2.0 > Service Account에서 calendar scope 추가 필요');
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

      // 올바른 LINE WORKS Calendar API로 조회
      const API_ID = process.env.LINEWORKS_API_ID || process.env.LINEWORKS_CLIENT_ID;
      const calendarId = '7a7c9e7c-6ce7-4757-8241-84413c32a245';
      const endpoint = `https://apis.worksmobile.com/r/${API_ID}/calendar/v1/${targetEmail}/calendars/${calendarId}/events`;
      
      const response = await axios.get(endpoint, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'consumerKey': process.env.LINEWORKS_CONSUMER_KEY || API_ID
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