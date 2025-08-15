// src/tools/lineworks-calendar-mcp.ts (고도화된 파서 통합 버전)
import axios from 'axios';
import { LineWorksAuth } from '../config/lineworks-auth.js';
import { AdvancedCalendarParser } from '../utils/nlp-calendar-parser.js';

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

class LineWorksCalendarMCP {
  private auth: LineWorksAuth;
  private parser: AdvancedCalendarParser;

  constructor() {
    this.auth = new LineWorksAuth();
    this.parser = new AdvancedCalendarParser();
  }

  /**
   * MCP에서 고도화된 캘린더 일정 생성
   */
  async createCalendarEvent(args: CalendarEventRequest): Promise<any> {
    try {
      console.log('📅 고도화된 MCP 캘린더 일정 생성 시작');
      console.log('- Request:', args);

      // 1. 고도화된 자연어 파싱
      const parsed = this.parser.parseCalendarText(args.text);
      if (!parsed) {
        return {
          success: false,
          message: '일정을 이해할 수 없습니다. 예시: "다음 주 화요일 오후 3시에 강남 스타벅스에서 김대리와 중요한 프로젝트 회의, 30분 전 알림"'
        };
      }

      console.log('- 고도화된 파싱 결과:', parsed);

      // 2. 파싱 신뢰도 체크
      if (parsed.confidence < 0.3) {
        return {
          success: false,
          message: `일정 정보가 불명확합니다 (신뢰도: ${Math.round(parsed.confidence * 100)}%).\n\n더 구체적으로 말씀해주세요.\n예시: "내일 오후 2시 김과장과 회의"\n\n🔍 인식된 정보:\n${parsed.extractedInfo?.join('\n• ') || '없음'}`,
          confidence: parsed.confidence,
          extractedInfo: parsed.extractedInfo
        };
      }

      // 3. 고도화된 캘린더 이벤트 생성
      const calendarEvent = this.convertToEnhancedCalendarEvent(parsed);
      console.log('- 고도화된 캘린더 이벤트:', calendarEvent);

      // 4. LINE WORKS 캘린더 API 호출
      const result = await this.createEnhancedEventWithBasicCalendar(args.userId, calendarEvent);
      
      if (result.success) {
        return {
          success: true,
          message: this.formatEnhancedSuccessMessage(parsed),
          eventId: result.eventId,
          event: calendarEvent,
          parsedInfo: {
            confidence: parsed.confidence,
            extractedInfo: parsed.extractedInfo,
            attendees: parsed.attendees,
            meetingType: parsed.meetingType,
            priority: parsed.priority,
            preparation: parsed.preparation
          }
        };
      } else {
        return {
          success: false,
          message: 'LINE WORKS 캘린더 일정 생성에 실패했습니다.',
          error: result.error,
          parsedInfo: parsed
        };
      }

    } catch (error) {
      console.error('❌ 고도화된 MCP 캘린더 오류:', error);
      return {
        success: false,
        message: '일정 처리 중 오류가 발생했습니다.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 고도화된 기본 캘린더에 이벤트 생성
   */
  private async createEnhancedEventWithBasicCalendar(userId: string, event: EnhancedCalendarEvent): Promise<{ success: boolean; eventId?: string; error?: any }> {
    try {
      console.log('📅 고도화된 MCP 캘린더 일정 생성 시작 (올바른 API 형식)');

      // Service Account 토큰 획득
      const accessToken = await this.auth.getAccessTokenWithCalendarScope();
      console.log('✅ LINE WORKS 캘린더 Access Token 발급 성공');

      // 기본 캘린더 엔드포인트
      const endpoint = `https://www.worksapis.com/v1.0/users/${userId}/calendar/events`;
      console.log('- API Endpoint:', endpoint);
      console.log('- User ID:', userId);

      // 고도화된 설명 생성
      const enhancedDescription = this.generateDetailedDescription(event);

      // 고도화된 제목 생성
      const enhancedSummary = this.generateEnhancedSummary(event);

      // LINE WORKS API 요청 데이터
      const eventData = {
        eventComponents: [
          {
            eventId: `claude-enhanced-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            summary: enhancedSummary,
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
            visibility: this.determineVisibility(event.priority, event.meetingType),
            sequence: 1,
            reminders: event.reminder ? [
              {
                method: 'DISPLAY',
                trigger: `-PT${event.reminder.remindBefore}M`
              }
            ] : [],
            priority: this.getPriorityLevel(event.priority)
          }
        ],
        sendNotification: true // 고도화된 일정은 알림 활성화
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
        eventId: response.data.eventComponents?.[0]?.eventId || response.data.returnValue || 'success'
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
      summary: parsed.title,
      startDateTime: formatDateTime(startDate),
      endDateTime: formatDateTime(endDate),
      location: parsed.location,
      isAllDay: false,
      visibility: this.determineVisibility(parsed.priority, parsed.meetingType),
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
   * 고도화된 제목 생성 (아이콘 포함)
   */
  private generateEnhancedSummary(event: EnhancedCalendarEvent): string {
    let summary = event.summary;

    // 우선순위 아이콘
    if (event.priority === 'high') {
      summary = `🔴 ${summary}`;
    } else if (event.priority === 'low') {
      summary = `🟢 ${summary}`;
    }

    // 회의 유형 아이콘
    switch (event.meetingType) {
      case 'client':
        summary = `🤝 ${summary}`;
        break;
      case 'presentation':
        summary = `📊 ${summary}`;
        break;
      case 'training':
        summary = `📚 ${summary}`;
        break;
      case 'interview':
        summary = `💼 ${summary}`;
        break;
      case 'internal':
        summary = `🏢 ${summary}`;
        break;
    }

    // 참석자 수 표시
    if (event.attendees && event.attendees.length > 0) {
      summary += ` (${event.attendees.length}명)`;
    }

    return summary;
  }

  /**
   * 상세한 설명 생성
   */
  private generateDetailedDescription(event: EnhancedCalendarEvent): string {
    let description = '🤖 Claude MCP 고도화된 일정 등록\n\n';

    // 회의 정보
    if (event.meetingType) {
      const typeNames = {
        internal: '🏢 내부 회의',
        client: '🤝 고객 미팅',
        presentation: '📊 프레젠테이션',
        training: '📚 교육/훈련',
        interview: '💼 면접',
        general: '📋 일반 회의'
      };
      description += `${typeNames[event.meetingType]}\n`;
    }

    if (event.priority) {
      const priorityNames = {
        high: '🔴 높은 우선순위',
        medium: '🟡 보통 우선순위',
        low: '🟢 낮은 우선순위'
      };
      description += `${priorityNames[event.priority]}\n`;
    }

    description += '\n';

    // 참석자 정보
    if (event.attendees && event.attendees.length > 0) {
      description += `👥 참석자:\n`;
      event.attendees.forEach(attendee => {
        description += `  • ${attendee}\n`;
      });
      description += '\n';
    }

    // 준비물
    if (event.preparation && event.preparation.length > 0) {
      description += `📝 준비물:\n`;
      event.preparation.forEach(item => {
        description += `  • ${item}\n`;
      });
      description += '\n';
    }

    // 반복 일정
    if (event.isRecurring && event.recurringPattern) {
      const recurringNames = {
        daily: '매일',
        weekly: '매주',
        monthly: '매월',
        yearly: '매년'
      };
      description += `🔄 반복: ${recurringNames[event.recurringPattern as keyof typeof recurringNames] || event.recurringPattern}\n\n`;
    }

    // 분석 정보
    if (event.confidence) {
      description += `📊 AI 분석 신뢰도: ${Math.round(event.confidence * 100)}%\n`;
    }

    if (event.extractedInfo && event.extractedInfo.length > 0) {
      description += `\n🔍 인식된 정보:\n`;
      event.extractedInfo.forEach(info => {
        description += `  • ${info}\n`;
      });
    }

    description += `\n⏰ 등록 시간: ${new Date().toLocaleString('ko-KR')}`;

    return description;
  }

  /**
   * 우선순위에 따른 가시성 결정
   */
  private determineVisibility(priority?: string, meetingType?: string): 'PUBLIC' | 'PRIVATE' {
    // 높은 우선순위나 고객 미팅은 공개
    if (priority === 'high' || meetingType === 'client') {
      return 'PUBLIC';
    }
    return 'PRIVATE';
  }

  /**
   * 우선순위 레벨 변환
   */
  private getPriorityLevel(priority?: string): number {
    switch (priority) {
      case 'high': return 1;
      case 'low': return 9;
      default: return 5;
    }
  }

  /**
   * 고도화된 성공 메시지 포맷팅
   */
  private formatEnhancedSuccessMessage(parsed: any): string {
    let message = `✅ 고도화된 AI로 LINE WORKS 캘린더에 일정을 등록했습니다!\n\n`;
    
    // 기본 정보
    message += `📅 날짜: ${parsed.date}\n`;
    message += `⏰ 시간: ${parsed.time}\n`;
    message += `📌 제목: ${parsed.title}\n`;
    
    // 고도화된 정보
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
      const recurringNames = {
        daily: '매일',
        weekly: '매주',
        monthly: '매월',
        yearly: '매년'
      };
      message += `🔄 반복: ${recurringNames[parsed.recurringPattern as keyof typeof recurringNames] || parsed.recurringPattern}\n`;
    }

    // AI 분석 정보
    message += `\n🤖 AI 분석 결과:`;
    message += `\n📊 신뢰도: ${Math.round(parsed.confidence * 100)}%`;
    
    if (parsed.extractedInfo && parsed.extractedInfo.length > 0) {
      message += `\n🔍 인식된 정보:\n${parsed.extractedInfo.map((info: string) => `  • ${info}`).join('\n')}`;
    }
    
    return message;
  }

  /**
   * 고도화된 일정 조회
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

      // 이벤트 고도화 처리
      const events = response.data.eventComponents || response.data.events || [];
      const enhancedEvents = this.enhanceRetrievedEvents(events);

      return {
        success: true,
        events: enhancedEvents,
        summary: this.generateEventsSummary(enhancedEvents)
      };

    } catch (error) {
      console.error('고도화된 일정 조회 오류:', error);
      return {
        success: false,
        events: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 조회된 이벤트 고도화
   */
  private enhanceRetrievedEvents(events: any[]): any[] {
    return events.map(event => {
      // 제목에서 정보 추출
      const { cleanTitle, priority, meetingType } = this.parseEventTitle(event.summary);
      
      // 설명에서 추가 정보 추출
      const enhancedInfo = this.parseEventDescription(event.description);
      
      return {
        ...event,
        summary: cleanTitle,
        originalSummary: event.summary,
        priority,
        meetingType,
        ...enhancedInfo,
        displaySummary: this.formatEventForDisplay(event, priority, meetingType)
      };
    });
  }

  /**
   * 이벤트 제목 파싱
   */
  private parseEventTitle(title: string): { cleanTitle: string; priority?: string; meetingType?: string } {
    if (!title) return { cleanTitle: '제목 없음' };

    let cleanTitle = title;
    let priority: string | undefined;
    let meetingType: string | undefined;

    // 우선순위 파싱
    if (title.includes('🔴')) {
      priority = 'high';
      cleanTitle = cleanTitle.replace(/🔴\s*/g, '');
    } else if (title.includes('🟢')) {
      priority = 'low';
      cleanTitle = cleanTitle.replace(/🟢\s*/g, '');
    }

    // 회의 유형 파싱
    if (title.includes('🤝')) {
      meetingType = 'client';
      cleanTitle = cleanTitle.replace(/🤝\s*/g, '');
    } else if (title.includes('📊')) {
      meetingType = 'presentation';
      cleanTitle = cleanTitle.replace(/📊\s*/g, '');
    } else if (title.includes('📚')) {
      meetingType = 'training';
      cleanTitle = cleanTitle.replace(/📚\s*/g, '');
    } else if (title.includes('💼')) {
      meetingType = 'interview';
      cleanTitle = cleanTitle.replace(/💼\s*/g, '');
    } else if (title.includes('🏢')) {
      meetingType = 'internal';
      cleanTitle = cleanTitle.replace(/🏢\s*/g, '');
    }

    return { cleanTitle: cleanTitle.trim(), priority, meetingType };
  }

  /**
   * 이벤트 설명 파싱
   */
  private parseEventDescription(description?: string): any {
    if (!description) return {};

    const info: any = {};

    // 참석자 추출
    const attendeesMatch = description.match(/👥 참석자:\n((?:\s*•\s*.+\n?)*)/);
    if (attendeesMatch) {
      info.attendees = attendeesMatch[1].split('\n').filter(line => line.trim()).map(line => line.replace(/\s*•\s*/, ''));
    }

    // 준비물 추출
    const preparationMatch = description.match(/📝 준비물:\n((?:\s*•\s*.+\n?)*)/);
    if (preparationMatch) {
      info.preparation = preparationMatch[1].split('\n').filter(line => line.trim()).map(line => line.replace(/\s*•\s*/, ''));
    }

    // 신뢰도 추출
    const confidenceMatch = description.match(/📊 AI 분석 신뢰도: (\d+)%/);
    if (confidenceMatch) {
      info.confidence = parseInt(confidenceMatch[1]) / 100;
    }

    return info;
  }

  /**
   * 표시용 이벤트 포맷팅
   */
  private formatEventForDisplay(event: any, priority?: string, meetingType?: string): string {
    const startTime = new Date(event.start?.dateTime || event.startDateTime);
    const timeStr = startTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    
    let display = `${timeStr} - ${event.summary}`;
    
    if (event.location) {
      display += ` (📍 ${event.location})`;
    }
    
    if (priority === 'high') {
      display = `🔴 ${display}`;
    } else if (priority === 'low') {
      display = `🟢 ${display}`;
    }
    
    return display;
  }

  /**
   * 이벤트 요약 생성
   */
  private generateEventsSummary(events: any[]): string {
    if (events.length === 0) {
      return '📅 등록된 일정이 없습니다.';
    }

    const high = events.filter(e => e.priority === 'high').length;
    const client = events.filter(e => e.meetingType === 'client').length;
    const internal = events.filter(e => e.meetingType === 'internal').length;

    let summary = `📊 일정 요약: 총 ${events.length}개`;
    
    if (high > 0) summary += `, 중요 ${high}개`;
    if (client > 0) summary += `, 고객미팅 ${client}개`;
    if (internal > 0) summary += `, 내부회의 ${internal}개`;

    return summary;
  }
}

// MCP 도구 정의 (고도화된 버전)
export const lineWorksCalendarTool = {
  name: 'lineworks_calendar',
  description: 'LINE WORKS 캘린더에 고도화된 AI 파싱으로 일정을 생성하거나 조회합니다. 자연어로 입력된 복잡한 일정 정보를 분석하여 참석자, 회의유형, 우선순위, 준비물 등을 자동으로 추출하고 저장합니다.',
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
        description: '자연어로 입력된 일정 내용 (예: "다음 주 화요일 오후 3시에 강남 스타벅스에서 김대리와 중요한 프로젝트 회의, 30분 전 알림")'
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