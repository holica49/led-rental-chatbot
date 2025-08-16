// src/services/project-management-service.ts (프로젝트 관리 서비스)
import { Client } from '@notionhq/client';
import { ProjectNLPParser } from '../../utils/project-nlp-parser.js';

interface ProjectCreationRequest {
  projectName: string;
  serviceType: '설치' | '렌탈' | '멤버쉽';
  initialStatus: string;
  location?: string;
  customer?: string;
  eventDate?: string;
  ledSize?: string;
  specialNotes?: string;
  userId: string;  // LINE WORKS 사용자 ID
}

interface ProjectUpdateRequest {
  projectKeyword: string;
  updateType: 'STATUS' | 'TECH' | 'SCHEDULE' | 'NOTES' | 'CUSTOMER';
  newValue: string;
  userId: string;
}

interface ProjectSearchResult {
  pageId: string;
  projectName: string;
  status: string;
  serviceType: string;
  customer?: string;
  similarity: number;
}

export class ProjectManagementService {
  private notion: Client;
  private parser: ProjectNLPParser;
  private databaseId: string;

  constructor() {
    this.notion = new Client({
      auth: process.env.NOTION_API_KEY,
    });
    this.parser = new ProjectNLPParser();
    this.databaseId = process.env.NOTION_DATABASE_ID || '';
    
    if (!this.databaseId) {
      throw new Error('NOTION_DATABASE_ID가 설정되지 않았습니다.');
    }
  }

  /**
   * 자연어로 프로젝트 생성
   */
  async createProjectFromNLP(text: string, userId: string): Promise<{
    success: boolean;
    message: string;
    projectInfo?: any;
    needsConfirmation?: boolean;
    parsedInfo?: any;
  }> {
    try {
      console.log('🔍 자연어 프로젝트 생성 시작:', text);
      
      // 1. 자연어 파싱
      const parsed = this.parser.parseProjectCreation(text);
      if (!parsed) {
        return {
          success: false,
          message: '프로젝트 생성 의도를 인식할 수 없습니다.\n예시: "강남 렌탈 수주했어", "청주오스코 구축 맡기로 했어"'
        };
      }

      console.log('📋 파싱 결과:', parsed);

      // 2. 신뢰도 체크
      if (parsed.confidence < 0.6) {
        return {
          success: false,
          message: `프로젝트 정보가 불명확합니다 (신뢰도: ${Math.round(parsed.confidence * 100)}%).\n\n더 구체적으로 말씀해주세요.\n예시: "강남역 스타벅스 LED 렌탈 수주했어"`,
          parsedInfo: parsed
        };
      }

      // 3. 중복 프로젝트 확인
      const existingProjects = await this.searchExistingProjects(parsed.projectName);
      if (existingProjects.length > 0) {
        const existingProject = existingProjects[0];
        return {
          success: false,
          message: `유사한 프로젝트가 이미 존재합니다:\n"${existingProject.projectName}" (${existingProject.status})\n\n새로 생성하시겠습니까?`,
          needsConfirmation: true,
          parsedInfo: parsed
        };
      }

      // 4. 사용자 정보 조회
      const { userService } = await import('../../models/user-model.js');
      const userProfile = await userService.getUserByLineWorksId(userId);

      // 5. 프로젝트 생성 확인
      return {
        success: false,  // 아직 생성하지 않음
        message: this.formatProjectConfirmation(parsed, userProfile),
        needsConfirmation: true,
        parsedInfo: parsed
      };

    } catch (error) {
      console.error('❌ 프로젝트 생성 오류:', error);
      return {
        success: false,
        message: '프로젝트 생성 중 오류가 발생했습니다.'
      };
    }
  }

