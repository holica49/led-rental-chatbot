// src/test-lineworks-notification.ts
import { config } from 'dotenv';
import { lineWorksNotification, LineWorksNotificationService } from './tools/services/lineworks-notification-service.js';

config();

async function testNotification() {
  console.log('LINE WORKS 알림 테스트 시작...\n');

  // 1. 사용자 매핑 확인
  console.log('1. 사용자 매핑 확인:');
  LineWorksNotificationService.validateUserMapping();
  console.log('\n');

  // 2. 테스트 알림 발송
  console.log('2. 테스트 알림 발송:');
  
  try {
    // 설치 서비스 테스트
    await lineWorksNotification.sendNewRequestNotification({
      serviceType: '설치',
      eventName: 'TEST - 강남역 LED 설치',
      customerName: '테스트 고객사',
      contactName: '김테스트',
      venue: '서울 강남구 강남역',
      notionPageId: 'test-page-id-123',
      totalAmount: 50000000
    });
    console.log('✅ 설치 서비스 알림 발송 완료');

    // 잠시 대기
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 렌탈 서비스 테스트
    await lineWorksNotification.sendNewRequestNotification({
      serviceType: '렌탈',
      eventName: 'TEST - 코엑스 전시회',
      customerName: '테스트 전시사',
      contactName: '박테스트',
      venue: '서울 삼성동 코엑스',
      eventPeriod: '2025-08-20 ~ 2025-08-22',
      notionPageId: 'test-page-id-456',
      totalAmount: 15000000
    });
    console.log('✅ 렌탈 서비스 알림 발송 완료');

    // 상태 변경 알림 테스트
    await lineWorksNotification.sendStatusChangeNotification(
      'test-page-id-789',
      '견적 요청',
      '견적 검토',
      'TEST - 상태 변경 테스트'
    );
    console.log('✅ 상태 변경 알림 발송 완료');

  } catch (error) {
    console.error('❌ 테스트 실패:', error);
  }
}

// 테스트 실행
testNotification().then(() => {
  console.log('\n테스트 완료!');
  process.exit(0);
}).catch(error => {
  console.error('테스트 중 오류 발생:', error);
  process.exit(1);
});
