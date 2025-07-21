// tools/notionUserFinder.js
// Notion 워크스페이스의 사용자 ID를 찾는 도구

import { Client } from '@notionhq/client';
import dotenv from 'dotenv';

dotenv.config();

class NotionUserFinder {
  constructor() {
    this.notion = new Client({ auth: process.env.NOTION_API_KEY });
    this.databaseId = process.env.NOTION_DATABASE_ID;
  }

  /**
   * 워크스페이스 사용자 목록 조회
   */
  async getWorkspaceUsers() {
    try {
      console.log('📋 워크스페이스 사용자 목록 조회 중...');
      
      const response = await this.notion.users.list({});
      
      console.log('\n👥 워크스페이스 사용자 목록:');
      console.log('─'.repeat(60));
      
      response.results.forEach((user, index) => {
        console.log(`${index + 1}. ${user.name || 'Unknown'}`);
        console.log(`   ID: ${user.id}`);
        console.log(`   Type: ${user.type}`);
        console.log(`   Email: ${user.person?.email || 'N/A'}`);
        console.log('─'.repeat(60));
      });
      
      return response.results;
      
    } catch (error) {
      console.error('❌ 사용자 목록 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 특정 사용자 정보 조회
   */
  async getUserInfo(userId) {
    try {
      const user = await this.notion.users.retrieve({ user_id: userId });
      
      console.log('\n👤 사용자 정보:');
      console.log(`이름: ${user.name || 'Unknown'}`);
      console.log(`ID: ${user.id}`);
      console.log(`타입: ${user.type}`);
      console.log(`이메일: ${user.person?.email || 'N/A'}`);
      
      return user;
      
    } catch (error) {
      console.error('❌ 사용자 정보 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 데이터베이스 페이지에서 사용자 속성 조회
   */
  async getDatabaseUsers() {
    try {
      console.log('📊 데이터베이스 사용자 속성 조회 중...');
      
      const database = await this.notion.databases.retrieve({
        database_id: this.databaseId
      });
      
      // 사용자 타입 속성 찾기
      const userProperties = Object.entries(database.properties)
        .filter(([key, prop]) => prop.type === 'people' || prop.type === 'created_by' || prop.type === 'last_edited_by');
      
      console.log('\n👥 데이터베이스 사용자 속성:');
      userProperties.forEach(([key, prop]) => {
        console.log(`- ${key}: ${prop.type}`);
      });
      
      return userProperties;
      
    } catch (error) {
      console.error('❌ 데이터베이스 사용자 속성 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 테스트 언급 실행
   */
  async testMention(pageId, userId) {
    try {
      console.log(`📝 테스트 언급 실행: 페이지 ${pageId}, 사용자 ${userId}`);
      
      const comment = await this.notion.comments.create({
        parent: { page_id: pageId },
        rich_text: [
          {
            type: 'text',
            text: { content: '🧪 테스트 언급: ' }
          },
          {
            type: 'mention',
            mention: {
              type: 'user',
              user: { id: userId }
            }
          },
          {
            type: 'text',
            text: { content: ' 확인 부탁드립니다!' }
          }
        ]
      });
      
      console.log('✅ 테스트 언급 성공');
      return comment;
      
    } catch (error) {
      console.error('❌ 테스트 언급 실패:', error);
      throw error;
    }
  }

  /**
   * 환경 변수 템플릿 생성
   */
  generateConfigTemplate(users) {
    const managersConfig = {
      managers: users.map((user, index) => ({
        name: user.name || `사용자${index + 1}`,
        notionId: user.id,
        department: "부서명",
        phone: "010-0000-0000",
        isActive: true
      }))
    };
    
    console.log('\n📋 MANAGERS_CONFIG 환경 변수 템플릿:');
    console.log('─'.repeat(60));
    console.log(JSON.stringify(managersConfig, null, 2));
    console.log('─'.repeat(60));
    
    return managersConfig;
  }
}

// 사용 예시
async function runUserFinder() {
  const finder = new NotionUserFinder();
  
  try {
    // 1. 워크스페이스 사용자 목록 조회
    const users = await finder.getWorkspaceUsers();
    
    // 2. 환경 변수 템플릿 생성
    finder.generateConfigTemplate(users);
    
    // 3. 데이터베이스 사용자 속성 조회
    await finder.getDatabaseUsers();
    
  } catch (error) {
    console.error('실행 중 오류 발생:', error);
  }
}

// 직접 실행 시
runUserFinder();

export default NotionUserFinder;