  /**
   * 프로젝트 생성 확정
   */
  async confirmProjectCreation(parsedInfo: any, userId: string): Promise<{
    success: boolean;
    message: string;
    projectInfo?: any;
  }> {
    try {
      console.log('✅ 프로젝트 생성 확정:', parsedInfo.projectName);

      // 1. 사용자 정보 조회
      const { userService } = await import('../../models/user-model.js');
      const userProfile = await userService.getUserByLineWorksId(userId);

      // 2. Notion 페이지 생성
      const projectInfo = await this.createNotionProject({
        projectName: parsedInfo.projectName,
        serviceType: parsedInfo.serviceType,
        initialStatus: parsedInfo.initialStatus,
        location: parsedInfo.location,
        customer: parsedInfo.customer,
        eventDate: parsedInfo.eventDate,
        ledSize: parsedInfo.ledSize,
        specialNotes: parsedInfo.specialNotes,
        userId
      }, userProfile);

      if (!projectInfo) {
        return {
          success: false,
          message: 'Notion 페이지 생성에 실패했습니다.'
        };
      }

      console.log('🎉 프로젝트 생성 완료:', projectInfo.pageId);

      return {
        success: true,
        message: this.formatProjectCreated(projectInfo, userProfile),
        projectInfo
      };

    } catch (error) {
      console.error('❌ 프로젝트 생성 확정 오류:', error);
      return {
        success: false,
        message: '프로젝트 생성 중 오류가 발생했습니다.'
      };
    }
  }

  /**
   * 프로젝트 업데이트
   */
  async updateProjectFromNLP(text: string, userId: string): Promise<{
    success: boolean;
    message: string;
    projectInfo?: any;
  }> {
    try {
      console.log('🔍 프로젝트 업데이트 파싱:', text);

      // 1. 업데이트 파싱
      const parsed = this.parser.parseProjectUpdate(text);
      if (!parsed) {
        return {
          success: false,
          message: '프로젝트 업데이트 명령을 인식할 수 없습니다.\n예시: "강남 렌탈 견적 완료했어", "청주오스코 LED 크기 3000x2000으로 변경"'
        };
      }

      console.log('📋 업데이트 파싱 결과:', parsed);

      // 2. 프로젝트 검색
      const projects = await this.searchExistingProjects(parsed.projectKeyword);
      if (projects.length === 0) {
        return {
          success: false,
          message: `"${parsed.projectKeyword}" 관련 프로젝트를 찾을 수 없습니다.\n\n등록된 프로젝트가 있는지 확인해주세요.`
        };
      }

      const targetProject = projects[0];  // 가장 유사한 프로젝트
      console.log('🎯 대상 프로젝트:', targetProject.projectName);

      // 3. 사용자 정보 조회
      const { userService } = await import('../../models/user-model.js');
      const userProfile = await userService.getUserByLineWorksId(userId);

      // 4. 프로젝트 업데이트 실행
      const updated = await this.updateNotionProject(
        targetProject.pageId,
        parsed.updateType,
        parsed.newValue,
        userProfile
      );

      if (!updated) {
        return {
          success: false,
          message: '프로젝트 업데이트에 실패했습니다.'
        };
      }

      return {
        success: true,
        message: this.formatProjectUpdated(targetProject, parsed, userProfile),
        projectInfo: targetProject
      };

    } catch (error) {
      console.error('❌ 프로젝트 업데이트 오류:', error);
      return {
        success: false,
        message: '프로젝트 업데이트 중 오류가 발생했습니다.'
      };
    }
  }

  /**
   * 기존 프로젝트 검색
   */
  private async searchExistingProjects(keyword: string): Promise<ProjectSearchResult[]> {
    try {
      const response = await this.notion.databases.query({
        database_id: this.databaseId,
        filter: {
          property: '행사명',
          title: {
            contains: keyword
          }
        }
      });

      const results: ProjectSearchResult[] = [];

      for (const page of response.results) {
        if (page.object !== 'page') continue;
        
        const properties = (page as any).properties;
        const projectName = properties['행사명']?.title?.[0]?.text?.content || '';
        const status = properties['행사 상태']?.status?.name || '';
        const serviceType = properties['서비스 유형']?.select?.name || '';
        const customer = properties['고객사']?.select?.name || '';

        // 유사도 계산 (간단한 문자열 매칭)
        const similarity = this.calculateSimilarity(keyword, projectName);

        results.push({
          pageId: page.id,
          projectName,
          status,
          serviceType,
          customer,
          similarity
        });
      }

      // 유사도 순으로 정렬
      return results.sort((a, b) => b.similarity - a.similarity);

    } catch (error) {
      console.error('프로젝트 검색 오류:', error);
      return [];
    }
  }

