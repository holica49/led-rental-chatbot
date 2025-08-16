// src/utils/project-nlp-parser.ts (프로젝트명 추출 수정)

interface ParsedProject {
  // 기본 정보
  projectName: string;
  serviceType: '설치' | '렌탈' | '멤버쉽';
  initialStatus: string;
  
  // 추출된 정보
  location?: string;
  customer?: string;
  eventDate?: string;
  ledSize?: string;
  specialNotes?: string;
  
  // 메타데이터
  confidence: number;
  extractedInfo: string[];
  action: 'CREATE' | 'UPDATE';
}

interface ProjectUpdate {
  projectKeyword: string;
  updateType: 'STATUS' | 'TECH' | 'SCHEDULE' | 'NOTES' | 'CUSTOMER';
  newValue: string;
  confidence: number;
  extractedInfo: string[];
}

export class ProjectNLPParser {
  
  // 서비스 유형 패턴
  private serviceTypePatterns = {
    설치: /(설치|구축|시공|공사|설립|셋업)/,
    렌탈: /(렌탈|대여|임대|빌려|수주)/,
    멤버쉽: /(멤버쉽|회원|메쎄이상|특가|할인)/
  };

  // 프로젝트 생성 패턴
  private projectCreationPatterns = {
    creation: /(수주|따냄|맡기|맡아|시작|진행|들어왔)/,
    completion: /(했어|됐어|완료|끝났|마쳤)/
  };

  // 상태 패턴
  private statusPatterns = {
    '견적 요청': /(견적|문의|요청|상담)/,
    '견적 검토': /(검토|검토중|리뷰|확인)/,
    '견적 승인': /(승인|확정|결정|OK|오케이)/,
    '설치 중': /(설치|구축|시공|작업|진행)/,
    '운영 중': /(운영|가동|실행|진행)/,
    '철거 중': /(철거|해체|정리|마무리)/,
    '완료': /(완료|끝|마침|종료)/
  };

  // 기술 정보 패턴
  private techPatterns = {
    ledSize: /(\d+(?:\.\d+)?)\s*(?:x|×|X)\s*(\d+(?:\.\d+)?)\s*(?:mm|미리|밀리)?/,
    quantity: /(\d+)\s*(?:개|모듈|장|set|세트)/,
    resolution: /(\d+)\s*(?:x|×|X)\s*(\d+)\s*(?:px|픽셀)/,
    power: /(\d+)\s*(?:kw|킬로와트|w|와트)/
  };

  // 날짜 패턴
  private datePatterns = {
    specific: /(\d{4})[-.년]\s*(\d{1,2})[-.월]\s*(\d{1,2})[일]?/,
    korean: /(\d{1,2})\s*월\s*(\d{1,2})\s*일/,
    relative: /(오늘|내일|모레|다음주|이번주|다음달|이번달)/,
    period: /(\d+)\s*(?:일간|일동안|박|일)/
  };

  /**
   * 프로젝트 생성 명령어 파싱
   */
  parseProjectCreation(text: string): ParsedProject | null {
    console.log('🔍 프로젝트 생성 파싱 시작:', text);
    
    try {
      const extractedInfo: string[] = [];
      let confidence = 0;

      // 1. 프로젝트 생성 의도 확인
      const isCreationIntent = this.projectCreationPatterns.creation.test(text) || 
                              this.projectCreationPatterns.completion.test(text);
      
      if (!isCreationIntent) {
        return null;
      }

      confidence += 0.3;
      extractedInfo.push('프로젝트 생성 의도 감지');

      // 2. 서비스 유형 추출
      const serviceType = this.extractServiceType(text);
      if (!serviceType) {
        return null;
      }

      confidence += 0.3;
      extractedInfo.push(`서비스 유형: ${serviceType}`);

      // 3. 프로젝트명 추출 (수정)
      const projectName = this.extractProjectName(text, serviceType);
      extractedInfo.push(`프로젝트명: ${projectName}`);
      confidence += 0.2;

      // 4. 추가 정보 추출
      const location = this.extractLocation(text);
      if (location) {
        extractedInfo.push(`위치: ${location}`);
        confidence += 0.05;
      }

      const customer = this.extractCustomer(text);
      if (customer) {
        extractedInfo.push(`고객: ${customer}`);
        confidence += 0.05;
      }

      const eventDate = this.extractEventDate(text);
      if (eventDate) {
        extractedInfo.push(`일정: ${eventDate}`);
        confidence += 0.05;
      }

      const ledSize = this.extractTechInfo(text);
      if (ledSize) {
        extractedInfo.push(`기술정보: ${ledSize}`);
        confidence += 0.05;
      }

      // 5. 초기 상태 결정
      const initialStatus = this.determineInitialStatus(text, serviceType);

      const result: ParsedProject = {
        projectName,
        serviceType,
        initialStatus,
        location,
        customer,
        eventDate,
        ledSize,
        specialNotes: this.extractSpecialNotes(text),
        confidence: Math.min(confidence, 1.0),
        extractedInfo,
        action: 'CREATE'
      };

      console.log('✅ 프로젝트 생성 파싱 완료:', result);
      return result;

    } catch (error) {
      console.error('❌ 프로젝트 생성 파싱 오류:', error);
      return null;
    }
  }

