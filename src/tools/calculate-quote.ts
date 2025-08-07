import { LEDSpec, QuoteResult, RentalQuoteResult } from '../types/index.js';

// 기본 상수 정의
const CONSTANTS = {
  MODULE_SIZE: 500,
  MODULE_BASE_PRICE: 50000,
  POWER_PER_MODULE: 0.2, // kW
  OPERATOR_DAILY_RATE: 280000, // 수정: 500000 -> 280000
  INSTALLATION_WORKER_RATE: 160000, // 수정: 350000 -> 160000
  STRUCTURE_PRICE_UNDER_4M: 20000, // 수정: 평방미터당 가격
  STRUCTURE_PRICE_OVER_4M: 25000, // 수정: 평방미터당 가격
  CONTROLLER_PRICE_UNDER_200: 200000, // 수정: 200인치 미만
  CONTROLLER_PRICE_OVER_200: 500000, // 수정: 200인치 이상
  POWER_PRICE: 500000, // 수정: 250인치 이상만
  TRANSPORT_BASE: 200000, // 수정: 200개 이하 고정
  VAT_RATE: 0.1,
  // 멤버쉽 할인 관련 상수
  MEMBERSHIP_FREE_MODULES: 500,
  MEMBERSHIP_MODULE_PRICE: 34000
};

// LED 인치 계산
export function calculateInch(size: string): number {
  const [width, height] = size.split('x').map(Number);
  const diagonalMm = Math.sqrt(width * width + height * height);
  return diagonalMm / 25.4;
}

// LED 정보 계산 (대각선 인치, 해상도, 소비전력, 전기설치 방식)
export function calculateLEDInfo(size: string): {
  diagonalInch: string;
  resolution: string;
  powerConsumption: string;
  electricalMethod: string;
} {
  const [width, height] = size.split('x').map(Number);
  
  // 대각선 인치 계산
  const diagonalInch = calculateInch(size);
  
  // 해상도 계산 (모듈당 168x168 픽셀 기준)
  const widthModules = width / CONSTANTS.MODULE_SIZE;
  const heightModules = height / CONSTANTS.MODULE_SIZE;
  const widthPixels = widthModules * 168;
  const heightPixels = heightModules * 168;
  
  // 소비전력 계산
  const moduleCount = widthModules * heightModules;
  const powerKw = moduleCount * CONSTANTS.POWER_PER_MODULE;
  
  // 전기설치 방식 결정
  let electricalMethod = '단상 220V';
  if (powerKw > 10) {
    electricalMethod = '삼상 380V';
  }
  
  return {
    diagonalInch: `${Math.round(diagonalInch)}인치`,
    resolution: `${widthPixels}x${heightPixels}`,
    powerConsumption: `${powerKw.toFixed(1)}kW`,
    electricalMethod
  };
}

// LED 모듈 계산 (멤버쉽 할인 적용)
export function calculateModules(ledSpecs: LEDSpec[], isMembership: boolean = false): { count: number; price: number } {
  const totalModules = ledSpecs.reduce((sum, led) => {
    const [width, height] = led.size.split('x').map(Number);
    return sum + (width / CONSTANTS.MODULE_SIZE) * (height / CONSTANTS.MODULE_SIZE);
  }, 0);

  let price = 0;
  
  if (isMembership) {
    // 멤버쉽: 500개까지 무료, 501개부터 개당 34,000원
    if (totalModules > CONSTANTS.MEMBERSHIP_FREE_MODULES) {
      const chargeableModules = totalModules - CONSTANTS.MEMBERSHIP_FREE_MODULES;
      price = chargeableModules * CONSTANTS.MEMBERSHIP_MODULE_PRICE;
    }
  } else {
    // 일반: 개당 50,000원
    price = totalModules * CONSTANTS.MODULE_BASE_PRICE;
  }

  return {
    count: totalModules,
    price
  };
}

