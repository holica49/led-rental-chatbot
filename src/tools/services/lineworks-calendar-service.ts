// src/tools/services/lineworks-calendar-service.ts
import axios from 'axios';
import { LineWorksAuth } from '../../config/lineworks-auth.js';
import { parseCalendarText } from '../../utils/nlp-calendar-parser.js';

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
  async createEventFromNaturalLanguage(userId: string, text: string): Promise<{ success: boolean; message: string; eventId?: string }> {
    try {
      console.log('📅 캘린더 일정 등록 시작');
      console.log('- userId:', userId);
      console.log('- text:', text);
      
      // 1. 자연어 파싱
      const parsedEvent = parseCalendarText(text);
      console.log('- 파싱 결과:', parsedEvent);
      
      if (!parsedEvent) {
        return {
          success: false,
          message: '일정을 이해할 수 없습니다. 예시: "내일 오후 2시 고객 미팅 30분전 알림"'
        };
      }

      // 2. LINE WORKS 캘린더 이벤트 형식으로 변환
      const calendarEvent = this.convertToCalendarEvent(parsedEvent);
      console.log('- 캘린더 이벤트:', JSON.stringify(calendarEvent, null, 2));

      // 3. 캘린더 API 호출
      const result = await this.createCalendarEvent(userId, calendarEvent);
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
          message: '일정 등록에 실패했습니다.'
        };
      }

    } catch (error) {
      console.error('❌ 자연어 일정 생성 오류:', error);
      return {
        success: false,
        message: '일정 처리 중 오류가 발생했습니다.'
      };
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
   * 캘린더 이벤트 생성 API 호출
   */
  private async createCalendarEvent(userId: string, event: CalendarEvent): Promise<{ success: boolean; eventId?: string; error?: any }> {
    try {
      console.log('📅 캘린더 API 호출 시작');
      const accessToken = await this.auth.getAccessToken();
      console.log('- Access Token 획득:', accessToken ? '성공' : '실패');
      
      // LINE WORKS Calendar API v2.0 endpoint
      const endpoint = `https://www.worksapis.com/v2.0/users/${userId}/calendar/events`;
      console.log('- API Endpoint:', endpoint);
      console.log('- Request Body:', JSON.stringify(event, null, 2));

      const response = await axios.post(endpoint, event, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('✅ 캘린더 API 성공:', response.data);
      return {
        success: true,
        eventId: response.data.eventId
      };

    } catch (error: any) {
      console.error('❌ 캘린더 API 오류:', {
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
   * 종료 시간 계산
   */
  private calculateEndTime(startDateTime: string, durationMinutes: number): string {
    const start = new Date(startDateTime);
    const end = new Date(start.getTime() + durationMinutes * 60000);
    
    return end.toISOString().slice(0, 19);
  }

  /**
   * 성공 메시지 포맷팅
   */
  private formatSuccessMessage(parsed: any): string {
    let message = `✅ 일정이 등록되었습니다!\n\n`;
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
   * 일정 조회 (오늘/이번주)
   */
  async getEvents(userId: string, range: 'today' | 'week'): Promise<CalendarEvent[]> {
    try {
      const accessToken = await this.auth.getAccessToken();
      
      const timeMin = new Date();
      const timeMax = new Date();
      
      if (range === 'today') {
        timeMax.setDate(timeMax.getDate() + 1);
      } else {
        timeMax.setDate(timeMax.getDate() + 7);
      }

      const endpoint = `https://www.worksapis.com/v1.0/users/${userId}/calendar/events`;
      
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

      return response.data.items || [];

    } catch (error) {
      console.error('일정 조회 오류:', error);
      return [];
    }
  }

  /**
   * 일정 삭제
   */
  async deleteEvent(userId: string, eventId: string): Promise<boolean> {
    try {
      const accessToken = await this.auth.getAccessToken();
      
      const endpoint = `https://www.worksapis.com/v1.0/users/${userId}/calendar/events/${eventId}`;
      
      await axios.delete(endpoint, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      return true;

    } catch (error) {
      console.error('일정 삭제 오류:', error);
      return false;
    }
  }
}

// 싱글톤 인스턴스
export const lineWorksCalendar = new LineWorksCalendarService();

// default export 추가
export default LineWorksCalendarService;