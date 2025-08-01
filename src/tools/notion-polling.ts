import { Client } from '@notionhq/client';
import { NotionStatusAutomation } from './notion-status-automation.js';
import { 
  getFileUploadMessage,
  getErrorMessage,
  replaceMessageVariables 
} from '../utils/notion-message-utils.js';
import { getNotionServiceType } from '../constants/notion-messages.js';

// 폴링 서비스 인스턴스 (싱글톤)
let pollingServiceInstance: NotionPollingService | null = null;

export class NotionPollingService {
  private notion: Client;
  private automation: NotionStatusAutomation;
  private lastCheckedPages: Map<string, string> = new Map();
  private lastFileCheckMap: Map<string, { hasQuote: boolean; hasRequest: boolean; lastChecked: number }> = new Map();
  private pollingInterval: NodeJS.Timeout | null = null;
  private isPolling: boolean = false;
  private managersConfig: any;

  constructor() {
    this.notion = new Client({ auth: process.env.NOTION_API_KEY });
    this.automation = new NotionStatusAutomation();
    
    // 담당자 설정 로드 - 안전하게 처리
    try {
      this.managersConfig = process.env.MANAGERS_CONFIG 
        ? JSON.parse(process.env.MANAGERS_CONFIG)
        : { managers: [] };
    } catch (error) {
      console.warn('NotionPollingService - MANAGERS_CONFIG 파싱 실패, 기본값 사용');
      this.managersConfig = { managers: [] };
    }
  }

  /**
   * 담당자 언급을 포함한 리치 텍스트 생성
   */
  private async createRichTextWithMention(pageId: string, content: string): Promise<any[]> {
    try {
      // 페이지에서 정보 가져오기
      const page = await this.notion.pages.retrieve({ page_id: pageId });
      const properties = (page as any).properties;
      const assignedPeople = properties['담당자']?.people || [];
      const serviceType = properties['서비스 유형']?.select?.name || '';
      
      const richText: any[] = [
        {
          type: 'text',
          text: { content }
        }
      ];

      // 담당자 언급 추가
      if (assignedPeople.length > 0) {
        // 지정된 담당자가 있는 경우
        richText.push({
          type: 'text',
          text: { content: '\n\n📢 담당자 확인 요청: ' },
          annotations: { bold: true }
        });

        assignedPeople.forEach((person: any, index: number) => {
          richText.push({
            type: 'mention',
            mention: {
              type: 'user',
              user: { id: person.id }
            }
          });

          if (index < assignedPeople.length - 1) {
            richText.push({
              type: 'text',
              text: { content: ', ' }
            });
          }
        });
      } else {
        // 담당자가 지정되지 않은 경우 - 서비스별 기본 담당자 언급
        let targetManagers = [];
        
        if (serviceType === '설치') {
          // 설치는 준수 유 구축팀장
          targetManagers = this.managersConfig.managers.filter((m: any) => 
            m.notionId === '225d872b-594c-8157-b968-0002e2380097'
          );
        } else if (serviceType === '렌탈' || serviceType === '멤버쉽') {
          // 렌탈과 멤버쉽은 수삼 최 렌탈팀장
          targetManagers = this.managersConfig.managers.filter((m: any) => 
            m.notionId === '237d872b-594c-8174-9ab2-00024813e3a9'
          );
        } else {
          // 기본값: 모든 활성 담당자
          targetManagers = this.managersConfig.managers.filter((m: any) => m.isActive);
        }
        
        if (targetManagers.length > 0) {
          richText.push({
            type: 'text',
            text: { content: '\n\n📢 담당자 확인 요청: ' },
            annotations: { bold: true }
          });

          targetManagers.forEach((manager: any, index: number) => {
            richText.push({
              type: 'mention',
              mention: {
                type: 'user',
                user: { id: manager.notionId }
              }
            });

            if (manager.department) {
              richText.push({
                type: 'text',
                text: { content: `(${manager.department})` }
              });
            }

            if (index < targetManagers.length - 1) {
              richText.push({
                type: 'text',
                text: { content: ', ' }
              });
            }
          });
        }
      }

      richText.push({
        type: 'text',
        text: { content: '\n\n⏰ 빠른 확인 부탁드립니다!' },
        annotations: { bold: true }
      });

      return richText;
      
    } catch (error) {
      console.error('리치 텍스트 생성 실패:', error);
      // 오류 시 기본 텍스트만 반환
      return [{ type: 'text', text: { content } }];
    }
  }

