// src/tools/notion-polling.ts
import { Client } from '@notionhq/client';
import { NotionStatusAutomation } from './notion-status-automation.js';

// 폴링 서비스 인스턴스 (싱글톤)
let pollingServiceInstance: NotionPollingService | null = null;

export class NotionPollingService {
  private notion: Client;
  private automation: NotionStatusAutomation;
  private lastCheckedPages: Map<string, string> = new Map();
  private lastFileCheckMap: Map<string, {
    hasQuote: boolean;
    hasRequest: boolean;
    lastChecked: number;
  }> = new Map();
  private pollingInterval: NodeJS.Timeout | null = null;
  private isPolling: boolean = false;

  constructor() {
    this.notion = new Client({ auth: process.env.NOTION_API_KEY });
    this.automation = new NotionStatusAutomation();
  }

  /**
   * 폴링 시작
   */
  async startPolling() {
    if (this.isPolling) {
      console.log('⚠️ 이미 폴링이 실행 중입니다.');
      return;
    }

    console.log('🔄 Notion 상태 변경 폴링 시작');
    this.isPolling = true;
    
    // 초기 상태 로드
    await this.loadInitialStates();
    
    // 30초마다 상태 확인
    this.pollingInterval = setInterval(async () => {
      await this.checkStatusChanges();
    }, 30000);
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
      
      const response = await this.notion.databases.query({
        database_id: process.env.NOTION_DATABASE_ID!,
        filter: {
          property: '행사 상태',
          status: {
            does_not_equal: '완료'
          }
        }
      });

      for (const page of response.results) {
        const pageId = page.id;
        const properties = (page as any).properties;
        const currentStatus = properties['행사 상태']?.status?.name;
        const eventName = properties['행사명']?.title?.[0]?.text?.content || 'Unknown';
        
        if (currentStatus) {
          this.lastCheckedPages.set(pageId, currentStatus);
          console.log(`📌 ${eventName}: ${currentStatus}`);
        }

        // 파일 상태도 초기화
        if (currentStatus === '견적 검토') {
          const hasQuoteFile = (properties['견적서']?.files || []).length > 0;
          const hasRequestFile = (properties['요청서']?.files || []).length > 0;
          
          this.lastFileCheckMap.set(pageId, {
            hasQuote: hasQuoteFile,
            hasRequest: hasRequestFile,
            lastChecked: Date.now()
          });
          
          console.log(`   파일 상태 - 견적서: ${hasQuoteFile ? '있음' : '없음'}, 요청서: ${hasRequestFile ? '있음' : '없음'}`);
        }
      }
      
      console.log(`✅ 초기 상태 로드 완료 (${this.lastCheckedPages.size}개 행사)`);
    } catch (error) {
      console.error('❌ 초기 상태 로드 실패:', error);
    }
  }

  /**
   * 상태 변경 및 파일 업로드 확인
   */
  private async checkStatusChanges() {
    try {
      const response = await this.notion.databases.query({
        database_id: process.env.NOTION_DATABASE_ID!,
        filter: {
          property: '행사 상태',
          status: {
            does_not_equal: '완료'
          }
        }
      });

      let changesDetected = 0;

      for (const page of response.results) {
        const pageId = page.id;
        const properties = (page as any).properties;
        const currentStatus = properties['행사 상태']?.status?.name;
        const eventName = properties['행사명']?.title?.[0]?.text?.content || 'Unknown';
        const lastStatus = this.lastCheckedPages.get(pageId);

        // 디버깅: 견적 검토 상태의 모든 페이지 확인
        if (currentStatus === '견적 검토') {
          console.log(`\n🔍 [${eventName}] 파일 속성 확인:`);
          console.log('견적서 속성:', JSON.stringify(properties['견적서'], null, 2));
          console.log('요청서 속성:', JSON.stringify(properties['요청서'], null, 2));
          
          // 파일 존재 여부 확인 (다양한 경우 처리)
          const quoteFiles = properties['견적서']?.files || [];
          const requestFiles = properties['요청서']?.files || [];
          
          const hasQuoteFile = quoteFiles.length > 0;
          const hasRequestFile = requestFiles.length > 0;
          
          console.log(`파일 상태: 견적서(${hasQuoteFile ? '있음' : '없음'}), 요청서(${hasRequestFile ? '있음' : '없음'})`);
          
          const lastFileCheck = this.lastFileCheckMap.get(pageId);
          console.log('이전 파일 상태:', lastFileCheck);
          
          // 파일 업로드 상태 확인
          if (hasQuoteFile && hasRequestFile) {
            // 이전 상태와 비교
            if (!lastFileCheck || !lastFileCheck.hasQuote || !lastFileCheck.hasRequest) {
              console.log(`✅ 파일 업로드 감지! 견적 승인으로 변경 시작...`);
              await this.updateToApproved(pageId, eventName);
              changesDetected++;
            } else {
              console.log('ℹ️ 파일이 이미 업로드된 상태');
            }
          } else {
            console.log(`⏳ 파일 대기 중... (견적서: ${hasQuoteFile}, 요청서: ${hasRequestFile})`);
          }
          
          // 현재 파일 상태 저장
          this.lastFileCheckMap.set(pageId, {
            hasQuote: hasQuoteFile,
            hasRequest: hasRequestFile,
            lastChecked: Date.now()
          });
        }

        // 일반 상태 변경 감지
        if (lastStatus && lastStatus !== currentStatus) {
          console.log(`\n🔄 상태 변경 감지: ${eventName} (${lastStatus} → ${currentStatus})`);
          changesDetected++;
          
          // 자동화 실행
          await this.handleStatusChange(pageId, currentStatus, lastStatus, eventName);
        }

        // 새로운 페이지 감지
        if (!lastStatus && currentStatus) {
          console.log(`\n🆕 새로운 행사 감지: ${eventName} (${currentStatus})`);
          
          // 새 페이지가 견적 검토 상태면 파일 상태 초기화
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

      if (changesDetected > 0) {
        console.log(`\n✅ ${changesDetected}개 변경사항 처리 완료`);
      }

      // 완료된 행사들 정리
      this.cleanupCompletedEvents(response.results);

    } catch (error) {
      console.error('❌ 상태 변경 확인 중 오류:', error);
    }
  }

  /**
   * 견적 승인으로 상태 변경
   */
  private async updateToApproved(pageId: string, eventName: string) {
    try {
      console.log(`🔄 [${eventName}] 견적 승인으로 변경 중...`);
      
      // 1. 상태를 "견적 승인"으로 변경
      await this.notion.pages.update({
        page_id: pageId,
        properties: {
          '행사 상태': {
            status: { name: '견적 승인' }
          }
        }
      });

      console.log(`✅ [${eventName}] 상태 변경 완료`);

      // 2. 현재 상태 업데이트
      this.lastCheckedPages.set(pageId, '견적 승인');

      // 3. 댓글 추가
      await this.notion.comments.create({
        parent: { page_id: pageId },
        rich_text: [
          {
            type: 'text',
            text: { 
              content: `✅ 파일 업로드 완료 - 자동 승인\n\n견적서와 요청서가 모두 업로드되어 자동으로 "견적 승인" 상태로 변경되었습니다.\n\n📎 업로드된 파일:\n• 견적서 ✓\n• 요청서 ✓\n\n🚚 다음 단계:\n배차 정보가 자동으로 생성됩니다.\n\n⏰ 변경 시간: ${new Date().toLocaleString()}` 
            }
          }
        ]
      });

      console.log(`✅ [${eventName}] 댓글 추가 완료`);

      // 4. 자동화 실행 (배차 정보 생성)
      await this.automation.onStatusQuoteApproved(pageId);
      
      console.log(`✅ [${eventName}] 견적 승인 프로세스 완료`);
      
    } catch (error) {
      console.error(`❌ 견적 승인 변경 실패 (${eventName}):`, error);
      
      // 오류 발생 시 댓글 추가
      try {
        await this.notion.comments.create({
          parent: { page_id: pageId },
          rich_text: [
            {
              type: 'text',
              text: { 
                content: `❌ 자동 승인 실패\n\n파일은 업로드되었으나 상태 변경 중 오류가 발생했습니다.\n오류: ${error instanceof Error ? error.message : String(error)}\n\n담당자가 수동으로 "견적 승인"으로 변경해주세요.` 
              }
            }
          ]
        });
      } catch (commentError) {
        console.error('댓글 추가 실패:', commentError);
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
          console.log('📊 견적서/요청서 작성 안내...');
          await this.automation.onStatusQuoteReview(pageId);
          console.log('✅ 견적 검토 프로세스 완료');
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
      
      // 오류 발생 시 Notion에 댓글 추가
      try {
        await this.notion.comments.create({
          parent: { page_id: pageId },
          rich_text: [
            {
              type: 'text',
              text: { 
                content: `❌ 자동화 오류 발생\n\n상태: ${oldStatus} → ${newStatus}\n오류: ${error instanceof Error ? error.message : String(error)}\n\n담당자 확인이 필요합니다.` 
              }
            }
          ]
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
    const activePageIds = new Set(activePages.map(page => page.id));
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
   * 현재 폴링 상태 확인
   */
  getPollingStatus() {
    return {
      isPolling: this.isPolling,
      trackedPages: this.lastCheckedPages.size,
      trackedFiles: this.lastFileCheckMap.size,
      lastCheckedPages: Array.from(this.lastCheckedPages.entries()),
      fileStatuses: Array.from(this.lastFileCheckMap.entries()).map(([pageId, status]) => ({
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
      
      const automation = new NotionStatusAutomation();
      
      switch (status) {
        case '견적 검토':
          await automation.onStatusQuoteReview(pageId);
          break;
        case '견적 승인':
          await automation.onStatusQuoteApproved(pageId);
          break;
        case '구인 완료':
          await automation.onStatusRecruitmentComplete(pageId);
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
   * 수동으로 파일 체크 (디버깅용)
   */
  async manualFileCheck(pageId: string) {
    try {
      const page = await this.notion.pages.retrieve({ page_id: pageId });
      const properties = (page as any).properties;
      
      const fileInfo = {
        pageId,
        eventName: properties['행사명']?.title?.[0]?.text?.content || 'Unknown',
        status: properties['행사 상태']?.status?.name,
        quoteFiles: properties['견적서']?.files || [],
        requestFiles: properties['요청서']?.files || [],
        hasQuoteFile: (properties['견적서']?.files || []).length > 0,
        hasRequestFile: (properties['요청서']?.files || []).length > 0
      };
      
      console.log('📁 파일 체크 결과:', fileInfo);
      return fileInfo;
      
    } catch (error) {
      console.error('❌ 파일 체크 실패:', error);
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