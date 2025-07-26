// src/tools/notion-scheduler.ts
import { Client } from '@notionhq/client';
import { NotionStatusAutomation } from './notion-status-automation.js';
import { STATUS_MESSAGES, SPECIAL_NOTIFICATIONS, getNotionServiceType } from '../constants/notion-messages.js';

// 스케줄러 서비스 인스턴스 (싱글톤)
let schedulerServiceInstance: NotionSchedulerService | null = null;

export class NotionSchedulerService {
  private notion: Client;
  private automation: NotionStatusAutomation;
  private schedulerInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private managersConfig: any;

  constructor() {
    this.notion = new Client({ auth: process.env.NOTION_API_KEY });
    this.automation = new NotionStatusAutomation();
    
    // 담당자 설정 로드
    try {
      this.managersConfig = process.env.MANAGERS_CONFIG 
        ? JSON.parse(process.env.MANAGERS_CONFIG)
        : { managers: [] };
    } catch (error) {
      console.warn('NotionSchedulerService - MANAGERS_CONFIG 파싱 실패, 기본값 사용');
      this.managersConfig = { managers: [] };
    }
  }

  /**
   * 스케줄러 시작
   */
  async startScheduler() {
    if (this.isRunning) {
      console.log('⚠️ 스케줄러가 이미 실행 중입니다.');
      return;
    }

    console.log('📅 Notion 날짜 기반 자동화 스케줄러 시작');
    this.isRunning = true;
    
    // 시작 시 즉시 한 번 실행
    await this.runScheduledTasks();
    
    // 1시간마다 실행 (3600000ms)
    this.schedulerInterval = setInterval(async () => {
      await this.runScheduledTasks();
    }, 3600000);
  }