  /**
   * Notion 프로젝트 생성
   */
  private async createNotionProject(request: ProjectCreationRequest, userProfile: any): Promise<any> {
    try {
      const now = new Date().toISOString();
      
      // 서비스 유형별 기본값 설정
      const defaultValues = this.getServiceTypeDefaults(request.serviceType);

      const properties: any = {
        '행사명': {
          title: [{
            text: { content: request.projectName }
          }]
        },
        '서비스 유형': {
          select: { name: request.serviceType }
        },
        '행사 상태': {
          status: { name: request.initialStatus }
        },
        '문의요청 사항': {
          rich_text: [{
            text: { content: `LINE WORKS에서 생성 (${userProfile?.name || request.userId})` }
          }]
        }
      };

      // 선택적 정보 추가
      if (request.customer) {
        properties['고객사'] = {
          select: { name: request.customer }
        };
      }

      if (request.location) {
        properties['행사장'] = {
          rich_text: [{
            text: { content: request.location }
          }]
        };
      }

      if (request.eventDate) {
        properties['행사 일정'] = {
          rich_text: [{
            text: { content: request.eventDate }
          }]
        };
      }

      if (request.ledSize) {
        properties['LED 크기 (가로x세로)'] = {
          rich_text: [{
            text: { content: request.ledSize }
          }]
        };
      }

      if (request.specialNotes) {
        properties['특이사항'] = {
          rich_text: [{
            text: { content: request.specialNotes }
          }]
        };
      }

      // 서비스별 기본값 적용
      Object.assign(properties, defaultValues);

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
            content: `🤖 LINE WORKS 봇에서 자동 생성\n등록자: ${userProfile?.department || ''} ${userProfile?.name || request.userId}\n생성 시간: ${new Date().toLocaleString('ko-KR')}` 
          }
        }]
      });

      return {
        pageId: response.id,
        projectName: request.projectName,
        serviceType: request.serviceType,
        status: request.initialStatus,
        notionUrl: `https://www.notion.so/${response.id.replace(/-/g, '')}`
      };

    } catch (error) {
      console.error('Notion 프로젝트 생성 오류:', error);
      return null;
    }
  }

  /**
   * Notion 프로젝트 업데이트
   */
  private async updateNotionProject(
    pageId: string, 
    updateType: string, 
    newValue: string, 
    userProfile: any
  ): Promise<boolean> {
    try {
      const properties: any = {};

      switch (updateType) {
        case 'STATUS':
          properties['행사 상태'] = {
            status: { name: newValue }
          };
          break;

        case 'TECH':
          if (newValue.includes('x') && newValue.includes('mm')) {
            properties['LED 크기 (가로x세로)'] = {
              rich_text: [{ text: { content: newValue } }]
            };
          }
          break;

        case 'SCHEDULE':
          properties['행사 일정'] = {
            rich_text: [{ text: { content: newValue } }]
          };
          break;

        case 'CUSTOMER':
          if (newValue.includes('@')) {
            // 이메일이면 고객 연락처에
            properties['고객 연락처'] = {
              phone_number: newValue
            };
          } else if (/\d{2,3}-\d{3,4}-\d{4}/.test(newValue)) {
            // 전화번호면 연락처에
            properties['고객 연락처'] = {
              phone_number: newValue
            };
          } else {
            // 그외는 고객명에
            properties['고객명'] = {
              rich_text: [{ text: { content: newValue } }]
            };
          }
          break;

        case 'NOTES':
          properties['특이사항'] = {
            rich_text: [{ text: { content: newValue } }]
          };
          break;
      }

      await this.notion.pages.update({
        page_id: pageId,
        properties
      });

      // 업데이트 댓글 추가
      await this.notion.comments.create({
        parent: { page_id: pageId },
        rich_text: [{
          type: 'text',
          text: { 
            content: `📝 LINE WORKS에서 업데이트\n수정자: ${userProfile?.department || ''} ${userProfile?.name || 'Unknown'}\n수정 내용: ${updateType} → ${newValue}\n수정 시간: ${new Date().toLocaleString('ko-KR')}` 
          }
        }]
      });

      console.log('✅ 프로젝트 업데이트 완료');
      return true;

    } catch (error) {
      console.error('Notion 프로젝트 업데이트 오류:', error);
      return false;
    }
  }

  /**
   * 서비스 유형별 기본값
   */
  private getServiceTypeDefaults(serviceType: string): any {
    const defaults: any = {};

    switch (serviceType) {
      case '설치':
        // 설치 서비스 기본값
        break;
      case '렌탈':
        // 렌탈 서비스 기본값
        break;
      case '멤버쉽':
        // 멤버쉽 서비스 기본값
        break;
    }

    return defaults;
  }

  /**
   * 문자열 유사도 계산
   */
  private calculateSimilarity(keyword: string, projectName: string): number {
    const keywordLower = keyword.toLowerCase();
    const projectLower = projectName.toLowerCase();
    
    // 정확히 포함되면 높은 점수
    if (projectLower.includes(keywordLower)) {
      return 0.9;
    }
    
    // 부분 매치 점수 계산
    const words = keywordLower.split(/\s+/);
    let matches = 0;
    
    for (const word of words) {
      if (projectLower.includes(word)) {
        matches++;
      }
    }
    
    return matches / words.length * 0.7;
  }

  /**
   * 프로젝트 생성 확인 메시지 포맷팅
   */
  private formatProjectConfirmation(parsed: any, userProfile: any): string {
    let message = `📋 다음 프로젝트를 생성하시겠습니까?\n\n`;
    message += `🏷️ 프로젝트명: ${parsed.projectName}\n`;
    message += `🔧 서비스 유형: ${parsed.serviceType}\n`;
    message += `📊 초기 상태: ${parsed.initialStatus}\n`;
    
    if (parsed.location) {
      message += `📍 장소: ${parsed.location}\n`;
    }
    if (parsed.customer) {
      message += `🏢 고객사: ${parsed.customer}\n`;
    }
    if (parsed.eventDate) {
      message += `📅 일정: ${parsed.eventDate}\n`;
    }
    if (parsed.ledSize) {
      message += `📺 LED 크기: ${parsed.ledSize}\n`;
    }
    
    message += `\n👤 등록자: ${userProfile?.department || ''} ${userProfile?.name || 'Unknown'}\n`;
    message += `🤖 분석 신뢰도: ${Math.round(parsed.confidence * 100)}%\n\n`;
    message += `✅ "생성" 또는 "확인"을 입력하면 프로젝트가 생성됩니다.\n`;
    message += `❌ "취소"를 입력하면 취소됩니다.`;
    
    return message;
  }

  /**
   * 프로젝트 생성 완료 메시지 포맷팅
   */
  private formatProjectCreated(projectInfo: any, userProfile: any): string {
    let message = `🎉 프로젝트가 성공적으로 생성되었습니다!\n\n`;
    message += `📋 프로젝트: ${projectInfo.projectName}\n`;
    message += `🔧 서비스: ${projectInfo.serviceType}\n`;
    message += `📊 상태: ${projectInfo.status}\n`;
    message += `👤 등록자: ${userProfile?.department || ''} ${userProfile?.name || 'Unknown'}\n\n`;
    message += `🔗 Notion에서 확인: ${projectInfo.notionUrl}\n\n`;
    message += `💬 이제 다음과 같이 업데이트할 수 있습니다:\n`;
    message += `• "${projectInfo.projectName.split(' ')[0]} 견적 완료했어"\n`;
    message += `• "${projectInfo.projectName.split(' ')[0]} LED 크기 3000x2000으로 변경"\n`;
    message += `• "${projectInfo.projectName.split(' ')[0]} 고객 연락처 추가해줘"`;
    
    return message;
  }

  /**
   * 프로젝트 업데이트 완료 메시지 포맷팅
   */
  private formatProjectUpdated(projectInfo: any, parsed: any, userProfile: any): string {
    const updateTypeNames = {
      STATUS: '상태',
      TECH: '기술정보',
      SCHEDULE: '일정',
      CUSTOMER: '고객정보',
      NOTES: '특이사항'
    };

    let message = `✅ 프로젝트가 업데이트되었습니다!\n\n`;
    message += `📋 프로젝트: ${projectInfo.projectName}\n`;
    message += `📝 수정 내용: ${updateTypeNames[parsed.updateType as keyof typeof updateTypeNames]} → ${parsed.newValue}\n`;
    message += `👤 수정자: ${userProfile?.department || ''} ${userProfile?.name || 'Unknown'}\n`;
    message += `⏰ 수정 시간: ${new Date().toLocaleString('ko-KR')}\n\n`;
    message += `🔗 Notion에서 확인: https://www.notion.so/${projectInfo.pageId.replace(/-/g, '')}`;
    
    return message;
  }
}