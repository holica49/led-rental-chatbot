// src/tools/notion-project-mcp.ts (Notion 프로젝트 관리 MCP 도구)
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
      const properties: any = {
        '행사명': {
          title: [{ text: { content: projectInfo.name } }]
        },
        '서비스 유형': {
          select: { name: projectInfo.serviceType }
        },
        '행사 상태': {
          status: { name: projectInfo.status || '견적 요청' }
        },
        '문의요청 사항': {
          rich_text: [{
            text: { content: `LINE WORKS에서 생성 (${userProfile?.name || 'Unknown'}): ${text}` }
          }]
        }
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

      if (projectInfo.ledSize) {
        properties['LED 크기 (가로x세로)'] = {
          rich_text: [{ text: { content: projectInfo.ledSize } }]
        };
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
            content: `🤖 LINE WORKS 봇에서 MCP를 통해 자동 생성\n등록자: ${userProfile?.department || ''} ${userProfile?.name || 'Unknown'}\n생성 시간: ${new Date().toLocaleString('ko-KR')}\n원본 텍스트: "${text}"` 
          }
        }]
      });

      const notionUrl = `https://www.notion.so/${response.id.replace(/-/g, '')}`;

      return {
        success: true,
        message: `✅ "${projectInfo.name}" 프로젝트가 생성되었습니다!\n\n` +
                 `🔧 서비스: ${projectInfo.serviceType}\n` +
                 `📊 상태: ${projectInfo.status || '견적 요청'}\n` +
                 `👤 등록자: ${userProfile?.department || ''} ${userProfile?.name || 'Unknown'}\n\n` +
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

      const targetProject = projects[0]; // 가장 유사한 프로젝트
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
   * 프로젝트 검색
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

  /**
   * 프로젝트 상세 조회
   */
  private async getProject(projectIdOrName: string): Promise<NotionProjectResult> {
    try {
      let project;
      
      if (projectIdOrName.length === 36 && projectIdOrName.includes('-')) {
        // UUID 형식이면 직접 조회
        const response = await this.notion.pages.retrieve({ page_id: projectIdOrName });
        project = this.formatProjectFromNotionPage(response);
      } else {
        // 이름으로 검색
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
      if (project.ledSize) {
        message += `📺 LED: ${project.ledSize}\n`;
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

  /**
   * 자연어에서 프로젝트 정보 추출
   */
  private parseProjectFromText(text: string): any {
    const info: any = {};

    // 서비스 유형 추출
    if (/(설치|구축|시공|공사)/.test(text)) {
      info.serviceType = '설치';
    } else if (/(렌탈|대여|임대|수주)/.test(text)) {
      info.serviceType = '렌탈';
    } else if (/(멤버쉽|회원|메쎄이상)/.test(text)) {
      info.serviceType = '멤버쉽';
    }

    // 프로젝트명 추출 (서비스 키워드 앞부분)
    const serviceKeywords = ['설치', '구축', '시공', '렌탈', '대여', '수주', '멤버쉽'];
    for (const keyword of serviceKeywords) {
      const index = text.indexOf(keyword);
      if (index > 0) {
        info.name = text.substring(0, index).trim();
        break;
      }
    }

    // 동작 키워드 제거
    if (info.name) {
      info.name = info.name.replace(/(수주했어|따냄|맡기|했어|됐어|완료)/, '').trim();
    }

    // 상태 추출
    if (/(견적|문의|요청)/.test(text)) {
      info.status = '견적 요청';
    } else if (/(승인|확정|결정)/.test(text)) {
      info.status = '견적 승인';
    } else if (/(완료|끝|마침)/.test(text)) {
      info.status = '완료';
    }

    // 고객사 추출
    const customerMatch = text.match(/([가-힣A-Za-z0-9]+(?:주식회사|회사|㈜|기업|그룹|센터))/);
    if (customerMatch) {
      info.customer = customerMatch[1];
    }

    // 장소 추출
    const locationMatch = text.match(/([가-힣]+(?:시|구|동|역|센터|빌딩|타워))/);
    if (locationMatch) {
      info.location = locationMatch[1];
    }

    // LED 크기 추출
    const ledSizeMatch = text.match(/(\d+)\s*(?:x|×|X)\s*(\d+)\s*(?:mm)?/);
    if (ledSizeMatch) {
      info.ledSize = `${ledSizeMatch[1]}x${ledSizeMatch[2]}mm`;
    }

    // 날짜 추출
    const dateMatch = text.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/) || 
                     text.match(/(\d{4})[-.]\s*(\d{1,2})[-.]\s*(\d{1,2})/);
    if (dateMatch) {
      if (dateMatch.length === 3) {
        // 월일 형식
        const currentYear = new Date().getFullYear();
        info.eventDate = `${currentYear}-${dateMatch[1].padStart(2, '0')}-${dateMatch[2].padStart(2, '0')}`;
      } else {
        // 년월일 형식
        info.eventDate = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
      }
    }

    console.log('📋 파싱된 프로젝트 정보:', info);
    return info;
  }

  /**
   * 자연어에서 업데이트 정보 추출
   */
  private parseUpdateFromText(text: string): any {
    const info: any = {};

    // 프로젝트 키워드 추출 (첫 번째 단어)
    const projectKeywordMatch = text.match(/^([가-힣A-Za-z0-9]+)/);
    if (projectKeywordMatch) {
      info.projectKeyword = projectKeywordMatch[1];
    }

    // 업데이트 유형 및 값 추출
    if (/(견적|승인|확정|완료|진행|시작|철거)/.test(text)) {
      info.type = 'status';
      if (/(견적.*완료|견적.*승인)/.test(text)) {
        info.value = '견적 승인';
      } else if (/(승인|확정|결정)/.test(text)) {
        info.value = '견적 승인';
      } else if (/(완료|끝|마침)/.test(text)) {
        info.value = '완료';
      } else if (/(설치.*시작|구축.*시작|진행)/.test(text)) {
        info.value = '설치 중';
      } else if (/(철거)/.test(text)) {
        info.value = '철거 중';
      } else {
        info.value = '견적 검토';
      }
    }

    // LED 크기 업데이트
    const ledSizeMatch = text.match(/(\d+)\s*(?:x|×|X)\s*(\d+)\s*(?:mm)?/);
    if (ledSizeMatch) {
      info.type = 'tech';
      info.value = `${ledSizeMatch[1]}x${ledSizeMatch[2]}mm`;
      info.field = 'LED 크기 (가로x세로)';
    }

    // 날짜 업데이트
    const dateMatch = text.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/) || 
                     text.match(/(\d{4})[-.]\s*(\d{1,2})[-.]\s*(\d{1,2})/);
    if (dateMatch && /(일정|날짜|변경)/.test(text)) {
      info.type = 'schedule';
      if (dateMatch.length === 3) {
        const currentYear = new Date().getFullYear();
        info.value = `${currentYear}-${dateMatch[1].padStart(2, '0')}-${dateMatch[2].padStart(2, '0')}`;
      } else {
        info.value = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
      }
    }

    // 고객 정보 업데이트
    if (/(고객|연락처|담당자)/.test(text)) {
      info.type = 'customer';
      const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      const phoneMatch = text.match(/(\d{2,3}-\d{3,4}-\d{4})/);
      const nameMatch = text.match(/([가-힣]{2,4})\s*(?:님|씨|대리|과장|부장|팀장)/);
      
      if (emailMatch) {
        info.value = emailMatch[1];
        info.field = '고객 연락처';
      } else if (phoneMatch) {
        info.value = phoneMatch[1];
        info.field = '고객 연락처';
      } else if (nameMatch) {
        info.value = nameMatch[1];
        info.field = '고객명';
      }
    }

    console.log('📝 파싱된 업데이트 정보:', info);
    return info;
  }

  /**
   * 업데이트 실행
   */
  private async executeUpdate(projectId: string, updateInfo: any, userProfile: any, originalText: string): Promise<{ success: boolean; description?: string; error?: string }> {
    try {
      const properties: any = {};
      let description = '';

      switch (updateInfo.type) {
        case 'status':
          properties['행사 상태'] = {
            status: { name: updateInfo.value }
          };
          description = `상태를 "${updateInfo.value}"로 변경`;
          break;

        case 'tech':
          properties[updateInfo.field] = {
            rich_text: [{ text: { content: updateInfo.value } }]
          };
          description = `${updateInfo.field}를 "${updateInfo.value}"로 변경`;
          break;

        case 'schedule':
          properties['행사 일정'] = {
            rich_text: [{ text: { content: updateInfo.value } }]
          };
          description = `일정을 "${updateInfo.value}"로 변경`;
          break;

        case 'customer':
          if (updateInfo.field === '고객 연락처') {
            properties['고객 연락처'] = {
              phone_number: updateInfo.value
            };
          } else {
            properties[updateInfo.field] = {
              rich_text: [{ text: { content: updateInfo.value } }]
            };
          }
          description = `${updateInfo.field}를 "${updateInfo.value}"로 변경`;
          break;

        default:
          return {
            success: false,
            error: '지원되지 않는 업데이트 유형입니다.'
          };
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
   * 프로젝트 이름으로 검색
   */
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

  /**
   * Notion 페이지를 프로젝트 객체로 변환
   */
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
      ledSize: properties['LED 크기 (가로x세로)']?.rich_text?.[0]?.text?.content || '',
      createdTime: page.created_time,
      lastEditedTime: page.last_edited_time
    };
  }
}

// MCP 도구 정의
export const notionProjectTool = {
  name: 'notion_project',
  description: 'Notion 데이터베이스에서 LED 렌탈/설치 프로젝트를 생성, 업데이트, 검색합니다. 자연어로 입력된 프로젝트 정보를 자동으로 파싱하여 적절한 Notion 필드에 저장하고 업데이트합니다.',
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
        description: '자연어로 입력된 프로젝트 내용 (예: "코엑스팝업 구축 수주했어", "코엑스팝업 견적 완료했어")'
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