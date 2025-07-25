import { Client } from '@notionhq/client';
import { calculateMultiLEDQuote } from './calculate-quote.js';

const notion = new Client({ auth: process.env.NOTION_API_KEY });

// 행사 상태 관리 서비스
export class NotionStatusAutomation {
  private managersConfig: { managers: Array<{ notionId: string; department?: string; isActive?: boolean }> };

// src/tools/notion-status-automation.ts 수정
  constructor() {
    console.log('NotionStatusAutomation 생성됨');
    console.log('MANAGERS_CONFIG 원본값:', process.env.MANAGERS_CONFIG); // 디버깅용
    
    // 담당자 설정 로드 - 안전하게 처리
    try {
      this.managersConfig = process.env.MANAGERS_CONFIG 
        ? JSON.parse(process.env.MANAGERS_CONFIG)
        : { managers: [] };
    } catch (error) {
      console.warn('MANAGERS_CONFIG 파싱 실패, 기본값 사용:', error);
      this.managersConfig = { managers: [] };
    }
  }

  /**
   * 담당자 언급을 포함한 리치 텍스트 생성
   */
  private async createRichTextWithMention(pageId: string, content: string): Promise<any[]> {
      try {
        // 페이지에서 정보 가져오기
        const page = await notion.pages.retrieve({ page_id: pageId });
        const properties = (page as any).properties;
        const assignedPeople = properties['담당자']?.people || [];
        const serviceType = properties['서비스 유형']?.select?.name || '';
        
        // 설치 서비스는 담당자 언급 없이 텍스트만 반환
        if (serviceType === '설치') {
          return [{ type: 'text', text: { content } }];
        }
      
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
   * 트럭 배차 계산
   */
  private calculateTruckDispatch(totalModules: number): { totalTrucks: number; description: string } {
    if (totalModules <= 80) {
      // 80개 이하: 1.4톤 1대
      return {
        totalTrucks: 1,
        description: '1.4톤 리프트 화물차'
      };
    } else if (totalModules <= 208) {
      // 81-208개: 3.5톤 1대
      return {
        totalTrucks: 1,
        description: '3.5톤 리프트 화물차'
      };
    } else if (totalModules <= 288) {
      // 209-288개: 3.5톤 1대 + 1.4톤 1대
      return {
        totalTrucks: 2,
        description: '3.5톤 리프트 화물차 1대, 1.4톤 리프트 화물차 1대'
      };
    } else if (totalModules <= 416) {
      // 289-416개: 3.5톤 2대
      return {
        totalTrucks: 2,
        description: '3.5톤 리프트 화물차 2대'
      };
    } else {
      // 417개 이상: 3.5톤으로 계산
      const trucks35 = Math.floor(totalModules / 208);
      const remainder = totalModules % 208;
      
      if (remainder === 0) {
        return {
          totalTrucks: trucks35,
          description: `3.5톤 리프트 화물차 ${trucks35}대`
        };
      } else if (remainder <= 80) {
        return {
          totalTrucks: trucks35 + 1,
          description: `3.5톤 리프트 화물차 ${trucks35}대, 1.4톤 리프트 화물차 1대`
        };
      } else {
        return {
          totalTrucks: trucks35 + 1,
          description: `3.5톤 리프트 화물차 ${trucks35 + 1}대`
        };
      }
    }
  }

  /**
   * 행사 상태가 "견적 검토"로 변경되었을 때 자동 실행
   */
  async onStatusQuoteReview(pageId: string) {
    try {
      console.log('📊 견적 검토 상태로 변경됨 - 자동화 시작');
      
      // 1. Notion에서 행사 정보 가져오기
      const eventData = await this.getEventDataFromNotion(pageId);
        if (!eventData.eventName) eventData.eventName = '';
        if (!eventData.customerName) eventData.customerName = '';
        if (!eventData.contactName) eventData.contactName = '';
        if (!eventData.venue) eventData.venue = '';

      // 2. 견적 계산
      const quote = this.calculateQuoteFromEventData(eventData);
      
      // 3. 견적 검토 댓글 추가
      await this.addQuoteReviewComment(pageId, eventData, quote);
      
      console.log('✅ 견적 검토 프로세스 완료');
      return { success: true, eventData, quote };
      
    } catch (error) {
      console.error('❌ 견적 검토 프로세스 실패:', error);
      await this.addErrorComment(pageId, '견적 검토 자동화 실패', error);
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
      await this.addErrorComment(pageId, '배차 정보 생성 실패', error);
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
      await this.addErrorComment(pageId, '구인 완료 프로세스 실패', error);
      throw error;
    }
  }

  /**
   * 자동 상태 변경 (일정 기반)
   */
  async autoUpdateStatusBySchedule() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      // 설치일이 오늘인 행사들을 "설치 중"으로 변경
      await this.updateStatusByDate('설치 일정', today, '설치 중');
      
      // 행사일이 오늘인 행사들을 "운영 중"으로 변경
      await this.updateStatusByDate('행사 일정', today, '운영 중');
      
      // 철거일이 오늘인 행사들을 "철거 중"으로 변경
      await this.updateStatusByDate('철거 일정', today, '철거 중');
      
      // 철거일이 내일인 행사들에 대해 철거 배차 알림
      await this.notifyDismantleDispatch(tomorrow);
      
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
      // 수정: "고객담당자" → "고객명"
      contactName: properties['고객명']?.rich_text?.[0]?.text?.content || '',
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
    if (!eventData.ledSpecs || eventData.ledSpecs.length === 0) {
      console.warn('⚠️ LED 사양 정보가 없습니다. 기본 견적을 생성합니다.');
      return {
        ledModules: { count: 0, price: 0 },
        structure: { area: 0, unitPrice: 20000, totalPrice: 0 },
        controller: { totalPrice: 0, count: 0 },
        power: { totalPrice: 0, requiredCount: 0 },
        installation: { workers: 0, totalPrice: 0 },
        operation: { totalPrice: 0, days: 0 },
        transport: { price: 0 },
        subtotal: 0,
        vat: 0,
        total: 0
      };
    }
    
    return calculateMultiLEDQuote(eventData.ledSpecs);
  }

  /**
   * 견적 검토 완료 댓글 추가
   */
  private async addQuoteReviewComment(pageId: string, eventData: any, quote: any) {
    const ledSummary = eventData.ledSpecs?.map((led: any, index: number) => {
      if (!led.size) return `LED${index + 1}: 정보 없음`;
      
      const [w, h] = led.size.split('x').map(Number);
      const moduleCount = (w / 500) * (h / 500);
      const operatorText = led.needOperator ? ` (오퍼레이터 ${led.operatorDays}일)` : '';
      return `LED${index + 1}: ${led.size} (${moduleCount}개${operatorText})`;
    }).join('\n') || '정보 없음';

    const comment = `📊 견적 검토 자동화 완료

✅ 견적 정보:
- 행사명: ${eventData.eventName}
- 고객사: ${eventData.customerName}
- 고객: ${eventData.contactName}  // 수정: "고객담당자" → "고객"
- 행사장: ${eventData.venue}
- 총 LED 모듈: ${quote.ledModules?.count || 0}개
- 견적 금액: ${quote.total?.toLocaleString() || 0}원 (VAT 포함)
- 설치 인력: ${quote.installation?.workers || 0}명


🖥️ LED 사양:
${ledSummary}

💰 견적 세부내역:
- LED 모듈: ${quote.ledModules?.price?.toLocaleString() || 0}원
- 구조물: ${quote.structure?.totalPrice?.toLocaleString() || 0}원
- 컨트롤러: ${quote.controller?.totalPrice?.toLocaleString() || 0}원
- 파워: ${quote.power?.totalPrice?.toLocaleString() || 0}원
- 설치인력: ${quote.installation?.totalPrice?.toLocaleString() || 0}원
- 오퍼레이터: ${quote.operation?.totalPrice?.toLocaleString() || 0}원
- 운반비: ${quote.transport?.price?.toLocaleString() || 0}원

📎 파일 업로드 가이드:
1. 위 내용을 바탕으로 견적서를 작성하세요
2. 요청서를 작성하세요
3. 작성된 파일을 아래 위치에 업로드하세요:
   • 견적서 → "견적서" 속성에 업로드
   • 요청서 → "요청서" 속성에 업로드

⚠️ 중요: 두 파일이 모두 업로드되면 자동으로 "견적 승인"으로 변경됩니다!

✨ 자동화 프로세스:
- 파일 업로드 감지 → 자동 승인 → 배차 정보 생성

⏰ 자동화 실행 시간: ${new Date().toLocaleString()}`;

    await this.addCommentToPageWithMention(pageId, comment);
  }

  /**
   * 배차 정보 생성 - 양식에 맞춰 수정
   */
  private generateDispatchMessage(eventData: any) {
    const totalModules = eventData.totalModuleCount || 0;
    const installDate = eventData.installSchedule;
    
    // 배차 정보 계산
    let dispatch = this.calculateTruckDispatch(totalModules);
    
    const plateBoxCount = Math.ceil(totalModules / 8);
    const storageAddress = process.env.STORAGE_ADDRESS || '경기 고양시 덕양구 향동동 396, 현대테라타워DMC 337호';
    
    // 양식에 맞춘 메시지
    const message = `배차 ${dispatch.totalTrucks}대 요청드립니다.

상차시간 : ${installDate || '미정'}

${dispatch.description}
(리프트 1500이상 / 차고 3.2m 이하)
-상차 : ${storageAddress}
-하차 : ${eventData.venue}

물품 : 플레이트 케이스 2단 ${plateBoxCount}개 + 시스템 비계
(2단 1개당 950x580x1200mm)

📋 행사 정보:
- 행사명: ${eventData.eventName}
- 고객사: ${eventData.customerName}
- 고객: ${eventData.contactName}  // 수정: "담당자" → "고객"
- 연락처: ${eventData.contactPhone}
- 철거일: ${eventData.dismantleSchedule || '미정'}

⚠️ 주의사항:
- 설치 전날까지 현장 도착 필수
- 하차 지점 및 주차 공간 사전 확인
- 기사님께 연락처 공유 필요
- 현장 접근성 및 엘리베이터 사용 가능 여부 확인

🔄 다음 단계:
1. 배차 기사님께 연락처 및 현장 정보 전달
2. 고객사 현장 담당자와 사전 협의
3. 상태를 "구인 완료"로 변경

⏰ 자동 생성 시간: ${new Date().toLocaleString()}`;

    return {
      message,
      truckInfo: dispatch.description,
      plateBoxCount,
      totalModules
    };
  }

  /**
   * 배차 댓글 추가 - 담당자 언급 포함
   */
  private async addDispatchComment(pageId: string, dispatchInfo: any) {
    await this.addCommentToPageWithMention(pageId, dispatchInfo.message);
  }

  /**
   * 구인 완료 정보 생성
   */
  private generateCompletionMessage(eventData: any) {
    return {
      message: `✅ 구인 완료 확인 (${eventData.eventName})

🚚 배차 상황: 완료
👷 인력 구인: 완료

📋 최종 체크리스트:
□ 배차 기사님께 연락처 전달
□ 설치 인력 현장 시간 확인
□ 고객사 현장 담당자 연락처 확인
□ 장비 점검 완료 확인
□ 보험 및 안전 사항 점검
□ 현장 접근 방법 및 주차 공간 확인
□ 전원 공급 및 전기 설치 조건 확인

📞 연락처 정보:
- 고객: ${eventData.contactName}  // 수정: "고객 담당자" → "고객"
- 연락처: ${eventData.contactPhone}
- 행사장: ${eventData.venue}

📅 일정 확인:
- 설치일: ${eventData.installSchedule || '미정'}
- 리허설: ${eventData.rehearsalSchedule || '미정'}
- 철거일: ${eventData.dismantleSchedule || '미정'}

🔄 다음 단계:
설치일에 자동으로 "설치 중" 상태로 변경됩니다.

⏰ 자동 생성 시간: ${new Date().toLocaleString()}`
    };
  }

  /**
   * 구인 완료 댓글 추가 - 담당자 언급 포함
   */
  private async addCompletionComment(pageId: string, completionInfo: any) {
    await this.addCommentToPageWithMention(pageId, completionInfo.message);
  }

  /**
   * 철거 배차 알림 (철거일 하루 전)
   */
  private async notifyDismantleDispatch(targetDate: string) {
    try {
      console.log(`🚚 ${targetDate} 철거 예정 행사 확인 중...`);
      
      // 철거일이 내일인 행사들 조회
      const response = await notion.databases.query({
        database_id: process.env.NOTION_DATABASE_ID!,
        filter: {
          and: [
            {
              property: '철거 일정',
              date: {
                equals: targetDate
              }
            },
            {
              property: '행사 상태',
              status: {
                does_not_equal: '완료'
              }
            }
          ]
        }
      });

      console.log(`철거 예정 행사: ${response.results.length}개`);

      // 각 행사에 대해 철거 배차 댓글 추가
      for (const page of response.results) {
        if (page.object !== 'page') continue;
        
        const pageId = page.id;
        const eventData = await this.getEventDataFromNotion(pageId);
        
        // 철거 배차 메시지 생성
        const dismantleDispatchInfo = this.generateDismantleDispatchMessage(eventData);
        
        // 댓글 추가
        await this.addDismantleDispatchComment(pageId, dismantleDispatchInfo);
        
        console.log(`✅ ${eventData.eventName} - 철거 배차 알림 완료`);
      }
      
    } catch (error) {
      console.error('❌ 철거 배차 알림 실패:', error);
    }
  }

  /**
   * 철거 배차 정보 생성
   */
  private generateDismantleDispatchMessage(eventData: any) {
    const totalModules = eventData.totalModuleCount || 0;
    const dismantleDate = eventData.dismantleSchedule;
    
    // 배차 정보 계산
    let dispatch = this.calculateTruckDispatch(totalModules);
    
    const plateBoxCount = Math.ceil(totalModules / 8);
    const storageAddress = process.env.STORAGE_ADDRESS || '경기 고양시 덕양구 향동동 396, 현대테라타워DMC 337호';
    
    // 철거 배차 양식에 맞춘 메시지
    const message = `🚨 철거 배차 알림 (내일 철거 예정)

배차 ${dispatch.totalTrucks}대 요청드립니다.

상차시간 : ${dismantleDate || '미정'}

${dispatch.description}
(리프트 1500이상 / 차고 3.2m 이하)
-상차 : ${eventData.venue}
-하차 : ${storageAddress}

물품 : 플레이트 케이스 2단 ${plateBoxCount}개 + 시스템 비계
(2단 1개당 950x580x1200mm)

📋 행사 정보:
- 행사명: ${eventData.eventName}
- 고객사: ${eventData.customerName}
- 고객: ${eventData.contactName}  // 수정: "담당자" → "고객"
- 연락처: ${eventData.contactPhone}

⚠️ 주의사항:
- 철거 당일 오전 중 현장 도착 필수
- 상차 지점 및 주차 공간 사전 확인
- 기사님께 연락처 공유 필요
- 철거 완료 후 장비 수량 확인 필수

⏰ 알림 생성 시간: ${new Date().toLocaleString()}`;

    return {
      message,
      truckInfo: dispatch.description,
      plateBoxCount,
      totalModules
    };
  }

  /**
   * 철거 배차 댓글 추가
   */
  private async addDismantleDispatchComment(pageId: string, dispatchInfo: any) {
    try {
      const richText = await this.createRichTextWithMention(pageId, dispatchInfo.message);
      
      await notion.comments.create({
        parent: { page_id: pageId },
        rich_text: richText
      });
      
      console.log('✅ 철거 배차 댓글 추가 완료 (담당자 언급 포함)');
    } catch (error) {
      console.error('❌ 철거 배차 댓글 추가 실패:', error);
    }
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

  /**
   * 오류 댓글 추가 - 담당자 언급 포함
   */
  private async addErrorComment(pageId: string, title: string, error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const comment = `❌ ${title}

오류 내용: ${errorMessage}
발생 시간: ${new Date().toLocaleString()}

담당자 확인이 필요합니다.`;

    await this.addCommentToPageWithMention(pageId, comment);
  }

  /**
   * 댓글 추가 공통 함수 (기존 버전 - 언급 없음)
   */
  private async addCommentToPage(pageId: string, content: string) {
    try {
      await notion.comments.create({
        parent: { page_id: pageId },
        rich_text: [{ type: 'text', text: { content } }]
      });
      console.log('✅ 댓글 추가 완료');
    } catch (error) {
      console.error('❌ 댓글 추가 실패:', error);
    }
  }

  /**
   * 댓글 추가 공통 함수 (담당자 언급 포함)
   */
  private async addCommentToPageWithMention(pageId: string, content: string) {
    try {
      const richText = await this.createRichTextWithMention(pageId, content);
      
      await notion.comments.create({
        parent: { page_id: pageId },
        rich_text: richText
      });
      
      console.log('✅ 댓글 추가 완료 (담당자 언급 포함)');
    } catch (error) {
      console.error('❌ 댓글 추가 실패:', error);
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