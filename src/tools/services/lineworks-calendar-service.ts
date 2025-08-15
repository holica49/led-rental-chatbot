// src/tools/services/lineworks-calendar-service.ts (고도화된 파서 통합 버전)
import axios from 'axios';
import { LineWorksAuth } from '../../config/lineworks-auth.js';
import { AdvancedCalendarParser } from '../../utils/nlp-calendar-parser.js';

interface CalendarEventRequest {
  userId: string;
  text: string;
  userEmail?: string;
}

interface EnhancedCalendarEvent {
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
  // 고도화된 정보
  attendees?: string[];
  meetingType?: 'internal' | 'client' | 'presentation' | 'training' | 'interview' | 'general';
  priority?: 'high' | 'medium' | 'low';
  preparation?: string[];
  isRecurring?: boolean;
  recurringPattern?: string;
  confidence?: number;
  extractedInfo?: string[];
}

export class LineWorksCalendarService {
  private auth: LineWorksAuth;
  private parser: AdvancedCalendarParser;

  constructor() {
    this.auth = new LineWorksAuth();
    this.parser = new AdvancedCalendarParser();
  }

  /**
   * 고도화된 자연어로 일정 생성
   */
  async createCalendarEvent(args: CalendarEventRequest): Promise<{ 
    success: boolean; 
    message: string; 
    eventId?: string; 
    parsedInfo?: any;
    needAuth?: boolean 
  }> {
    try {
      console.log('📅 고도화된 MCP 캘린더 일정 생성 시작');
      console.log('- userId:', args.userId);
      console.log('- text:', args.text);
      
      // 1. 고도화된 자연어 파싱
      const parsedEvent = this.parser.parseCalendarText(args.text);
      console.log('- 고도화된 파싱 결과:', parsedEvent);
      
      if (!parsedEvent) {
        return {
          success: false,
          message: '일정을 이해할 수 없습니다. 예시: "내일 오후 2시에 강남 스타벅스에서 김대리와 중요한 프로젝트 회의"'
        };
      }

      // 2. 파싱 신뢰도 체크
      if (parsedEvent.confidence < 0.3) {
        return {
          success: false,
          message: `일정 정보가 불명확합니다 (신뢰도: ${Math.round(parsedEvent.confidence * 100)}%). 더 구체적으로 말씀해주세요.\n예시: "내일 오후 2시 회의"`
        };
      }

      // 3. 고도화된 캘린더 이벤트 생성
      const calendarEvent = this.convertToEnhancedCalendarEvent(parsedEvent);
      console.log('- 고도화된 캘린더 이벤트:', JSON.stringify(calendarEvent, null, 2));

      // 4. LINE WORKS Calendar API 호출
      const result = await this.createEventWithCorrectAPI(args.userId, calendarEvent);
      console.log('- API 결과:', result);

      if (result.success) {
        return {
          success: true,
          message: this.formatEnhancedSuccessMessage(parsedEvent),
          eventId: result.eventId,
          parsedInfo: parsedEvent
        };
      } else {
        return {
          success: false,
          message: 'LINE WORKS 캘린더 일정 생성에 실패했습니다.'
        };
      }

    } catch (error) {
      console.error('❌ 고도화된 MCP 캘린더 오류:', error);
      return {
        success: false,
        message: '일정 처리 중 오류가 발생했습니다.'
      };
    }
  }

