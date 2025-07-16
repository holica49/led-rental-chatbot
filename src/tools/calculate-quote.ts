import { LEDQuoteResponse, LEDQuoteRequest, TransportInfo } from '../types/index.js';

// 가격 상수
const PRICES = {
  LED_MODULE: 34000,          // LED 모듈 단가 (500개 이상 시)
  STRUCTURE_UNDER_4M: 20000,  // 4m 미만 구조물 (원/㎡) - 항상 이 가격 적용
  STRUCTURE_OVER_4M: 25000,   // 4m 이상 구조물 (원/㎡) - 사용 안 함
  CONTROLLER_UNDER_200: 200000, // 200인치 미만 컨트롤러
  CONTROLLER_OVER_200: 500000,  // 200인치 이상 컨트롤러
  POWER_OVER_250: 500000,       // 250인치 이상 파워
  INSTALLATION_PER_WORKER: 160000, // 설치 인력 단가
  OPERATOR_PER_DAY: 280000,     // 오퍼레이터 일당
  MIN_WORKERS: 3,               // 최소 설치 인력
  VAT_RATE: 0.1                 // 부가세율
};

// LED 입력 타입 정의
interface LEDSpecInput {
  size: string;
  needOperator: boolean;
  operatorDays: number;
}

// LED 크기 검증 함수
function validateLEDSize(ledSize: string): { valid: boolean; error?: string } {
  if (!ledSize || typeof ledSize !== 'string') {
    return { valid: false, error: 'LED 크기를 입력해주세요.' };
  }

  const pattern = /^(\d+)x(\d+)$/;
  const match = ledSize.match(pattern);
  
  if (!match) {
    return { valid: false, error: 'LED 크기는 "가로x세로" 형식으로 입력해주세요. (예: 4000x2500)' };
  }

  const [, widthStr, heightStr] = match;
  const width = parseInt(widthStr);
  const height = parseInt(heightStr);

  if (width % 500 !== 0 || height % 500 !== 0) {
    return { valid: false, error: 'LED 크기는 500mm 단위로 입력해주세요.' };
  }

  if (width < 500 || height < 500) {
    return { valid: false, error: 'LED 크기는 최소 500x500mm 이상이어야 합니다.' };
  }

  return { valid: true };
}

// 운반비 계산 함수 (수정됨)
function calculateTransportCost(totalModules: number): number {
  if (totalModules <= 200) {
    return 200000;
  } else if (totalModules <= 400) {
    return 400000;
  } else {
    return 700000;
  }
}

// 배차 정보 계산 함수
function calculateTransport(moduleCount: number): TransportInfo {
  // 플레이트 케이스 수량 (8개씩 포장)
  const plateBoxCount = Math.ceil(moduleCount / 8);
  
  // 차급 및 대수 결정
  if (moduleCount <= 80) {
    return {
      truckType: '1.5톤',
      truckCount: 1,
      plateBoxCount: plateBoxCount
    };
  } else {
    // 3.5톤 기준 (추후 최대 적재량 확인 필요)
    const trucksNeeded = Math.ceil(moduleCount / 200); // 임시로 200개 기준
    return {
      truckType: '3.5톤',
      truckCount: trucksNeeded,
      plateBoxCount: plateBoxCount
    };
  }
}

