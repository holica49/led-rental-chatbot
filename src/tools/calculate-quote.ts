import { TransportInfo } from '../types/index.js';

// 가격 상수
const PRICES = {
  LED_MODULE: 34000,          // LED 모듈 단가 (500개 이상 시)
  STRUCTURE_UNDER_4M: 20000,  // 4m 미만 구조물 (원/㎡)
  STRUCTURE_OVER_4M: 25000,   // 4m 이상 구조물 (원/㎡)
  CONTROLLER_UNDER_200: 200000, // 200인치 미만 컨트롤러
  CONTROLLER_OVER_200: 500000,  // 200인치 이상 컨트롤러
  POWER_OVER_250: 500000,       // 250인치 이상 파워
  INSTALLATION_PER_WORKER: 160000, // 설치 인력 단가
  OPERATOR_PER_DAY: 280000,     // 오퍼레이터 일당
  VAT_RATE: 0.1                 // 부가세율
};

// LED 입력 타입
interface LEDSpecInput {
  size: string;
  stageHeight?: number;
  needOperator: boolean;
  operatorDays: number;
  prompterConnection?: boolean;
  relayConnection?: boolean;
}

// 총 LED 모듈 수량에 따른 설치 인력 계산
function calculateInstallationWorkers(totalModules: number): number {
  if (totalModules <= 60) return 3;
  if (totalModules <= 100) return 5;
  if (totalModules <= 150) return 7;
  if (totalModules <= 250) return 9;
  return 12; // 251개 이상
}

// 설치인력 구간 구분 텍스트
function getInstallationWorkerRange(totalModules: number): string {
  if (totalModules <= 60) return "60개 이하 (3명)";
  if (totalModules <= 100) return "61-100개 (5명)";
  if (totalModules <= 150) return "101-150개 (7명)";
  if (totalModules <= 250) return "151-250개 (9명)";
  return "251개 이상 (12명)";
}

// 구조물 단가 구분 (무대 높이 기준)
function getStructureUnitPrice(stageHeights: number[]): { unitPrice: number; description: string } {
  const maxHeight = Math.max(...stageHeights.filter(h => h > 0));
  
  if (maxHeight >= 4000) {
    return {
      unitPrice: PRICES.STRUCTURE_OVER_4M,
      description: "4m 이상 (25,000원/㎡)"
    };
  } else {
    return {
      unitPrice: PRICES.STRUCTURE_UNDER_4M,
      description: "4m 미만 (20,000원/㎡)"
    };
  }
}

// 운반비 구간 구분
function getTransportRange(totalModules: number): string {
  if (totalModules <= 200) return "200개 이하";
  if (totalModules <= 400) return "201-400개";
  return "400개 초과";
}

// 운반비 계산
function calculateTransportCost(totalModules: number): number {
  if (totalModules <= 200) return 200000;
  if (totalModules <= 400) return 400000;
  return 700000;
}

// 배차 정보 계산
function calculateTransport(moduleCount: number): TransportInfo {
  const plateBoxCount = Math.ceil(moduleCount / 8);
  
  if (moduleCount <= 80) {
    return {
      truckType: '1.5톤',
      truckCount: 1,
      plateBoxCount: plateBoxCount
    };
  } else {
    const trucksNeeded = Math.ceil(moduleCount / 200);
    return {
      truckType: '3.5톤',
      truckCount: trucksNeeded,
      plateBoxCount: plateBoxCount
    };
  }
}