// 구조물 비용 계산 (수정됨 - 평방미터 기준)
export function calculateStructure(ledSpecs: LEDSpec[]): { 
  unitPrice: number; 
  totalPrice: number; 
  description: string;
  area: number;
} {
  let totalPrice = 0;
  let totalArea = 0;
  
  ledSpecs.forEach(led => {
    const [width, height] = led.size.split('x').map(Number);
    const area = (width * height) / 1000000; // 평방미터로 변환
    totalArea += area;
    
    // 높이에 따른 단가 적용
    const unitPrice = height < 4000 ? CONSTANTS.STRUCTURE_PRICE_UNDER_4M : CONSTANTS.STRUCTURE_PRICE_OVER_4M;
    totalPrice += area * unitPrice;
  });
  
  // 평균 단가 계산 (표시용)
  const avgUnitPrice = Math.round(totalPrice / totalArea);
  
  return {
    unitPrice: avgUnitPrice,
    totalPrice: Math.round(totalPrice),
    description: '시스템 비계',
    area: totalArea
  };
}

// 프로세서 개수 계산 (수정됨 - 인치 기준)
export function calculateControllers(ledSpecs: LEDSpec[]): { count: number; totalPrice: number } {
  let totalPrice = 0;
  let count = 0;
  
  ledSpecs.forEach(led => {
    const inch = calculateInch(led.size);
    if (inch < 200) {
      totalPrice += CONSTANTS.CONTROLLER_PRICE_UNDER_200;
    } else {
      totalPrice += CONSTANTS.CONTROLLER_PRICE_OVER_200;
    }
    count++;
  });
  
  return {
    count,
    totalPrice
  };
}

// 전원 개수 계산 (수정됨 - 250인치 기준)
export function calculatePower(ledSpecs: LEDSpec[]): { 
  requiredCount: number; 
  totalPrice: number; 
  totalPower: number;
} {
  let totalPrice = 0;
  let requiredCount = 0;
  let totalPower = 0;
  
  ledSpecs.forEach(led => {
    const inch = calculateInch(led.size);
    const [width, height] = led.size.split('x').map(Number);
    const moduleCount = (width / CONSTANTS.MODULE_SIZE) * (height / CONSTANTS.MODULE_SIZE);
    totalPower += moduleCount * CONSTANTS.POWER_PER_MODULE;
    
    if (inch >= 250) {
      totalPrice += CONSTANTS.POWER_PRICE;
      requiredCount++;
    }
  });
  
  return {
    requiredCount,
    totalPrice,
    totalPower
  };
}

// 설치 인력 계산 (수정됨 - 새로운 기준)
export function calculateInstallation(moduleCount: number): {
  workers: number;
  workerRange: string;
  totalPrice: number;
} {
  let workers: number;
  
  if (moduleCount <= 60) {
    workers = 3;
  } else if (moduleCount <= 100) {
    workers = 5;
  } else if (moduleCount <= 150) {
    workers = 7;
  } else if (moduleCount <= 250) {
    workers = 9;
  } else if (moduleCount <= 300) {
    workers = 12;
  } else {
    workers = 15;
  }
  
  const workerRange = `${workers}명`;
  
  return {
    workers,
    workerRange,
    totalPrice: workers * CONSTANTS.INSTALLATION_WORKER_RATE
  };
}

// 운송비 계산 (수정됨 - 200개 기준)
export function calculateTransport(moduleCount: number): {
  price: number;
  range: string;
  trucks: number;
} {
  const price = CONSTANTS.TRANSPORT_BASE; // 200개 이하 고정, 초과시 별도 협의
  const range = moduleCount <= 200 ? '기본' : '별도 협의';
  const trucks = 1; // 기본 1대
  
  return { price, range, trucks };
}

// 렌탈 기간 할증 계산
export function calculatePeriodSurcharge(basePrice: number, days: number): {
  rate: number;
  surchargeAmount: number;
} {
  let rate = 1.0;
  
  if (days >= 4 && days <= 6) {
    rate = 1.1;
  } else if (days >= 7 && days <= 9) {
    rate = 1.2;
  } else if (days >= 10) {
    rate = 1.3;
  }
  
  return {
    rate,
    surchargeAmount: Math.round(basePrice * (rate - 1))
  };
}