// 다중 LED 견적 계산 함수 (총 모듈 수 포함)
export function calculateMultiLEDQuote(ledSpecs: LEDSpecInput[]) {
  let totalModules = 0;
  let totalStructureArea = 0;
  let totalControllerCost = 0;
  let totalPowerCost = 0;
  let totalOperatorCost = 0;

  // 각 LED 개소별 계산
  ledSpecs.forEach(specs => {
    if (!specs.size) return;

    const [width, height] = specs.size.split('x').map(Number);
    
    // LED 모듈 수량
    const moduleCount = (width / 500) * (height / 500);
    totalModules += moduleCount;  // 각 개소의 모듈 수를 누적
    
    // 구조물 면적 (LED 크기의 가로×세로만, 무대 높이 무시)
    const structureArea = (width * height) / 1_000_000;
    totalStructureArea += structureArea;
    
    // 대각선 인치 계산
    const inches = Math.sqrt(width ** 2 + height ** 2) / 25.4;
    
    // 컨트롤러 비용 (개소별)
    totalControllerCost += inches < 200 ? PRICES.CONTROLLER_UNDER_200 : PRICES.CONTROLLER_OVER_200;
    
    // 파워 비용 (개소별)
    totalPowerCost += inches >= 250 ? PRICES.POWER_OVER_250 : 0;
    
    // 오퍼레이터 비용
    if (specs.needOperator) {
      totalOperatorCost += specs.operatorDays * PRICES.OPERATOR_PER_DAY;
    }
  });

  // 여기서 totalModules는 모든 LED 개소의 모듈 수 합계
  // 예: LED1(40개) + LED2(12개) + LED3(4개) = 56개

  const quote = {
    ledModules: {
      count: totalModules,  // 총 모듈 수 (56개)
      price: totalModules < 500 ? 0 : totalModules * PRICES.LED_MODULE
    },
    structure: {
      area: totalStructureArea,
      unitPrice: PRICES.STRUCTURE_UNDER_4M,  // 항상 4m 미만 요금
      totalPrice: totalStructureArea * PRICES.STRUCTURE_UNDER_4M
    },
    controller: {
      totalPrice: totalControllerCost
    },
    power: {
      totalPrice: totalPowerCost
    },
    installation: {
      workers: PRICES.MIN_WORKERS,
      pricePerWorker: PRICES.INSTALLATION_PER_WORKER,
      totalPrice: PRICES.MIN_WORKERS * PRICES.INSTALLATION_PER_WORKER
    },
    operation: {
      totalPrice: totalOperatorCost
    },
    transport: {
      price: calculateTransportCost(totalModules)  // 총 모듈 수로 운반비 계산
    },
    
    // 💡 여기가 핵심! 총 모듈 수를 별도로 포함
    totalModuleCount: totalModules,  // 🔥 새로 추가된 부분 - Notion DB용
    
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

// 기존 단일 LED 견적 계산 도구 (수정됨)
export const calculateQuoteTool = {
  definition: {
    name: 'calculate_quote',
    description: 'LED 렌탈 견적을 자동으로 계산합니다',
    inputSchema: {
      type: 'object',
      properties: {
        ledSize: {
          type: 'string',
          description: 'LED 크기 (예: "4000x2500")'
        },
        is3D: {
          type: 'boolean',
          description: '3D 사용 여부'
        },
        needOperator: {
          type: 'boolean',
          description: '오퍼레이터 필요 여부'
        },
        eventStartDate: {
          type: 'string',
          description: '행사 시작일 (YYYY-MM-DD)'
        },
        eventEndDate: {
          type: 'string',
          description: '행사 종료일 (YYYY-MM-DD)'
        },
        eventLocation: {
          type: 'string',
          description: '행사 장소'
        },
        customerName: {
          type: 'string',
          description: '고객사명'
        }
      },
      required: ['ledSize', 'is3D', 'needOperator', 'eventStartDate', 'eventEndDate']
    }
  },

  handler: async (args: any) => {
    try {
      // 입력 검증
      const validation = validateLEDSize(args.ledSize);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const [width, height] = args.ledSize.split('x').map(Number);
      
      // LED 모듈 수량 계산 (500x500mm 기준)
      const moduleCount = (width / 500) * (height / 500);
      
      // 구조물 면적 계산 (LED 크기만, 무대 높이 무시)
      const structureArea = (width * height) / 1_000_000;
      
      // 대각선 인치 계산
      const inches = Math.sqrt(width ** 2 + height ** 2) / 25.4;
      
      // 행사 일수 계산
      const startDate = new Date(args.eventStartDate);
      const endDate = new Date(args.eventEndDate);
      const eventDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      // 견적 계산 (수정된 로직)
      const quote: LEDQuoteResponse = {
        ledModules: {
          count: moduleCount,
          price: moduleCount < 500 ? 0 : moduleCount * PRICES.LED_MODULE
        },
        structure: {
          area: structureArea,
          unitPrice: PRICES.STRUCTURE_UNDER_4M,  // 항상 4m 미만 요금 적용
          totalPrice: structureArea * PRICES.STRUCTURE_UNDER_4M
        },
        controller: {
          inches: inches,
          price: inches < 200 ? PRICES.CONTROLLER_UNDER_200 : PRICES.CONTROLLER_OVER_200
        },
        power: {
          price: inches >= 250 ? PRICES.POWER_OVER_250 : 0
        },
        installation: {
          workers: PRICES.MIN_WORKERS,
          pricePerWorker: PRICES.INSTALLATION_PER_WORKER,
          totalPrice: PRICES.MIN_WORKERS * PRICES.INSTALLATION_PER_WORKER
        },
        operation: {
          days: args.needOperator ? eventDays : 0,
          pricePerDay: PRICES.OPERATOR_PER_DAY,
          totalPrice: args.needOperator ? eventDays * PRICES.OPERATOR_PER_DAY : 0
        },
        transport: {
          price: calculateTransportCost(moduleCount)  // 수정된 운반비 계산
        },
        subtotal: 0,
        vat: 0,
        total: 0
      };

      // 소계 계산
      quote.subtotal = quote.ledModules.price + quote.structure.totalPrice + 
                      quote.controller.price + quote.power.price + 
                      quote.installation.totalPrice + quote.operation.totalPrice + 
                      quote.transport.price;
      
      quote.vat = Math.round(quote.subtotal * PRICES.VAT_RATE);
      quote.total = quote.subtotal + quote.vat;

      // 배차 정보 계산
      const transport: TransportInfo = calculateTransport(moduleCount);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            quote,
            transport,
            summary: `견적 완료: ${args.customerName} - ${args.ledSize} LED, 총 ${quote.total.toLocaleString()}원 (VAT 포함)`
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `견적 계산 실패: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
};

// 다중 LED 견적 계산 도구 (새로 추가)
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
        const validation = validateLEDSize(specs.size);
        if (!validation.valid) {
          throw new Error(`LED 크기 오류: ${validation.error}`);
        }
      }

      // 다중 LED 견적 계산
      const quote = calculateMultiLEDQuote(ledSpecs);

      // 배차 정보 계산
      const transport = calculateTransport(quote.ledModules.count);

      // LED 개소별 요약 정보 (타입 안전)
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

// LED 해상도 계산 함수
export function calculateLEDResolution(ledSize: string): string {
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
export function calculateLEDPowerConsumption(ledSize: string): string {
  if (!ledSize) return '';
  
  const [width, height] = ledSize.split('x').map(Number);
  const moduleCount = (width / 500) * (height / 500);
  
  // LED 모듈 1장당 380V 0.2kW
  const totalPower = moduleCount * 0.2;
  
  return `380V ${totalPower}kW`;
}

// 전기설치 방식 계산 함수
export function calculateElectricalInstallation(ledSize: string): string {
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

// LED 사양 인터페이스 확장
export interface EnhancedLEDSpec {
  size: string;
  stageHeight?: number;
  needOperator: boolean;
  operatorDays: number;
  
  // 새로 추가된 속성들
  resolution?: string;
  powerConsumption?: string;
  electricalInstallation?: string;
  prompterConnection?: boolean;
  relayConnection?: boolean;
}

// 확장된 LED 사양 계산 함수
export function calculateEnhancedLEDSpecs(ledSpecs: any[]): EnhancedLEDSpec[] {
  return ledSpecs.map(spec => ({
    ...spec,
    resolution: calculateLEDResolution(spec.size),
    powerConsumption: calculateLEDPowerConsumption(spec.size),
    electricalInstallation: calculateElectricalInstallation(spec.size),
    prompterConnection: spec.prompterConnection || false,
    relayConnection: spec.relayConnection || false
  }));
}