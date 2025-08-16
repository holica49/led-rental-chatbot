// src/utils/nlp-calendar-parser.ts (고도화된 버전으로 교체)

interface ParsedEvent {
  // 기본 정보
  title: string;
  date: string;
  time: string;
  duration: number;
  
  // 고도화된 정보
  location?: string;
  attendees?: string[];
  meetingType?: 'internal' | 'client' | 'presentation' | 'training' | 'interview' | 'general';
  priority?: 'high' | 'medium' | 'low';
  preparation?: string[];
  reminder?: number;
  notes?: string;
  isRecurring?: boolean;
  recurringPattern?: string;
  
  // 메타데이터
  confidence: number; // 파싱 신뢰도 (0-1)
  extractedInfo: string[]; // 추출된 정보 목록
}

export class AdvancedCalendarParser {
  // 날짜 관련 패턴
  private datePatterns = {
    relative: {
      '오늘': 0,
      '내일': 1,
      '모레': 2,
      '글피': 3,
      '이번주': 0,
      '다음주': 7,
      '다다음주': 14
    } as Record<string, number>,
    weekdays: {
      '월요일': 1, '월': 1,
      '화요일': 2, '화': 2,
      '수요일': 3, '수': 3,
      '목요일': 4, '목': 4,
      '금요일': 5, '금': 5,
      '토요일': 6, '토': 6,
      '일요일': 0, '일': 0
    } as Record<string, number>
  };

  // 시간 관련 패턴
  private timePatterns = {
    ampm: /(오전|오후|아침|저녁|밤)\s*(\d{1,2})시?\s*(\d{1,2}분?)?/g,
    hour24: /(\d{1,2}):(\d{2})/g,
    rough: /(아침|점심|오후|저녁|밤)/g
  };

  // 장소 관련 패턴
  private locationPatterns = {
    office: /(회의실|사무실|본사|지사|회사)/,
    external: /(카페|스타벅스|레스토랑|호텔|빌딩)/,
    virtual: /(줌|zoom|팀즈|teams|화상|온라인)/i
  };

  // 참석자 관련 패턴
  private attendeePatterns = {
    names: /([가-힣]{2,4})\s*(대리|과장|차장|부장|팀장|이사|사장|님|씨)/g,
    departments: /(개발팀|마케팅팀|영업팀|기획팀|디자인팀|인사팀)/g,
    external: /(고객|클라이언트|업체|파트너)/
  };

  // 회의 유형 패턴
  private meetingTypePatterns = {
    internal: /(회의|미팅|논의|브리핑|보고|검토)/,
    client: /(고객|클라이언트|상담|제안|프레젠테이션)/,
    presentation: /(발표|프레젠테이션|시연|데모)/,
    training: /(교육|훈련|세미나|워크샵)/,
    interview: /(면접|인터뷰)/
  };

  // 우선순위 패턴
  private priorityPatterns = {
    high: /(중요|긴급|urgent|asap|반드시)/i,
    low: /(가벼운|간단한|짧은)/
  };

  // 반복 패턴
  private recurringPatterns = {
    daily: /(매일|daily)/i,
    weekly: /(매주|weekly)/i,
    monthly: /(매월|monthly)/i,
    yearly: /(매년|yearly)/i
  };

