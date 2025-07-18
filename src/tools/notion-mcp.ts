import { Client } from '@notionhq/client';

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

const databaseId = process.env.NOTION_DATABASE_ID;

// LED 사양 타입
interface LEDSpec {
  size: string;
  stageHeight: number;
  needOperator: boolean;
  operatorDays: number;
  prompterConnection?: boolean;
  relayConnection?: boolean;
}

// Notion 데이터 타입
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
  
  // 상세 조건 정보
  maxStageHeight: number;
  installationWorkers: number;
  installationWorkerRange: string;
  controllerCount: number;
  powerRequiredCount: number;
  transportRange: string;
  structureUnitPrice: number;
  structureUnitPriceDescription: string;
}

// LED 계산 함수들
function calculateLEDResolution(ledSize: string): string {
  if (!ledSize) return '';
  
  const [width, height] = ledSize.split('x').map(Number);
  const horizontalModules = width / 500;
  const verticalModules = height / 500;
  const horizontalPixels = horizontalModules * 168;
  const verticalPixels = verticalModules * 168;
  
  return `${horizontalPixels} x ${verticalPixels} pixels`;
}

function calculateLEDPowerConsumption(ledSize: string): string {
  if (!ledSize) return '';
  
  const [width, height] = ledSize.split('x').map(Number);
  const moduleCount = (width / 500) * (height / 500);
  const totalPower = moduleCount * 0.2;
  
  return `380V ${totalPower}kW`;
}

function calculateElectricalInstallation(ledSize: string): string {
  if (!ledSize) return '';
  
  const [width, height] = ledSize.split('x').map(Number);
  const inches = Math.sqrt(width ** 2 + height ** 2) / 25.4;
  
  if (inches < 250) {
    const moduleCount = (width / 500) * (height / 500);
    const multiTapCount = moduleCount <= 20 ? 3 : 4;
    return `220V 멀티탭 ${multiTapCount}개`;
  } else {
    const moduleCount = (width / 500) * (height / 500);
    const totalPower = moduleCount * 0.2;
    const panelCount = Math.ceil(totalPower / 19);
    return `50A 3상-4선 배전반 ${panelCount}개`;
  }
}

function calculateInches(size: string): number {
  if (!size) return 0;
  const [width, height] = size.split('x').map(Number);
  return Math.round(Math.sqrt(width ** 2 + height ** 2) / 25.4 * 10) / 10;
}

function calculateModuleCount(size: string): number {
  if (!size) return 0;
  const [width, height] = size.split('x').map(Number);
  return (width / 500) * (height / 500);
}

function calculateTotalModuleCount(data: NotionData): number {
  let totalCount = 0;
  for (let i = 1; i <= 5; i++) {
    const ledKey = `led${i}` as keyof NotionData;
    const ledData = data[ledKey] as LEDSpec | undefined;
    if (ledData && ledData.size) {
      totalCount += calculateModuleCount(ledData.size);
    }
  }
  return totalCount;
}

// LED 속성 생성 함수
function createLEDProperties(ledData: LEDSpec | undefined, prefix: string) {
  if (!ledData) return {};
  
  return {
    [`${prefix} 크기`]: {
      rich_text: [{ text: { content: ledData.size || "" } }]
    },
    [`${prefix} 무대 높이`]: {
      number: ledData.stageHeight || null
    },
    [`${prefix} 모듈 수량`]: {
      number: ledData.size ? calculateModuleCount(ledData.size) : null
    },
    [`${prefix} 대각선 인치`]: {
      rich_text: [{ text: { content: ledData.size ? `${calculateInches(ledData.size)}인치` : "" } }]
    },
    [`${prefix} 해상도`]: {
      rich_text: [{ text: { content: ledData.size ? calculateLEDResolution(ledData.size) : "" } }]
    },
    [`${prefix} 소비전력`]: {
      rich_text: [{ text: { content: ledData.size ? calculateLEDPowerConsumption(ledData.size) : "" } }]
    },
    [`${prefix} 전기설치 방식`]: {
      rich_text: [{ text: { content: ledData.size ? calculateElectricalInstallation(ledData.size) : "" } }]
    },
    [`${prefix} 프롬프터 연결`]: {
      checkbox: ledData.prompterConnection || false
    },
    [`${prefix} 중계카메라 연결`]: {
      checkbox: ledData.relayConnection || false
    },
    [`${prefix} 오퍼레이터 필요`]: {
      checkbox: ledData.needOperator || false
    },
    [`${prefix} 오퍼레이터 일수`]: {
      number: ledData.operatorDays || null
    }
  };
}

