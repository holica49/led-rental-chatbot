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
      
      // LED 모듈 수량 계산 함수
      const calculateModuleCount = (size: string): number => {
        if (!size) return 0;
        const [width, height] = size.split('x').map(Number);
        return (width / 500) * (height / 500);
      };

      // LED 모듈 수량 계산 함수 (기존 함수 수정)
      const calculateTotalModuleCount = (data: NotionData): number => {
        let totalCount = 0;
        for (let i = 1; i <= 5; i++) {
          const ledKey = `led${i}` as keyof NotionData;
          const ledData = data[ledKey] as LEDSpec | undefined;
          if (ledData && ledData.size) {
            const [width, height] = ledData.size.split('x').map(Number);
            totalCount += (width / 500) * (height / 500);
          }
        }
        return totalCount;
      };
      
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
            select: {
              name: data.customerName || "메쎄이상"
            }
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
          
          // 상태 관리
          "행사 상태": {
            select: {
              name: "견적 요청"
            }
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
          
          // LED1 정보
          "LED1 크기": {
            rich_text: [
              {
                text: {
                  content: data.led1?.size || ""
                }
              }
            ]
          },
          
          "LED1 무대 높이": {
            number: data.led1?.stageHeight || null
          },
          
          "LED1 모듈 수량": {
            number: data.led1?.size ? calculateModuleCount(data.led1.size) : null
          },
          
          "LED1 오퍼레이터 필요": {
            checkbox: data.led1?.needOperator || false
          },
          
          "LED1 오퍼레이터 일수": {
            number: data.led1?.operatorDays || null
          },
          
          // LED2 정보
          "LED2 크기": {
            rich_text: [
              {
                text: {
                  content: data.led2?.size || ""
                }
              }
            ]
          },
          
          "LED2 무대 높이": {
            number: data.led2?.stageHeight || null
          },
          
          "LED2 모듈 수량": {
            number: data.led2?.size ? calculateModuleCount(data.led2.size) : null
          },
          
          "LED2 오퍼레이터 필요": {
            checkbox: data.led2?.needOperator || false
          },
          
          "LED2 오퍼레이터 일수": {
            number: data.led2?.operatorDays || null
          },
          
          // LED3 정보
          "LED3 크기": {
            rich_text: [
              {
                text: {
                  content: data.led3?.size || ""
                }
              }
            ]
          },
          
          "LED3 무대 높이": {
            number: data.led3?.stageHeight || null
          },
          
          "LED3 모듈 수량": {
            number: data.led3?.size ? calculateModuleCount(data.led3.size) : null
          },
          
          "LED3 오퍼레이터 필요": {
            checkbox: data.led3?.needOperator || false
          },
          
          "LED3 오퍼레이터 일수": {
            number: data.led3?.operatorDays || null
          },
          
          // LED4 정보
          "LED4 크기": {
            rich_text: [
              {
                text: {
                  content: data.led4?.size || ""
                }
              }
            ]
          },
          
          "LED4 무대 높이": {
            number: data.led4?.stageHeight || null
          },
          
          "LED4 모듈 수량": {
            number: data.led4?.size ? calculateModuleCount(data.led4.size) : null
          },
          
          "LED4 오퍼레이터 필요": {
            checkbox: data.led4?.needOperator || false
          },
          
          "LED4 오퍼레이터 일수": {
            number: data.led4?.operatorDays || null
          },
          
          // LED5 정보
          "LED5 크기": {
            rich_text: [
              {
                text: {
                  content: data.led5?.size || ""
                }
              }
            ]
          },
          
          "LED5 무대 높이": {
            number: data.led5?.stageHeight || null
          },
          
          "LED5 모듈 수량": {
            number: data.led5?.size ? calculateModuleCount(data.led5.size) : null
          },
          
          "LED5 오퍼레이터 필요": {
            checkbox: data.led5?.needOperator || false
          },
          
          "LED5 오퍼레이터 일수": {
            number: data.led5?.operatorDays || null
          },
          
          "총 LED 모듈 수량": {
            number: calculateTotalModuleCount(data)
          },

          // 견적 정보
          "견적 금액": {
            number: data.totalQuoteAmount || null
          },
          
          "LED 모듈 비용": {
            number: data.ledModuleCost || null
          },
          
          "지지구조물 비용": {
            number: data.structureCost || null
          },
          
          "컨트롤러 및 스위치 비용": {
            number: data.controllerCost || null
          },
          
          "파워 비용": {
            number: data.powerCost || null
          },
          
          "설치철거인력 비용": {
            number: data.installationCost || null
          },
          
          "오퍼레이터 비용": {
            number: data.operatorCost || null
          },
          
          "운반 비용": {
            number: data.transportCost || null
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