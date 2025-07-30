import { LEDSpec, QuoteResult, RentalQuoteResult } from '../types/index.js';

// 기본 상수 정의
const CONSTANTS = {
  MODULE_SIZE: 500,
  MODULE_BASE_PRICE: 50000,
  POWER_PER_MODULE: 0.2, // kW
  OPERATOR_DAILY_RATE: 500000,
  INSTALLATION_WORKER_RATE: 350000,
  STRUCTURE_UNIT_PRICE: 30000,
  CONTROLLER_UNIT_PRICE: 1500000,
  POWER_UNIT_PRICE: 300000,
  TRANSPORT_BASE: 300000,
  TRANSPORT_PER_TRUCK: 200000,
  VAT_RATE: 0.1,
  // 멤버쉽 할인 관련 상수 추가
  MEMBERSHIP_FREE_MODULES: 500,
  MEMBERSHIP_MODULE_PRICE: 34000
};

// LED 정보 계산 (대각선 인치, 해상도, 소비전력, 전기설치 방식)
export function calculateLEDInfo(size: string): {
  diagonalInch: string;
  resolution: string;
  powerConsumption: string;
  electricalMethod: string;
} {
  const [width, height] = size.split('x').map(Number);
  
  // 대각선 인치 계산 (피타고라스 정리)
  const diagonalMm = Math.sqrt(width * width + height * height);
  const diagonalInch = Math.round(diagonalMm / 25.4);
  
  // 해상도 계산 (모듈당 128x128 픽셀 기준)
  const widthModules = width / CONSTANTS.MODULE_SIZE;
  const heightModules = height / CONSTANTS.MODULE_SIZE;
  const widthPixels = widthModules * 128;
  const heightPixels = heightModules * 128;
  
  // 소비전력 계산
  const moduleCount = widthModules * heightModules;
  const powerKw = moduleCount * CONSTANTS.POWER_PER_MODULE;
  
  // 전기설치 방식 결정
  let electricalMethod = '단상 220V';
  if (powerKw > 10) {
    electricalMethod = '삼상 380V';
  }
  
  return {
    diagonalInch: `${diagonalInch}인치`,
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

// 구조물 비용 계산
export function calculateStructure(ledSpecs: LEDSpec[], maxHeight: number): { 
  unitPrice: number; 
  totalPrice: number; 
  description: string;
} {
  const totalModules = calculateModules(ledSpecs).count;
  
  let unitPrice = CONSTANTS.STRUCTURE_UNIT_PRICE;
  let description = '기본형';
  
  if (maxHeight > 5000) {
    unitPrice = 50000;
    description = '대형 (5m 이상)';
  } else if (maxHeight > 3000) {
    unitPrice = 40000;
    description = '중형 (3-5m)';
  }
  
  return {
    unitPrice,
    totalPrice: totalModules * unitPrice,
    description
  };
}

// 프로세서 개수 계산
export function calculateControllers(moduleCount: number): { count: number; totalPrice: number } {
  const count = Math.ceil(moduleCount / 200);
  return {
    count,
    totalPrice: count * CONSTANTS.CONTROLLER_UNIT_PRICE
  };
}

// 전원 개수 계산
export function calculatePower(moduleCount: number): { 
  requiredCount: number; 
  totalPrice: number; 
  totalPower: number;
} {
  const totalPower = moduleCount * CONSTANTS.POWER_PER_MODULE;
  const requiredCount = Math.ceil(totalPower / 30); // 30kW per unit
  
  return {
    requiredCount,
    totalPrice: requiredCount * CONSTANTS.POWER_UNIT_PRICE,
    totalPower
  };
}

// 설치 인력 계산
export function calculateInstallation(moduleCount: number): {
  workers: number;
  workerRange: string;
  totalPrice: number;
} {
  let workers: number;
  let workerRange: string;
  
  if (moduleCount <= 50) {
    workers = 2;
    workerRange = '2명';
  } else if (moduleCount <= 100) {
    workers = 3;
    workerRange = '2-3명';
  } else if (moduleCount <= 200) {
    workers = 4;
    workerRange = '3-4명';
  } else {
    workers = Math.ceil(moduleCount / 50);
    workerRange = `${workers-1}-${workers}명`;
  }
  
  return {
    workers,
    workerRange,
    totalPrice: workers * CONSTANTS.INSTALLATION_WORKER_RATE
  };
}

// 운송비 계산
export function calculateTransport(moduleCount: number): {
  price: number;
  range: string;
  trucks: number;
} {
  const trucks = Math.ceil(moduleCount / 100);
  const price = CONSTANTS.TRANSPORT_BASE + (trucks - 1) * CONSTANTS.TRANSPORT_PER_TRUCK;
  
  let range: string;
  if (trucks === 1) {
    range = '1톤';
  } else if (trucks <= 2) {
    range = '1-2.5톤';
  } else {
    range = `${trucks-1}-${trucks}톤`;
  }
  
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
  const structure = calculateStructure(ledSpecs, maxHeight);
  const controller = calculateControllers(modules.count);
  const power = calculatePower(modules.count);
  const installation = calculateInstallation(modules.count);
  
  // 오퍼레이터 비용 계산 (LED별 오퍼레이터 일수 합산)
  const totalOperatorDays = ledSpecs.reduce((sum, led) => {
    return sum + (led.needOperator ? led.operatorDays : 0);
  }, 0);
  
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
  
  // 운영 인력은 렌탈 기간만큼
  const totalOperatorDays = ledSpecs.reduce((sum, led) => {
    return sum + (led.needOperator ? led.operatorDays : 0);
  }, 0);
  
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