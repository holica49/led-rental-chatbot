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
  // 서비스 구분 정보
  serviceType: '설치' | '렌탈' | '멤버쉽';
  memberCode?: string;
  
  // 설치 서비스 관련
  installEnvironment?: '실내' | '실외';
  installRegion?: string;
  requiredTiming?: string;
  
  // 렌탈 서비스 관련
  supportStructureType?: '목공 설치' | '단독 설치';
  rentalPeriod?: number;
  periodSurchargeAmount?: number;
  
  // 기본 정보
  eventName: string;
  customerName: string;
  contactName: string;
  contactTitle: string;
  contactPhone: string;
  venue: string;
  eventSchedule: string;
  installSchedule?: string;
  rehearsalSchedule?: string;
  dismantleSchedule?: string;
  
  // LED 정보
  led1?: LEDSpec;
  led2?: LEDSpec;
  led3?: LEDSpec;
  led4?: LEDSpec;
  led5?: LEDSpec;
  
  // 견적 정보
  totalQuoteAmount: number;
  totalModuleCount?: number;
  ledModuleCost?: number;
  structureCost?: number;
  controllerCost?: number;
  powerCost?: number;
  installationCost?: number;
  operatorCost?: number;
  transportCost?: number;
  
  // 상세 조건 정보
  maxStageHeight?: number;
  installationWorkers?: number;
  installationWorkerRange?: string;
  controllerCount?: number;
  powerRequiredCount?: number;
  transportRange?: string;
  structureUnitPrice?: number;
  structureUnitPriceDescription?: string;
  
  // 추가 정보
  additionalRequests?: string;
  assignedManager?: string;
  managerPhone?: string;
}

