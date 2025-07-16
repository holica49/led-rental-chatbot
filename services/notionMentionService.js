// services/notionMentionService.js
const { Client } = require('@notionhq/client');

class NotionMentionService {
  constructor() {
    this.notion = new Client({ auth: process.env.NOTION_API_KEY });
    this.databaseId = process.env.NOTION_DATABASE_ID;
    
    // 담당자 정보 (환경 변수에서 로드)
    this.managers = JSON.parse(process.env.MANAGERS_CONFIG || '{"managers":[]}').managers;
  }

  /**
   * 견적 요청 완료 시 Notion 페이지에 담당자 언급 댓글 추가
   */
  async addMentionComment(pageId, eventData) {
    try {
      console.log(`📝 Notion 페이지 ${pageId}에 담당자 언급 댓글 추가 시작`);
      
      // 활성화된 담당자만 필터링
      const activeManagers = this.managers.filter(manager => manager.isActive);
      
      if (activeManagers.length === 0) {
        console.warn('⚠️ 활성화된 담당자가 없습니다.');
        return false;
      }
      
      // 댓글 내용 구성
      const commentContent = this.buildCommentContent(activeManagers, eventData);
      
      // Notion 댓글 추가
      const comment = await this.notion.comments.create({
        parent: { page_id: pageId },
        rich_text: commentContent
      });
      
      console.log(`✅ Notion 언급 댓글 추가 완료 (${activeManagers.length}명 언급)`);
      return comment;
      
    } catch (error) {
      console.error('❌ Notion 언급 댓글 추가 실패:', error);
      throw error;
    }
  }

  /**
   * 댓글 내용 구성 (담당자 언급 포함)
   */
  buildCommentContent(managers, eventData) {
    const richTextContent = [];
    
    // 알림 제목
    richTextContent.push({
      type: 'text',
      text: { content: '🚨 새로운 견적 요청이 접수되었습니다!\n\n' },
      annotations: { bold: true, color: 'red' }
    });
    
    // 행사 정보
    const eventInfo = [
      { label: '📋 행사명', value: eventData.eventName },
      { label: '🏢 고객사', value: eventData.customerName },
      { label: '👤 담당자', value: `${eventData.contactName} (${eventData.contactTitle})` },
      { label: '📞 연락처', value: eventData.contactPhone },
      { label: '📅 행사기간', value: eventData.eventPeriod },
      { label: '🎪 행사장', value: eventData.venue },
      { label: '💰 견적금액', value: `${eventData.totalAmount?.toLocaleString() || '계산중'}원` }
    ];
    
    eventInfo.forEach(info => {
      richTextContent.push({
        type: 'text',
        text: { content: `${info.label}: ` },
        annotations: { bold: true }
      });
      richTextContent.push({
        type: 'text',
        text: { content: `${info.value}\n` }
      });
    });
    
    // LED 사양 정보
    if (eventData.ledSpecs && eventData.ledSpecs.length > 0) {
      richTextContent.push({
        type: 'text',
        text: { content: '\n📺 LED 사양:\n' },
        annotations: { bold: true }
      });
      
      eventData.ledSpecs.forEach((spec, index) => {
        richTextContent.push({
          type: 'text',
          text: { content: `${index + 1}. ${spec.size} (${spec.modules}모듈, 무대높이: ${spec.stageHeight}m)\n` }
        });
      });
    }
    
    // 오퍼레이터 정보
    if (eventData.operatorDays) {
      richTextContent.push({
        type: 'text',
        text: { content: `\n👨‍💼 오퍼레이터: ${eventData.operatorDays}일\n` },
        annotations: { bold: true }
      });
    }
    
    // 구분선
    richTextContent.push({
      type: 'text',
      text: { content: '\n' + '─'.repeat(30) + '\n' }
    });
    
    // 담당자 언급
    richTextContent.push({
      type: 'text',
      text: { content: '담당자 확인 요청: ' },
      annotations: { bold: true, color: 'blue' }
    });
    
    // 각 담당자를 언급
    managers.forEach((manager, index) => {
      // 담당자 언급
      richTextContent.push({
        type: 'mention',
        mention: {
          type: 'user',
          user: { id: manager.notionId }
        },
        annotations: { bold: true }
      });
      
      // 부서 정보 추가
      if (manager.department) {
        richTextContent.push({
          type: 'text',
          text: { content: `(${manager.department})` }
        });
      }
      
      // 구분자 추가 (마지막이 아닌 경우)
      if (index < managers.length - 1) {
        richTextContent.push({
          type: 'text',
          text: { content: ', ' }
        });
      }
    });
    
    // 마감 안내
    richTextContent.push({
      type: 'text',
      text: { content: '\n\n⏰ 빠른 확인 부탁드립니다!' },
      annotations: { bold: true, color: 'orange' }
    });
    
    return richTextContent;
  }

  /**
   * 특정 담당자에게만 언급 (긴급 상황용)
   */
  async addUrgentMention(pageId, managerName, message) {
    try {
      const manager = this.managers.find(m => m.name === managerName && m.isActive);
      if (!manager) {
        throw new Error(`담당자 '${managerName}'를 찾을 수 없습니다.`);
      }
      
      const richTextContent = [
        {
          type: 'text',
          text: { content: '🚨 긴급 확인 요청\n\n' },
          annotations: { bold: true, color: 'red' }
        },
        {
          type: 'mention',
          mention: {
            type: 'user',
            user: { id: manager.notionId }
          },
          annotations: { bold: true }
        },
        {
          type: 'text',
          text: { content: `님, ${message}` }
        }
      ];
      
      const comment = await this.notion.comments.create({
        parent: { page_id: pageId },
        rich_text: richTextContent
      });
      
      console.log(`✅ ${managerName}님에게 긴급 언급 완료`);
      return comment;
      
    } catch (error) {
      console.error('❌ 긴급 언급 실패:', error);
      throw error;
    }
  }

  /**
   * 담당자 목록 조회
   */
  getActiveManagers() {
    return this.managers.filter(manager => manager.isActive);
  }

  /**
   * 담당자 활성화/비활성화
   */
  updateManagerStatus(managerName, isActive) {
    try {
      const manager = this.managers.find(m => m.name === managerName);
      if (!manager) {
        throw new Error(`담당자 '${managerName}'를 찾을 수 없습니다.`);
      }
      
      manager.isActive = isActive;
      console.log(`✅ ${managerName}님 상태 변경: ${isActive ? '활성화' : '비활성화'}`);
      return true;
      
    } catch (error) {
      console.error('❌ 담당자 상태 변경 실패:', error);
      throw error;
    }
  }

  /**
   * 테스트 언급 (개발용)
   */
  async sendTestMention() {
    try {
      // 테스트용 페이지 ID (실제 페이지 ID로 변경 필요)
      const testPageId = 'test-page-id';
      
      const testEventData = {
        eventName: '테스트 행사',
        customerName: '테스트 고객사',
        contactName: '김테스트',
        contactTitle: '대리',
        contactPhone: '010-1234-5678',
        eventPeriod: '2024-01-15 ~ 2024-01-17',
        venue: '테스트 행사장',
        totalAmount: 1500000,
        ledSpecs: [
          { size: '4m x 3m', modules: 12, stageHeight: 1.5 },
          { size: '6m x 4m', modules: 24, stageHeight: 2.0 }
        ],
        operatorDays: 3
      };
      
      const result = await this.addMentionComment(testPageId, testEventData);
      return result;
      
    } catch (error) {
      console.error('❌ 테스트 언급 실패:', error);
      throw error;
    }
  }
}

module.exports = NotionMentionService;