  /**
   * 스케줄러 중지
   */
  stopScheduler() {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
    }
    this.isRunning = false;
    console.log('🛑 Notion 스케줄러 중지');
  }

  /**
   * 예약된 작업 실행
   */
  private async runScheduledTasks() {
    try {
      console.log('📅 날짜 기반 자동화 작업 시작...');
      
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const todayStr = this.formatDate(today);
      const tomorrowStr = this.formatDate(tomorrow);
      
      console.log(`   오늘: ${todayStr}`);
      console.log(`   내일: ${tomorrowStr}`);
      
      // 1. 내일 설치 예정 건들 → "설치 중"으로 변경
      await this.updateToInstalling(tomorrowStr);
      
      // 2. 오늘 행사 시작 건들 → "운영 중"으로 변경
      await this.updateToOperating(todayStr);
      
      // 3. 오늘 행사 종료 건들 → "철거 중"으로 변경
      await this.updateToDismantling(todayStr);
      
      // 4. 내일 철거 예정 건들 → 철거 알림
      await this.notifyTomorrowDismantle(tomorrowStr);
      
      console.log('✅ 날짜 기반 자동화 작업 완료');
      
    } catch (error) {
      console.error('❌ 스케줄러 작업 실패:', error);
    }
  }

  /**
   * 설치 중으로 변경 (행사 전날)
   */
  private async updateToInstalling(tomorrowDate: string) {
    try {
      console.log('🔧 내일 설치 예정 행사 확인 중...');
      
      const databaseId = this.formatDatabaseId(process.env.NOTION_DATABASE_ID!);
      
      // 견적 승인 또는 구인 완료 상태인 행사 중 내일 설치인 건 조회
      const response = await this.notion.databases.query({
        database_id: databaseId,
        filter: {
          and: [
            {
              or: [
                {
                  property: '행사 상태',
                  status: { equals: '견적 승인' }
                },
                {
                  property: '행사 상태',
                  status: { equals: '구인 완료' }
                }
              ]
            },
            {
              property: '설치 일정',
              date: { equals: tomorrowDate }
            }
          ]
        }
      });

      console.log(`   내일 설치 예정: ${response.results.length}건`);

      for (const page of response.results) {
        if (page.object !== 'page') continue;
        
        const pageId = page.id;
        const properties = (page as any).properties;
        const eventName = properties['행사명']?.title?.[0]?.text?.content || 'Unknown';
        const serviceType = properties['서비스 유형']?.select?.name || '';
        
        console.log(`   🔄 ${eventName} → "설치 중"으로 변경`);
        
        // 상태 변경
        await this.notion.pages.update({
          page_id: pageId,
          properties: {
            '행사 상태': {
              status: { name: '설치 중' }
            }
          }
        });
        
        // 알림 댓글 추가
        await this.addScheduledComment(pageId, serviceType, 'TO_INSTALLING', {
          eventName,
          venue: properties['행사장']?.rich_text?.[0]?.text?.content || '',
          installDate: tomorrowDate
        });
        
        console.log(`   ✅ ${eventName} 상태 변경 완료`);
      }
      
    } catch (error) {
      console.error('❌ 설치 중 변경 실패:', error);
    }
  }

  /**
   * 운영 중으로 변경 (행사 시작일)
   */
  private async updateToOperating(todayDate: string) {
    try {
      console.log('🎯 오늘 시작하는 행사 확인 중...');
      
      const databaseId = this.formatDatabaseId(process.env.NOTION_DATABASE_ID!);
      
      // 설치 중 상태인 모든 행사 조회
      const response = await this.notion.databases.query({
        database_id: databaseId,
        filter: {
          property: '행사 상태',
          status: { equals: '설치 중' }
        }
      });

      // 텍스트 필드에서 행사 시작일 확인
      const todayEvents = response.results.filter(page => {
        if (page.object !== 'page') return false;
        const properties = (page as any).properties;
        
        // 행사 일정 텍스트에서 시작일 추출 (예: "2025-07-26 ~ 2025-07-28")
        const eventScheduleText = properties['행사 일정']?.rich_text?.[0]?.text?.content || '';
        
        if (eventScheduleText.includes(' ~ ')) {
          const [startDate] = eventScheduleText.split(' ~ ').map((s: string) => s.trim());
          return startDate === todayDate;
        }
        
        return false;
      });

      console.log(`   오늘 시작 행사: ${todayEvents.length}건`);

      for (const page of todayEvents) {
        const pageId = page.id;
        const properties = (page as any).properties;
        const eventName = properties['행사명']?.title?.[0]?.text?.content || 'Unknown';
        const serviceType = properties['서비스 유형']?.select?.name || '';
        
        // 렌탈/멤버쉽만 운영 중으로 변경
        if (serviceType === '렌탈' || serviceType === '멤버쉽') {
          console.log(`   🎯 ${eventName} → "운영 중"으로 변경`);
          
          await this.notion.pages.update({
            page_id: pageId,
            properties: {
              '행사 상태': {
                status: { name: '운영 중' }
              }
            }
          });
          
          await this.addScheduledComment(pageId, serviceType, 'TO_OPERATING', {
            eventName,
            venue: properties['행사장']?.rich_text?.[0]?.text?.content || '',
            eventPeriod: properties['행사 일정']?.rich_text?.[0]?.text?.content || ''
          });
          
          console.log(`   ✅ ${eventName} 상태 변경 완료`);
        }
      }
      
    } catch (error) {
      console.error('❌ 운영 중 변경 실패:', error);
    }
  }

  /**
   * 철거 중으로 변경 (행사 종료일)
   */
  private async updateToDismantling(todayDate: string) {
    try {
      console.log('📦 오늘 종료되는 행사 확인 중...');
      
      const databaseId = this.formatDatabaseId(process.env.NOTION_DATABASE_ID!);
      
      // 운영 중 상태인 모든 행사 조회
      const response = await this.notion.databases.query({
        database_id: databaseId,
        filter: {
          property: '행사 상태',
          status: { equals: '운영 중' }
        }
      });

      // 텍스트 필드에서 행사 종료일 확인
      const todayEndEvents = response.results.filter(page => {
        if (page.object !== 'page') return false;
        const properties = (page as any).properties;
        
        // 행사 일정 텍스트에서 종료일 추출 (예: "2025-07-26 ~ 2025-07-28")
        const eventScheduleText = properties['행사 일정']?.rich_text?.[0]?.text?.content || '';
        
        if (eventScheduleText.includes(' ~ ')) {
          const parts = eventScheduleText.split(' ~ ').map((s: string) => s.trim());
          const endDate = parts[1];
          return endDate === todayDate;
        }
        
        return false;
      });

      console.log(`   오늘 종료 행사: ${todayEndEvents.length}건`);

      for (const page of todayEndEvents) {
        const pageId = page.id;
        const properties = (page as any).properties;
        const eventName = properties['행사명']?.title?.[0]?.text?.content || 'Unknown';
        const serviceType = properties['서비스 유형']?.select?.name || '';
        
        console.log(`   📦 ${eventName} → "철거 중"으로 변경`);
        
        await this.notion.pages.update({
          page_id: pageId,
          properties: {
            '행사 상태': {
              status: { name: '철거 중' }
            }
          }
        });
        
        // 철거 배차 정보 계산
        const totalModules = properties['총 LED 모듈 수량']?.number || 0;
        const truckInfo = this.calculateTruckInfo(totalModules);
        
        await this.addScheduledComment(pageId, serviceType, 'TO_DISMANTLING', {
          eventName,
          venue: properties['행사장']?.rich_text?.[0]?.text?.content || '',
          dismantleTime: '행사 종료 후',
          dismantleTruckInfo: truckInfo
        });
        
        console.log(`   ✅ ${eventName} 상태 변경 완료`);
      }
      
    } catch (error) {
      console.error('❌ 철거 중 변경 실패:', error);
    }
  }

  /**
   * 내일 철거 예정 알림
   */
  private async notifyTomorrowDismantle(tomorrowDate: string) {
    try {
      console.log('🚨 내일 철거 예정 행사 알림...');
      
      const databaseId = this.formatDatabaseId(process.env.NOTION_DATABASE_ID!);
      
      // 철거 일정이 내일인 행사 조회
      const response = await this.notion.databases.query({
        database_id: databaseId,
        filter: {
          and: [
            {
              property: '철거 일정',
              date: { equals: tomorrowDate }
            },
            {
              property: '행사 상태',
              status: { does_not_equal: '완료' }
            }
          ]
        }
      });

      console.log(`   내일 철거 예정: ${response.results.length}건`);

      for (const page of response.results) {
        if (page.object !== 'page') continue;
        
        const pageId = page.id;
        const properties = (page as any).properties;
        const eventName = properties['행사명']?.title?.[0]?.text?.content || 'Unknown';
        const serviceType = properties['서비스 유형']?.select?.name || '';
        
        // 철거 배차 정보 계산
        const totalModules = properties['총 LED 모듈 수량']?.number || 0;
        const truckInfo = this.calculateTruckInfo(totalModules);
        
        await this.addDismantleReminderComment(pageId, serviceType, {
          eventName,
          venue: properties['행사장']?.rich_text?.[0]?.text?.content || '',
          dismantleDate: tomorrowDate,
          dismantleTruckInfo: truckInfo,
          contactName: properties['고객명']?.rich_text?.[0]?.text?.content || '',
          contactPhone: properties['고객 연락처']?.phone_number || ''
        });
        
        console.log(`   ✅ ${eventName} 철거 알림 완료`);
      }
      
    } catch (error) {
      console.error('❌ 철거 알림 실패:', error);
    }
  }

  /**
   * 스케줄 기반 댓글 추가
   */
  private async addScheduledComment(
    pageId: string, 
    serviceType: string, 
    messageType: string,
    variables: Record<string, any>
  ) {
    try {
      const notionServiceType = getNotionServiceType(serviceType);
      // 타입 단언 추가
      const message = (STATUS_MESSAGES.AUTO_STATUS_CHANGES as any)[messageType];
      
      if (!message) {
        console.error(`메시지 타입을 찾을 수 없습니다: ${messageType}`);
        return;
      }
      
      let content = message;
      
      // 변수 치환
      Object.entries(variables).forEach(([key, value]) => {
        content = content.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
      });
      
      // 타임스탬프 추가
      content = content.replace('{{timestamp}}', `⏰ 자동 변경 시간: ${new Date().toLocaleString()}`);
      
      // 담당자 멘션
      const richText = await this.createRichTextWithMention(pageId, content);
      
      await this.notion.comments.create({
        parent: { page_id: pageId },
        rich_text: richText
      });
      
    } catch (error) {
      console.error('스케줄 댓글 추가 실패:', error);
    }
  }

  /**
   * 철거 알림 댓글 추가
   */
  private async addDismantleReminderComment(
    pageId: string,
    serviceType: string,
    variables: Record<string, any>
  ) {
    try {
      // 타입 단언으로 수정
      let content = SPECIAL_NOTIFICATIONS.DISMANTLE_REMINDER as string;
      
      // 변수 치환
      Object.entries(variables).forEach(([key, value]) => {
        content = content.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
      });
      
      // 타임스탬프 추가
      content = content.replace('{{timestamp}}', `⏰ 알림 시간: ${new Date().toLocaleString()}`);
      
      // 담당자 멘션
      const richText = await this.createRichTextWithMention(pageId, content);
      
      await this.notion.comments.create({
        parent: { page_id: pageId },
        rich_text: richText
      });
      
    } catch (error) {
      console.error('철거 알림 댓글 추가 실패:', error);
    }
  }

  /**
   * 담당자 언급을 포함한 리치 텍스트 생성
   */
  private async createRichTextWithMention(pageId: string, content: string): Promise<any[]> {
    try {
      const page = await this.notion.pages.retrieve({ page_id: pageId });
      const properties = (page as any).properties;
      const serviceType = properties['서비스 유형']?.select?.name || '';
      
      const richText: any[] = [
        {
          type: 'text',
          text: { content }
        }
      ];

      // 서비스별 담당자 선택
      let targetManagers = [];
      const notionServiceType = getNotionServiceType(serviceType);
      
      if (notionServiceType === 'INSTALL') {
        targetManagers = this.managersConfig.managers.filter((m: any) => 
          m.notionId === '225d872b-594c-8157-b968-0002e2380097'
        );
      } else {
        targetManagers = this.managersConfig.managers.filter((m: any) => 
          m.notionId === '237d872b-594c-8174-9ab2-00024813e3a9'
        );
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

          if (index < targetManagers.length - 1) {
            richText.push({
              type: 'text',
              text: { content: ', ' }
            });
          }
        });
      }

      richText.push({
        type: 'text',
        text: { content: '\n\n⏰ 빠른 확인 부탁드립니다!' },
        annotations: { bold: true }
      });

      return richText;
      
    } catch (error) {
      console.error('리치 텍스트 생성 실패:', error);
      return [{ type: 'text', text: { content } }];
    }
  }

  /**
   * 트럭 배차 정보 계산
   */
  private calculateTruckInfo(totalModules: number): string {
    if (totalModules <= 80) {
      return '1.4톤 리프트 화물차 1대';
    } else if (totalModules <= 208) {
      return '3.5톤 리프트 화물차 1대';
    } else if (totalModules <= 288) {
      return '3.5톤 리프트 화물차 1대, 1.4톤 리프트 화물차 1대';
    } else if (totalModules <= 416) {
      return '3.5톤 리프트 화물차 2대';
    } else {
      const trucks35 = Math.ceil(totalModules / 208);
      return `3.5톤 리프트 화물차 ${trucks35}대`;
    }
  }

  /**
   * 날짜 포맷팅
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * 데이터베이스 ID 포맷 변환
   */
  private formatDatabaseId(id: string): string {
    if (!id.includes('-') && id.length === 32) {
      return `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;
    }
    return id;
  }

  /**
   * 현재 스케줄러 상태 확인
   */
  getSchedulerStatus() {
    return {
      isRunning: this.isRunning,
      nextRun: this.isRunning ? '1시간 이내' : 'N/A'
    };
  }

  /**
   * 행사 일정 텍스트에서 시작일과 종료일 추출
   */
  private extractDatesFromScheduleText(scheduleText: string): { startDate: string | null, endDate: string | null } {
    if (!scheduleText || !scheduleText.includes(' ~ ')) {
      return { startDate: null, endDate: null };
    }
    
    const parts = scheduleText.split(' ~ ').map((s: string) => s.trim());
    return {
      startDate: parts[0] || null,
      endDate: parts[1] || null
    };
  }
}

/**
 * 스케줄러 서비스 인스턴스 가져오기 (싱글톤)
 */
export function getSchedulerService(): NotionSchedulerService {
  if (!schedulerServiceInstance) {
    schedulerServiceInstance = new NotionSchedulerService();
  }
  return schedulerServiceInstance;
}

/**
 * 스케줄러 시작
 */
export async function startSchedulerService() {
  const service = getSchedulerService();
  await service.startScheduler();
}

/**
 * 스케줄러 중지
 */
export function stopSchedulerService() {
  if (schedulerServiceInstance) {
    schedulerServiceInstance.stopScheduler();
  }
}