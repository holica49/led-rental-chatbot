// src/utils/nlp-calendar-parser.ts

interface ParsedCalendarEvent {
  title: string;
  date: string;
  time: string;
  duration: number; // 분 단위
  reminder?: number; // 분 단위
  location?: string;
  participants?: string[];
}

export class NLPCalendarParser {
  // 날짜 패턴
  private datePatterns = {
    today: /오늘/,
    tomorrow: /내일/,
    dayAfterTomorrow: /모레|내일모레/,
    nextWeek: /다음\s*주\s*(월|화|수|목|금|토|일)요일/,
    thisWeek: /이번\s*주\s*(월|화|수|목|금|토|일)요일/,
    specificDate: /(\d{1,2})월\s*(\d{1,2})일/,
    fullDate: /(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/
  };

  // 시간 패턴
  private timePatterns = {
    ampm: /(오전|오후)\s*(\d{1,2})시\s*(\d{1,2})?분?/,
    hour24: /(\d{1,2})시\s*(\d{1,2})?분?/,
    hour24Colon: /(\d{1,2}):(\d{2})/
  };

  // 알림 패턴
  private reminderPatterns = {
    minutes: /(\d+)분\s*전/,
    hours: /(\d+)시간\s*전/,
    days: /(\d+)일\s*전/
  };

  /**
   * 자연어 텍스트를 파싱하여 캘린더 이벤트 객체로 변환
   */
  parse(text: string): ParsedCalendarEvent | null {
    try {
      const event: Partial<ParsedCalendarEvent> = {};

      // 날짜 추출
      const dateInfo = this.extractDate(text);
      if (!dateInfo) return null;
      event.date = dateInfo.date;

      // 시간 추출
      const timeInfo = this.extractTime(text);
      if (!timeInfo) return null;
      event.time = timeInfo.time;

      // 제목 추출
      const title = this.extractTitle(text, dateInfo.matched, timeInfo.matched);
      if (!title) return null;
      event.title = title;

      // 알림 시간 추출 (선택사항)
      const reminder = this.extractReminder(text);
      if (reminder) event.reminder = reminder;

      // 장소 추출 (선택사항)
      const location = this.extractLocation(text);
      if (location) event.location = location;

      // 기본 duration 설정 (1시간)
      event.duration = 60;

      return event as ParsedCalendarEvent;
    } catch (error) {
      console.error('자연어 파싱 오류:', error);
      return null;
    }
  }

  /**
   * 날짜 추출
   */
  private extractDate(text: string): { date: string; matched: string } | null {
    const today = new Date();
    
    // 오늘
    if (this.datePatterns.today.test(text)) {
      return {
        date: this.formatDate(today),
        matched: '오늘'
      };
    }

    // 내일
    if (this.datePatterns.tomorrow.test(text)) {
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      return {
        date: this.formatDate(tomorrow),
        matched: '내일'
      };
    }

    // 모레
    if (this.datePatterns.dayAfterTomorrow.test(text)) {
      const dayAfter = new Date(today);
      dayAfter.setDate(today.getDate() + 2);
      return {
        date: this.formatDate(dayAfter),
        matched: text.match(this.datePatterns.dayAfterTomorrow)![0]
      };
    }

    // 다음주/이번주 요일
    const weekMatch = text.match(this.datePatterns.nextWeek) || text.match(this.datePatterns.thisWeek);
    if (weekMatch) {
      const isNext = weekMatch[0].includes('다음');
      const dayName = weekMatch[1];
      const targetDate = this.getDateByWeekday(dayName, isNext);
      return {
        date: this.formatDate(targetDate),
        matched: weekMatch[0]
      };
    }

    // 특정 날짜 (월/일)
    const specificMatch = text.match(this.datePatterns.specificDate);
    if (specificMatch) {
      const month = parseInt(specificMatch[1]);
      const day = parseInt(specificMatch[2]);
      const year = today.getFullYear();
      const targetDate = new Date(year, month - 1, day);
      
      // 과거 날짜인 경우 내년으로 설정
      if (targetDate < today) {
        targetDate.setFullYear(year + 1);
      }
      
      return {
        date: this.formatDate(targetDate),
        matched: specificMatch[0]
      };
    }

    // 완전한 날짜 형식
    const fullMatch = text.match(this.datePatterns.fullDate);
    if (fullMatch) {
      const year = parseInt(fullMatch[1]);
      const month = parseInt(fullMatch[2]);
      const day = parseInt(fullMatch[3]);
      return {
        date: `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`,
        matched: fullMatch[0]
      };
    }

    return null;
  }

  /**
   * 시간 추출
   */
  private extractTime(text: string): { time: string; matched: string } | null {
    // 오전/오후 형식
    const ampmMatch = text.match(this.timePatterns.ampm);
    if (ampmMatch) {
      const isPM = ampmMatch[1] === '오후';
      let hour = parseInt(ampmMatch[2]);
      const minute = ampmMatch[3] ? parseInt(ampmMatch[3]) : 0;
      
      if (isPM && hour !== 12) hour += 12;
      if (!isPM && hour === 12) hour = 0;
      
      return {
        time: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
        matched: ampmMatch[0]
      };
    }

    // 콜론 형식 (14:30)
    const colonMatch = text.match(this.timePatterns.hour24Colon);
    if (colonMatch) {
      return {
        time: `${colonMatch[1].padStart(2, '0')}:${colonMatch[2]}`,
        matched: colonMatch[0]
      };
    }

    // 24시간 형식
    const hour24Match = text.match(this.timePatterns.hour24);
    if (hour24Match) {
      const hour = parseInt(hour24Match[1]);
      const minute = hour24Match[2] ? parseInt(hour24Match[2]) : 0;
      
      return {
        time: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
        matched: hour24Match[0]
      };
    }

    return null;
  }

  /**
   * 제목 추출 (날짜/시간 제외한 나머지)
   */
  private extractTitle(text: string, dateMatched: string, timeMatched: string): string {
    let title = text;
    
    // 날짜, 시간 제거
    title = title.replace(dateMatched, '').replace(timeMatched, '');
    
    // 알림 설정 문구 제거
    title = title.replace(/\d+[분시간일]\s*전/, '');
    
    // 불필요한 키워드 제거
    title = title.replace(/일정|등록|추가|알림/, '');
    
    // 앞뒤 공백 제거
    title = title.trim();
    
    return title || '새 일정';
  }

  /**
   * 알림 시간 추출 (분 단위로 반환)
   */
  private extractReminder(text: string): number | null {
    // 분 단위
    const minuteMatch = text.match(this.reminderPatterns.minutes);
    if (minuteMatch) {
      return parseInt(minuteMatch[1]);
    }

    // 시간 단위
    const hourMatch = text.match(this.reminderPatterns.hours);
    if (hourMatch) {
      return parseInt(hourMatch[1]) * 60;
    }

    // 일 단위
    const dayMatch = text.match(this.reminderPatterns.days);
    if (dayMatch) {
      return parseInt(dayMatch[1]) * 24 * 60;
    }

    return null;
  }

  /**
   * 장소 추출 (간단한 구현)
   */
  private extractLocation(text: string): string | null {
    // "~에서" 패턴
    const locationMatch = text.match(/(.+?)(에서|장소)/);
    if (locationMatch && locationMatch[1].length < 20) {
      return locationMatch[1].trim();
    }

    // 주요 장소 키워드
    const places = ['회의실', '사무실', '카페', '식당', '온라인', 'ZOOM', '강남', '판교'];
    for (const place of places) {
      if (text.includes(place)) {
        return place;
      }
    }

    return null;
  }

  /**
   * 요일로 날짜 계산
   */
  private getDateByWeekday(dayName: string, isNext: boolean): Date {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const targetDay = days.indexOf(dayName);
    
    const today = new Date();
    const currentDay = today.getDay();
    
    let daysToAdd = targetDay - currentDay;
    if (daysToAdd <= 0 || isNext) {
      daysToAdd += 7;
    }
    
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + daysToAdd);
    
    return targetDate;
  }

  /**
   * 날짜 포맷팅
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

// 사용 예시 함수
export function parseCalendarText(text: string): ParsedCalendarEvent | null {
  const parser = new NLPCalendarParser();
  return parser.parse(text);
}

// 테스트 예시
const testExamples = [
  "내일 오후 2시 강남LED 설치 미팅",
  "다음주 월요일 10시 30분 고객 상담 30분전 알림",
  "2025-08-20 14:00 프로젝트 킥오프",
  "오늘 저녁 6시 팀 회식 1시간전 알림"
];

// default export 추가
export default NLPCalendarParser;