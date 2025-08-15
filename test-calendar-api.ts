// test-calendar-api.ts
import { config } from 'dotenv';
import { lineWorksCalendar } from './src/tools/services/lineworks-calendar-service.js';

config();

async function testCalendar() {
  console.log('LINE WORKS 캘린더 API 테스트\n');
  
  // 테스트할 사용자 ID - 실제 LINE WORKS 사용자 ID로 변경
  const testUserId = process.env.LINEWORKS_USER_YU || 'test-user';
  console.log('테스트 사용자 ID:', testUserId);
  
  // 테스트 케이스들
  const testCases = [
    '내일 오후 2시 테스트 미팅',
    '오늘 저녁 6시 팀 회식'
  ];
  
  for (const testCase of testCases) {
    console.log(`\n테스트: "${testCase}"`);
    const result = await lineWorksCalendar.createEventFromNaturalLanguage(testUserId, testCase);
    console.log('결과:', result);
  }
}

testCalendar().catch(console.error);