  /**
   * 프로젝트 업데이트 명령어 파싱
   */
  parseProjectUpdate(text: string): ProjectUpdate | null {
    console.log('🔍 프로젝트 업데이트 파싱 시작:', text);
    
    try {
      const extractedInfo: string[] = [];
      let confidence = 0;

      // 1. 프로젝트 키워드 추출 (첫 번째 명사구)
      const projectKeyword = this.extractProjectKeyword(text);
      if (!projectKeyword) {
        return null;
      }

      confidence += 0.4;
      extractedInfo.push(`프로젝트 키워드: ${projectKeyword}`);

      // 2. 업데이트 유형 판단
      const updateType = this.determineUpdateType(text);
      if (!updateType) {
        return null;
      }

      confidence += 0.3;
      extractedInfo.push(`업데이트 유형: ${updateType}`);

      // 3. 새로운 값 추출
      const newValue = this.extractNewValue(text, updateType);
      if (!newValue) {
        return null;
      }

      confidence += 0.3;
      extractedInfo.push(`새 값: ${newValue}`);

      const result: ProjectUpdate = {
        projectKeyword,
        updateType,
        newValue,
        confidence: Math.min(confidence, 1.0),
        extractedInfo
      };

      console.log('✅ 프로젝트 업데이트 파싱 완료:', result);
      return result;

    } catch (error) {
      console.error('❌ 프로젝트 업데이트 파싱 오류:', error);
      return null;
    }
  }

  /**
   * 서비스 유형 추출
   */
  private extractServiceType(text: string): '설치' | '렌탈' | '멤버쉽' | undefined {
    for (const [type, pattern] of Object.entries(this.serviceTypePatterns)) {
      if (pattern.test(text)) {
        return type as '설치' | '렌탈' | '멤버쉽';
      }
    }
    return undefined;
  }

  /**
   * 프로젝트명 추출 (수정된 버전)
   */
  private extractProjectName(text: string, serviceType: string): string {
    console.log('🔍 프로젝트명 추출 시작:', text, 'serviceType:', serviceType);
    
    // 서비스 키워드 앞의 모든 텍스트를 프로젝트명 후보로 추출
    const serviceKeywords = ['설치', '구축', '시공', '공사', '설립', '셋업', '렌탈', '대여', '임대', '빌려', '수주', '멤버쉽', '회원', '메쎄이상', '특가', '할인'];
    
    let projectNameCandidate = text;
    
    // 서비스 키워드 찾기
    for (const keyword of serviceKeywords) {
      const index = text.indexOf(keyword);
      if (index > 0) {
        // 서비스 키워드 앞부분을 프로젝트명으로 추출
        projectNameCandidate = text.substring(0, index).trim();
        break;
      }
    }
    
    // 동작 키워드 제거
    const actionKeywords = ['수주했어', '따냄', '맡기', '맡아', '시작', '진행', '들어왔', '했어', '됐어', '완료', '끝났', '마쳤'];
    for (const action of actionKeywords) {
      projectNameCandidate = projectNameCandidate.replace(action, '').trim();
    }
    
    // 불필요한 조사/어미 제거
    projectNameCandidate = projectNameCandidate.replace(/\s*(을|를|이|가|은|는|에서|에|과|와|랑|이랑)\s*$/, '');
    
    console.log('📝 추출된 프로젝트명 후보:', projectNameCandidate);
    
    // 빈 문자열이면 기본값 사용
    if (!projectNameCandidate || projectNameCandidate.length === 0) {
      const location = this.extractLocation(text) || '신규';
      const customer = this.extractCustomer(text);
      
      if (customer) {
        return `${location} ${customer}`;
      } else {
        return location;
      }
    }
    
    console.log('✅ 최종 프로젝트명:', projectNameCandidate);
    return projectNameCandidate;
  }

