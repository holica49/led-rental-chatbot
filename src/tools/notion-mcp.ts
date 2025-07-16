// src/tools/notion-mcp.ts
import { Client } from '@notionhq/client';

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

const databaseId = process.env.NOTION_DATABASE_ID;

// 확장된 LED 사양 타입
interface LEDSpec {
  size: string;
  stageHeight: number;
  needOperator: boolean;
  operatorDays: number;
  prompterConnection?: boolean;  // 🆕 추가
  relayConnection?: boolean;     // 🆕 추가
}

// 확장된 Notion 데이터 타입
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

// LED 해상도 계산 함수
function calculateLEDResolution(ledSize: string): string {
  if (!ledSize) return '';
  
  const [width, height] = ledSize.split('x').map(Number);
  
  // LED 모듈 1장당 168x168 픽셀, 모듈 크기 500x500mm
  const horizontalModules = width / 500;
  const verticalModules = height / 500;
  
  const horizontalPixels = horizontalModules * 168;
  const verticalPixels = verticalModules * 168;
  
  return `${horizontalPixels} x ${verticalPixels} pixels`;
}

// LED 소비전력 계산 함수
function calculateLEDPowerConsumption(ledSize: string): string {
  if (!ledSize) return '';
  
  const [width, height] = ledSize.split('x').map(Number);
  const moduleCount = (width / 500) * (height / 500);
  
  // LED 모듈 1장당 380V 0.2kW
  const totalPower = moduleCount * 0.2;
  
  return `380V ${totalPower}kW`;
}

