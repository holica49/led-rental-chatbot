// src/test-lineworks-auth.ts
import { config } from 'dotenv';
import { LineWorksAuth } from './config/lineworks-auth.js';
import { testV1Auth } from './config/lineworks-auth-v1.js';

config();

async function testAuth() {
  console.log('=== LINE WORKS Bot 정보 ===');
  console.log('Bot ID:', process.env.LINEWORKS_BOT_ID);
  console.log('Domain ID:', process.env.LINEWORKS_DOMAIN_ID);
  console.log('Bot Secret 길이:', process.env.LINEWORKS_BOT_SECRET?.length);
  console.log('Bot Secret 앞 5자:', process.env.LINEWORKS_BOT_SECRET?.substring(0, 5) + '...');
  
  // API v1.0 테스트
  await testV1Auth();
  
  // API v2.0 테스트
  console.log('\n=== LINE WORKS API v2.0 테스트 ===');
  try {
    const auth = new LineWorksAuth();
    const accessToken = await auth.getAccessToken();
    
    console.log('✅ Access Token 발급 성공!');
    console.log('Token:', accessToken.substring(0, 20) + '...');
    
    // Bot 정보 조회 테스트
    try {
      const botInfo = await auth.getBotInfo();
      console.log('✅ Bot 정보 조회 성공!');
      console.log('Bot Name:', botInfo.name);
      console.log('Bot Status:', botInfo.status);
    } catch (error) {
      console.log('⚠️ Bot 정보 조회 실패 (권한 문제일 수 있음)');
    }
    
  } catch (error) {
    console.error('❌ API v2.0 인증 테스트 실패:', error);
  }
}

// LINE WORKS Developers Console에서 확인할 사항
console.log('\n📋 LINE WORKS Developers Console에서 확인해주세요:');
console.log('1. Bot의 상태가 "활성"인지');
console.log('2. API Version이 1.0인지 2.0인지');
console.log('3. Private Key 파일이 제공되었는지');
console.log('4. Service API ID가 있는지');
console.log('5. Consumer Key가 있는지\n');

testAuth();