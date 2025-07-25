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
  VAT_RATE: 0.1
};

// LED 모듈 계산
export function calculateModules(ledSpecs: LEDSpec[]): { count: number; price: number } {
  const totalModules = ledSpecs.reduce((sum, led) => {
    const [width, height] = led.size.split('x').map(Number);
    return sum + (width / CONSTANTS.MODULE_SIZE) * (height / CONSTANTS.MODULE_SIZE);
  }, 0);

  return {
    count: totalModules,
    price: totalModules * CONSTANTS.MODULE_BASE_PRICE
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

// 멀티 LED 견적 계산 (멤버쉽용)
export function calculateMultiLEDQuote(ledSpecs: LEDSpec[]): QuoteResult {
  const modules = calculateModules(ledSpecs);
  const maxHeight = Math.max(...ledSpecs.map(led => led.stageHeight || 0));
  const structure = calculateStructure(ledSpecs, maxHeight);
  const controller = calculateControllers(modules.count);
  const power = calculatePower(modules.count);
  const installation = calculateInstallation(modules.count);
  const operation = {
    days: 1,
    totalPrice: CONSTANTS.OPERATOR_DAILY_RATE
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
  const baseQuote = calculateMultiLEDQuote(ledSpecs);
  
  // 렌탈 기간별 할증 적용
  const periodSurcharge = calculatePeriodSurcharge(baseQuote.subtotal, rentalDays);
  
  // 운영 인력은 렌탈 기간만큼
  const operation = {
    days: rentalDays,
    totalPrice: CONSTANTS.OPERATOR_DAILY_RATE * rentalDays
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