  /**
   * 위치 추출 (개선된 버전)
   */
  private extractLocation(text: string): string | undefined {
    // 지역명 패턴 (기존 + 추가)
    const locationPatterns = [
      /([가-힣]+(?:시|구|군|동|읍|면|리))/g,
      /([가-힣]+(?:역|대학교|병원|마트|백화점|센터|빌딩|타워))/g,
      /(강남|홍대|명동|잠실|여의도|판교|분당|수원|인천|부산|대구|광주|대전|울산|세종|코엑스)/g,
      /([가-힣A-Za-z0-9]+(?:팝업|매장|스토어|샵|점포))/g // 팝업스토어 등
    ];

    for (const pattern of locationPatterns) {
      const matches = text.match(pattern);
      if (matches && matches.length > 0) {
        return matches[0];
      }
    }

    return undefined;
  }

  /**
   * 고객사 추출
   */
  private extractCustomer(text: string): string | undefined {
    // 회사명 패턴
    const customerPatterns = [
      /([가-힣A-Za-z0-9]+(?:주식회사|회사|㈜|기업|그룹|센터|대학교))/g,
      /([가-힣A-Za-z0-9]+(?:코|시스템|텍|솔루션|미디어|엔터|프라임))/g
    ];

    for (const pattern of customerPatterns) {
      const matches = text.match(pattern);
      if (matches && matches.length > 0) {
        return matches[0];
      }
    }

    return undefined;
  }

