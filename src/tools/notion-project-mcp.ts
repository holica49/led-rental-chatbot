// src/tools/notion-project-mcp.ts - 고도화된 날짜 처리 버전
import { Client } from '@notionhq/client';

interface NotionProjectRequest {
  action: 'create' | 'update' | 'search' | 'get';
  text: string;
  userId: string;
  projectId?: string;
}

interface NotionProjectResult {
  success: boolean;
  message: string;
  projects?: any[];
  project?: any;
  error?: string;
}

interface LEDInfo {
  size: string;
  stageHeight?: number;
  count?: number;
}

interface ProjectInfo {
  name: string;
  serviceType: '설치' | '렌탈' | '멤버쉽';
  status?: string;
  location?: string;
  customer?: string;
  eventDate?: string;
  ledInfos?: LEDInfo[];
  specialNotes?: string;
  confidence: number;
  extractedInfo: string[];
}

interface ProjectUpdate {
  projectKeyword: string;
  updateType: 'STATUS' | 'TECH' | 'SCHEDULE' | 'NOTES' | 'CUSTOMER';
  newValue: string;
  ledInfos?: LEDInfo[];
  confidence: number;
  extractedInfo: string[];
}

export class NotionProjectMCP {
  private notion: Client;
  private databaseId: string;

  constructor() {
    this.notion = new Client({
      auth: process.env.NOTION_API_KEY,
    });
    this.databaseId = process.env.NOTION_DATABASE_ID || '';
    
    if (!this.databaseId) {
      throw new Error('NOTION_DATABASE_ID가 설정되지 않았습니다.');
    }
  }

