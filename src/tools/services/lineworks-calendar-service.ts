// src/tools/services/lineworks-calendar-service.ts
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
  startDateTime: string;  // ISO 8601 형식
  endDateTime: string;    // ISO 8601 형식
  location?: string;
  isAllDay?: boolean;
  category?: string;
  visibility?: 'PUBLIC' | 'PRIVATE';
  recurrence?: any;
  reminder?: {
    remindBefore: number;  // 분 단위
  };
}

export class LineWorksCalendarService {
  private auth: LineWorksAuth;
  private calendarId: string = 'primary'; // 기본 캘린더

  constructor() {
    this.auth = new LineWorksAuth();
  }

  /**
   * 자연어로 일정 생성
   */
  async createCalendarEvent(args: CalendarEventRequest): Promise<{ success: boolean; message: string; eventId?: string; needAuth?: boolean }> {
    try {
      console.log('📅 캘린더 일정 등록 시작');
      console.log('- userId:', args.userId);
      console.log('- text:', args.text);
      
      // 1. 자연어 파싱
      const parsedEvent = parseCalendarText(args.text);
      console.log('- 파싱 결과:', parsedEvent);
      
      if (!parsedEvent) {
        return {
          success: false,
          message: '일정을 이해할 수 없습니다. 예시: "내일 오후 2시 고객 미팅 30분전 알림"'
        };
      }

      // 2. 사용자 이메일 결정
      let targetEmail = args.userEmail;
      if (!targetEmail) {
        // userId를 기반으로 이메일 추출 또는 기본값 설정
        targetEmail = await this.getUserEmailFromUserId(args.userId);
      }

      console.log('- 대상 이메일:', targetEmail);

      // 3. LINE WORKS 캘린더 이벤트 형식으로 변환
      const calendarEvent = this.convertToCalendarEvent(parsedEvent);
      console.log('- 캘린더 이벤트:', JSON.stringify(calendarEvent, null, 2));

      // 4. 캘린더 API 호출 (Service Account 사용)
      const result = await this.createEventWithServiceAccount(targetEmail, calendarEvent);
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
      console.error('❌ 캘린더 일정 생성 오류:', error);
      return {
        success: false,
        message: '일정 처리 중 오류가 발생했습니다.'
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

      // LINE WORKS Calendar API v1.0 사용 (실제 API 확인 필요)
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
    let message = `✅ LINE WORKS 캘린더에 일정이 등록되었습니다!\n\n`;
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