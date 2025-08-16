// src/tools/services/lineworks-calendar-service.ts (사용자 관리 통합 버전)
import axios from 'axios';
import { LineWorksAuth } from '../../config/lineworks-auth.js';
import { AdvancedCalendarParser } from '../../utils/nlp-calendar-parser.js';
import { userService } from '../../models/user-model.js';

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
   * 사용자 관리 시스템이 통합된 일정 생성
   */
  async createCalendarEvent(args: CalendarEventRequest): Promise<{ 
    success: boolean; 
    message: string; 
    eventId?: string; 
    parsedInfo?: any;
    userInfo?: any;
    needAuth?: boolean 
  }> {
    try {
      console.log('📅 사용자 관리 통합 캘린더 일정 생성 시작');
      console.log('- userId:', args.userId);
      console.log('- text:', args.text);
      
      // 1. 사용자 정보 조회
      const userProfile = await userService.getUserByLineWorksId(args.userId);
      console.log('- 사용자 정보:', userProfile);
      
      if (!userProfile) {
        return {
          success: false,
          message: '사용자 정보를 찾을 수 없습니다. 관리자에게 문의하세요.',
          needAuth: true
        };
      }

      // 2. 고도화된 자연어 파싱
      const parsedEvent = this.parser.parseCalendarText(args.text);
      console.log('- 고도화된 파싱 결과:', parsedEvent);
      
      if (!parsedEvent) {
        return {
          success: false,
          message: '일정을 이해할 수 없습니다. 예시: "내일 오후 2시에 강남 스타벅스에서 김대리와 중요한 프로젝트 회의"'
        };
      }

      // 3. 파싱 신뢰도 체크
      if (parsedEvent.confidence < 0.3) {
        return {
          success: false,
          message: `일정 정보가 불명확합니다 (신뢰도: ${Math.round(parsedEvent.confidence * 100)}%). 더 구체적으로 말씀해주세요.\n예시: "내일 오후 2시 김과장과 회의"`
        };
      }

      // 4. 고도화된 캘린더 이벤트 생성
      const calendarEvent = await this.convertToEnhancedCalendarEventWithUserData(parsedEvent, userProfile);
      console.log('- 사용자 정보가 포함된 캘린더 이벤트:', JSON.stringify(calendarEvent, null, 2));

      // 5. LINE WORKS Calendar API 호출
      const result = await this.createEventWithUserManagement(args.userId, calendarEvent, userProfile);
      console.log('- API 결과:', result);

      if (result.success) {
        return {
          success: true,
          message: this.formatEnhancedSuccessMessage(parsedEvent, userProfile),
          eventId: result.eventId,
          parsedInfo: parsedEvent,
          userInfo: {
            name: userProfile.name,
            email: userProfile.email,
            department: userProfile.department,
            position: userProfile.position
          }
        };
      } else {
        return {
          success: false,
          message: 'LINE WORKS 캘린더 일정 생성에 실패했습니다.'
        };
      }

    } catch (error) {
      console.error('❌ 사용자 관리 통합 캘린더 오류:', error);
      return {
        success: false,
        message: '일정 처리 중 오류가 발생했습니다.'
      };
    }
  }

  /**
   * 사용자 정보를 활용한 LINE WORKS Calendar API 호출
   */
  private async createEventWithUserManagement(userId: string, event: EnhancedCalendarEvent, userProfile: any): Promise<{ success: boolean; eventId?: string; error?: any }> {
    try {
      console.log('📅 사용자 관리 통합 LINE WORKS Calendar API 호출');

      // Service Account 토큰 획득
      const accessToken = await this.auth.getAccessTokenWithCalendarScope();
      console.log('✅ LINE WORKS 캘린더 Access Token 발급 성공');

      // 사용자별 캘린더 엔드포인트 (기본 캘린더 또는 지정된 캘린더)
      const calendarId = userProfile.calendarId || 'primary'; // 기본 캘린더
      const endpoint = userProfile.calendarId 
        ? `https://www.worksapis.com/v1.0/users/${userId}/calendars/${calendarId}/events`
        : `https://www.worksapis.com/v1.0/users/${userId}/calendar/events`;
      
      console.log('- API Endpoint:', endpoint);
      console.log('- User Profile:', userProfile.name, userProfile.email);

      // 사용자 정보가 포함된 고도화된 설명 생성
      const enhancedDescription = await this.generateUserAwareDescription(event, userProfile);

      // LINE WORKS Calendar API 요청 데이터 (안전한 속성만 사용)
      const eventData = {
        eventComponents: [
          {
            eventId: `claude-${userProfile.name}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
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
            transparency: 'OPAQUE'
            // 문제가 되는 속성들 제거:
            // - visibility (일부 환경에서 지원 안됨)
            // - sequence 
            // - priority
            // - attendees (참석자 정보는 description에 포함)
            // - reminders (알림 정보는 description에 포함)
            // - organizer (지원되지 않음)
          }
        ]
        // sendNotification도 제거
      };

      console.log('- 요청 데이터:', JSON.stringify(eventData, null, 2));

      // API 호출
      const response = await axios.post(endpoint, eventData, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('✅ 사용자 관리 통합 LINE WORKS 캘린더 API 성공:', response.data);
      return {
        success: true,
        eventId: response.data.eventComponents?.[0]?.eventId || 'success'
      };

    } catch (error: any) {
      console.error('❌ 사용자 관리 통합 LINE WORKS 캘린더 API 오류:', {
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
   * 사용자 정보를 활용한 캘린더 이벤트 변환
   */
  private async convertToEnhancedCalendarEventWithUserData(parsed: any, userProfile: any): Promise<EnhancedCalendarEvent> {
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
   * 사용자 정보가 포함된 상세 설명 생성 (모든 정보 포함)
   */
  private async generateUserAwareDescription(event: EnhancedCalendarEvent, userProfile: any): Promise<string> {
    let description = `🤖 Claude MCP 스마트 일정 등록\n`;
    description += `👤 등록자: ${userProfile.name}${userProfile.position} (${userProfile.department})\n`;
    description += `📧 연락처: ${userProfile.email}\n\n`;

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

    // 참석자 정보 (description에 포함)
    if (event.attendees && event.attendees.length > 0) {
      description += `👥 참석자:\n`;
      
      // 사용자 데이터베이스에서 실제 정보 조회하여 표시
      for (const attendeeName of event.attendees) {
        description += `  • ${attendeeName}`;
        
        // 실제 이메일도 description에 표시
        try {
          const email = await userService.generateEmailForAttendee(attendeeName);
          description += ` (${email})`;
        } catch (error) {
          // 오류 시 기본 이메일 표시
          const cleanName = attendeeName.replace(/[팀장|과장|차장|부장|대리|사원|님|씨]/g, '');
          description += ` (${cleanName}@anyractive.co.kr)`;
        }
        description += '\n';
      }
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

    // 알림 정보 (description에 포함)
    if (event.reminder) {
      description += `🔔 알림: ${event.reminder.remindBefore}분 전\n\n`;
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

    // AI 분석 정보
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
    description += `\n🏢 등록 부서: ${userProfile.department}`;

    return description;
  }

  /**
   * 사용자 데이터베이스를 활용한 참석자 정보 포맷팅
   */
  private async formatAttendeesWithUserData(attendees?: string[], organizer?: any): Promise<any[]> {
    if (!attendees || attendees.length === 0) return [];

    const formattedAttendees = [];

    for (const attendeeName of attendees) {
      try {
        // 사용자 관리 시스템에서 실제 이메일 조회
        const email = await userService.generateEmailForAttendee(attendeeName);
        
        formattedAttendees.push({
          email: email,
          displayName: attendeeName,
          partstat: 'NEEDS-ACTION',
          isOptional: false,
          isResource: false
        });
      } catch (error) {
        console.error(`참석자 ${attendeeName} 정보 조회 오류:`, error);
        // 오류 시 기본 형식 사용
        const cleanName = attendeeName.replace(/[팀장|과장|차장|부장|대리|사원|님|씨]/g, '');
        formattedAttendees.push({
          email: `${cleanName}@anyractive.co.kr`,
          displayName: attendeeName,
          partstat: 'NEEDS-ACTION',
          isOptional: false,
          isResource: false
        });
      }
    }

    return formattedAttendees;
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
   * 우선순위 레벨 변환 (0-9)
   */
  private getPriorityLevel(priority?: string): number {
    switch (priority) {
      case 'high': return 1;
      case 'medium': return 5;
      case 'low': return 8;
      default: return 0;
    }
  }

  /**
   * 알림 정보 포맷팅
   */
  private formatReminders(reminder?: { remindBefore: number }): any[] {
    if (!reminder) return [];

    return [
      {
        method: 'DISPLAY',
        trigger: `-PT${reminder.remindBefore}M`
      }
    ];
  }

  /**
   * 사용자 정보가 포함된 성공 메시지 포맷팅 (개선된 버전)
   */
  private formatEnhancedSuccessMessage(parsed: any, userProfile: any): string {
    // 사용자 이름 표시 개선
    const userName = userProfile.name === userProfile.lineWorksUserId 
      ? userProfile.displayName || '미등록 사용자'
      : userProfile.name;
    
    let message = `✅ ${userName}${userProfile.position}님의 일정이 등록되었습니다!\n\n`;
    
    // 기본 정보
    message += `📅 날짜: ${parsed.date}\n`;
    message += `⏰ 시간: ${parsed.time}\n`;
    message += `📌 제목: ${parsed.title}\n`;
    message += `👤 등록자: ${userProfile.department} ${userName}${userProfile.position}\n`;
    
    // 사용자 등록 상태 안내
    if (userProfile.id.startsWith('default-')) {
      message += `⚠️ 미등록 사용자입니다. 관리자에게 사용자 등록을 요청하세요.\n`;
    }
    
    // 추가 정보
    if (parsed.location) {
      message += `📍 장소: ${parsed.location}\n`;
    }
    
    // 참석자 정보 (실제 이메일과 함께)
    if (parsed.attendees && parsed.attendees.length > 0) {
      message += `👥 참석자: ${parsed.attendees.join(', ')}\n`;
      message += `📧 참석자 알림: 사용자 데이터베이스의 실제 이메일로 발송됩니다\n`;
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

    // AI 분석 정보
    message += `\n🤖 AI 분석 결과:`;
    message += `\n📊 신뢰도: ${Math.round(parsed.confidence * 100)}%`;
    
    // 파싱 디버그 정보 (개발용)
    if (parsed.extractedInfo && parsed.extractedInfo.length > 0) {
      message += `\n🔍 파싱 정보: ${parsed.extractedInfo.join(', ')}`;
    }
    
    // 사용자 관리 시스템 활용 안내
    message += `\n\n💡 참석자 정보는 사용자 데이터베이스에서 자동으로 매핑되어 정확한 이메일로 알림이 전송됩니다.`;
    
    return message;
  }

  /**
   * 일정 조회 (사용자 정보 포함)
   */
  async getEvents(args: { userId: string; userEmail?: string; range: 'today' | 'week' }): Promise<any> {
    try {
      // 사용자 정보 조회
      const userProfile = await userService.getUserByLineWorksId(args.userId);
      
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

      const events = response.data.eventComponents || response.data.events || [];

      return {
        success: true,
        events: events,
        user: userProfile ? {
          name: userProfile.name,
          department: userProfile.department,
          position: userProfile.position
        } : null
      };

    } catch (error) {
      console.error('사용자 관리 통합 일정 조회 오류:', error);
      return {
        success: false,
        events: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}