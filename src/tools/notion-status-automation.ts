import { Client } from '@notionhq/client';
import { GoogleDriveService } from './google-drive-service.js';
import { calculateMultiLEDQuote } from './calculate-quote.js';

const notion = new Client({ auth: process.env.NOTION_API_KEY });

// 행사 상태 관리 서비스
export class NotionStatusAutomation {
  private driveService: GoogleDriveService;
  
  constructor() {
    this.driveService = new GoogleDriveService();
  }

  /**
   * 행사 상태가 "견적 검토"로 변경되었을 때 자동 실행
   */
  async onStatusQuoteReview(pageId: string) {
    try {
      console.log('📊 견적 검토 상태로 변경됨 - 견적서/요청서 자동 생성 시작');
      
      // 1. Notion에서 행사 정보 가져오기
      const eventData = await this.getEventDataFromNotion(pageId);
      
      // 2. 견적 계산
      const quote = this.calculateQuoteFromEventData(eventData);
      
      // 3. 구글 드라이브에 견적서/요청서 생성
      const driveResult = await this.driveService.generateQuoteAndRequestFiles(eventData, quote);
      
      // 4. Notion에 파일 링크 저장
      await this.updateNotionWithFileLinks(pageId, driveResult);
      
      // 5. 완료 댓글 추가
      await this.addQuoteReviewComment(pageId, driveResult);
      
      console.log('✅ 견적 검토 프로세스 완료');
      return driveResult;
      
    } catch (error) {
      console.error('❌ 견적 검토 프로세스 실패:', error);
      throw error;
    }
  }

  /**
   * 행사 상태가 "견적 승인"으로 변경되었을 때 자동 실행
   */
  async onStatusQuoteApproved(pageId: string) {
    try {
      console.log('✅ 견적 승인됨 - 배차 정보 자동 생성');
      
      // 1. 행사 정보 가져오기
      const eventData = await this.getEventDataFromNotion(pageId);
      
      // 2. 배차 정보 생성
      const dispatchInfo = this.generateDispatchMessage(eventData);
      
      // 3. 배차 댓글 추가
      await this.addDispatchComment(pageId, dispatchInfo);
      
      console.log('✅ 배차 정보 생성 완료');
      return dispatchInfo;
      
    } catch (error) {
      console.error('❌ 배차 정보 생성 실패:', error);
      throw error;
    }
  }

  /**
   * 행사 상태가 "구인 완료"로 변경되었을 때 자동 실행
   */
  async onStatusRecruitmentComplete(pageId: string) {
    try {
      console.log('👷 구인 완료 - 최종 준비 상황 확인');
      
      const eventData = await this.getEventDataFromNotion(pageId);
      const completionInfo = this.generateCompletionMessage(eventData);
      
      await this.addCompletionComment(pageId, completionInfo);
      
      console.log('✅ 구인 완료 프로세스 완료');
      return completionInfo;
      
    } catch (error) {
      console.error('❌ 구인 완료 프로세스 실패:', error);
      throw error;
    }
  }

