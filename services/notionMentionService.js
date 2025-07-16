// services/notificationService.js
const axios = require('axios');

class NotificationService {
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
      
      // 병렬로 알림 전송
      const results = await Promise.allSettled([
        this.sendNotionMentions(activeManagers, eventData),
        this.sendKakaoMessages(activeManagers, eventData)
      ]);
      
      // 결과 로깅
      results.forEach((result, index) => {
        const type = index === 0 ? 'Notion 언급' : '카카오톡 알림';
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
          type: 'paragraph',
          paragraph: {
            rich_text: [
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
            ]
          }
        }
      ];
      
      // Notion 페이지에 댓글 추가
      await notion.comments.create({
        parent: { page_id: eventData.notionPageId },
        rich_text: commentBlocks[0].paragraph.rich_text
      });
      
      console.log('✅ Notion 언급 댓글 추가 완료');
      return true;
    } catch (error) {
      console.error('❌ Notion 언급 실패:', error);
      throw error;
    }
  }

  /**
   * 카카오톡 알림톡/채널 메시지 전송
   */
  async sendKakaoMessages(managers, eventData) {
    try {
      const messagePromises = managers.map(manager => 
        this.sendKakaoMessageToManager(manager, eventData)
      );
      
      const results = await Promise.allSettled(messagePromises);
      
      // 결과 확인
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failCount = results.filter(r => r.status === 'rejected').length;
      
      console.log(`✅ 카카오톡 메시지 전송 완료: 성공 ${successCount}건, 실패 ${failCount}건`);
      
      if (failCount > 0) {
        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            console.error(`❌ ${managers[index].name} 전송 실패:`, result.reason);
          }
        });
      }
      
      return true;
    } catch (error) {
      console.error('❌ 카카오톡 메시지 전송 실패:', error);
      throw error;
    }
  }

  /**
   * 개별 담당자에게 카카오톡 메시지 전송
   */
  async sendKakaoMessageToManager(manager, eventData) {
    try {
      // 알림톡 전송 시도
      const alimtalkResult = await this.sendAlimtalk(manager, eventData);
      if (alimtalkResult) {
        console.log(`✅ ${manager.name}님에게 알림톡 전송 성공`);
        return true;
      }
      
      // 알림톡 실패 시 채널톡 전송
      const channelResult = await this.sendChannelTalk(manager, eventData);
      if (channelResult) {
        console.log(`✅ ${manager.name}님에게 채널톡 전송 성공`);
        return true;
      }
      
      throw new Error('알림톡, 채널톡 모두 전송 실패');
    } catch (error) {
      console.error(`❌ ${manager.name}님 카카오톡 전송 실패:`, error.message);
      throw error;
    }
  }

  /**
   * 카카오톡 알림톡 전송
   */
  async sendAlimtalk(manager, eventData) {
    try {
      const messageData = {
        plusFriendId: this.kakaoSenderKey,
        templateCode: this.kakaoTemplateCode,
        messages: [{
          to: manager.phone,
          content: {
            담당자명: manager.name,
            행사명: eventData.eventName,
            고객사: eventData.customerName,
            행사기간: eventData.eventPeriod,
            행사장: eventData.venue,
            견적금액: eventData.totalAmount?.toLocaleString() || '계산중',
            노션링크: eventData.notionPageUrl || 'Notion에서 확인'
          }
        }]
      };
      
      const response = await axios.post(
        'https://alimtalk-api.bizmsg.kr/v2/sender/send',
        messageData,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.kakaoApiKey}`
          }
        }
      );
      
      return response.data.code === '0000';
    } catch (error) {
      console.error('알림톡 전송 실패:', error.response?.data || error.message);
      return false;
    }
  }

  /**
   * 카카오톡 채널톡 전송 (알림톡 실패 시 백업)
   */
  async sendChannelTalk(manager, eventData) {
    try {
      const message = `🚨 새로운 견적 요청 알림

안녕하세요, ${manager.name}님!

📋 행사명: ${eventData.eventName}
🏢 고객사: ${eventData.customerName}
📅 행사기간: ${eventData.eventPeriod}
🎪 행사장: ${eventData.venue}
💰 견적금액: ${eventData.totalAmount?.toLocaleString() || '계산중'}원

자세한 내용은 Notion에서 확인해주세요.`;

      const messageData = {
        plusFriendId: this.kakaoSenderKey,
        messages: [{
          to: manager.phone,
          content: {
            text: message
          }
        }]
      };
      
      const response = await axios.post(
        'https://friendtalk-api.bizmsg.kr/v2/sender/send',
        messageData,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.kakaoApiKey}`
          }
        }
      );
      
      return response.data.code === '0000';
    } catch (error) {
      console.error('채널톡 전송 실패:', error.response?.data || error.message);
      return false;
    }
  }

  /**
   * 테스트 메시지 전송
   */
  async sendTestNotification() {
    const testData = {
      eventName: '테스트 행사',
      customerName: '테스트 고객사',
      eventPeriod: '2024-01-15 ~ 2024-01-17',
      venue: '테스트 행사장',
      totalAmount: 1500000,
      notionPageId: 'test-page-id',
      notionPageUrl: 'https://notion.so/test-page'
    };
    
    return await this.sendQuoteRequestNotification(testData);
  }
}

export default NotionMentionService;