  /**
   * 고도화된 자연어 파싱
   */
  public parseCalendarText(text: string): ParsedEvent | undefined {
    console.log('🔍 고도화된 자연어 파싱 시작:', text);

    try {
      const extractedInfo: string[] = [];
      let confidence = 0;

      // 1. 기본 날짜/시간 추출
      const dateTime = this.extractDateTime(text);
      if (!dateTime) {
        console.log('❌ 날짜/시간을 찾을 수 없습니다.');
        return undefined;
      }
      extractedInfo.push(`날짜: ${dateTime.date}`, `시간: ${dateTime.time}`);
      confidence += 0.4;

      // 2. 제목 추출
      const title = this.extractTitle(text);
      extractedInfo.push(`제목: ${title}`);
      confidence += 0.2;

      // 3. 장소 추출
      const location = this.extractLocation(text);
      if (location) {
        extractedInfo.push(`장소: ${location}`);
        confidence += 0.1;
      }

      // 4. 참석자 추출
      const attendees = this.extractAttendees(text);
      if (attendees.length > 0) {
        extractedInfo.push(`참석자: ${attendees.join(', ')}`);
        confidence += 0.1;
      }

      // 5. 회의 유형 판단
      const meetingType = this.determineMeetingType(text);
      if (meetingType) {
        extractedInfo.push(`회의 유형: ${meetingType}`);
        confidence += 0.05;
      }

      // 6. 우선순위 판단
      const priority = this.determinePriority(text);
      if (priority) {
        extractedInfo.push(`우선순위: ${priority}`);
        confidence += 0.05;
      }

      // 7. 알림 시간 추출
      const reminder = this.extractReminder(text);
      if (reminder) {
        extractedInfo.push(`알림: ${reminder}분 전`);
        confidence += 0.05;
      }

      // 8. 반복 패턴 추출
      const recurring = this.extractRecurring(text);
      if (recurring) {
        extractedInfo.push(`반복: ${recurring}`);
        confidence += 0.05;
      }

      // 9. 준비물 추출
      const preparation = this.extractPreparation(text);
      if (preparation.length > 0) {
        extractedInfo.push(`준비물: ${preparation.join(', ')}`);
      }

      // 10. 기간 추출
      const duration = this.extractDuration(text);

      const result: ParsedEvent = {
        title,
        date: dateTime.date,
        time: dateTime.time,
        duration,
        location: location || undefined,
        attendees,
        meetingType,
        priority,
        reminder: reminder || undefined,
        preparation,
        isRecurring: !!recurring,
        recurringPattern: recurring || undefined,
        notes: this.extractNotes(text) || undefined,
        confidence: Math.min(confidence, 1.0),
        extractedInfo
      };

      console.log('✅ 파싱 완료:', result);
      return result;

    } catch (error) {
      console.error('❌ 파싱 오류:', error);
      return undefined;
    }
  }

// src/utils/nlp-calendar-parser.ts (날짜 파싱 오류 수정)

/**
 * 날짜와 시간 추출 (수정된 버전 - 절대 날짜 우선 처리)
 */
private extractDateTime(text: string): { date: string; time: string } | undefined {
  console.log('🔍 날짜/시간 추출 시작:', text);

  // 1. 절대 날짜 우선 처리 (수정됨)
  // "8월 19일", "12월 25일" 형식
  const koreanDateMatch = text.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  if (koreanDateMatch) {
    const month = parseInt(koreanDateMatch[1]);
    const day = parseInt(koreanDateMatch[2]);
    const currentYear = new Date().getFullYear();
    
    // 올해 날짜로 설정
    const date = `${currentYear}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    const time = this.extractTime(text);
    
    console.log(`✅ 한국어 절대 날짜 파싱: ${month}월 ${day}일 → ${date} ${time}`);
    
    if (time) {
      return { date, time };
    }
  }

  // "2024-12-25", "2024.12.25" 형식
  const absoluteDateMatch = text.match(/(\d{4})[-.년]\s*(\d{1,2})[-.월]\s*(\d{1,2})[일]?/);
  if (absoluteDateMatch) {
    const [, year, month, day] = absoluteDateMatch;
    const date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    const time = this.extractTime(text);
    
    console.log(`✅ 숫자 절대 날짜 파싱: ${date} ${time}`);
    
    if (time) {
      return { date, time };
    }
  }

  // 2. 상대 날짜 처리 (절대 날짜가 없을 때만)
  const today = new Date();
  let targetDate = new Date(today);

  // "이번주 화요일" 패턴
  const thisWeekMatch = text.match(/(이번\s*주|이번주)\s*([월화수목금토일])[요일]?/);
  if (thisWeekMatch) {
    const dayName = thisWeekMatch[2];
    const targetDay = this.datePatterns.weekdays[dayName + '요일'] ?? this.datePatterns.weekdays[dayName];
    
    if (targetDay !== undefined) {
      console.log(`🔍 이번주 ${dayName}요일 계산 중...`);
      
      const currentDay = today.getDay();
      let daysToAdd = targetDay - currentDay;
      
      if (daysToAdd < 0) {
        daysToAdd += 7;
      }
      
      targetDate.setDate(today.getDate() + daysToAdd);
      console.log(`- 계산된 날짜: ${targetDate.toDateString()}`);
    }
  }
  // "다음 주 화요일" 패턴
  else if (text.match(/(다음\s*주|담주)\s*([월화수목금토일])[요일]?/)) {
    const nextWeekMatch = text.match(/(다음\s*주|담주)\s*([월화수목금토일])[요일]?/);
    if (nextWeekMatch) {
      const dayName = nextWeekMatch[2];
      const targetDay = this.datePatterns.weekdays[dayName + '요일'] ?? this.datePatterns.weekdays[dayName];
      
      if (targetDay !== undefined) {
        console.log(`🔍 다음주 ${dayName}요일 계산 중...`);
        
        const nextWeekStart = new Date(today);
        nextWeekStart.setDate(today.getDate() + (7 - today.getDay()));
        
        targetDate = new Date(nextWeekStart);
        targetDate.setDate(nextWeekStart.getDate() + targetDay);
        
        console.log(`- 계산된 날짜: ${targetDate.toDateString()}`);
      }
    }
  }
  // "내일", "모레" 등 상대 날짜
  else {
    let foundRelativeDate = false;
    for (const [keyword, days] of Object.entries(this.datePatterns.relative)) {
      if (text.includes(keyword) && !keyword.includes('주')) { // 주 단위는 위에서 처리됨
        targetDate.setDate(today.getDate() + days);
        console.log(`🔍 상대 날짜 ${keyword}: ${targetDate.toDateString()}`);
        foundRelativeDate = true;
        break;
      }
    }
    
    // 상대 날짜도 없으면 오늘로 설정
    if (!foundRelativeDate) {
      console.log('🔍 기본값: 오늘 날짜 사용');
    }
  }

  const date = targetDate.toISOString().split('T')[0];
  const time = this.extractTime(text);
  
  console.log(`✅ 최종 파싱 결과: ${date} ${time}`);
  
  if (time) {
    return { date, time };
  }

  return undefined;
}

  /**
   * 시간 추출
   */
  private extractTime(text: string): string | undefined {
    // 오전/오후 패턴
    const ampmMatch = text.match(/(?:오전|오후|아침|저녁)\s*(\d{1,2})시?\s*(?:(\d{1,2})분?)?/);
    if (ampmMatch) {
      let hour = parseInt(ampmMatch[1]);
      const minute = ampmMatch[2] ? parseInt(ampmMatch[2]) : 0;
      
      if (text.includes('오후') || text.includes('저녁')) {
        if (hour !== 12) hour += 12;
      } else if (text.includes('오전') || text.includes('아침')) {
        if (hour === 12) hour = 0;
      }
      
      return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    }

    // 24시간 패턴
    const hour24Match = text.match(/(\d{1,2}):(\d{2})/);
    if (hour24Match) {
      return `${hour24Match[1].padStart(2, '0')}:${hour24Match[2]}`;
    }

    // 대략적인 시간
    if (text.includes('아침')) return '09:00';
    if (text.includes('점심')) return '12:00';
    if (text.includes('오후')) return '14:00';
    if (text.includes('저녁')) return '18:00';

    return undefined;
  }

  /**
   * 제목 추출 및 정제 (개선된 버전)
   */
  private extractTitle(text: string): string {
    // 시간/날짜 정보 제거
    let title = text
      .replace(/(\d{4})[-.년]\s*(\d{1,2})[-.월]\s*(\d{1,2})[일]?/g, '')
      .replace(/(오늘|내일|모레|다음주|이번주|담주)/g, '')
      .replace(/(월요일|화요일|수요일|목요일|금요일|토요일|일요일|월|화|수|목|금|토|일)/g, '')
      .replace(/(오전|오후|아침|저녁|밤)\s*\d{1,2}시?\s*\d{0,2}분?/g, '')
      .replace(/\d{1,2}:\d{2}/g, '')
      .replace(/(에서|에|과|와|랑|이랑)/g, '')
      .trim();

    // 불필요한 전치사 제거
    title = title.replace(/^(에서|에|과|와|랑|이랑)\s*/, '');
    
    // 연속된 공백 정리
    title = title.replace(/\s+/g, ' ').trim();

    // 기본 제목이 없으면 "회의"로 설정
    if (!title || title.length < 2) {
      title = '회의';
    }

    console.log(`📝 제목 추출: "${text}" → "${title}"`);
    return title;
  }

  /**
   * 장소 추출
   */
  private extractLocation(text: string): string | undefined {
    // 구체적인 장소명
    const specificLocation = text.match(/([가-힣\w\s]+(?:카페|스타벅스|회의실|사무실|빌딩|호텔|레스토랑))/);
    if (specificLocation) {
      return specificLocation[1].trim();
    }

    // "에서" 앞의 장소
    const locationMatch = text.match(/([가-힣\w\s]+)\s*에서/);
    if (locationMatch) {
      return locationMatch[1].trim();
    }

    // 화상회의 키워드
    if (this.locationPatterns.virtual.test(text)) {
      return '화상회의';
    }

    return undefined;
  }

  /**
   * 참석자 추출
   */
  private extractAttendees(text: string): string[] {
    const attendees: string[] = [];
    
    // 이름 + 직급 패턴
    const nameMatches = text.matchAll(this.attendeePatterns.names);
    for (const match of nameMatches) {
      attendees.push(`${match[1]}${match[2]}`);
    }

    // "와", "과", "랑" 등으로 연결된 이름들
    const conjunctionMatch = text.match(/([가-힣]{2,4})\s*(?:와|과|랑|이랑)\s*([가-힣]{2,4})/);
    if (conjunctionMatch) {
      attendees.push(conjunctionMatch[1], conjunctionMatch[2]);
    }

    return [...new Set(attendees)]; // 중복 제거
  }

  /**
   * 회의 유형 판단
   */
  private determineMeetingType(text: string): ParsedEvent['meetingType'] {
    if (this.meetingTypePatterns.client.test(text)) return 'client';
    if (this.meetingTypePatterns.presentation.test(text)) return 'presentation';
    if (this.meetingTypePatterns.training.test(text)) return 'training';
    if (this.meetingTypePatterns.interview.test(text)) return 'interview';
    if (this.meetingTypePatterns.internal.test(text)) return 'internal';
    
    return 'general';
  }

  /**
   * 우선순위 판단
   */
  private determinePriority(text: string): ParsedEvent['priority'] {
    if (this.priorityPatterns.high.test(text)) return 'high';
    if (this.priorityPatterns.low.test(text)) return 'low';
    return 'medium';
  }

  /**
   * 알림 시간 추출
   */
  private extractReminder(text: string): number | undefined {
    const reminderMatch = text.match(/(\d+)\s*분\s*전\s*(?:에\s*)?(?:알림|알려)/);
    if (reminderMatch) {
      return parseInt(reminderMatch[1]);
    }

    if (text.includes('알림') || text.includes('알려')) {
      return 30; // 기본 30분 전
    }

    return undefined;
  }

  /**
   * 반복 패턴 추출
   */
  private extractRecurring(text: string): string | undefined {
    for (const [pattern, keyword] of Object.entries(this.recurringPatterns)) {
      if (keyword.test(text)) {
        return pattern;
      }
    }
    return undefined;
  }

  /**
   * 준비물 추출
   */
  private extractPreparation(text: string): string[] {
    const prep: string[] = [];
    
    // "준비", "가져올" 등의 키워드 뒤의 내용
    const prepMatch = text.match(/(?:준비|가져올|필요한)\s*(?:것은|물은|내용은)?\s*([^,.\n]+)/);
    if (prepMatch) {
      prep.push(prepMatch[1].trim());
    }

    // 자료, 문서 등 키워드
    const docMatches = text.match(/(자료|문서|PPT|프레젠테이션|보고서|계획서)/g);
    if (docMatches) {
      prep.push(...docMatches);
    }

    return [...new Set(prep)];
  }

  /**
   * 기간 추출
   */
  private extractDuration(text: string): number {
    const durationMatch = text.match(/(\d+)\s*(?:시간|분)/);
    if (durationMatch) {
      const value = parseInt(durationMatch[1]);
      if (text.includes('시간')) return value * 60;
      if (text.includes('분')) return value;
    }

    // 기본값: 1시간
    return 60;
  }

  /**
   * 추가 메모 추출
   */
  private extractNotes(text: string): string | undefined {
    // 메모나 특이사항
    const notesMatch = text.match(/(?:메모|참고|주의|특이사항):\s*(.+)/);
    if (notesMatch) {
      return notesMatch[1].trim();
    }

    return undefined;
  }
}

// 기존 함수와의 호환성을 위한 래퍼
export function parseCalendarText(text: string): any {
  const parser = new AdvancedCalendarParser();
  const result = parser.parseCalendarText(text);
  
  if (!result) return undefined;

  // 기존 형식으로 변환
  return {
    title: result.title,
    date: result.date,
    time: result.time,
    duration: result.duration,
    location: result.location,
    reminder: result.reminder,
    // 고도화된 정보도 포함
    attendees: result.attendees,
    meetingType: result.meetingType,
    priority: result.priority,
    preparation: result.preparation,
    isRecurring: result.isRecurring,
    recurringPattern: result.recurringPattern,
    notes: result.notes,
    confidence: result.confidence,
    extractedInfo: result.extractedInfo
  };
}