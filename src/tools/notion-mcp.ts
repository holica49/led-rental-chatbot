// src/tools/notion-mcp.ts
import { Client } from '@notionhq/client';

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

const databaseId = process.env.NOTION_DATABASE_ID;

// 타입 정의
interface LEDSpec {
  size: string;
  stageHeight: number;
  needOperator: boolean;
  operatorDays: number;
}

interface NotionData {
  eventName: string;
  customerName: string;
  contactName: string;
  contactTitle: string;
  contactPhone: string;
  venue: string;
  eventSchedule: string;
  installSchedule: string;
  rehearsalSchedule: string;
  dismantleSchedule: string;
  led1?: LEDSpec;
  led2?: LEDSpec;
  led3?: LEDSpec;
  led4?: LEDSpec;
  led5?: LEDSpec;
  totalQuoteAmount: number;
  totalModuleCount: number;
  ledModuleCost: number;
  structureCost: number;
  controllerCost: number;
  powerCost: number;
  installationCost: number;
  operatorCost: number;
  transportCost: number;
}

export const notionMCPTool = {
  async handler(data: NotionData) {
    try {
      console.log('Notion 저장 시작:', data);
      
      // Notion 페이지 생성
      const response = await notion.pages.create({
        parent: { database_id: databaseId! },
        properties: {
          // 기본 정보
          "행사명": {
            title: [
              {
                text: {
                  content: data.eventName || ""
                }
              }
            ]
          },
          
          "고객사": {
            rich_text: [
              {
                text: {
                  content: data.customerName || ""
                }
              }
            ]
          },
          
          "고객담당자": {
            rich_text: [
              {
                text: {
                  content: data.contactName && data.contactTitle 
                    ? `${data.contactName} ${data.contactTitle}`
                    : (data.contactName || "")
                }
              }
            ]
          },
          
          "고객 연락처": {
            phone_number: data.contactPhone || ""
          },
          
          "행사장": {
            rich_text: [
              {
                text: {
                  content: data.venue || ""
                }
              }
            ]
          },
          
          // 일정 정보
          "행사 일정": {
            rich_text: [
              {
                text: {
                  content: data.eventSchedule || ""
                }
              }
            ]
          },
          
          "설치 일정": {
            date: data.installSchedule ? {
              start: data.installSchedule
            } : null
          },
          
          "리허설 일정": {
            date: data.rehearsalSchedule ? {
              start: data.rehearsalSchedule
            } : null
          },
          
          "철거 일정": {
            date: data.dismantleSchedule ? {
              start: data.dismantleSchedule
            } : null
          },
          
          // LED 정보
          "LED 총 개수": {
            number: this.countLEDs(data)
          },
          
          "LED 모듈 총 개수": {
            number: data.totalModuleCount || 0
          },
          
          // LED 상세 정보
          "LED1 크기": {
            rich_text: [
              {
                text: {
                  content: data.led1?.size || ""
                }
              }
            ]
          },
          
          "LED1 무대높이": {
            number: data.led1?.stageHeight || null
          },
          
          "LED1 오퍼레이터": {
            checkbox: data.led1?.needOperator || false
          },
          
          "LED1 오퍼레이터 일수": {
            number: data.led1?.operatorDays || 0
          },
          
          "LED2 크기": {
            rich_text: [
              {
                text: {
                  content: data.led2?.size || ""
                }
              }
            ]
          },
          
          "LED2 무대높이": {
            number: data.led2?.stageHeight || null
          },
          
          "LED2 오퍼레이터": {
            checkbox: data.led2?.needOperator || false
          },
          
          "LED2 오퍼레이터 일수": {
            number: data.led2?.operatorDays || 0
          },
          
          "LED3 크기": {
            rich_text: [
              {
                text: {
                  content: data.led3?.size || ""
                }
              }
            ]
          },
          
          "LED3 무대높이": {
            number: data.led3?.stageHeight || null
          },
          
          "LED3 오퍼레이터": {
            checkbox: data.led3?.needOperator || false
          },
          
          "LED3 오퍼레이터 일수": {
            number: data.led3?.operatorDays || 0
          },
          
          "LED4 크기": {
            rich_text: [
              {
                text: {
                  content: data.led4?.size || ""
                }
              }
            ]
          },
          
          "LED4 무대높이": {
            number: data.led4?.stageHeight || null
          },
          
          "LED4 오퍼레이터": {
            checkbox: data.led4?.needOperator || false
          },
          
          "LED4 오퍼레이터 일수": {
            number: data.led4?.operatorDays || 0
          },
          
          "LED5 크기": {
            rich_text: [
              {
                text: {
                  content: data.led5?.size || ""
                }
              }
            ]
          },
          
          "LED5 무대높이": {
            number: data.led5?.stageHeight || null
          },
          
          "LED5 오퍼레이터": {
            checkbox: data.led5?.needOperator || false
          },
          
          "LED5 오퍼레이터 일수": {
            number: data.led5?.operatorDays || 0
          },
          
          // 견적 정보
          "총 견적 금액": {
            number: data.totalQuoteAmount || 0
          },
          
          "LED 모듈 비용": {
            number: data.ledModuleCost || 0
          },
          
          "지지구조물 비용": {
            number: data.structureCost || 0
          },
          
          "컨트롤러 비용": {
            number: data.controllerCost || 0
          },
          
          "파워 비용": {
            number: data.powerCost || 0
          },
          
          "설치철거 비용": {
            number: data.installationCost || 0
          },
          
          "오퍼레이터 비용": {
            number: data.operatorCost || 0
          },
          
          "운반 비용": {
            number: data.transportCost || 0
          },
          
          // 상태 관리
          "견적 상태": {
            select: {
              name: "견적 완료"
            }
          },
          
          "알림 상태": {
            select: {
              name: "관리자 확인 필요"
            }
          },
          
          "우선순위": {
            select: {
              name: data.totalQuoteAmount > 20000000 ? "긴급" : "일반"
            }
          },
          
          "생성일시": {
            date: {
              start: new Date().toISOString()
            }
          }
        }
      });
      
      console.log('Notion 저장 완료:', response.id);
      
      // 관리자 알림을 위한 댓글 추가
      await this.addNotificationComment(response.id, data);
      
      return response;
      
    } catch (error) {
      console.error('Notion 저장 실패:', error);
      throw error;
    }
  },
  
  // LED 개수 계산
  countLEDs(data: NotionData): number {
    let count = 0;
    for (let i = 1; i <= 5; i++) {
      const ledKey = `led${i}` as keyof NotionData;
      const ledData = data[ledKey] as LEDSpec | undefined;
      if (ledData && ledData.size) {
        count++;
      }
    }
    return count;
  },
  
  // 관리자 알림 댓글 추가
  async addNotificationComment(pageId: string, data: NotionData) {
    try {
      const adminUserId = process.env.NOTION_ADMIN_USER_ID;
      
      if (!adminUserId) {
        console.log('관리자 사용자 ID가 설정되지 않음');
        return;
      }
      
      const comment = await notion.comments.create({
        parent: {
          page_id: pageId,
        },
        rich_text: [
          {
            type: "text",
            text: {
              content: "🚨 새로운 LED 렌탈 견적 요청이 도착했습니다!\n\n"
            }
          },
          {
            type: "mention",
            mention: {
              type: "user",
              user: {
                id: adminUserId
              }
            }
          },
          {
            type: "text",
            text: {
              content: ` 님, 확인해주세요.\n\n📋 행사명: ${data.eventName}\n🏢 고객사: ${data.customerName}\n👤 담당자: ${data.contactName} ${data.contactTitle}\n📞 연락처: ${data.contactPhone}\n📅 행사 일정: ${data.eventSchedule}\n💰 견적 금액: ${data.totalQuoteAmount?.toLocaleString()}원`
            }
          }
        ],
      });
      
      console.log('Notion 댓글 알림 추가 완료:', comment.id);
      return comment;
      
    } catch (error) {
      console.error('Notion 댓글 알림 추가 실패:', error);
      // 댓글 실패해도 메인 프로세스는 계속 진행
    }
  }
};