  /**
   * LINE WORKS Calendar API로 이벤트 생성 (고도화된 정보 포함)
   */
  private async createEventWithCorrectAPI(userId: string, event: EnhancedCalendarEvent): Promise<{ success: boolean; eventId?: string; error?: any }> {
    try {
      console.log('📅 고도화된 LINE WORKS Calendar API 호출');

      // Service Account 토큰 획득
      const accessToken = await this.auth.getAccessTokenWithCalendarScope();
      console.log('✅ LINE WORKS 캘린더 Access Token 발급 성공');

      // 기본 캘린더 사용
      const endpoint = `https://www.worksapis.com/v1.0/users/${userId}/calendar/events`;
      console.log('- API Endpoint:', endpoint);
      console.log('- User ID:', userId);

      // 고도화된 설명 생성
      const enhancedDescription = this.generateEnhancedDescription(event);

      // LINE WORKS Calendar API 요청 데이터
      const eventData = {
        eventComponents: [
          {
            eventId: `claude-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            summary: event.summary,
            description: enhancedDescription,
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
            visibility: this.getVisibilityFromPriority(event.priority),
            // 참석자 정보 (향후 확장 가능)
            organizer: {
              email: `${userId}@anyractive.co.kr`,
              displayName: 'Claude MCP'
            }
          }
        ]
      };

      console.log('- 요청 데이터:', JSON.stringify(eventData, null, 2));

      // API 호출
      const response = await axios.post(endpoint, eventData, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('✅ 고도화된 LINE WORKS 캘린더 API 성공:', response.data);
      return {
        success: true,
        eventId: response.data.eventComponents?.[0]?.eventId || 'success'
      };

    } catch (error: any) {
      console.error('❌ 고도화된 LINE WORKS 캘린더 API 오류:', {
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
   * 파싱된 이벤트를 고도화된 캘린더 이벤트로 변환
   */
  private convertToEnhancedCalendarEvent(parsed: any): EnhancedCalendarEvent {
    // 한국 시간으로 Date 객체 생성
    const startDate = new Date(`${parsed.date}T${parsed.time}:00`);
    const endDate = new Date(startDate.getTime() + (parsed.duration || 60) * 60000);
    
    // 시간 포맷팅
    const formatDateTime = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      
      return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
    };

    const event: EnhancedCalendarEvent = {
      summary: this.enhanceTitle(parsed.title, parsed.meetingType, parsed.priority),
      startDateTime: formatDateTime(startDate),
      endDateTime: formatDateTime(endDate),
      location: parsed.location,
      isAllDay: false,
      visibility: this.getVisibilityFromPriority(parsed.priority),
      // 고도화된 정보
      attendees: parsed.attendees,
      meetingType: parsed.meetingType,
      priority: parsed.priority,
      preparation: parsed.preparation,
      isRecurring: parsed.isRecurring,
      recurringPattern: parsed.recurringPattern,
      confidence: parsed.confidence,
      extractedInfo: parsed.extractedInfo
    };

    // 알림 설정
    if (parsed.reminder) {
      event.reminder = {
        remindBefore: parsed.reminder
      };
    }

    return event;
  }

  /**
   * 제목 고도화 (회의 유형, 우선순위 반영)
   */
  private enhanceTitle(title: string, meetingType?: string, priority?: string): string {
    let enhancedTitle = title;

    // 우선순위 표시
    if (priority === 'high') {
      enhancedTitle = `🔴 ${enhancedTitle}`;
    } else if (priority === 'low') {
      enhancedTitle = `🟢 ${enhancedTitle}`;
    }

    // 회의 유형 표시
    switch (meetingType) {
      case 'client':
        enhancedTitle = `🤝 ${enhancedTitle}`;
        break;
      case 'presentation':
        enhancedTitle = `📊 ${enhancedTitle}`;
        break;
      case 'training':
        enhancedTitle = `📚 ${enhancedTitle}`;
        break;
      case 'interview':
        enhancedTitle = `💼 ${enhancedTitle}`;
        break;
      case 'internal':
        enhancedTitle = `🏢 ${enhancedTitle}`;
        break;
    }

    return enhancedTitle;
  }

  /**
   * 우선순위에 따른 가시성 설정
   */
  private getVisibilityFromPriority(priority?: string): 'PUBLIC' | 'PRIVATE' {
    if (priority === 'high') return 'PUBLIC';
    return 'PRIVATE';
  }

  /**
   * 고도화된 설명 생성
   */
  private generateEnhancedDescription(event: EnhancedCalendarEvent): string {
    let description = 'Claude MCP에서 등록된 일정\n\n';

    // 기본 정보
    if (event.meetingType) {
      const typeNames = {
        internal: '내부 회의',
        client: '고객 미팅',
        presentation: '프레젠테이션',
        training: '교육/훈련',
        interview: '면접',
        general: '일반 회의'
      };
      description += `📋 회의 유형: ${typeNames[event.meetingType]}\n`;
    }

    if (event.priority) {
      const priorityNames = {
        high: '높음 🔴',
        medium: '보통 🟡',
        low: '낮음 🟢'
      };
      description += `⚡ 우선순위: ${priorityNames[event.priority]}\n`;
    }

    // 참석자 정보
    if (event.attendees && event.attendees.length > 0) {
      description += `👥 참석자: ${event.attendees.join(', ')}\n`;
    }

    // 준비물
    if (event.preparation && event.preparation.length > 0) {
      description += `📝 준비물: ${event.preparation.join(', ')}\n`;
    }

    // 반복 일정
    if (event.isRecurring && event.recurringPattern) {
      const recurringNames = {
        daily: '매일',
        weekly: '매주',
        monthly: '매월',
        yearly: '매년'
      };
      description += `🔄 반복: ${recurringNames[event.recurringPattern as keyof typeof recurringNames] || event.recurringPattern}\n`;
    }

    // 파싱 정보 (디버깅용)
    if (event.extractedInfo && event.extractedInfo.length > 0) {
      description += `\n🔍 추출된 정보:\n${event.extractedInfo.map(info => `• ${info}`).join('\n')}`;
    }

    // 신뢰도 표시
    if (event.confidence) {
      description += `\n\n📊 파싱 신뢰도: ${Math.round(event.confidence * 100)}%`;
    }

    return description;
  }

  /**
   * 고도화된 성공 메시지 포맷팅
   */
  private formatEnhancedSuccessMessage(parsed: any): string {
    let message = `✅ 고도화된 MCP로 LINE WORKS 캘린더에 일정을 등록했습니다!\n\n`;
    
    // 기본 정보
    message += `📅 날짜: ${parsed.date}\n`;
    message += `⏰ 시간: ${parsed.time}\n`;
    message += `📌 제목: ${parsed.title}\n`;
    
    // 추가 정보
    if (parsed.location) {
      message += `📍 장소: ${parsed.location}\n`;
    }
    
    if (parsed.attendees && parsed.attendees.length > 0) {
      message += `👥 참석자: ${parsed.attendees.join(', ')}\n`;
    }
    
    if (parsed.meetingType && parsed.meetingType !== 'general') {
      const typeNames = {
        internal: '내부 회의',
        client: '고객 미팅', 
        presentation: '프레젠테이션',
        training: '교육/훈련',
        interview: '면접'
      };
      message += `📋 유형: ${typeNames[parsed.meetingType as keyof typeof typeNames]}\n`;
    }
    
    if (parsed.priority && parsed.priority !== 'medium') {
      const priorityNames = {
        high: '높음 🔴',
        low: '낮음 🟢'
      };
      message += `⚡ 우선순위: ${priorityNames[parsed.priority as keyof typeof priorityNames]}\n`;
    }
    
    if (parsed.reminder) {
      message += `🔔 알림: ${parsed.reminder}분 전\n`;
    }
    
    if (parsed.preparation && parsed.preparation.length > 0) {
      message += `📝 준비물: ${parsed.preparation.join(', ')}\n`;
    }
    
    if (parsed.isRecurring) {
      message += `🔄 반복 일정: ${parsed.recurringPattern}\n`;
    }

    // 신뢰도와 추출 정보
    message += `\n📊 파싱 신뢰도: ${Math.round(parsed.confidence * 100)}%`;
    
    if (parsed.extractedInfo && parsed.extractedInfo.length > 0) {
      message += `\n\n🔍 인식된 정보:\n${parsed.extractedInfo.map((info: string) => `• ${info}`).join('\n')}`;
    }
    
    return message;
  }

  /**
   * 일정 조회 (고도화된 정보 포함)
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

      // 이벤트 정보 고도화
      const enhancedEvents = this.enhanceEventList(response.data.eventComponents || response.data.events || []);

      return {
        success: true,
        events: enhancedEvents
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

  /**
   * 이벤트 목록 고도화 (아이콘, 우선순위 표시)
   */
  private enhanceEventList(events: any[]): any[] {
    return events.map(event => {
      // 제목에서 아이콘과 우선순위 파싱
      const { cleanTitle, priority, meetingType } = this.parseEnhancedTitle(event.summary);
      
      return {
        ...event,
        summary: cleanTitle,
        originalSummary: event.summary,
        priority,
        meetingType,
        enhancedInfo: this.extractEnhancedInfoFromDescription(event.description)
      };
    });
  }

  /**
   * 제목에서 고도화된 정보 파싱
   */
  private parseEnhancedTitle(title: string): { cleanTitle: string; priority?: string; meetingType?: string } {
    let cleanTitle = title;
    let priority: string | undefined;
    let meetingType: string | undefined;

    // 우선순위 파싱
    if (title.includes('🔴')) {
      priority = 'high';
      cleanTitle = cleanTitle.replace('🔴', '').trim();
    } else if (title.includes('🟢')) {
      priority = 'low';
      cleanTitle = cleanTitle.replace('🟢', '').trim();
    }

    // 회의 유형 파싱
    if (title.includes('🤝')) {
      meetingType = 'client';
      cleanTitle = cleanTitle.replace('🤝', '').trim();
    } else if (title.includes('📊')) {
      meetingType = 'presentation';
      cleanTitle = cleanTitle.replace('📊', '').trim();
    } else if (title.includes('📚')) {
      meetingType = 'training';
      cleanTitle = cleanTitle.replace('📚', '').trim();
    } else if (title.includes('💼')) {
      meetingType = 'interview';
      cleanTitle = cleanTitle.replace('💼', '').trim();
    } else if (title.includes('🏢')) {
      meetingType = 'internal';
      cleanTitle = cleanTitle.replace('🏢', '').trim();
    }

    return { cleanTitle, priority, meetingType };
  }

  /**
   * 설명에서 고도화된 정보 추출
   */
  private extractEnhancedInfoFromDescription(description?: string): any {
    if (!description) return {};

    const info: any = {};

    // 참석자 추출
    const attendeesMatch = description.match(/👥 참석자: (.+)/);
    if (attendeesMatch) {
      info.attendees = attendeesMatch[1].split(', ');
    }

    // 준비물 추출
    const preparationMatch = description.match(/📝 준비물: (.+)/);
    if (preparationMatch) {
      info.preparation = preparationMatch[1].split(', ');
    }

    // 신뢰도 추출
    const confidenceMatch = description.match(/📊 파싱 신뢰도: (\d+)%/);
    if (confidenceMatch) {
      info.confidence = parseInt(confidenceMatch[1]) / 100;
    }

    return info;
  }
}