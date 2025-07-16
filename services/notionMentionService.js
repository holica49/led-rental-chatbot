// services/notionMentionService.js - ES 모듈 버전
import axios from 'axios';

class NotionMentionService {
  constructor() {
    this.managers = JSON.parse(process.env.MANAGERS_CONFIG || '{"managers":[]}').managers;
    this.kakaoApiKey = process.env.KAKAO_API_KEY;
    this.kakaoSenderKey = process.env.KAKAO_SENDER_KEY;
    this.kakaoTemplateCode = process.env.KAKAO_TEMPLATE_CODE;
    this.kakaoPhoneNumber = process.env.KAKAO_PHONE_NUMBER;
  }

  /**
   * 견적 요청 완료 시 모든 담당자에게 알림 발송
   */
  async sendQuoteRequestNotification(eventData) {
    try {
      const activeManagers = this.managers.filter(manager => manager.isActive);
      
      console.log(`${activeManagers.length}명의 담당자에게 알림 발송 시작`);
      
      // Notion 언급만 실행 (카카오톡은 나중에 추가)
      const results = await Promise.allSettled([
        this.sendNotionMentions(activeManagers, eventData)
      ]);
      
      // 결과 로깅
      results.forEach((result, index) => {
        const type = 'Notion 언급';
        if (result.status === 'fulfilled') {
          console.log(`✅ ${type} 전송 성공`);
        } else {
          console.error(`❌ ${type} 전송 실패:`, result.reason);
        }
      });
      
      return true;
    } catch (error) {
      console.error('알림 발송 중 오류:', error);
      return false;
    }
  }

  /**
   * Notion 댓글에 담당자 언급 추가
   */
  async sendNotionMentions(managers, eventData) {
    try {
      const { Client } = await import('@notionhq/client');
      const notion = new Client({ auth: process.env.NOTION_API_KEY });
      
      // 언급할 담당자들의 멘션 텍스트 생성
      const mentions = managers.map(manager => ({
        type: 'mention',
        mention: {
          type: 'user',
          user: { id: manager.notionId }
        }
      }));
      
      // 댓글 내용 구성
      const commentBlocks = [
        {
          type: 'text',
          text: { content: '🚨 새로운 견적 요청이 접수되었습니다!\n\n' }
        },
        {
          type: 'text',
          text: { content: `📋 행사명: ${eventData.eventName}\n` }
        },
        {
          type: 'text',
          text: { content: `🏢 고객사: ${eventData.customerName}\n` }
        },
        {
          type: 'text',
          text: { content: `📅 행사기간: ${eventData.eventPeriod}\n` }
        },
        {
          type: 'text',
          text: { content: `🎪 행사장: ${eventData.venue}\n` }
        },
        {
          type: 'text',
          text: { content: `💰 견적금액: ${eventData.totalAmount?.toLocaleString() || '계산중'}원\n\n` }
        },
        {
          type: 'text',
          text: { content: '담당자 확인 부탁드립니다: ' }
        },
        ...mentions.map((mention, index) => ({
          ...mention,
          annotations: { bold: true }
        }))
      ];
      
      // Notion 페이지에 댓글 추가
      await notion.comments.create({
        parent: { page_id: eventData.notionPageId },
        rich_text: commentBlocks
      });
      
      console.log('✅ Notion 언급 댓글 추가 완료');
      return true;
    } catch (error) {
      console.error('❌ Notion 언급 실패:', error);
      throw error;
    }
  }

  /**
   * 특정 페이지에 언급 댓글 추가
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
      const { Client } = await import('@notionhq/client');
      const notion = new Client({ auth: process.env.NOTION_API_KEY });
      
      const comment = await notion.comments.create({
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
          text: { content: `${index + 1}. ${spec.size} (무대높이: ${spec.stageHeight}m)\n` }
        });
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
   * 활성 담당자 목록 조회
   */
  getActiveManagers() {
    return this.managers.filter(manager => manager.isActive);
  }

  /**
   * 테스트 언급 (개발용)
   */
  async sendTestMention() {
    try {
      console.log('🧪 테스트 언급 시작');
      
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
        ]
      };
      
      // 최근 페이지 찾기
      const { Client } = await import('@notionhq/client');
      const notion = new Client({ auth: process.env.NOTION_API_KEY });
      
      const response = await notion.databases.query({
        database_id: process.env.NOTION_DATABASE_ID,
        page_size: 1,
        sorts: [
          {
            timestamp: 'created_time',
            direction: 'descending'
          }
        ]
      });
      
      if (response.results.length > 0) {
        const pageId = response.results[0].id;
        const result = await this.addMentionComment(pageId, testEventData);
        return result;
      } else {
        throw new Error('테스트할 페이지가 없습니다.');
      }
      
    } catch (error) {
      console.error('❌ 테스트 언급 실패:', error);
      throw error;
    }
  }
}

export default NotionMentionService;