  /**
   * 행사 날짜 추출
   */
  private extractEventDate(text: string): string | undefined {
    // 구체적인 날짜
    const specificMatch = text.match(this.datePatterns.specific);
    if (specificMatch) {
      const [, year, month, day] = specificMatch;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // 한국어 날짜
    const koreanMatch = text.match(this.datePatterns.korean);
    if (koreanMatch) {
      const [, month, day] = koreanMatch;
      const currentYear = new Date().getFullYear();
      return `${currentYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // 상대 날짜
    const relativeMatch = text.match(this.datePatterns.relative);
    if (relativeMatch) {
      return this.convertRelativeDate(relativeMatch[1]);
    }

    return undefined;
  }

  /**
   * 기술 정보 추출
   */
  private extractTechInfo(text: string): string | undefined {
    const techInfo: string[] = [];

    // LED 크기
    const sizeMatch = text.match(this.techPatterns.ledSize);
    if (sizeMatch) {
      techInfo.push(`${sizeMatch[1]}x${sizeMatch[2]}mm`);
    }

    // 수량
    const quantityMatch = text.match(this.techPatterns.quantity);
    if (quantityMatch) {
      techInfo.push(`${quantityMatch[1]}개`);
    }

    // 해상도
    const resolutionMatch = text.match(this.techPatterns.resolution);
    if (resolutionMatch) {
      techInfo.push(`${resolutionMatch[1]}x${resolutionMatch[2]}px`);
    }

    return techInfo.length > 0 ? techInfo.join(', ') : undefined;
  }

  /**
   * 특이사항 추출
   */
  private extractSpecialNotes(text: string): string | undefined {
    // 특이사항 키워드 뒤의 내용
    const notesPatterns = [
      /(?:특이사항|주의사항|참고|메모):\s*(.+)/,
      /(?:특별히|특히|주의할)\s*(.+)/
    ];

    for (const pattern of notesPatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return undefined;
  }

  /**
   * 초기 상태 결정
   */
  private determineInitialStatus(text: string, serviceType: string): string {
    // 명시적 상태가 있으면 사용
    for (const [status, pattern] of Object.entries(this.statusPatterns)) {
      if (pattern.test(text)) {
        return status;
      }
    }

    // 서비스별 기본 상태
    return '견적 요청';
  }

  /**
   * 프로젝트 키워드 추출 (업데이트용) - 개선된 버전
   */
  private extractProjectKeyword(text: string): string | undefined {
    // "강남 렌탈" 패턴으로 프로젝트 식별
    const keywordPatterns = [
      /([가-힣A-Za-z0-9]+)\s*(?:렌탈|설치|멤버쉽|구축|프로젝트)/,
      /([가-힣A-Za-z0-9]+(?:시|구|군|동|역|대학교|팝업|매장|센터|빌딩))\s*(?:관련|건|거)?/
    ];

    for (const pattern of keywordPatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return undefined;
  }

  /**
   * 업데이트 유형 판단
   */
  private determineUpdateType(text: string): ProjectUpdate['updateType'] | undefined {
    if (this.statusPatterns['견적 요청'].test(text) || 
        this.statusPatterns['견적 검토'].test(text) ||
        this.statusPatterns['견적 승인'].test(text) ||
        this.statusPatterns['완료'].test(text)) {
      return 'STATUS';
    }

    if (this.techPatterns.ledSize.test(text) || 
        this.techPatterns.quantity.test(text) ||
        this.techPatterns.resolution.test(text)) {
      return 'TECH';
    }

    if (this.datePatterns.specific.test(text) || 
        this.datePatterns.korean.test(text) ||
        this.datePatterns.relative.test(text)) {
      return 'SCHEDULE';
    }

    if (text.includes('고객') || text.includes('연락처') || text.includes('담당자')) {
      return 'CUSTOMER';
    }

    if (text.includes('특이사항') || text.includes('메모') || text.includes('참고')) {
      return 'NOTES';
    }

    return undefined;
  }

  /**
   * 새로운 값 추출
   */
  private extractNewValue(text: string, updateType: ProjectUpdate['updateType']): string | undefined {
    switch (updateType) {
      case 'STATUS':
        for (const [status, pattern] of Object.entries(this.statusPatterns)) {
          if (pattern.test(text)) {
            return status;
          }
        }
        break;

      case 'TECH':
        return this.extractTechInfo(text);

      case 'SCHEDULE':
        return this.extractEventDate(text);

      case 'CUSTOMER':
        return this.extractCustomer(text) || this.extractContactInfo(text);

      case 'NOTES':
        const notesMatch = text.match(/(?:특이사항|메모|참고):\s*(.+)/);
        return notesMatch ? notesMatch[1] : text;
    }

    return undefined;
  }

  /**
   * 연락처 정보 추출
   */
  private extractContactInfo(text: string): string | undefined {
    const contactPatterns = [
      /(\d{2,3}-\d{3,4}-\d{4})/,  // 전화번호
      /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/,  // 이메일
      /([가-힣]{2,4})\s*(?:님|씨|대리|과장|부장|팀장|이사|사장)/  // 담당자명
    ];

    for (const pattern of contactPatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return undefined;
  }

  /**
   * 상대 날짜를 절대 날짜로 변환
   */
  private convertRelativeDate(relative: string): string {
    const today = new Date();
    let targetDate = new Date(today);

    switch (relative) {
      case '오늘':
        break;
      case '내일':
        targetDate.setDate(today.getDate() + 1);
        break;
      case '모레':
        targetDate.setDate(today.getDate() + 2);
        break;
      case '다음주':
        targetDate.setDate(today.getDate() + 7);
        break;
      case '다음달':
        targetDate.setMonth(today.getMonth() + 1);
        break;
    }

    return targetDate.toISOString().split('T')[0];
  }
}

// 기존 함수와의 호환성을 위한 래퍼
export function parseProjectCreation(text: string): ParsedProject | null {
  const parser = new ProjectNLPParser();
  return parser.parseProjectCreation(text);
}

export function parseProjectUpdate(text: string): ProjectUpdate | null {
  const parser = new ProjectNLPParser();
  return parser.parseProjectUpdate(text);
}