// 다중 LED 견적 계산 함수
export function calculateMultiLEDQuote(ledSpecs: LEDSpecInput[]) {
  let totalModules = 0;
  let totalStructureArea = 0;
  let totalControllerCost = 0;
  let totalPowerCost = 0;
  let totalOperatorCost = 0;
  let powerRequiredCount = 0;
  const stageHeights: number[] = [];

  // 각 LED 개소별 계산
  ledSpecs.forEach(specs => {
    if (!specs.size) return;

    const [width, height] = specs.size.split('x').map(Number);
    
    // LED 모듈 수량
    const moduleCount = (width / 500) * (height / 500);
    totalModules += moduleCount;
    
    // 구조물 면적
    const structureArea = (width * height) / 1_000_000;
    totalStructureArea += structureArea;
    
    // 무대 높이 수집
    if (specs.stageHeight) {
      stageHeights.push(specs.stageHeight);
    }
    
    // 대각선 인치 계산
    const inches = Math.sqrt(width ** 2 + height ** 2) / 25.4;
    
    // 컨트롤러 비용 (개소별)
    totalControllerCost += inches < 200 ? PRICES.CONTROLLER_UNDER_200 : PRICES.CONTROLLER_OVER_200;
    
    // 파워 비용 (개소별)
    if (inches >= 250) {
      totalPowerCost += PRICES.POWER_OVER_250;
      powerRequiredCount++;
    }
    
    // 오퍼레이터 비용
    if (specs.needOperator) {
      totalOperatorCost += specs.operatorDays * PRICES.OPERATOR_PER_DAY;
    }
  });

  // 구조물 단가 결정 (최대 무대 높이 기준)
  const structureInfo = getStructureUnitPrice(stageHeights);
  
  // 설치 인력 계산 (총 모듈 수 기준)
  const installationWorkers = calculateInstallationWorkers(totalModules);

  const quote = {
    ledModules: {
      count: totalModules,
      price: totalModules < 500 ? 0 : totalModules * PRICES.LED_MODULE
    },
    structure: {
      area: totalStructureArea,
      unitPrice: structureInfo.unitPrice,
      unitPriceDescription: structureInfo.description,
      totalPrice: totalStructureArea * structureInfo.unitPrice
    },
    controller: {
      totalPrice: totalControllerCost,
      count: ledSpecs.length // 개소 수
    },
    power: {
      totalPrice: totalPowerCost,
      requiredCount: powerRequiredCount
    },
    installation: {
      workers: installationWorkers,
      workerRange: getInstallationWorkerRange(totalModules),
      pricePerWorker: PRICES.INSTALLATION_PER_WORKER,
      totalPrice: installationWorkers * PRICES.INSTALLATION_PER_WORKER
    },
    operation: {
      totalPrice: totalOperatorCost,
      days: ledSpecs.reduce((sum, spec) => sum + (spec.needOperator ? spec.operatorDays : 0), 0),
      pricePerDay: PRICES.OPERATOR_PER_DAY
    },
    transport: {
      price: calculateTransportCost(totalModules),
      range: getTransportRange(totalModules)
    },
    
    // 추가 정보 (상세 조건 정보)
    totalModuleCount: totalModules,
    maxStageHeight: Math.max(...stageHeights.filter(h => h > 0), 0),
    installationWorkers: installationWorkers,
    installationWorkerRange: getInstallationWorkerRange(totalModules),
    controllerCount: ledSpecs.length,
    powerRequiredCount: powerRequiredCount,
    transportRange: getTransportRange(totalModules),
    structureUnitPrice: structureInfo.unitPrice,
    structureUnitPriceDescription: structureInfo.description,
    
    subtotal: 0,
    vat: 0,
    total: 0
  };

  // 소계 계산
  quote.subtotal = quote.ledModules.price + quote.structure.totalPrice + 
                  quote.controller.totalPrice + quote.power.totalPrice + 
                  quote.installation.totalPrice + quote.operation.totalPrice + 
                  quote.transport.price;
  
  quote.vat = Math.round(quote.subtotal * PRICES.VAT_RATE);
  quote.total = quote.subtotal + quote.vat;

  return quote;
}

// 다중 LED 견적 계산 도구
export const calculateMultiQuoteTool = {
  definition: {
    name: 'calculate_multi_quote',
    description: '다중 LED 개소의 렌탈 견적을 자동으로 계산합니다',
    inputSchema: {
      type: 'object',
      properties: {
        ledSpecs: {
          type: 'array',
          description: 'LED 개소별 사양 배열',
          items: {
            type: 'object',
            properties: {
              size: { type: 'string', description: 'LED 크기 (예: "4000x2500")' },
              stageHeight: { type: 'number', description: '무대 높이 (mm)' },
              needOperator: { type: 'boolean', description: '오퍼레이터 필요 여부' },
              operatorDays: { type: 'number', description: '오퍼레이터 일수' }
            },
            required: ['size', 'needOperator', 'operatorDays']
          }
        },
        customerName: {
          type: 'string',
          description: '고객사명'
        }
      },
      required: ['ledSpecs', 'customerName']
    }
  },

  handler: async (args: any) => {
    try {
      const { ledSpecs, customerName } = args;

      // 각 LED 크기 검증
      for (const specs of ledSpecs) {
        if (!specs.size || typeof specs.size !== 'string') {
          throw new Error('LED 크기를 입력해주세요.');
        }
        
        const [width, height] = specs.size.split('x').map(Number);
        if (width % 500 !== 0 || height % 500 !== 0) {
          throw new Error(`LED 크기는 500mm 단위로 입력해주세요: ${specs.size}`);
        }
      }

      // 다중 LED 견적 계산
      const quote = calculateMultiLEDQuote(ledSpecs);

      // 배차 정보 계산
      const transport = calculateTransport(quote.ledModules.count);

      // LED 개소별 요약 정보
      const ledSummary = ledSpecs.map((specs: LEDSpecInput, index: number) => {
        const [width, height] = specs.size.split('x').map(Number);
        const moduleCount = (width / 500) * (height / 500);
        return `LED${index + 1}: ${specs.size} (${moduleCount}개)`;
      }).join(', ');

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            quote,
            transport,
            ledSummary,
            summary: `다중 견적 완료: ${customerName} - ${ledSpecs.length}개소 LED, 총 ${quote.total.toLocaleString()}원 (VAT 포함)`
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `다중 견적 계산 실패: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
};