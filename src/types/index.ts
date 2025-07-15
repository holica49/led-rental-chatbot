// LED 렌탈 관련 타입 정의
export interface LEDQuoteRequest {
    ledSize: string;          // "4000x2500" 형식
    is3D: boolean;
    needOperator: boolean;
    eventStartDate: string;
    eventEndDate: string;
    eventLocation: string;
    customerName: string;
    stageHeight?: number;
  }
  
  export interface LEDQuoteResponse {
    ledModules: {
      count: number;
      price: number;
    };
    structure: {
      area: number;          // ㎡
      unitPrice: number;     // 20,000 or 25,000
      totalPrice: number;
    };
    controller: {
      inches: number;
      price: number;
    };
    power: {
      price: number;
    };
    installation: {
      workers: number;
      pricePerWorker: number;
      totalPrice: number;
    };
    operation: {
      days: number;
      pricePerDay: number;
      totalPrice: number;
    };
    transport: {
      price: number;
    };
    subtotal: number;
    vat: number;
    total: number;
  }
  
  export interface TransportInfo {
    truckType: '1.5톤' | '3.5톤';
    truckCount: number;
    plateBoxCount: number;
  }