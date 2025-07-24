// tests/unit/session/session-manager.test.ts
import { SessionManager } from '../../../src/tools/session/session-manager.js';
import { ServiceType } from '../../../src/types/index.js';

describe('SessionManager', () => {
  let sessionManager: SessionManager;

  beforeEach(() => {
    // 각 테스트마다 새로운 인스턴스 생성
    sessionManager = new SessionManager({
      maxSessionAge: 1000, // 1초 (테스트용)
      cleanupInterval: 500 // 0.5초 (테스트용)
    });
  });

  afterEach(() => {
    // 정리
    sessionManager.stopCleanup();
  });

  describe('세션 생성 및 관리', () => {
    it('새 세션을 생성해야 함', () => {
      const session = sessionManager.getSession('user1');
      
      expect(session).toBeDefined();
      expect(session.step).toBe('start');
      expect(session.data.ledSpecs).toEqual([]);
      expect(session.ledCount).toBe(0);
      expect(session.currentLED).toBe(1);
    });

    it('기존 세션을 반환해야 함', () => {
      const session1 = sessionManager.getSession('user1');
      session1.step = 'test';
      
      const session2 = sessionManager.getSession('user1');
      expect(session2.step).toBe('test');
      expect(session1).toBe(session2);
    });

    it('세션을 초기화해야 함', () => {
      const session = sessionManager.getSession('user1');
      session.step = 'test';
      session.data.eventName = 'Test Event';
      
      sessionManager.resetSession('user1');
      
      const resetSession = sessionManager.getSession('user1');
      expect(resetSession.step).toBe('start');
      expect(resetSession.data.eventName).toBeUndefined();
    });
  });

  describe('세션 업데이트', () => {
    it('세션 데이터를 업데이트해야 함', () => {
      sessionManager.updateSessionData('user1', {
        eventName: 'LED 박람회',
        venue: '코엑스'
      });
      
      const session = sessionManager.getSession('user1');
      expect(session.data.eventName).toBe('LED 박람회');
      expect(session.data.venue).toBe('코엑스');
    });

    it('서비스 타입을 설정해야 함', () => {
      sessionManager.setServiceType('user1', '렌탈');
      
      const session = sessionManager.getSession('user1');
      expect(session.serviceType).toBe('렌탈');
    });

    it('단계를 변경해야 함', () => {
      sessionManager.setStep('user1', 'rental_led_count');
      
      const session = sessionManager.getSession('user1');
      expect(session.step).toBe('rental_led_count');
    });
  });

  describe('LED 관리', () => {
    it('LED를 추가해야 함', () => {
      sessionManager.addLED('user1', {
        size: '6000x3000',
        stageHeight: 600,
        needOperator: true,
        operatorDays: 2
      });
      
      const session = sessionManager.getSession('user1');
      expect(session.data.ledSpecs).toHaveLength(1);
      expect(session.data.ledSpecs[0].size).toBe('6000x3000');
    });

    it('현재 LED 정보를 가져와야 함', () => {
      const led = {
        size: '6000x3000',
        stageHeight: 600,
        needOperator: true,
        operatorDays: 2
      };
      
      sessionManager.addLED('user1', led);
      const currentLED = sessionManager.getCurrentLED('user1');
      
      expect(currentLED).toEqual(led);
    });

    it('다음 LED로 이동해야 함', () => {
      const session = sessionManager.getSession('user1');
      session.ledCount = 3;
      session.currentLED = 1;
      
      const moved = sessionManager.moveToNextLED('user1');
      expect(moved).toBe(true);
      expect(session.currentLED).toBe(2);
      
      sessionManager.moveToNextLED('user1');
      expect(session.currentLED).toBe(3);
      
      const notMoved = sessionManager.moveToNextLED('user1');
      expect(notMoved).toBe(false);
      expect(session.currentLED).toBe(3);
    });
  });

  describe('세션 정리', () => {
    it('오래된 세션을 정리해야 함', (done) => {
      sessionManager.getSession('user1');
      sessionManager.getSession('user2');
      
      // 1.5초 후 확인 (maxSessionAge가 1초이므로)
      setTimeout(() => {
        // 새로운 세션 요청으로 정리 트리거
        sessionManager.getSession('user3');
        
        const stats = sessionManager.getStats();
        expect(stats.totalSessions).toBe(1); // user3만 남아있어야 함
        done();
      }, 1500);
    });
  });

  describe('통계 및 디버그', () => {
    it('세션 통계를 반환해야 함', () => {
      sessionManager.getSession('user1');
      sessionManager.setServiceType('user1', '렌탈');
      sessionManager.getSession('user2');
      sessionManager.setServiceType('user2', '멤버쉽');
      
      const stats = sessionManager.getStats();
      expect(stats.totalSessions).toBe(2);
      expect(stats.sessions).toHaveLength(2);
      expect(stats.sessions[0].serviceType).toBe('렌탈');
      expect(stats.sessions[1].serviceType).toBe('멤버쉽');
    });
  });
});