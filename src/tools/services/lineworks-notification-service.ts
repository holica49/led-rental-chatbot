// src/tools/services/lineworks-notification-service.ts
import axios from 'axios';
import { LineWorksAuth } from '../../config/lineworks-auth.js';

// 담당자별 LINE WORKS userId 매핑
const USER_MAPPING: { [key: string]: string } = {
  '유준수': process.env.LINEWORKS_USER_YU || '',
  '최수삼': process.env.LINEWORKS_USER_CHOI || '',
  // 필요시 추가
};

// 서비스별 이모지
const SERVICE_EMOJI: { [key: string]: string } = {
  '설치': '🏢',
  '렌탈': '📅',
  '멤버쉽': '⭐'
};

interface NotificationData {
  serviceType?: string;
  eventName: string;
  customerName: string;
  contactName?: string;
  venue?: string;
  eventPeriod?: string;
  notionPageId: string;
  notionUrl?: string;
  totalAmount?: number;
}

export class LineWorksNotificationService {
  private auth: LineWorksAuth;

  constructor() {
    this.auth = new LineWorksAuth();
  }

  /**
   * 카카오 챗봇 → Notion 저장 후 담당자에게 알림 발송
   */
  async sendNewRequestNotification(data: NotificationData): Promise<void> {
    try {
      // 서비스별 담당자 결정
      const recipientName = this.getRecipientByService(data.serviceType);
      const recipientId = USER_MAPPING[recipientName];

      if (!recipientId) {
        console.error(`담당자 ${recipientName}의 LINE WORKS ID를 찾을 수 없습니다.`);
        return;
      }

      // 메시지 생성
      const message = this.createNewRequestMessage(data);

      // LINE WORKS 메시지 발송
      await this.auth.sendMessage(recipientId, {
        type: 'text',
        text: message
      });

      // 버튼 메시지 추가 (Notion 링크)
      if (data.notionUrl) {
        await this.sendButtonMessage(recipientId, data);
      }

      console.log(`✅ LINE WORKS 알림 발송 완료: ${recipientName} (${recipientId})`);
    } catch (error) {
      console.error('❌ LINE WORKS 알림 발송 실패:', error);
      // 실패해도 메인 프로세스에는 영향 없도록 에러를 throw하지 않음
    }
  }

  /**
   * 서비스별 담당자 결정
   */
  private getRecipientByService(serviceType?: string): string {
    switch (serviceType) {
      case '설치':
        return '유준수';
      case '렌탈':
      case '멤버쉽':
        return '최수삼';
      default:
        return '최수삼'; // 기본값
    }
  }

  /**
   * 새 요청 알림 메시지 생성
   */
  private createNewRequestMessage(data: NotificationData): string {
    const emoji = SERVICE_EMOJI[data.serviceType || ''] || '📋';
    const serviceLabel = data.serviceType || '서비스';
    
    let message = `${emoji} 새로운 ${serviceLabel} 요청이 접수되었습니다!\n\n`;
    message += `📌 기본 정보\n`;
    message += `• 행사명: ${data.eventName}\n`;
    message += `• 고객사: ${data.customerName}\n`;
    
    if (data.contactName) {
      message += `• 담당자: ${data.contactName}\n`;
    }
    
    if (data.venue) {
      message += `• 장소: ${data.venue}\n`;
    }
    
    if (data.eventPeriod) {
      message += `• 일정: ${data.eventPeriod}\n`;
    }
    
    if (data.totalAmount && data.totalAmount > 0) {
      message += `• 예상 견적: ${data.totalAmount.toLocaleString()}원\n`;
    }
    
    message += `\n⚡ 빠른 확인 부탁드립니다!`;
    
    return message;
  }

  /**
   * 버튼 메시지 발송 (Notion 링크)
   */
  private async sendButtonMessage(userId: string, data: NotificationData): Promise<void> {
    try {
      const accessToken = await this.auth.getAccessToken();
      const botId = process.env.LINEWORKS_BOT_ID;

      const buttonMessage = {
        type: 'button_template',
        contentText: '상세 내용을 확인하시려면 아래 버튼을 클릭하세요.',
        actions: [
          {
            type: 'uri',
            label: 'Notion에서 확인',
            uri: data.notionUrl || `https://notion.so/${data.notionPageId}`
          }
        ]
      };

      await axios.post(
        `https://www.worksapis.com/v1.0/bots/${botId}/users/${userId}/messages`,
        {
          content: buttonMessage
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
    } catch (error) {
      console.error('버튼 메시지 발송 실패:', error);
      // 버튼 발송 실패는 무시 (텍스트 메시지는 이미 발송됨)
    }
  }

  /**
   * 상태 변경 알림
   */
  async sendStatusChangeNotification(
    pageId: string, 
    oldStatus: string, 
    newStatus: string,
    eventName: string
  ): Promise<void> {
    try {
      // Notion에서 담당자 정보 조회 (추후 구현)
      // 일단은 기본 담당자에게 발송
      const recipientId = USER_MAPPING['최수삼'];
      
      const message = `🔄 상태 변경 알림\n\n` +
                     `행사명: ${eventName}\n` +
                     `${oldStatus} → ${newStatus}\n\n` +
                     `Notion에서 확인해주세요.`;
      
      await this.auth.sendMessage(recipientId, {
        type: 'text',
        text: message
      });
    } catch (error) {
      console.error('상태 변경 알림 실패:', error);
    }
  }

  /**
   * 담당자 매핑 확인 (디버깅용)
   */
  static validateUserMapping(): void {
    console.log('LINE WORKS 사용자 매핑 확인:');
    for (const [name, id] of Object.entries(USER_MAPPING)) {
      if (id) {
        console.log(`✅ ${name}: ${id}`);
      } else {
        console.log(`❌ ${name}: ID 미설정`);
      }
    }
  }
}

// 싱글톤 인스턴스
export const lineWorksNotification = new LineWorksNotificationService();

// default export 추가
export default LineWorksNotificationService;