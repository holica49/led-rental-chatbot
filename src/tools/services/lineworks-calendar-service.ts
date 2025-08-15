// src/tools/services/lineworks-calendar-service.ts
import axios from 'axios';
import { LineWorksAuth } from '../../config/lineworks-auth.js';
import { parseCalendarText } from '../../utils/nlp-calendar-parser.js';
import { getUserToken, isUserAuthenticated } from '../oauth-routes.js';

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
  async createEventFromNaturalLanguage(userId: string, text: string): Promise<{ success: boolean; message: string; eventId?: string; needAuth?: boolean }> {
    try {
      console.log('📅 캘린더 일정 등록 시작');
      console.log('- userId:', userId);
      console.log('- text:', text);
      
      // 사용자 인증 확인
      if (!isUserAuthenticated(userId)) {
        const authUrl = `${process.env.APP_URL}/auth/lineworks?userId=${userId}`;
        return {
          success: false,
          needAuth: true,
          message: `캘린더 사용을 위해 먼저 인증이 필요합니다.\n\n다음 링크를 클릭하여 인증해주세요:\n${authUrl}`
        };
      }
      
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

      // 3. 캘린더 API 호출 (사용자 토큰 사용)
      const result = await this.createCalendarEventWithUserToken(userId, calendarEvent);
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
   * 사용자 토큰으로 캘린더 이벤트 생성
   */
  private async createCalendarEventWithUserToken(userId: string, event: CalendarEvent): Promise<{ success: boolean; eventId?: string; error?: any }> {
    try {
      console.log('📅 사용자 캘린더 API 호출 시작');
      
      // 사용자 토큰 가져오기
      const userToken = getUserToken(userId);
      if (!userToken) {
        throw new Error('사용자 토큰을 찾을 수 없습니다.');
      }
      
      // 사용자 이메일 조회
      const userEmail = await this.getUserEmailWithUserToken(userToken.accessToken);
      console.log('- 사용자 이메일:', userEmail);
      
      // LINE WORKS Calendar API v1.0 endpoint
      const endpoint = `https://www.worksapis.com/v1.0/users/${userEmail}/calendars/primary/events`;
      console.log('- API Endpoint:', endpoint);

      const response = await axios.post(endpoint, event, {
        headers: {
          'Authorization': `Bearer ${userToken.accessToken}`,
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
        status: error.response?.status
      });
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  /**
   * 사용자 토큰으로 이메일 조회
   */
  private async getUserEmailWithUserToken(accessToken: string): Promise<string> {
    try {
      const response = await axios.get('https://www.worksapis.com/v1.0/users/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      return response.data.email;
    } catch (error) {
      console.error('사용자 정보 조회 실패:', error);
      throw error;
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