// 전기설치 방식 계산 함수
function calculateElectricalInstallation(ledSize: string): string {
  if (!ledSize) return '';
  
  const [width, height] = ledSize.split('x').map(Number);
  
  // 대각선 인치 계산
  const inches = Math.sqrt(width ** 2 + height ** 2) / 25.4;
  
  if (inches < 250) {
    // 250인치 미만: 220V 멀티탭
    const moduleCount = (width / 500) * (height / 500);
    const multiTapCount = moduleCount <= 20 ? 3 : 4;
    return `220V 멀티탭 ${multiTapCount}개`;
  } else {
    // 250인치 이상: 50A 3상-4선 배전반
    const moduleCount = (width / 500) * (height / 500);
    const totalPower = moduleCount * 0.2; // kW
    
    // 50A 배전반 1개당 약 19kW 처리 가능 (380V x 50A x √3 x 0.8 ≈ 26kW, 안전율 고려)
    const panelCount = Math.ceil(totalPower / 19);
    return `50A 3상-4선 배전반 ${panelCount}개`;
  }
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

      // 총 모듈 수량 계산 함수
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
            status: {
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
          
          // LED1 정보 - 확장된 속성들
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
          
          "LED1 해상도": {
            rich_text: [
              {
                text: {
                  content: data.led1?.size ? calculateLEDResolution(data.led1.size) : ""
                }
              }
            ]
          },
          
          "LED1 소비전력": {
            rich_text: [
              {
                text: {
                  content: data.led1?.size ? calculateLEDPowerConsumption(data.led1.size) : ""
                }
              }
            ]
          },
          
          "LED1 전기설치 방식": {
            rich_text: [
              {
                text: {
                  content: data.led1?.size ? calculateElectricalInstallation(data.led1.size) : ""
                }
              }
            ]
          },
          
          "LED1 프롬프터 연결": {
            checkbox: data.led1?.prompterConnection || false
          },
          
          "LED1 중계카메라 연결": {
            checkbox: data.led1?.relayConnection || false
          },
          
          "LED1 오퍼레이터 필요": {
            checkbox: data.led1?.needOperator || false
          },
          
          "LED1 오퍼레이터 일수": {
            number: data.led1?.operatorDays || null
          },
          
          // LED2 정보 - 확장된 속성들
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
          
          "LED2 해상도": {
            rich_text: [
              {
                text: {
                  content: data.led2?.size ? calculateLEDResolution(data.led2.size) : ""
                }
              }
            ]
          },
          
          "LED2 소비전력": {
            rich_text: [
              {
                text: {
                  content: data.led2?.size ? calculateLEDPowerConsumption(data.led2.size) : ""
                }
              }
            ]
          },
          
          "LED2 전기설치 방식": {
            rich_text: [
              {
                text: {
                  content: data.led2?.size ? calculateElectricalInstallation(data.led2.size) : ""
                }
              }
            ]
          },
          
          "LED2 프롬프터 연결": {
            checkbox: data.led2?.prompterConnection || false
          },
          
          "LED2 중계카메라 연결": {
            checkbox: data.led2?.relayConnection || false
          },
          
          "LED2 오퍼레이터 필요": {
            checkbox: data.led2?.needOperator || false
          },
          
          "LED2 오퍼레이터 일수": {
            number: data.led2?.operatorDays || null
          },
          
          // LED3 정보 - 확장된 속성들
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
          
          "LED3 해상도": {
            rich_text: [
              {
                text: {
                  content: data.led3?.size ? calculateLEDResolution(data.led3.size) : ""
                }
              }
            ]
          },
          
          "LED3 소비전력": {
            rich_text: [
              {
                text: {
                  content: data.led3?.size ? calculateLEDPowerConsumption(data.led3.size) : ""
                }
              }
            ]
          },
          
          "LED3 전기설치 방식": {
            rich_text: [
              {
                text: {
                  content: data.led3?.size ? calculateElectricalInstallation(data.led3.size) : ""
                }
              }
            ]
          },
          
          "LED3 프롬프터 연결": {
            checkbox: data.led3?.prompterConnection || false
          },
          
          "LED3 중계카메라 연결": {
            checkbox: data.led3?.relayConnection || false
          },
          
          "LED3 오퍼레이터 필요": {
            checkbox: data.led3?.needOperator || false
          },
          
          "LED3 오퍼레이터 일수": {
            number: data.led3?.operatorDays || null
          },
          
          // LED4 정보 - 확장된 속성들
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
          
          "LED4 해상도": {
            rich_text: [
              {
                text: {
                  content: data.led4?.size ? calculateLEDResolution(data.led4.size) : ""
                }
              }
            ]
          },
          
          "LED4 소비전력": {
            rich_text: [
              {
                text: {
                  content: data.led4?.size ? calculateLEDPowerConsumption(data.led4.size) : ""
                }
              }
            ]
          },
          
          "LED4 전기설치 방식": {
            rich_text: [
              {
                text: {
                  content: data.led4?.size ? calculateElectricalInstallation(data.led4.size) : ""
                }
              }
            ]
          },
          
          "LED4 프롬프터 연결": {
            checkbox: data.led4?.prompterConnection || false
          },
          
          "LED4 중계카메라 연결": {
            checkbox: data.led4?.relayConnection || false
          },
          
          "LED4 오퍼레이터 필요": {
            checkbox: data.led4?.needOperator || false
          },
          
          "LED4 오퍼레이터 일수": {
            number: data.led4?.operatorDays || null
          },
          
          // LED5 정보 - 확장된 속성들
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
          
          "LED5 해상도": {
            rich_text: [
              {
                text: {
                  content: data.led5?.size ? calculateLEDResolution(data.led5.size) : ""
                }
              }
            ]
          },
          
          "LED5 소비전력": {
            rich_text: [
              {
                text: {
                  content: data.led5?.size ? calculateLEDPowerConsumption(data.led5.size) : ""
                }
              }
            ]
          },
          
          "LED5 전기설치 방식": {
            rich_text: [
              {
                text: {
                  content: data.led5?.size ? calculateElectricalInstallation(data.led5.size) : ""
                }
              }
            ]
          },
          
          "LED5 프롬프터 연결": {
            checkbox: data.led5?.prompterConnection || false
          },
          
          "LED5 중계카메라 연결": {
            checkbox: data.led5?.relayConnection || false
          },
          
          "LED5 오퍼레이터 필요": {
            checkbox: data.led5?.needOperator || false
          },
          
          "LED5 오퍼레이터 일수": {
            number: data.led5?.operatorDays || null
          },
          
          // 총 LED 모듈 수량
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
      
      // LED 사양 요약 생성
      const ledSummary = [];
      for (let i = 1; i <= 5; i++) {
        const ledKey = `led${i}` as keyof NotionData;
        const ledData = data[ledKey] as LEDSpec | undefined;
        if (ledData && ledData.size) {
          const [width, height] = ledData.size.split('x').map(Number);
          const moduleCount = (width / 500) * (height / 500);
          const operatorText = ledData.needOperator ? `, 오퍼레이터 ${ledData.operatorDays}일` : '';
          const prompterText = ledData.prompterConnection ? ', 프롬프터 연결' : '';
          const relayText = ledData.relayConnection ? ', 중계카메라 연결' : '';
          
          ledSummary.push(`LED${i}: ${ledData.size} (${moduleCount}개${operatorText}${prompterText}${relayText})`);
        }
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
              content: ` 님, 확인해주세요.\n\n📋 행사명: ${data.eventName}\n🏢 고객사: ${data.customerName}\n👤 담당자: ${data.contactName} ${data.contactTitle}\n📞 연락처: ${data.contactPhone}\n📅 행사 일정: ${data.eventSchedule}\n\n🖥️ LED 사양:\n${ledSummary.join('\n')}\n\n💰 견적 금액: ${data.totalQuoteAmount?.toLocaleString()}원`
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