export const notionMCPTool = {
  async handler(data: NotionData) {
    try {
      console.log('Notion 저장 시작:', data);
      
      // 기본 속성
      const properties: any = {
        // 기본 정보
        "행사명": {
          title: [{ text: { content: data.eventName || "" } }]
        },
        "고객사": {
          select: { name: data.customerName || "메쎄이상" }
        },
        "고객담당자": {
          rich_text: [{ text: { content: data.contactName && data.contactTitle ? `${data.contactName} ${data.contactTitle}` : (data.contactName || "") } }]
        },
        "고객 연락처": {
          phone_number: data.contactPhone || ""
        },
        "행사장": {
          rich_text: [{ text: { content: data.venue || "" } }]
        },
        "행사 상태": {
          status: { name: "견적 요청" }
        },
        
        // 일정 정보
        "행사 일정": {
          rich_text: [{ text: { content: data.eventSchedule || "" } }]
        },
        "설치 일정": {
          date: data.installSchedule ? { start: data.installSchedule } : null
        },
        "리허설 일정": {
          date: data.rehearsalSchedule ? { start: data.rehearsalSchedule } : null
        },
        "철거 일정": {
          date: data.dismantleSchedule ? { start: data.dismantleSchedule } : null
        },
        
        // 총 LED 모듈 수량
        "총 LED 모듈 수량": {
          number: calculateTotalModuleCount(data)
        },

        // 견적 정보
        "견적 금액": {
          number: data.totalQuoteAmount || null
        },
        "견적서": {
          files: []  // 파일은 나중에 수동으로 업로드
        },
        "요청서": {
          files: []  // 파일은 나중에 수동으로 업로드
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
      };
      
      // LED 개소별 속성 추가
      const ledProperties = [
        createLEDProperties(data.led1, 'LED1'),
        createLEDProperties(data.led2, 'LED2'),
        createLEDProperties(data.led3, 'LED3'),
        createLEDProperties(data.led4, 'LED4'),
        createLEDProperties(data.led5, 'LED5')
      ];
      
      // 모든 LED 속성 병합
      ledProperties.forEach(ledProp => {
        Object.assign(properties, ledProp);
      });
      
      // Notion 페이지 생성
      const response = await notion.pages.create({
        parent: { database_id: databaseId! },
        properties
      });
      
      console.log('Notion 저장 완료:', response.id);
      
      // 조건별 정보 댓글 추가
      await this.addConditionComment(response.id, data);
      
      return {
        content: [{
          type: 'text',
          text: `✅ Notion에 행사 정보가 저장되었습니다!\n📝 페이지 ID: ${response.id}\n🏢 고객사: ${data.customerName}\n📋 행사명: ${data.eventName}\n💰 견적 금액: ${data.totalQuoteAmount?.toLocaleString()}원`
        }],
        id: response.id
      };
      
    } catch (error) {
      console.error('Notion 저장 실패:', error);
      throw error;
    }
  },
  
  // 조건별 정보 댓글 추가
  async addConditionComment(pageId: string, data: NotionData) {
    try {
      const conditionSummary = [
        `📊 조건별 정보 요약`,
        ``,
        `🏗️ 구조물: ${data.structureUnitPriceDescription || "정보 없음"}`,
        `👷 설치인력: ${data.installationWorkerRange || "정보 없음"} - ${data.installationWorkers || 0}명`,
        `🎛️ 컨트롤러: 총 ${data.controllerCount || 0}개소`,
        `⚡ 파워: ${data.powerRequiredCount || 0}개소 필요`,
        `🚚 운반비: ${data.transportRange || "정보 없음"}`,
        `📐 최대 무대높이: ${data.maxStageHeight || 0}mm`
      ].join('\n');
      
      const comment = await notion.comments.create({
        parent: { page_id: pageId },
        rich_text: [
          {
            type: 'text',
            text: { content: conditionSummary }
          }
        ]
      });
      
      console.log('조건별 정보 댓글 추가 완료:', comment.id);
      return comment;
      
    } catch (error) {
      console.error('조건별 정보 댓글 추가 실패:', error);
    }
  }
};