  /**
   * MCP에서 Notion 프로젝트 관리 처리
   */
  async handleProjectRequest(args: NotionProjectRequest): Promise<NotionProjectResult> {
    try {
      console.log('📋 Notion 프로젝트 MCP 요청:', args);

      // 사용자 정보 조회
      const { userService } = await import('../models/user-model.js');
      const userProfile = await userService.getUserByLineWorksId(args.userId);

      switch (args.action) {
        case 'create':
          return await this.createProject(args.text, userProfile);
        
        case 'update':
          return await this.updateProject(args.text, userProfile);
        
        case 'search':
          return await this.searchProjects(args.text);
        
        case 'get':
          return await this.getProject(args.projectId || args.text);
        
        default:
          return {
            success: false,
            message: '지원되지 않는 액션입니다.',
            error: 'Invalid action'
          };
      }

    } catch (error) {
      console.error('❌ Notion 프로젝트 MCP 오류:', error);
      return {
        success: false,
        message: '프로젝트 처리 중 오류가 발생했습니다.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 프로젝트 생성
   */
  private async createProject(text: string, userProfile: any): Promise<NotionProjectResult> {
    try {
      console.log('🆕 프로젝트 생성:', text);

      // 자연어에서 프로젝트 정보 추출
      const projectInfo = this.parseProjectFromText(text);
      
      if (!projectInfo.name || !projectInfo.serviceType) {
        return {
          success: false,
          message: '프로젝트 정보가 불충분합니다. 예시: "코엑스팝업 구축 수주했어"'
        };
      }

      // 중복 프로젝트 확인
      const existingProjects = await this.searchProjectsByName(projectInfo.name);
      if (existingProjects.length > 0) {
        return {
          success: false,
          message: `"${projectInfo.name}" 프로젝트가 이미 존재합니다.`,
          projects: existingProjects
        };
      }

      // Notion 페이지 생성
      const response = await this.createNotionPage(projectInfo, userProfile);
      
      if (!response) {
        return {
          success: false,
          message: 'Notion 페이지 생성에 실패했습니다.'
        };
      }

      const notionUrl = `https://www.notion.so/${response.id.replace(/-/g, '')}`;

      return {
        success: true,
        message: `✅ "${projectInfo.name}" 프로젝트가 생성되었습니다!\n\n` +
                 `🔧 서비스: ${projectInfo.serviceType}\n` +
                 `📊 상태: ${projectInfo.status || '견적 요청'}\n` +
                 `👤 등록자: ${userProfile?.department || ''} ${userProfile?.name || 'Unknown'}\n` +
                 `🤖 AI 신뢰도: ${Math.round(projectInfo.confidence * 100)}%\n\n` +
                 `🔗 Notion에서 확인: ${notionUrl}\n\n` +
                 `💡 이제 "${projectInfo.name} 견적 완료했어" 같은 방식으로 업데이트할 수 있습니다.`,
        project: {
          id: response.id,
          name: projectInfo.name,
          serviceType: projectInfo.serviceType,
          status: projectInfo.status || '견적 요청',
          notionUrl
        }
      };

    } catch (error) {
      console.error('프로젝트 생성 오류:', error);
      return {
        success: false,
        message: '프로젝트 생성에 실패했습니다.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 프로젝트 업데이트
   */
  private async updateProject(text: string, userProfile: any): Promise<NotionProjectResult> {
    try {
      console.log('📝 프로젝트 업데이트:', text);

      // 업데이트 정보 파싱
      const updateInfo = this.parseUpdateFromText(text);
      
      if (!updateInfo.projectKeyword) {
        return {
          success: false,
          message: '업데이트할 프로젝트를 찾을 수 없습니다. 예시: "코엑스팝업 견적 완료했어"'
        };
      }

      // 프로젝트 검색
      const projects = await this.searchProjectsByName(updateInfo.projectKeyword);
      if (projects.length === 0) {
        return {
          success: false,
          message: `"${updateInfo.projectKeyword}" 관련 프로젝트를 찾을 수 없습니다.\n\n등록된 프로젝트가 있는지 확인해주세요.`
        };
      }

      const targetProject = projects[0];
      console.log('🎯 업데이트 대상:', targetProject.name);

      // 업데이트 실행
      const updateResult = await this.executeUpdate(targetProject.id, updateInfo, userProfile, text);
      
      if (!updateResult.success) {
        return {
          success: false,
          message: updateResult.error || '프로젝트 업데이트에 실패했습니다.'
        };
      }

      const notionUrl = `https://www.notion.so/${targetProject.id.replace(/-/g, '')}`;

      return {
        success: true,
        message: `✅ "${targetProject.name}" 프로젝트가 업데이트되었습니다!\n\n` +
                 `📝 변경 내용: ${updateResult.description}\n` +
                 `👤 수정자: ${userProfile?.department || ''} ${userProfile?.name || 'Unknown'}\n` +
                 `🤖 AI 신뢰도: ${Math.round(updateInfo.confidence * 100)}%\n` +
                 `⏰ 수정 시간: ${new Date().toLocaleString('ko-KR')}\n\n` +
                 `🔗 Notion에서 확인: ${notionUrl}`,
        project: {
          id: targetProject.id,
          name: targetProject.name,
          updateDescription: updateResult.description
        }
      };

    } catch (error) {
      console.error('프로젝트 업데이트 오류:', error);
      return {
        success: false,
        message: '프로젝트 업데이트에 실패했습니다.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 자연어에서 프로젝트 정보 추출 (고도화된 버전)
   */
  private parseProjectFromText(text: string): ProjectInfo {
    const extractedInfo: string[] = [];
    let confidence = 0;

    // 1. 서비스 유형 추출
    let serviceType: '설치' | '렌탈' | '멤버쉽' = '렌탈';
    if (/(설치|구축|시공|공사)/.test(text)) {
      serviceType = '설치';
      confidence += 0.3;
      extractedInfo.push('서비스: 설치');
    } else if (/(멤버쉽|회원|메쎄이상)/.test(text)) {
      serviceType = '멤버쉽';
      confidence += 0.3;
      extractedInfo.push('서비스: 멤버쉽');
    } else if (/(렌탈|대여|임대)/.test(text)) {
      serviceType = '렌탈';
      confidence += 0.3;
      extractedInfo.push('서비스: 렌탈');
    }

    // 2. 프로젝트명 추출
    let projectName = '';
    for (const keyword of ['설치', '구축', '시공', '렌탈', '대여', '수주', '멤버쉽']) {
      const index = text.indexOf(keyword);
      if (index > 0) {
        projectName = text.substring(0, index).trim();
        break;
      }
    }
    
    if (!projectName) {
      projectName = text.split(/\s+/)[0] || '신규 프로젝트';
    }
    
    // 동작 키워드 제거
    projectName = projectName.replace(/(수주했어|따냄|맡기|했어|됐어|완료)/, '').trim();
    extractedInfo.push(`프로젝트명: ${projectName}`);
    confidence += 0.2;

    // 3. LED 정보 추출
    const ledInfos = this.extractLEDInfos(text);
    if (ledInfos.length > 0) {
      extractedInfo.push(`LED 정보: ${ledInfos.length}개소`);
      confidence += 0.2;
    }

    // 4. 기타 정보 추출
    const location = this.extractLocation(text);
    if (location) {
      extractedInfo.push(`위치: ${location}`);
      confidence += 0.1;
    }

    const customer = this.extractCustomer(text);
    if (customer) {
      extractedInfo.push(`고객: ${customer}`);
      confidence += 0.1;
    }

    const eventDate = this.extractEventDate(text);
    if (eventDate) {
      extractedInfo.push(`일정: ${eventDate}`);
      confidence += 0.1;
    }

    // 5. 🔥 추가 정보 추출 (문의요청사항용)
    const additionalInfo = this.extractAdditionalInfo(text);
    let specialNotes = '';
    if (additionalInfo.length > 0) {
      specialNotes = additionalInfo.join(', ');
      extractedInfo.push(`특이사항: ${specialNotes}`);
      confidence += 0.05;
    }

    return {
      name: projectName,
      serviceType,
      status: '견적 요청',
      location,
      customer,
      eventDate,
      ledInfos,
      specialNotes,
      confidence: Math.min(confidence, 1.0),
      extractedInfo
    };
  }

  /**
   * 🔥 고도화된 날짜 추출 (Phase 1 - 코드 수정)
   */
  private extractEventDate(text: string): string | undefined {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1; // 1-based
    
    // 1. 상대적 날짜 표현 처리
    const relativePatterns = [
      // 월 기준 표현
      { pattern: /(\d{1,2})\s*월\s*말쯤?/, handler: (match: RegExpMatchArray) => {
        const month = parseInt(match[1]);
        return `${currentYear}-${month.toString().padStart(2, '0')}-25 ~ ${currentYear}-${month.toString().padStart(2, '0')}-${this.getLastDayOfMonth(currentYear, month)} (추정)`;
      }},
      { pattern: /(\d{1,2})\s*월\s*중순?/, handler: (match: RegExpMatchArray) => {
        const month = parseInt(match[1]);
        return `${currentYear}-${month.toString().padStart(2, '0')}-15 ~ ${currentYear}-${month.toString().padStart(2, '0')}-20`;
      }},
      { pattern: /(\d{1,2})\s*월\s*초/, handler: (match: RegExpMatchArray) => {
        const month = parseInt(match[1]);
        return `${currentYear}-${month.toString().padStart(2, '0')}-01 ~ ${currentYear}-${month.toString().padStart(2, '0')}-07`;
      }},
      
      // 현재/다음달 기준 표현
      { pattern: /이번\s*달?\s*말/, handler: () => {
        const lastDay = this.getLastDayOfMonth(currentYear, currentMonth);
        return `${currentYear}-${currentMonth.toString().padStart(2, '0')}-25 ~ ${currentYear}-${currentMonth.toString().padStart(2, '0')}-${lastDay}`;
      }},
      { pattern: /이번\s*달?\s*중순/, handler: () => {
        return `${currentYear}-${currentMonth.toString().padStart(2, '0')}-15 ~ ${currentYear}-${currentMonth.toString().padStart(2, '0')}-20`;
      }},
      { pattern: /다음\s*달?\s*초/, handler: () => {
        const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
        const year = currentMonth === 12 ? currentYear + 1 : currentYear;
        return `${year}-${nextMonth.toString().padStart(2, '0')}-01 ~ ${year}-${nextMonth.toString().padStart(2, '0')}-07`;
      }},
      { pattern: /다음\s*달?\s*중순/, handler: () => {
        const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
        const year = currentMonth === 12 ? currentYear + 1 : currentYear;
        return `${year}-${nextMonth.toString().padStart(2, '0')}-15 ~ ${year}-${nextMonth.toString().padStart(2, '0')}-20`;
      }},
      { pattern: /다음\s*달?\s*말/, handler: () => {
        const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
        const year = currentMonth === 12 ? currentYear + 1 : currentYear;
        const lastDay = this.getLastDayOfMonth(year, nextMonth);
        return `${year}-${nextMonth.toString().padStart(2, '0')}-25 ~ ${year}-${nextMonth.toString().padStart(2, '0')}-${lastDay}`;
      }},
      
      // 계절/연도 표현
      { pattern: /연말/, handler: () => `${currentYear}-12-25 ~ ${currentYear}-12-31` },
      { pattern: /연초/, handler: () => `${currentYear}-01-01 ~ ${currentYear}-01-15` },
      { pattern: /내년\s*초/, handler: () => `${currentYear + 1}-01-01 ~ ${currentYear + 1}-01-15` },
      { pattern: /가을쯤?/, handler: () => `${currentYear}-10-01 ~ ${currentYear}-11-30` },
      { pattern: /겨울/, handler: () => `${currentYear}-12-01 ~ ${currentYear + 1}-02-28` },
      
      // 주 단위 표현
      { pattern: /(\d{1,2})\s*월\s*첫째?\s*주/, handler: (match: RegExpMatchArray) => {
        const month = parseInt(match[1]);
        return `${currentYear}-${month.toString().padStart(2, '0')}-01 ~ ${currentYear}-${month.toString().padStart(2, '0')}-07`;
      }},
      { pattern: /(\d{1,2})\s*월\s*둘째\s*주/, handler: (match: RegExpMatchArray) => {
        const month = parseInt(match[1]);
        return `${currentYear}-${month.toString().padStart(2, '0')}-08 ~ ${currentYear}-${month.toString().padStart(2, '0')}-14`;
      }},
      
      // 모호한 단일 날짜
      { pattern: /(\d{1,2})\s*일\s*쯤/, handler: (match: RegExpMatchArray) => {
        const day = parseInt(match[1]);
        return `${currentYear}-${currentMonth.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      }}
    ];

    // 상대적 패턴 먼저 확인
    for (const { pattern, handler } of relativePatterns) {
      const match = text.match(pattern);
      if (match) {
        console.log('🔥 상대적 날짜 패턴 감지:', match[0]);
        return handler(match);
      }
    }

    // 2. 기존 날짜 범위 패턴들
    const rangePatterns = [
      /(\d{1,2})\s*월\s*(\d{1,2})\s*일\s*[~-]\s*(\d{1,2})\s*일/,           // 8월25일~29일
      /(\d{1,2})\s*월\s*(\d{1,2})\s*일\s*[~-]\s*\d{1,2}\s*월\s*(\d{1,2})\s*일/, // 8월25일~8월29일
      /(\d{1,2})\s*일\s*부터\s*(\d{1,2})\s*일\s*까지/,                      // 25일부터 29일까지
      /(\d{1,2})\s*월\s*(\d{1,2})\s*일\s*부터\s*(\d{1,2})\s*일\s*까지/      // 8월25일부터 29일까지
    ];

    for (const pattern of rangePatterns) {
      const match = text.match(pattern);
      if (match) {
        console.log('🔥 날짜 범위 패턴 감지:', match[0]);
        if (match.length === 4) { // 8월25일~29일 형태
          const month = match[1];
          const startDay = match[2];
          const endDay = match[3];
          return `${currentYear}-${month.padStart(2, '0')}-${startDay.padStart(2, '0')} ~ ${currentYear}-${month.padStart(2, '0')}-${endDay.padStart(2, '0')}`;
        } else if (match.length === 5) { // 8월25일부터 29일까지 형태
          const month = match[1];
          const startDay = match[2];
          const endDay = match[3];
          return `${currentYear}-${month.padStart(2, '0')}-${startDay.padStart(2, '0')} ~ ${currentYear}-${month.padStart(2, '0')}-${endDay.padStart(2, '0')}`;
        }
      }
    }

    // 3. 단일 날짜 패턴
    const singleDateMatch = text.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
    if (singleDateMatch) {
      return `${currentYear}-${singleDateMatch[1].padStart(2, '0')}-${singleDateMatch[2].padStart(2, '0')}`;
    }

    // 4. ISO 형식이나 기타 형식은 그대로 반환
    const isoMatch = text.match(/(\d{4})[-.]\s*(\d{1,2})[-.]\s*(\d{1,2})/);
    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
    }

    return undefined;
  }

  /**
   * 월의 마지막 날 계산
   */
  private getLastDayOfMonth(year: number, month: number): string {
    const lastDay = new Date(year, month, 0).getDate();
    return lastDay.toString().padStart(2, '0');
  }

  /**
   * 복수 LED 정보 추출
   */
  private extractLEDInfos(text: string): LEDInfo[] {
    const ledInfos: LEDInfo[] = [];
    
    // "2개소이고" 패턴
    const countMatch = text.match(/(\d+)\s*개소/);
    const expectedCount = countMatch ? parseInt(countMatch[1]) : 1;

    // LED 크기 추출: "6000x3500, 4000x2000"
    const sizePattern = /(\d+)\s*(?:x|×|X)\s*(\d+)/g;
    let sizeMatch;
    while ((sizeMatch = sizePattern.exec(text)) !== null) {
      ledInfos.push({
        size: `${sizeMatch[1]}x${sizeMatch[2]}`,
        count: 1
      });
    }

    // 무대높이 추출
    const stageHeights = this.extractStageHeights(text, ledInfos.length);
    ledInfos.forEach((led, index) => {
      if (stageHeights[index] !== undefined) {
        led.stageHeight = stageHeights[index];
      }
    });

    // LED가 없으면 개수만큼 빈 객체 생성
    if (ledInfos.length === 0 && expectedCount > 0) {
      for (let i = 0; i < expectedCount; i++) {
        ledInfos.push({ size: '', count: 1 });
      }
    }

    return ledInfos;
  }

  /**
   * 무대높이 추출
   */
  private extractStageHeights(text: string, ledCount: number): number[] {
    const heights: number[] = [];

    // "둘 다 600mm" 패턴
    const allSameMatch = text.match(/(?:둘|모두|전부|다)\s*(?:다|모두)?\s*(\d+)\s*(?:mm|밀리)?/);
    if (allSameMatch) {
      const height = parseInt(allSameMatch[1]);
      return new Array(ledCount).fill(height);
    }

    // 개별 높이: "600mm, 800mm"
    const heightPattern = /(\d+)\s*(?:mm|밀리)/g;
    let heightMatch;
    while ((heightMatch = heightPattern.exec(text)) !== null) {
      heights.push(parseInt(heightMatch[1]));
    }

    return heights;
  }

  /**
   * 🔥 추가 정보 추출 (문의요청사항용)
   */
  private extractAdditionalInfo(text: string): string[] {
    const additionalInfo: string[] = [];
    
    // 감정이나 상황을 나타내는 표현들
    const patterns = [
      /처음\s*(?:써보는|사용하는|해보는)/,
      /친절한?\s*설명/,
      /급하게?\s*필요/,
      /예산이?\s*(?:빠듯|부족|타이트)/,
      /시간이?\s*(?:촉박|부족|없어)/,
      /경험이?\s*없어/,
      /잘\s*몰라/,
      /도움이?\s*필요/,
      /문의\s*드려요?/,
      /상담\s*받고?\s*싶어/
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        additionalInfo.push(match[0]);
      }
    }
    
    // 특정 키워드들
    const keywords = ['처음', '급함', '빠듯', '상담', '도움', '설명'];
    for (const keyword of keywords) {
      if (text.includes(keyword) && !additionalInfo.some(info => info.includes(keyword))) {
        // 키워드 주변 문맥 추출
        const context = this.extractContext(text, keyword);
        if (context) {
          additionalInfo.push(context);
        }
      }
    }
    
    return additionalInfo;
  }

  /**
   * 키워드 주변 문맥 추출
   */
  private extractContext(text: string, keyword: string): string | null {
    const index = text.indexOf(keyword);
    if (index === -1) return null;
    
    // 키워드 앞뒤 10글자씩 추출하여 의미있는 구문 만들기
    const start = Math.max(0, index - 10);
    const end = Math.min(text.length, index + keyword.length + 10);
    const context = text.substring(start, end).trim();
    
    // 너무 짧거나 의미없는 경우 제외
    if (context.length < 5 || /^[0-9x×X\s]+$/.test(context)) {
      return null;
    }
    
    return context;
  }

  /**
   * 업데이트 정보 파싱
   */
  private parseUpdateFromText(text: string): ProjectUpdate {
    const extractedInfo: string[] = [];
    let confidence = 0;

    // 프로젝트 키워드 추출
    const projectKeyword = text.match(/^([가-힣A-Za-z0-9]+)/)?.[1] || '';
    if (projectKeyword) {
      extractedInfo.push(`프로젝트: ${projectKeyword}`);
      confidence += 0.3;
    }

    // 복수 LED 정보 업데이트 감지
    const ledInfos = this.extractLEDInfos(text);
    if (ledInfos.length > 0) {
      return {
        projectKeyword,
        updateType: 'TECH',
        newValue: '복수 LED 정보',
        ledInfos,
        confidence: confidence + 0.4,
        extractedInfo: [...extractedInfo, `LED 정보: ${ledInfos.length}개소`]
      };
    }

    // 단일 업데이트 감지
    let updateType: ProjectUpdate['updateType'] = 'NOTES';
    let newValue = '';

    // 상태 업데이트
    if (/(견적|승인|확정|완료|진행|시작|철거)/.test(text)) {
      updateType = 'STATUS';
      if (/(견적.*완료|견적.*승인)/.test(text)) {
        newValue = '견적 승인';
      } else if (/(승인|확정|결정)/.test(text)) {
        newValue = '견적 승인';
      } else if (/(완료|끝|마침)/.test(text)) {
        newValue = '완료';
      } else if (/(설치.*시작|구축.*시작|진행)/.test(text)) {
        newValue = '설치 중';
      } else if (/(철거)/.test(text)) {
        newValue = '철거 중';
      } else {
        newValue = '견적 검토';
      }
      confidence += 0.4;
    }
    // LED 크기 업데이트
    else if (/(\d+)\s*(?:x|×|X)\s*(\d+)/.test(text)) {
      updateType = 'TECH';
      const match = text.match(/(\d+)\s*(?:x|×|X)\s*(\d+)/);
      newValue = `${match![1]}x${match![2]}`;
      confidence += 0.4;
    }
    // 일정 업데이트 (고도화된 날짜 파싱 사용)
    else if (/(일정|날짜)/.test(text)) {
      updateType = 'SCHEDULE';
      const dateValue = this.extractEventDate(text);
      if (dateValue) {
        newValue = dateValue;
        confidence += 0.3;
      }
    }

    extractedInfo.push(`업데이트 유형: ${updateType}`);
    extractedInfo.push(`새 값: ${newValue}`);

    return {
      projectKeyword,
      updateType,
      newValue,
      confidence: Math.min(confidence, 1.0),
      extractedInfo
    };
  }

  /**
   * 업데이트 실행 (복수 LED 지원)
   */
  private async executeUpdate(projectId: string, updateInfo: ProjectUpdate, userProfile: any, originalText: string): Promise<{ success: boolean; description?: string; error?: string }> {
    try {
      const properties: any = {};
      let description = '';

      if (updateInfo.updateType === 'TECH' && updateInfo.ledInfos && updateInfo.ledInfos.length > 0) {
        // 복수 LED 정보 업데이트
        updateInfo.ledInfos.forEach((led, index) => {
          const ledNumber = index + 1;
          
          if (led.size) {
            properties[`LED${ledNumber} 크기`] = {
              rich_text: [{ text: { content: led.size } }]
            };
          }
          
          if (led.stageHeight !== undefined) {
            properties[`LED${ledNumber} 무대 높이`] = {
              number: led.stageHeight
            };
          }
          
          // 모듈 수량 자동 계산
          if (led.size) {
            const [width, height] = led.size.split('x').map(s => parseInt(s.replace(/mm/g, '')));
            const moduleCount = (width / 500) * (height / 500);
            properties[`LED${ledNumber} 모듈 수량`] = {
              number: Math.ceil(moduleCount)
            };
          }
        });
        
        description = `${updateInfo.ledInfos.length}개소 LED 정보 업데이트`;
        
      } else {
        // 단일 업데이트
        switch (updateInfo.updateType) {
          case 'STATUS':
            properties['행사 상태'] = {
              status: { name: updateInfo.newValue }
            };
            description = `상태를 "${updateInfo.newValue}"로 변경`;
            break;

          case 'TECH':
            properties['LED1 크기'] = {
              rich_text: [{ text: { content: updateInfo.newValue } }]
            };
            description = `LED1 크기를 "${updateInfo.newValue}"로 변경`;
            break;

          case 'SCHEDULE':
            properties['행사 일정'] = {
              rich_text: [{ text: { content: updateInfo.newValue } }]
            };
            description = `일정을 "${updateInfo.newValue}"로 변경`;
            break;

          case 'CUSTOMER':
            properties['고객명'] = {
              rich_text: [{ text: { content: updateInfo.newValue } }]
            };
            description = `고객 정보를 "${updateInfo.newValue}"로 변경`;
            break;

          case 'NOTES':
            properties['문의요청 사항'] = {
              rich_text: [{ text: { content: updateInfo.newValue } }]
            };
            description = `특이사항을 "${updateInfo.newValue}"로 변경`;
            break;

          default:
            return {
              success: false,
              error: '지원되지 않는 업데이트 유형입니다.'
            };
        }
      }

      await this.notion.pages.update({
        page_id: projectId,
        properties
      });

      // 업데이트 댓글 추가
      await this.notion.comments.create({
        parent: { page_id: projectId },
        rich_text: [{
          type: 'text',
          text: { 
            content: `📝 LINE WORKS에서 MCP를 통해 업데이트\n수정자: ${userProfile?.department || ''} ${userProfile?.name || 'Unknown'}\n수정 내용: ${description}\n수정 시간: ${new Date().toLocaleString('ko-KR')}\n원본 텍스트: "${originalText}"` 
          }
        }]
      });

      return {
        success: true,
        description
      };

    } catch (error) {
      console.error('업데이트 실행 오류:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Notion 페이지 생성 (개선된 필드 매핑)
   */
  private async createNotionPage(projectInfo: ProjectInfo, userProfile: any): Promise<any> {
    try {
      const properties: any = {
        '행사명': {
          title: [{ text: { content: projectInfo.name } }]
        },
        '서비스 유형': {
          select: { name: projectInfo.serviceType }
        },
        '행사 상태': {
          status: { name: projectInfo.status || '견적 요청' }
        }
      };

      // 🔥 문의요청사항 필드에 추가 정보 저장
      let requestDetails = `LINE WORKS에서 생성 (${userProfile?.name || 'Unknown'})`;
      if (projectInfo.specialNotes) {
        requestDetails += `\n특이사항: ${projectInfo.specialNotes}`;
      }
      if (projectInfo.extractedInfo && projectInfo.extractedInfo.length > 0) {
        requestDetails += `\nAI 추출 정보: ${projectInfo.extractedInfo.join(', ')}`;
      }
      
      properties['문의요청 사항'] = {
        rich_text: [{ text: { content: requestDetails } }]
      };

      // 선택적 정보 추가
      if (projectInfo.customer) {
        properties['고객사'] = {
          select: { name: projectInfo.customer }
        };
      }

      if (projectInfo.location) {
        properties['행사장'] = {
          rich_text: [{ text: { content: projectInfo.location } }]
        };
      }

      if (projectInfo.eventDate) {
        properties['행사 일정'] = {
          rich_text: [{ text: { content: projectInfo.eventDate } }]
        };
      }

      // LED 정보 추가 (정확한 Notion 필드명 사용)
      if (projectInfo.ledInfos && projectInfo.ledInfos.length > 0) {
        projectInfo.ledInfos.forEach((led, index) => {
          const ledNumber = index + 1;
          
          if (led.size) {
            properties[`LED${ledNumber} 크기`] = {
              rich_text: [{ text: { content: led.size } }]
            };
            
            // 모듈 수량 자동 계산
            const [width, height] = led.size.split('x').map(s => parseInt(s.replace(/mm/g, '')));
            if (width && height) {
              const moduleCount = (width / 500) * (height / 500);
              properties[`LED${ledNumber} 모듈 수량`] = {
                number: Math.ceil(moduleCount)
              };
            }
          }
          
          if (led.stageHeight !== undefined) {
            properties[`LED${ledNumber} 무대 높이`] = {
              number: led.stageHeight
            };
          }
        });
      }

      const response = await this.notion.pages.create({
        parent: { database_id: this.databaseId },
        properties
      });

      // 생성 완료 댓글 추가
      await this.notion.comments.create({
        parent: { page_id: response.id },
        rich_text: [{
          type: 'text',
          text: { 
            content: `🤖 LINE WORKS 봇에서 MCP를 통해 자동 생성\n등록자: ${userProfile?.department || ''} ${userProfile?.name || 'Unknown'}\n생성 시간: ${new Date().toLocaleString('ko-KR')}\nAI 신뢰도: ${Math.round(projectInfo.confidence * 100)}%\n추출 정보: ${projectInfo.extractedInfo.join(', ')}\n특이사항: ${projectInfo.specialNotes || '없음'}` 
          }
        }]
      });

      return response;

    } catch (error) {
      console.error('Notion 페이지 생성 오류:', error);
      return null;
    }
  }

  /**
   * 기타 추출 함수들
   */
  private extractLocation(text: string): string | undefined {
    const locationMatch = text.match(/([가-힣]+(?:시|구|군|동|역|센터|빌딩|타워|코엑스|킨텍스))/);
    return locationMatch ? locationMatch[1] : undefined;
  }

  private extractCustomer(text: string): string | undefined {
    const customerMatch = text.match(/([가-힣A-Za-z0-9]+(?:주식회사|회사|㈜|기업|그룹|센터))/);
    return customerMatch ? customerMatch[1] : undefined;
  }

  /**
   * 프로젝트 검색 관련 함수들
   */
  private async searchProjects(query: string): Promise<NotionProjectResult> {
    try {
      const projects = await this.searchProjectsByName(query);
      
      if (projects.length === 0) {
        return {
          success: false,
          message: `"${query}" 관련 프로젝트를 찾을 수 없습니다.`
        };
      }

      let message = `🔍 "${query}" 검색 결과 (${projects.length}개):\n\n`;
      projects.forEach((project, index) => {
        message += `${index + 1}. ${project.name}\n`;
        message += `   📊 상태: ${project.status}\n`;
        message += `   🔧 서비스: ${project.serviceType}\n`;
        if (project.customer) {
          message += `   🏢 고객: ${project.customer}\n`;
        }
        message += '\n';
      });

      return {
        success: true,
        message,
        projects
      };

    } catch (error) {
      console.error('프로젝트 검색 오류:', error);
      return {
        success: false,
        message: '프로젝트 검색에 실패했습니다.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async searchProjectsByName(keyword: string): Promise<any[]> {
    try {
      const response = await this.notion.databases.query({
        database_id: this.databaseId,
        filter: {
          property: '행사명',
          title: {
            contains: keyword
          }
        },
        sorts: [
          {
            property: '행사명',
            direction: 'ascending'
          }
        ]
      });

      return response.results.map(page => this.formatProjectFromNotionPage(page));

    } catch (error) {
      console.error('프로젝트 검색 오류:', error);
      return [];
    }
  }

  private async getProject(projectIdOrName: string): Promise<NotionProjectResult> {
    try {
      let project;
      
      if (projectIdOrName.length === 36 && projectIdOrName.includes('-')) {
        const response = await this.notion.pages.retrieve({ page_id: projectIdOrName });
        project = this.formatProjectFromNotionPage(response);
      } else {
        const projects = await this.searchProjectsByName(projectIdOrName);
        if (projects.length === 0) {
          return {
            success: false,
            message: `"${projectIdOrName}" 프로젝트를 찾을 수 없습니다.`
          };
        }
        project = projects[0];
      }

      const notionUrl = `https://www.notion.so/${project.id.replace(/-/g, '')}`;

      let message = `📋 프로젝트 상세 정보\n\n`;
      message += `🏷️ 이름: ${project.name}\n`;
      message += `🔧 서비스: ${project.serviceType}\n`;
      message += `📊 상태: ${project.status}\n`;
      
      if (project.customer) {
        message += `🏢 고객: ${project.customer}\n`;
      }
      if (project.location) {
        message += `📍 장소: ${project.location}\n`;
      }
      if (project.eventDate) {
        message += `📅 일정: ${project.eventDate}\n`;
      }
      
      message += `\n🔗 Notion: ${notionUrl}`;

      return {
        success: true,
        message,
        project
      };

    } catch (error) {
      console.error('프로젝트 조회 오류:', error);
      return {
        success: false,
        message: '프로젝트 조회에 실패했습니다.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private formatProjectFromNotionPage(page: any): any {
    const properties = page.properties;
    
    return {
      id: page.id,
      name: properties['행사명']?.title?.[0]?.text?.content || '',
      status: properties['행사 상태']?.status?.name || '',
      serviceType: properties['서비스 유형']?.select?.name || '',
      customer: properties['고객사']?.select?.name || '',
      location: properties['행사장']?.rich_text?.[0]?.text?.content || '',
      eventDate: properties['행사 일정']?.rich_text?.[0]?.text?.content || '',
      createdTime: page.created_time,
      lastEditedTime: page.last_edited_time
    };
  }
}

// MCP 도구 정의
export const notionProjectTool = {
  name: 'notion_project',
  description: 'Notion 데이터베이스에서 LED 렌탈/설치 프로젝트를 생성, 업데이트, 검색합니다. 복수 LED 정보를 자동으로 파싱하여 적절한 LED1, LED2 필드에 저장하고 업데이트합니다. 🔥 고도화된 날짜 범위 처리를 지원합니다.',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['create', 'update', 'search', 'get'],
        description: '수행할 작업 (create: 프로젝트 생성, update: 프로젝트 업데이트, search: 프로젝트 검색, get: 프로젝트 상세 조회)'
      },
      text: {
        type: 'string',
        description: '자연어로 입력된 프로젝트 내용 (예: "킨텍스 팝업은 2개소이고, LED크기는 6000x3500, 4000x2000이야", "8월 말쯤 행사야")'
      },
      userId: {
        type: 'string',
        description: 'LINE WORKS 사용자 ID'
      },
      projectId: {
        type: 'string',
        description: '프로젝트 ID (get 액션용, 선택사항)'
      }
    },
    required: ['action', 'text', 'userId']
  },
  handler: async (args: Record<string, unknown>) => {
    const projectService = new NotionProjectMCP();
    
    return projectService.handleProjectRequest({
      action: args.action as 'create' | 'update' | 'search' | 'get',
      text: args.text as string,
      userId: args.userId as string,
      projectId: args.projectId as string | undefined
    });
  }
};