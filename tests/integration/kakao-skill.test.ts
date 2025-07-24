import { 
  calculateMultiLEDQuote, 
  calculateRentalLEDQuote,
  calculateTransport 
} from '../../src/tools/calculate-quote';

describe('Calculate Quote - 견적 계산', () => {
  describe('calculateMultiLEDQuote - 멤버쉽 견적', () => {
    it('LED 1개 기본 견적 계산', () => {
      const ledSpecs = [{
        size: '6000x3000',
        stageHeight: 600,
        needOperator: true,
        operatorDays: 2,
        prompterConnection: false,
        relayConnection: false
      }];
      
      const result = calculateMultiLEDQuote(ledSpecs);
      
      // LED 모듈 수량 검증: (6000/500) * (3000/500) = 12 * 6 = 72
      expect(result.ledModules.count).toBe(72);
      expect(result.ledModules.unitPrice).toBe(34000);
      
      // 구조물 면적: 6m * 3m = 18㎡
      expect(result.structure.area).toBe(18);
      
      // 오퍼레이터: 2일
      expect(result.operation.days).toBe(2);
      expect(result.operation.pricePerDay).toBe(280000);
      expect(result.operation.totalPrice).toBe(560000);
      
      // 총액이 0보다 큼
      expect(result.total).toBeGreaterThan(0);
    });

    it('무대 높이 0mm 처리', () => {
      const ledSpecs = [{
        size: '4000x2500',
        stageHeight: 0, // 0mm 테스트
        needOperator: false,
        operatorDays: 0,
        prompterConnection: false,
        relayConnection: false
      }];
      
      const result = calculateMultiLEDQuote(ledSpecs);
      
      // 0mm도 정상 처리
      expect(result.structure.unitPrice).toBe(20000); // 4m 미만
      expect(result.maxStageHeight).toBe(0);
    });

    it('LED 5개 설치 시 설치 인력 계산', () => {
      const ledSpecs = Array(5).fill({
        size: '3000x2000',
        stageHeight: 800,
        needOperator: false,
        operatorDays: 0,
        prompterConnection: false,
        relayConnection: false
      });
      
      const result = calculateMultiLEDQuote(ledSpecs);
      
      // 총 모듈 수: 5개 * (6*4) = 120개
      expect(result.ledModules.count).toBe(120);
      
      // 설치 인력: 101-150개 구간 = 7명
      expect(result.installation.workers).toBe(7);
    });
  });

  describe('calculateRentalLEDQuote - 렌탈 견적', () => {
    it('3일 렌탈 기본 견적', () => {
      const ledSpecs = [{
        size: '4000x2500',
        stageHeight: 600,
        needOperator: true,
        operatorDays: 3,
        prompterConnection: true,
        relayConnection: false
      }];
      
      const result = calculateRentalLEDQuote(ledSpecs, 3);
      
      // LED 모듈: (4000/500) * (2500/500) = 8 * 5 = 40개
      expect(result.ledModules.count).toBe(40);
      expect(result.ledModules.unitPrice).toBe(50000);
      
      // 렌탈 기간
      expect(result.rentalPeriod).toBe(3);
      
      // 기간 할증: 5일 이하 = 0%
      expect(result.periodSurcharge?.rate).toBe(0);
      expect(result.periodSurcharge?.surchargeAmount).toBe(0);
    });

    it('10일 렌탈 시 20% 할증', () => {
      const ledSpecs = [{
        size: '3000x2000',
        stageHeight: 0,
        needOperator: false,
        operatorDays: 0,
        prompterConnection: false,
        relayConnection: false
      }];
      
      const result = calculateRentalLEDQuote(ledSpecs, 10);
      
      // 기간 할증: 5일 초과 15일 미만 = 20%
      expect(result.periodSurcharge?.rate).toBe(0.2);
      expect(result.periodSurcharge?.surchargeAmount).toBeGreaterThan(0);
    });
  });

  describe('calculateTransport - 배차 계산', () => {
    it('80개 이하는 1.5톤 1대', () => {
      const transport = calculateTransport(80);
      
      expect(transport.truckType).toBe('1.5톤');
      expect(transport.truckCount).toBe(1);
      expect(transport.plateBoxCount).toBe(10); // 80/8
    });

    it('200개는 3.5톤 1대', () => {
      const transport = calculateTransport(200);
      
      expect(transport.truckType).toBe('3.5톤');
      expect(transport.truckCount).toBe(1);
      expect(transport.plateBoxCount).toBe(25); // 200/8
    });
  });
});