  /**
   * 자동 상태 변경 (일정 기반)
   */
  async autoUpdateStatusBySchedule() {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // 설치일이 오늘인 행사들을 "설치 중"으로 변경
      await this.updateStatusByDate('설치 일정', today, '설치 중');
      
      // 행사일이 오늘인 행사들을 "운영 중"으로 변경
      await this.updateStatusByDate('행사 일정', today, '운영 중');
      
      // 철거일이 오늘인 행사들을 "철거 중"으로 변경
      await this.updateStatusByDate('철거 일정', today, '철거 중');
      
    } catch (error) {
      console.error('❌ 자동 상태 변경 실패:', error);
    }
  }

  /**
   * Notion에서 행사 정보 가져오기
   */
  private async getEventDataFromNotion(pageId: string) {
    const response = await notion.pages.retrieve({ page_id: pageId });
    const properties = (response as any).properties;
    
    // LED 사양 정보 수집
    const ledSpecs = [];
    for (let i = 1; i <= 5; i++) {
      const sizeProperty = properties[`LED${i} 크기`];
      if (sizeProperty?.rich_text?.[0]?.text?.content) {
        ledSpecs.push({
          size: sizeProperty.rich_text[0].text.content,
          stageHeight: properties[`LED${i} 무대 높이`]?.number || 0,
          needOperator: properties[`LED${i} 오퍼레이터 필요`]?.checkbox || false,
          operatorDays: properties[`LED${i} 오퍼레이터 일수`]?.number || 0,
          prompterConnection: properties[`LED${i} 프롬프터 연결`]?.checkbox || false,
          relayConnection: properties[`LED${i} 중계카메라 연결`]?.checkbox || false
        });
      }
    }
    
    return {
      eventName: properties['행사명']?.title?.[0]?.text?.content || '',
      customerName: properties['고객사']?.select?.name || '',
      contactName: properties['고객담당자']?.rich_text?.[0]?.text?.content || '',
      contactPhone: properties['고객 연락처']?.phone_number || '',
      venue: properties['행사장']?.rich_text?.[0]?.text?.content || '',
      eventSchedule: properties['행사 일정']?.rich_text?.[0]?.text?.content || '',
      installSchedule: properties['설치 일정']?.date?.start || '',
      rehearsalSchedule: properties['리허설 일정']?.date?.start || '',
      dismantleSchedule: properties['철거 일정']?.date?.start || '',
      ledSpecs: ledSpecs,
      totalModuleCount: properties['총 LED 모듈 수량']?.number || 0
    };
  }

  /**
   * 견적 계산
   */
  private calculateQuoteFromEventData(eventData: any) {
    return calculateMultiLEDQuote(eventData.ledSpecs);
  }

  /**
   * Notion에 파일 링크 저장
   */
  private async updateNotionWithFileLinks(pageId: string, driveResult: any) {
    await notion.pages.update({
      page_id: pageId,
      properties: {
        '견적서 링크': {
          url: driveResult.quoteFileUrl
        },
        '요청서 링크': {
          url: driveResult.requestFileUrl
        }
      }
    });
  }

  /**
   * 견적 검토 완료 댓글 추가
   */
  private async addQuoteReviewComment(pageId: string, driveResult: any) {
    const comment = `📊 견적 검토 단계 완료

✅ 자동 생성된 파일들:
📋 견적서: ${driveResult.quoteFileUrl}
📄 요청서: ${driveResult.requestFileUrl}

🔄 다음 단계:
1. 생성된 파일들을 검토해주세요
2. 필요시 수정 사항을 반영해주세요
3. 고객사에 견적서와 요청서를 전달해주세요
4. 고객 승인 후 상태를 "견적 승인"으로 변경해주세요`;

    await notion.comments.create({
      parent: { page_id: pageId },
      rich_text: [{ type: 'text', text: { content: comment } }]
    });
  }

  /**
   * 배차 정보 생성
   */
  private generateDispatchMessage(eventData: any) {
    const totalModules = eventData.totalModuleCount || 0;
    const installDate = eventData.installSchedule;
    const dismantleDate = eventData.dismantleSchedule;
    
    // 배차 정보 계산
    let truckInfo = '';
    if (totalModules <= 80) {
      truckInfo = '1.5톤 트럭 1대';
    } else {
      const truckCount = Math.ceil(totalModules / 200);
      truckInfo = `3.5톤 트럭 ${truckCount}대`;
    }
    
    const plateBoxCount = Math.ceil(totalModules / 8);
    
    return {
      message: `🚚 배차 정보 (${eventData.eventName})

📋 기본 정보:
• 고객사: ${eventData.customerName}
• 행사장: ${eventData.venue}
• 담당자: ${eventData.contactName} (${eventData.contactPhone})

📦 운반 물품:
• LED 모듈: ${totalModules}개
• 플레이트 케이스: ${plateBoxCount}박스
• 필요 차량: ${truckInfo}

📅 일정:
• 설치일: ${installDate}
• 철거일: ${dismantleDate}

📍 배송지: ${eventData.venue}

⚠️ 주의사항:
- 설치 전날까지 현장 도착 필수
- 하차 지점 및 주차 공간 사전 확인
- 기사님께 연락처 공유 필요`,
      truckInfo,
      plateBoxCount,
      totalModules
    };
  }

  /**
   * 배차 댓글 추가
   */
  private async addDispatchComment(pageId: string, dispatchInfo: any) {
    await notion.comments.create({
      parent: { page_id: pageId },
      rich_text: [{ type: 'text', text: { content: dispatchInfo.message } }]
    });
  }

  /**
   * 구인 완료 정보 생성
   */
  private generateCompletionMessage(eventData: any) {
    return {
      message: `✅ 배차 및 구인 완료 확인

🚚 배차 상황: 완료
👷 인력 구인: 완료

📋 최종 체크리스트:
□ 배차 기사님께 연락처 전달
□ 설치 인력 현장 시간 확인
□ 고객사 현장 담당자 연락처 확인
□ 장비 점검 완료 확인
□ 보험 및 안전 사항 점검

🔄 다음 단계:
설치일에 자동으로 "설치 중" 상태로 변경됩니다.`
    };
  }

  /**
   * 구인 완료 댓글 추가
   */
  private async addCompletionComment(pageId: string, completionInfo: any) {
    await notion.comments.create({
      parent: { page_id: pageId },
      rich_text: [{ type: 'text', text: { content: completionInfo.message } }]
    });
  }

  /**
   * 날짜 기준 상태 업데이트
   */
  private async updateStatusByDate(dateProperty: string, targetDate: string, newStatus: string) {
    try {
      // 해당 날짜인 행사들 조회
      const response = await notion.databases.query({
        database_id: process.env.NOTION_DATABASE_ID!,
        filter: {
          property: dateProperty,
          date: {
            equals: targetDate
          }
        }
      });

      // 각 행사의 상태 업데이트
      for (const page of response.results) {
        await notion.pages.update({
          page_id: page.id,
          properties: {
            '행사 상태': {
              status: { name: newStatus }
            }
          }
        });
        
        console.log(`✅ ${page.id} 상태를 "${newStatus}"로 변경`);
      }
      
    } catch (error) {
      console.error(`❌ ${newStatus} 상태 변경 실패:`, error);
    }
  }
}