  /**
   * 폴링 시작
   */
  async startPolling() {
    if (this.isPolling) {
      console.log('⚠️ 이미 폴링이 실행 중입니다.');
      return;
    }

    console.log('🔄 Notion 상태 변경 폴링 시작 (10분 간격)');
    this.isPolling = true;
    
    // 초기 상태 로드
    await this.loadInitialStates();
    
    // 10분마다 상태 확인 (600초 = 600,000ms)
    this.pollingInterval = setInterval(async () => {
      await this.checkStatusChanges();
    }, 600000); // 600000으로 변경
  }

  /**
   * 폴링 중지
   */
  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.isPolling = false;
    console.log('🛑 Notion 폴링 중지');
  }

  /**
   * 초기 상태 로드 (폴링 시작 시 현재 상태 저장)
   */
  private async loadInitialStates() {
    try {
      console.log('📋 초기 상태 로드 중...');
      
      // 데이터베이스 ID를 하이픈 형식으로 변환
      const databaseId = this.formatDatabaseId(process.env.NOTION_DATABASE_ID!);
      console.log(`   데이터베이스 ID: ${databaseId}`);
      
      const response = await this.notion.databases.query({
        database_id: databaseId,
        filter: {
          property: '행사 상태',
          status: {
            does_not_equal: '완료'
          }
        }
      });

      console.log(`   총 ${response.results.length}개 행사 조회됨`);
      
      let quoteReviewCount = 0;

      for (const page of response.results) {
        if (page.object !== 'page') continue;
        
        const pageId = page.id;
        const properties = (page as any).properties;
        const currentStatus = properties['행사 상태']?.status?.name;
        const eventName = properties['행사명']?.title?.[0]?.text?.content || 'Unknown';
        
        if (currentStatus) {
          this.lastCheckedPages.set(pageId, currentStatus);
          console.log(`📌 ${eventName}: ${currentStatus}`);
          
          // 파일 상태도 초기화 (견적 검토 상태일 때)
          if (currentStatus === '견적 검토') {
            quoteReviewCount++;
            const hasQuoteFile = (properties['견적서']?.files || []).length > 0;
            const hasRequestFile = (properties['요청서']?.files || []).length > 0;
            
            this.lastFileCheckMap.set(pageId, {
              hasQuote: hasQuoteFile,
              hasRequest: hasRequestFile,
              lastChecked: Date.now()
            });
            
            console.log(`   파일 상태: 견적서=${hasQuoteFile ? '✅' : '❌'}, 요청서=${hasRequestFile ? '✅' : '❌'}`);
            
            // 파일 정보 상세 출력
            if (hasQuoteFile || hasRequestFile) {
              console.log(`   견적서 파일: ${properties['견적서']?.files?.map((f: any) => f.name).join(', ') || '없음'}`);
              console.log(`   요청서 파일: ${properties['요청서']?.files?.map((f: any) => f.name).join(', ') || '없음'}`);
            }
          }
        }
      }
      
      console.log(`✅ 초기 상태 로드 완료 (총 ${this.lastCheckedPages.size}개, 견적검토 ${quoteReviewCount}개)`);
    } catch (error) {
      console.error('❌ 초기 상태 로드 실패:', error);
      if (error instanceof Error) {
        console.error('오류 상세:', error.message);
      }
    }
  }

  /**
   * 상태 변경 확인
   */
  private async checkStatusChanges() {
    try {
      const databaseId = this.formatDatabaseId(process.env.NOTION_DATABASE_ID!);
      
      console.log('🔍 상태 변경 확인 중...');
      console.log(`   데이터베이스 ID: ${databaseId}`);
      
      const response = await this.notion.databases.query({
        database_id: databaseId,
        filter: {
          property: '행사 상태',
          status: {
            does_not_equal: '완료'
          }
        }
      });

      console.log(`   조회된 페이지 수: ${response.results.length}`);

      let changesDetected = 0;
      let fileCheckCount = 0;
      let quoteReviewCount = 0;

      for (const page of response.results) {
        if (page.object !== 'page') continue;
        
        const pageId = page.id;
        const properties = (page as any).properties;
        const currentStatus = properties['행사 상태']?.status?.name;
        const eventName = properties['행사명']?.title?.[0]?.text?.content || 'Unknown';
        
        console.log(`   📋 ${eventName}: ${currentStatus}`);
        
        // 견적 검토 상태 카운트
        if (currentStatus === '견적 검토') {
          quoteReviewCount++;
        }
        
        const lastStatus = this.lastCheckedPages.get(pageId);

        // 1. 상태 변경 감지
        if (lastStatus && lastStatus !== currentStatus) {
          console.log(`🔄 상태 변경 감지: ${eventName} (${lastStatus} → ${currentStatus})`);
          changesDetected++;
          
          // 자동화 실행
          await this.handleStatusChange(pageId, currentStatus, lastStatus, eventName);
        }

        // 2. 견적 검토 상태인 모든 페이지의 파일 체크
        if (currentStatus === '견적 검토') {
          fileCheckCount++;
          console.log(`📄 파일 체크 시작: ${eventName}`);
          
          // 파일 속성 상세 로그
          console.log(`   견적서 속성:`, JSON.stringify(properties['견적서'], null, 2));
          console.log(`   요청서 속성:`, JSON.stringify(properties['요청서'], null, 2));
          
          // 파일 정보 직접 확인
          const quoteFiles = properties['견적서']?.files || [];
          const requestFiles = properties['요청서']?.files || [];
          
          const hasQuoteFile = quoteFiles.length > 0;
          const hasRequestFile = requestFiles.length > 0;
          
          console.log(`   견적서: ${hasQuoteFile ? '✅' : '❌'} (${quoteFiles.length}개)`);
          console.log(`   요청서: ${hasRequestFile ? '✅' : '❌'} (${requestFiles.length}개)`);
          
          // 디버깅을 위한 파일 정보 출력
          if (hasQuoteFile) {
            console.log(`   견적서 파일:`, quoteFiles.map((f: any) => f.name || 'unnamed').join(', '));
          }
          if (hasRequestFile) {
            console.log(`   요청서 파일:`, requestFiles.map((f: any) => f.name || 'unnamed').join(', '));
          }
          
          // 이전 파일 상태 가져오기
          const lastFileCheck = this.lastFileCheckMap.get(pageId);
          console.log(`   이전 파일 상태:`, lastFileCheck);
          
          // 파일 상태 변경 감지
          const fileStateChanged = !lastFileCheck || 
                                 lastFileCheck.hasQuote !== hasQuoteFile || 
                                 lastFileCheck.hasRequest !== hasRequestFile;
          
          if (fileStateChanged) {
            console.log(`📎 파일 상태 변경 감지: ${eventName}`);
            console.log(`   이전: 견적서=${lastFileCheck?.hasQuote ? '✅' : '❌'}, 요청서=${lastFileCheck?.hasRequest ? '✅' : '❌'}`);
            console.log(`   현재: 견적서=${hasQuoteFile ? '✅' : '❌'}, 요청서=${hasRequestFile ? '✅' : '❌'}`);
          }
          
          // 두 파일이 모두 있으면 승인으로 변경
          if (hasQuoteFile && hasRequestFile) {
            console.log(`🎯 두 파일 모두 확인됨!`);
            
            // 이전에 두 파일이 모두 없었던 경우만 처리
            if (!lastFileCheck || !lastFileCheck.hasQuote || !lastFileCheck.hasRequest) {
              console.log(`✅ 파일 업로드 완료 감지! ${eventName} - 견적 승인으로 변경합니다.`);
              await this.updateToApproved(pageId, eventName);
              changesDetected++;
            } else {
              console.log(`   이미 처리된 파일입니다.`);
            }
          } else if (fileStateChanged && (hasQuoteFile || hasRequestFile)) {
            console.log(`📋 파일 일부만 업로드됨`);
            // 파일이 하나만 업로드된 경우 알림
            await this.addPartialUploadComment(pageId, hasQuoteFile, hasRequestFile);
          }
          
          // 현재 파일 상태 저장
          this.lastFileCheckMap.set(pageId, {
            hasQuote: hasQuoteFile,
            hasRequest: hasRequestFile,
            lastChecked: Date.now()
          });
        }

        // 3. 새로운 페이지 감지
        if (!lastStatus && currentStatus) {
          console.log(`🆕 새로운 행사 감지: ${eventName} (${currentStatus})`);
          
          // 새 페이지도 파일 체크 맵에 추가
          if (currentStatus === '견적 검토') {
            const hasQuoteFile = (properties['견적서']?.files || []).length > 0;
            const hasRequestFile = (properties['요청서']?.files || []).length > 0;
            
            this.lastFileCheckMap.set(pageId, {
              hasQuote: hasQuoteFile,
              hasRequest: hasRequestFile,
              lastChecked: Date.now()
            });
          }
        }

        // 현재 상태 저장
        if (currentStatus) {
          this.lastCheckedPages.set(pageId, currentStatus);
        }
      }

      console.log(`✅ 체크 완료: ${response.results.length}개 중 견적검토 ${quoteReviewCount}개, 파일체크 ${fileCheckCount}개, 변경감지 ${changesDetected}개`);

      // 완료된 행사들 정리
      this.cleanupCompletedEvents(response.results);

    } catch (error) {
      console.error('❌ 상태 변경 확인 중 오류:', error);
      if (error instanceof Error) {
        console.error('오류 상세:', error.message);
        console.error('스택:', error.stack);
      }
    }
  }

  /**
   * 부분 업로드 알림 댓글 - 담당자 언급 포함
   */
  private async addPartialUploadComment(pageId: string, hasQuote: boolean, hasRequest: boolean) {
    try {
      // 서비스 타입 가져오기
      const page = await this.notion.pages.retrieve({ page_id: pageId });
      const serviceType = (page as any).properties['서비스 유형']?.select?.name || '렌탈';
      
      const variables = {
        uploadedFile: hasQuote ? '견적서' : '요청서',
        missingFile: !hasQuote ? '견적서' : '요청서',
        timestamp: new Date().toLocaleString()
      };
      
      const content = getFileUploadMessage(serviceType, 'PARTIAL_UPLOAD', variables);
      
      const richText = await this.createRichTextWithMention(pageId, content);
      
      await this.notion.comments.create({
        parent: { page_id: pageId },
        rich_text: richText
      });
      
      console.log('✅ 부분 업로드 알림 댓글 추가 완료');
    } catch (error) {
      console.error('댓글 추가 실패:', error);
    }
  }

  /**
   * 견적 승인으로 상태 변경
   */
  private async updateToApproved(pageId: string, eventName: string) {
    try {
      console.log(`🔄 ${eventName} - 견적 승인으로 변경 시작`);
      
      // 1. 상태를 "견적 승인"으로 변경
      await this.notion.pages.update({
        page_id: pageId,
        properties: {
          '행사 상태': {
            status: { name: '견적 승인' }
          }
        }
      });

      console.log(`✅ 상태 변경 완료`);

      // 2. 댓글 추가 (담당자 언급 포함)
      // 서비스 타입 가져오기
      const page = await this.notion.pages.retrieve({ page_id: pageId });
      const serviceType = (page as any).properties['서비스 유형']?.select?.name || '렌탈';

      const variables = {
        timestamp: new Date().toLocaleString()
      };

      const content = getFileUploadMessage(serviceType, 'AUTO_APPROVAL', variables);
      const richText = await this.createRichTextWithMention(pageId, content);
      
      await this.notion.comments.create({
        parent: { page_id: pageId },
        rich_text: richText
      });

      // 3. 상태 변경 기록 업데이트
      this.lastCheckedPages.set(pageId, '견적 승인');

      // 4. 자동화 실행 (배차 정보 생성)
      await this.automation.onStatusQuoteApproved(pageId);
      
      console.log(`✅ ${eventName} - 견적 승인으로 자동 변경 완료`);
      
    } catch (error) {
      console.error(`❌ 견적 승인 변경 실패 (${eventName}):`, error);
      
      // 오류 발생 시 댓글 추가 (담당자 언급 포함)
      try {
        const variables = {
          errorMessage: error instanceof Error ? error.message : '알 수 없는 오류',
          timestamp: new Date().toLocaleString()
        };
        
        const errorContent = getErrorMessage('FILE_APPROVAL_ERROR', variables);
        const richText = await this.createRichTextWithMention(pageId, errorContent);
        
        await this.notion.comments.create({
          parent: { page_id: pageId },
          rich_text: richText
        });
      } catch (commentError) {
        console.error('오류 댓글 추가 실패:', commentError);
      }
    }
  }

  /**
   * 상태 변경 처리
   */
  private async handleStatusChange(pageId: string, newStatus: string, oldStatus: string, eventName: string) {
    try {
      console.log(`🎯 자동화 실행: ${eventName} (${oldStatus} → ${newStatus})`);
      
      switch (newStatus) {
        case '견적 검토':
          console.log('📊 견적 정보 자동 생성 시작...');
          await this.automation.onStatusQuoteReview(pageId);
          console.log('✅ 견적 정보 생성 완료');
          break;
          
        case '견적 승인':
          console.log('🚚 배차 정보 자동 생성 시작...');
          await this.automation.onStatusQuoteApproved(pageId);
          console.log('✅ 배차 정보 생성 완료');
          break;
          
        case '구인 완료':
          console.log('👷 구인 완료 프로세스 시작...');
          await this.automation.onStatusRecruitmentComplete(pageId);
          console.log('✅ 구인 완료 프로세스 완료');
          break;
          
        default:
          console.log(`ℹ️ "${newStatus}" 상태에 대한 자동화는 설정되지 않았습니다.`);
      }
      
    } catch (error) {
      console.error(`❌ 상태 변경 처리 실패 (${eventName}):`, error);
      
      // 오류 발생 시 Notion에 댓글 추가 (담당자 언급 포함)
      try {
        const variables = {
          oldStatus: oldStatus,
          newStatus: newStatus,
          errorMessage: error instanceof Error ? error.message : '알 수 없는 오류',
          timestamp: new Date().toLocaleString()
        };
        
        const errorContent = getErrorMessage('AUTOMATION_ERROR', variables);
        const richText = await this.createRichTextWithMention(pageId, errorContent);
        
        await this.notion.comments.create({
          parent: { page_id: pageId },
          rich_text: richText
        });
      } catch (commentError) {
        console.error('댓글 추가 실패:', commentError);
      }
    }
  }

  /**
   * 완료된 행사들 메모리에서 정리
   */
  private cleanupCompletedEvents(activePages: any[]) {
    const activePageIds = new Set(activePages.filter(p => p.object === 'page').map(page => page.id));
    const currentPageIds = Array.from(this.lastCheckedPages.keys());
    
    for (const pageId of currentPageIds) {
      if (!activePageIds.has(pageId)) {
        this.lastCheckedPages.delete(pageId);
        this.lastFileCheckMap.delete(pageId);
        console.log(`🗑️ 완료된 행사 정리: ${pageId}`);
      }
    }
  }

  /**
   * 데이터베이스 ID 포맷 변환
   */
  private formatDatabaseId(id: string): string {
    // 하이픈 제거된 ID를 하이픈 포함 형식으로 변환
    if (!id.includes('-') && id.length === 32) {
      return `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;
    }
    return id;
  }

  /**
   * 현재 폴링 상태 확인
   */
  getPollingStatus() {
    return {
      isPolling: this.isPolling,
      trackedPages: this.lastCheckedPages.size,
      fileTrackingPages: this.lastFileCheckMap.size,
      lastCheckedPages: Array.from(this.lastCheckedPages.entries()).map(([pageId, status]) => ({
        pageId,
        status
      })),
      fileStatus: Array.from(this.lastFileCheckMap.entries()).map(([pageId, status]) => ({
        pageId,
        hasQuote: status.hasQuote,
        hasRequest: status.hasRequest,
        lastChecked: new Date(status.lastChecked).toLocaleString()
      }))
    };
  }

  /**
   * 수동으로 특정 페이지 상태 변경 처리
   */
  async manualTrigger(pageId: string, status: string) {
    try {
      console.log(`🔧 수동 트리거 실행: ${pageId} → ${status}`);
      
      switch (status) {
        case '견적 검토':
          await this.automation.onStatusQuoteReview(pageId);
          break;
        case '견적 승인':
          await this.automation.onStatusQuoteApproved(pageId);
          break;
        case '구인 완료':
          await this.automation.onStatusRecruitmentComplete(pageId);
          break;
        default:
          throw new Error(`지원하지 않는 상태: ${status}`);
      }
      
      console.log('✅ 수동 트리거 완료');
      return { success: true };
      
    } catch (error) {
      console.error('❌ 수동 트리거 실패:', error);
      throw error;
    }
  }

  /**
   * 특정 페이지의 파일 상태 수동 확인
   */
  async checkPageFiles(pageId: string) {
    try {
      const page = await this.notion.pages.retrieve({ page_id: pageId });
      const properties = (page as any).properties;
      const eventName = properties['행사명']?.title?.[0]?.text?.content || 'Unknown';
      const currentStatus = properties['행사 상태']?.status?.name;
      // 수정: "고객담당자" → "고객명"
      const customerName = properties['고객명']?.rich_text?.[0]?.text?.content || 'Unknown';
      
      console.log(`📄 파일 상태 확인 - ${eventName} (${currentStatus}):`);
      console.log(`   - 고객: ${customerName}`);
      console.log(`   - 견적서: ${properties['견적서']?.files?.length > 0 ? '✅' : '❌'}`);
      console.log(`   - 요청서: ${properties['요청서']?.files?.length > 0 ? '✅' : '❌'}`);
      
      return {
        eventName,
        status: currentStatus,
        customerName,
        hasQuoteFile: properties['견적서']?.files?.length > 0,
        hasRequestFile: properties['요청서']?.files?.length > 0,
        quoteFiles: properties['견적서']?.files || [],
        requestFiles: properties['요청서']?.files || []
      };
    } catch (error) {
      console.error('페이지 파일 확인 실패:', error);
      throw error;
    }
  }
}

/**
 * 폴링 서비스 인스턴스 가져오기 (싱글톤)
 */
export function getPollingService(): NotionPollingService {
  if (!pollingServiceInstance) {
    pollingServiceInstance = new NotionPollingService();
  }
  return pollingServiceInstance;
}

/**
 * 폴링 서비스 시작
 */
export async function startPollingService() {
  const service = getPollingService();
  await service.startPolling();
}

/**
 * 폴링 서비스 중지
 */
export function stopPollingService() {
  if (pollingServiceInstance) {
    pollingServiceInstance.stopPolling();
  }
}