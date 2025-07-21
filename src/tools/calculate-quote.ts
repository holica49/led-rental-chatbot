import { TransportInfo } from '../types/index.js';

// 가격 상수
const PRICES = {
  // 기본 가격
  LED_MODULE: 34000,          // LED 모듈 단가 (멤버쉽용 - 500개 이상 시)
  LED_MODULE_RENTAL: 50000,   // 렌탈 LED 모듈 단가
  
  // 구조물 가격
  STRUCTURE_UNDER_4M: 20000,  // 4m 미만 구조물 (원/㎡)
  STRUCTURE_OVER_4M: 25000,   // 4m 이상 구조물 (원/㎡)
  
  // 장비 가격
  CONTROLLER_UNDER_200: 200000, // 200인치 미만 컨트롤러
  CONTROLLER_OVER_200: 500000,  // 200인치 이상 컨트롤러
  POWER_OVER_250: 500000,       // 250인치 이상 파워
  
  // 인건비
  INSTALLATION_PER_WORKER: 160000, // 설치 인력 단가
  OPERATOR_PER_DAY: 280000,     // 오퍼레이터 일당
  
  // 세금
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

// 견적 결과 타입
export interface QuoteResult {
  ledModules: {
    count: number;
    unitPrice?: number;
    price: number;
  };
  structure: {
    area?: number;
    unitPrice?: number;
    unitPriceDescription?: string;
    totalPrice: number;
  };
  controller: {
    totalPrice: number;
    count?: number;
  };
  power: {
    totalPrice: number;
    requiredCount?: number;
  };
  installation: {
    workers?: number;
    workerRange?: string;
    pricePerWorker?: number;
    totalPrice: number;
  };
  operation: {
    totalPrice: number;
    days?: number;
    pricePerDay?: number;
  };
  transport: {
    price: number;
    range: string;
  };
  periodSurcharge?: {
    days: number;
    rate: number;
    description: string;
    baseAmount: number;
    surchargeAmount: number;
  };
  
  // 추가 정보
  totalModuleCount: number;
  maxStageHeight?: number;
  installationWorkers?: number;
  installationWorkerRange?: string;
  controllerCount?: number;
  powerRequiredCount?: number;
  transportRange?: string;
  structureUnitPrice?: number;
  structureUnitPriceDescription?: string;
  rentalPeriod?: number;
  ledDetails?: any[];
  
  // 합계
  subtotal: number;
  vat: number;
  total: number;
}

// ===== 공통 유틸리티 함수 =====

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
  const maxHeight = Math.max(...stageHeights.filter(h => h > 0), 0);
  
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

// 배차 정보 계산
export function calculateTransport(moduleCount: number): TransportInfo {
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

// ===== 멤버쉽 서비스 관련 함수 =====

// 운반비 구간 구분 (멤버쉽)
function getTransportRange(totalModules: number): string {
  if (totalModules <= 200) return "200개 이하";
  if (totalModules <= 400) return "201-400개";
  return "400개 초과";
}

// 운반비 계산 (멤버쉽)
function calculateTransportCost(totalModules: number): number {
  if (totalModules <= 200) return 200000;
  if (totalModules <= 400) return 400000;
  return 700000;
}

// ===== 렌탈 서비스 관련 함수 =====

// 렌탈 운반비 구간 구분
function getRentalTransportRange(totalModules: number): string {
  if (totalModules <= 60) return "60개 이하";
  if (totalModules <= 100) return "61-100개";
  return "101개 이상";
}

// 렌탈 운반비 계산
function calculateRentalTransportCost(totalModules: number): number {
  if (totalModules <= 60) return 300000;
  if (totalModules <= 100) return 400000;
  return 500000;
}

// 렌탈 기간 할증률 계산
function calculateRentalSurchargeRate(days: number): { rate: number; description: string } {
  if (days <= 5) {
    return { rate: 0, description: "5일 이하 (할증 없음)" };
  } else if (days < 15) {
    return { rate: 0.2, description: "5일 초과~15일 미만 (20%)" };
  } else if (days < 30) {
    return { rate: 0.3, description: "15일 이상~30일 미만 (30%)" };
  } else {
    return { rate: 0.3, description: "30일 이상 (30%)" };
  }
}

// ===== 멤버쉽 견적 계산 함수 =====
export function calculateMultiLEDQuote(ledSpecs: LEDSpecInput[]): QuoteResult {
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

  const quote: QuoteResult = {
    ledModules: {
      count: totalModules,
      unitPrice: PRICES.LED_MODULE,
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
    
    // 추가 정보
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

// ===== 렌탈 견적 계산 함수 =====
export function calculateRentalLEDQuote(ledSpecs: LEDSpecInput[], rentalDays: number): QuoteResult {
  let totalModules = 0;
  const ledDetails: any[] = [];

  // 각 LED 개소별 계산
  ledSpecs.forEach((specs, index) => {
    if (!specs.size) return;

    const [width, height] = specs.size.split('x').map(Number);
    
    // LED 모듈 수량
    const moduleCount = (width / 500) * (height / 500);
    totalModules += moduleCount;
    
    ledDetails.push({
      index: index + 1,
      size: specs.size,
      moduleCount: moduleCount,
      stageHeight: specs.stageHeight || 0,
      needOperator: specs.needOperator,
      operatorDays: specs.operatorDays,
      prompterConnection: specs.prompterConnection || false,
      relayConnection: specs.relayConnection || false
    });
  });

  // 기본 비용 계산
  const moduleCost = totalModules * PRICES.LED_MODULE_RENTAL;
  const transportCost = calculateRentalTransportCost(totalModules);
  
  // 기간 할증 계산
  const surchargeInfo = calculateRentalSurchargeRate(rentalDays);
  const surchargeCost = Math.round((moduleCost + transportCost) * surchargeInfo.rate);

  const quote: QuoteResult = {
    ledModules: {
      count: totalModules,
      unitPrice: PRICES.LED_MODULE_RENTAL,
      price: moduleCost
    },
    transport: {
      price: transportCost,
      range: getRentalTransportRange(totalModules)
    },
    periodSurcharge: {
      days: rentalDays,
      rate: surchargeInfo.rate,
      description: surchargeInfo.description,
      baseAmount: moduleCost + transportCost,
      surchargeAmount: surchargeCost
    },
    
    // 렌탈에서 제외되는 항목들 (0원 처리)
    structure: {
      totalPrice: 0
    },
    controller: {
      totalPrice: 0
    },
    power: {
      totalPrice: 0
    },
    installation: {
      totalPrice: 0
    },
    operation: {
      totalPrice: 0
    },
    
    // LED 상세 정보
    ledDetails: ledDetails,
    
    // 추가 정보
    totalModuleCount: totalModules,
    rentalPeriod: rentalDays,
    transportRange: getRentalTransportRange(totalModules),
    
    subtotal: 0,
    vat: 0,
    total: 0
  };

  // 소계 계산 (모듈비 + 운송비 + 기간할증)
  quote.subtotal = quote.ledModules.price + quote.transport.price + (quote.periodSurcharge?.surchargeAmount || 0);
  
  quote.vat = Math.round(quote.subtotal * PRICES.VAT_RATE);
  quote.total = quote.subtotal + quote.vat;

  return quote;
}

// ===== MCP 도구 정의 =====

// 멤버쉽 견적 계산 도구
export const calculateMultiQuoteTool = {
  definition: {
    name: 'calculate_multi_quote',
    description: '멤버쉽 서비스의 다중 LED 견적을 자동으로 계산합니다',
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
              operatorDays: { type: 'number', description: '오퍼레이터 일수' },
              prompterConnection: { type: 'boolean', description: '프롬프터 연결 여부' },
              relayConnection: { type: 'boolean', description: '중계카메라 연결 여부' }
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

      // 멤버쉽 견적 계산
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
            summary: `멤버쉽 견적 완료: ${customerName} - ${ledSpecs.length}개소 LED, 총 ${quote.total.toLocaleString()}원 (VAT 포함)`
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `멤버쉽 견적 계산 실패: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
};

// 렌탈 견적 계산 도구
export const calculateRentalQuoteTool = {
  definition: {
    name: 'calculate_rental_quote',
    description: '렌탈 서비스의 LED 견적을 자동으로 계산합니다',
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
              operatorDays: { type: 'number', description: '오퍼레이터 일수' },
              prompterConnection: { type: 'boolean', description: '프롬프터 연결 여부' },
              relayConnection: { type: 'boolean', description: '중계카메라 연결 여부' }
            },
            required: ['size', 'needOperator', 'operatorDays']
          }
        },
        rentalDays: {
          type: 'number',
          description: '렌탈 기간 (일수)'
        },
        customerName: {
          type: 'string',
          description: '고객사명'
        }
      },
      required: ['ledSpecs', 'rentalDays', 'customerName']
    }
  },

  handler: async (args: any) => {
    try {
      const { ledSpecs, rentalDays, customerName } = args;

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

      // 렌탈 견적 계산
      const quote = calculateRentalLEDQuote(ledSpecs, rentalDays);

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
            summary: `렌탈 견적 완료: ${customerName} - ${ledSpecs.length}개소 LED, ${rentalDays}일간, 총 ${quote.total.toLocaleString()}원 (VAT 포함)`
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `렌탈 견적 계산 실패: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
};