// 멀티 LED 견적 계산 (멤버쉽용 - 수정됨)
export function calculateMultiLEDQuote(ledSpecs: LEDSpec[], isMembership: boolean = false): QuoteResult {
  const modules = calculateModules(ledSpecs, isMembership);
  const maxHeight = Math.max(...ledSpecs.map(led => led.stageHeight || 0));
  const structure = calculateStructure(ledSpecs);
  const controller = calculateControllers(ledSpecs);
  const power = calculatePower(ledSpecs);
  const installation = calculateInstallation(modules.count);
  
  // 오퍼레이터 비용 계산 (실제 필요한 경우만)
  let totalOperatorDays = 0;
  ledSpecs.forEach(led => {
    if (led.needOperator && led.operatorDays > 0) {
      totalOperatorDays += led.operatorDays;
    }
  });
  
  const operation = {
    days: totalOperatorDays,
    totalPrice: totalOperatorDays * CONSTANTS.OPERATOR_DAILY_RATE
  };
  
  const transport = calculateTransport(modules.count);
  
  const subtotal = modules.price + structure.totalPrice + controller.totalPrice + 
                  power.totalPrice + installation.totalPrice + operation.totalPrice + 
                  transport.price;
  
  const vat = Math.round(subtotal * CONSTANTS.VAT_RATE);
  const total = subtotal + vat;
  
  return {
    totalModuleCount: modules.count,
    ledModules: modules,
    structure,
    controller,
    power,
    installation,
    operation,
    transport,
    subtotal,
    vat,
    total,
    maxStageHeight: maxHeight,
    installationWorkers: installation.workers,
    installationWorkerRange: installation.workerRange,
    controllerCount: controller.count,
    powerRequiredCount: power.requiredCount,
    transportRange: transport.range,
    structureUnitPrice: structure.unitPrice,
    structureUnitPriceDescription: structure.description
  };
}

// 렌탈 LED 견적 계산
export function calculateRentalLEDQuote(ledSpecs: LEDSpec[], rentalDays: number): RentalQuoteResult {
  const baseQuote = calculateMultiLEDQuote(ledSpecs, false);
  
  // 렌탈 기간별 할증 적용
  const periodSurcharge = calculatePeriodSurcharge(baseQuote.subtotal, rentalDays);
  
  // 렌탈은 운영 인력이 렌탈 기간만큼 필요
  let totalOperatorDays = 0;
  ledSpecs.forEach(led => {
    if (led.needOperator && led.operatorDays > 0) {
      totalOperatorDays += led.operatorDays;
    }
  });
  
  const operation = {
    days: totalOperatorDays * rentalDays,
    totalPrice: totalOperatorDays * rentalDays * CONSTANTS.OPERATOR_DAILY_RATE
  };
  
  const subtotal = baseQuote.ledModules.price + baseQuote.structure.totalPrice + 
                  baseQuote.controller.totalPrice + baseQuote.power.totalPrice + 
                  baseQuote.installation.totalPrice + operation.totalPrice + 
                  baseQuote.transport.price + periodSurcharge.surchargeAmount;
  
  const vat = Math.round(subtotal * CONSTANTS.VAT_RATE);
  const total = subtotal + vat;
  
  return {
    ...baseQuote,
    operation,
    periodSurcharge,
    subtotal,
    vat,
    total,
    rentalDays
  };
}

// 단일 LED 정보 계산 (유틸리티 함수)
export function calculateSingleLEDInfo(size: string): {
  moduleCount: number;
  power: string;
  weight: string;
} {
  const [width, height] = size.split('x').map(Number);
  const moduleCount = (width / CONSTANTS.MODULE_SIZE) * (height / CONSTANTS.MODULE_SIZE);
  const power = moduleCount * CONSTANTS.POWER_PER_MODULE;
  const weight = moduleCount * 15; // 15kg per module
  
  return {
    moduleCount,
    power: `${power.toFixed(1)}kW`,
    weight: `${weight}kg`
  };
}