// 담당자 정보 가져오기
function getManagerInfo(serviceType: string, installEnvironment?: string): { name: string; phone: string } {
  // 설치 서비스는 항상 유준수 구축팀장
  if (serviceType === '설치') {
    return { name: '유준수 구축팀장', phone: '010-7333-3336' };
  }
  
  // 렌탈 서비스 + 실외
  if (serviceType === '렌탈' && installEnvironment === '실외') {
    return { name: '최수삼 팀장', phone: '010-2797-2504' };
  }
  
  // 기본값 (멤버쉽 또는 렌탈 실내)
  return { name: '', phone: '' };
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
  if (!ledData || !ledData.size) return {};
  
  return {
    [`${prefix} 크기`]: {
      rich_text: [{ text: { content: ledData.size || "" } }]
    },
    [`${prefix} 무대 높이`]: {
      number: ledData.stageHeight || null
    },
    [`${prefix} 모듈 수량`]: {
      number: calculateModuleCount(ledData.size)
    },
    [`${prefix} 대각선 인치`]: {
      rich_text: [{ text: { content: `${calculateInches(ledData.size)}인치` } }]
    },
    [`${prefix} 해상도`]: {
      rich_text: [{ text: { content: calculateLEDResolution(ledData.size) } }]
    },
    [`${prefix} 소비전력`]: {
      rich_text: [{ text: { content: calculateLEDPowerConsumption(ledData.size) } }]
    },
    [`${prefix} 전기설치 방식`]: {
      rich_text: [{ text: { content: calculateElectricalInstallation(ledData.size) } }]
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
      
      // 담당자 정보 자동 설정
      const managerInfo = getManagerInfo(data.serviceType, data.installEnvironment);
      
      // 기본 속성
      const properties: any = {
        // 서비스 구분 정보
        "서비스 유형": {
          select: { name: data.serviceType }
        },
        
        // 기본 정보
        "행사명": {
          title: [{ text: { content: data.eventName || "" } }]
        },
        "고객사": {
          select: { name: data.customerName || "고객사" }
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
        
        // 견적 정보
        "견적 금액": {
          number: data.totalQuoteAmount || null
        },
        "견적서": {
          files: []  // 파일은 나중에 수동으로 업로드
        },
        "요청서": {
          files: []  // 파일은 나중에 수동으로 업로드
        }
      };
      
      // 설치 일정 정보 (설치 서비스가 아닌 경우만)
      if (data.serviceType !== '설치') {
        if (data.installSchedule) {
          properties["설치 일정"] = {
            date: { start: data.installSchedule }
          };
        }
        if (data.rehearsalSchedule) {
          properties["리허설 일정"] = {
            date: { start: data.rehearsalSchedule }
          };
        }
        if (data.dismantleSchedule) {
          properties["철거 일정"] = {
            date: { start: data.dismantleSchedule }
          };
        }
      }
      
      // 견적 상세 정보 (설치 서비스가 아닌 경우)
      if (data.serviceType !== '설치') {
        properties["총 LED 모듈 수량"] = {
          number: calculateTotalModuleCount(data) || data.totalModuleCount || null
        };
        
        if (data.ledModuleCost !== undefined) {
          properties["LED 모듈 비용"] = { number: data.ledModuleCost };
        }
        if (data.structureCost !== undefined) {
          properties["지지구조물 비용"] = { number: data.structureCost };
        }
        if (data.controllerCost !== undefined) {
          properties["컨트롤러 및 스위치 비용"] = { number: data.controllerCost };
        }
        if (data.powerCost !== undefined) {
          properties["파워 비용"] = { number: data.powerCost };
        }
        if (data.installationCost !== undefined) {
          properties["설치철거인력 비용"] = { number: data.installationCost };
        }
        if (data.operatorCost !== undefined) {
          properties["오퍼레이터 비용"] = { number: data.operatorCost };
        }
        if (data.transportCost !== undefined) {
          properties["운반 비용"] = { number: data.transportCost };
        }
      }
      
      // 추가 정보
      if (data.additionalRequests) {
        properties["문의요청 사항"] = {
          rich_text: [{ text: { content: data.additionalRequests } }]
        };
      }
      
      // 서비스별 추가 속성
      if (data.serviceType === '멤버쉽' && data.memberCode) {
        properties["멤버 코드"] = {
          rich_text: [{ text: { content: data.memberCode } }]
        };
      }
      
      if (data.serviceType === '설치') {
        if (data.installEnvironment) {
          properties["설치 환경"] = {
            select: { name: data.installEnvironment }
          };
        }
        if (data.installRegion) {
          properties["설치 지역"] = {
            rich_text: [{ text: { content: data.installRegion } }]
          };
        }
        if (data.requiredTiming) {
          properties["필요 시기"] = {
            rich_text: [{ text: { content: data.requiredTiming } }]
          };
        }
      }
      
      if (data.serviceType === '렌탈') {
        if (data.supportStructureType) {
          properties["지지구조물 타입"] = {
            select: { name: data.supportStructureType }
          };
        }
        if (data.rentalPeriod) {
          properties["렌탈 기간"] = {
            number: data.rentalPeriod
          };
        }
        if (data.periodSurchargeAmount !== undefined) {
          properties["기간 할증 비용"] = {
            number: data.periodSurchargeAmount
          };
        }
      }
      
      // 담당자 정보 (자동 설정된 경우)
      if (managerInfo.name) {
        properties["담당자"] = {
          rich_text: [{ text: { content: managerInfo.name } }]
        };
        properties["담당자 연락처"] = {
          phone_number: managerInfo.phone
        };
      }
      
      // LED 개소별 속성 추가 (설치 서비스가 아닌 경우)
      if (data.serviceType !== '설치') {
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
      }
      
      // Notion 페이지 생성
      const response = await notion.pages.create({
        parent: { database_id: databaseId! },
        properties
      });
      
      console.log('Notion 저장 완료:', response.id);
      
      // 조건별 정보 댓글 추가 (설치 서비스가 아닌 경우)
      if (data.serviceType !== '설치') {
        await this.addConditionComment(response.id, data);
      }
      
      // 담당자 멘션 추가 (환경변수에 설정된 경우)
      if (data.assignedManager) {
        await this.addManagerMention(response.id, data.assignedManager);
      }
      
      return {
        content: [{
          type: 'text',
          text: `✅ Notion에 ${data.serviceType} 정보가 저장되었습니다!\n📝 페이지 ID: ${response.id}\n🏢 고객사: ${data.customerName}\n📋 행사명: ${data.eventName}\n💰 견적 금액: ${data.totalQuoteAmount?.toLocaleString() || '계산 중'}원\n🔖 서비스: ${data.serviceType}${managerInfo.name ? `\n👤 담당자: ${managerInfo.name}` : ''}`
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
      const serviceInfo = [
        `🔖 서비스 유형: ${data.serviceType}`,
        data.memberCode ? `📌 멤버 코드: ${data.memberCode}` : '',
        data.installEnvironment ? `🏗️ 설치 환경: ${data.installEnvironment}` : '',
        data.supportStructureType ? `🔧 지지구조물: ${data.supportStructureType}` : '',
        data.rentalPeriod ? `📅 렌탈 기간: ${data.rentalPeriod}일` : '',
        data.periodSurchargeAmount !== undefined ? `💸 기간 할증: ${data.periodSurchargeAmount.toLocaleString()}원` : ''
      ].filter(line => line).join('\n');
      
      const structureInfo = data.structureUnitPriceDescription || (data.serviceType === '렌탈' ? "렌탈은 구조물비 제외" : "정보 없음");
      const installInfo = data.installationWorkerRange || (data.serviceType === '렌탈' ? "렌탈은 설치인력비 제외" : "정보 없음");
      
      const conditionSummary = [
        `📊 조건별 정보 요약`,
        ``,
        serviceInfo,
        ``,
        `🏗️ 구조물: ${structureInfo}`,
        `👷 설치인력: ${installInfo}${data.installationWorkers ? ` - ${data.installationWorkers}명` : ''}`,
        `🎛️ 컨트롤러: ${data.controllerCount ? `총 ${data.controllerCount}개소` : (data.serviceType === '렌탈' ? '렌탈은 제외' : '정보 없음')}`,
        `⚡ 파워: ${data.powerRequiredCount ? `${data.powerRequiredCount}개소 필요` : (data.serviceType === '렌탈' ? '렌탈은 제외' : '정보 없음')}`,
        `🚚 운반비: ${data.transportRange || "정보 없음"}`,
        data.maxStageHeight ? `📐 최대 무대높이: ${data.maxStageHeight}mm` : '',
        data.additionalRequests ? `\n💬 추가 요청사항: ${data.additionalRequests}` : ''
      ].filter(line => line !== '').join('\n');
      
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
      return null;
    }
  },
  
  // 담당자 멘션 추가
  async addManagerMention(pageId: string, managerName: string) {
    try {
      // 환경변수에서 매니저 정보 가져오기
      const managersConfig = process.env.MANAGERS_CONFIG ? JSON.parse(process.env.MANAGERS_CONFIG) : {};
      const managerId = managersConfig[managerName];
      
      if (!managerId) {
        console.log(`담당자 "${managerName}"의 Notion ID를 찾을 수 없습니다.`);
        return null;
      }
      
      // Notion API의 rich_text 타입에 맞춰 작성
      const richTextArray: any[] = [
        {
          type: 'mention',
          mention: {
            user: { id: managerId }
          }
        },
        {
          type: 'text',
          text: { content: ' 님, 새로운 견적 요청이 등록되었습니다. 확인 부탁드립니다.' }
        }
      ];
      
      const comment = await notion.comments.create({
        parent: { page_id: pageId },
        rich_text: richTextArray
      });
      
      console.log('담당자 멘션 추가 완료:', comment.id);
      return comment;
      
    } catch (error) {
      console.error('담당자 멘션 추가 실패:', error);
      return null;
    }
  }
};