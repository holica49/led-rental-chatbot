// findUsers.js - ES 모듈 버전
import dotenv from 'dotenv';
import { Client } from '@notionhq/client';

dotenv.config();

const notion = new Client({ auth: process.env.NOTION_API_KEY });

async function findNotionUsers() {
  try {
    console.log('🔍 Notion 워크스페이스 사용자 조회 중...\n');
    
    const response = await notion.users.list({});
    
    console.log('👥 워크스페이스 사용자 목록:');
    console.log('='.repeat(80));
    
    response.results.forEach((user, index) => {
      console.log(`${index + 1}. 이름: ${user.name || 'Unknown'}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   타입: ${user.type}`);
      console.log(`   이메일: ${user.person?.email || 'N/A'}`);
      console.log('-'.repeat(80));
    });
    
    // 환경 변수 템플릿 생성
    console.log('\n📋 MANAGERS_CONFIG 환경 변수 템플릿:');
    console.log('='.repeat(80));
    
    const managersConfig = {
      managers: response.results
        .filter(user => user.type === 'person') // 사람만 필터링
        .map((user, index) => ({
          name: user.name || `사용자${index + 1}`,
          notionId: user.id,
          department: "부서명을_입력하세요",
          phone: "010-0000-0000",
          isActive: true
        }))
    };
    
    console.log(JSON.stringify(managersConfig, null, 2));
    console.log('='.repeat(80));
    
    console.log('\n📝 다음 단계:');
    console.log('1. 위의 JSON을 복사하세요');
    console.log('2. 실제 이름, 부서명, 전화번호로 수정하세요');
    console.log('3. Railway 환경 변수 MANAGERS_CONFIG에 설정하세요');
    
  } catch (error) {
    console.error('❌ 사용자 조회 실패:', error);
    
    if (error.code === 'unauthorized') {
      console.log('\n💡 해결 방법:');
      console.log('- NOTION_API_KEY가 올바른지 확인하세요');
      console.log('- Integration이 워크스페이스에 추가되었는지 확인하세요');
    }
  }
}

// 실행
findNotionUsers();