// 상태 변경 감지 및 자동화 실행
export const statusAutomationTool = {
  definition: {
    name: 'handle_status_change',
    description: 'Notion 행사 상태 변경에 따른 자동화 프로세스를 실행합니다',
    inputSchema: {
      type: 'object',
      properties: {
        pageId: {
          type: 'string',
          description: 'Notion 페이지 ID'
        },
        newStatus: {
          type: 'string',
          description: '변경된 상태값'
        }
      },
      required: ['pageId', 'newStatus']
    }
  },

  handler: async (args: any) => {
    try {
      const { pageId, newStatus } = args;
      const automation = new NotionStatusAutomation();
      
      let result;
      
      switch (newStatus) {
        case '견적 검토':
          result = await automation.onStatusQuoteReview(pageId);
          break;
        case '견적 승인':
          result = await automation.onStatusQuoteApproved(pageId);
          break;
        case '구인 완료':
          result = await automation.onStatusRecruitmentComplete(pageId);
          break;
        default:
          return {
            content: [{
              type: 'text',
              text: `상태 "${newStatus}"에 대한 자동화 프로세스가 정의되지 않았습니다.`
            }]
          };
      }
      
      return {
        content: [{
          type: 'text',
          text: `✅ "${newStatus}" 상태 변경에 따른 자동화 프로세스가 완료되었습니다.`
        }],
        result
      };
      
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ 상태 변경 자동화 실패: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
};