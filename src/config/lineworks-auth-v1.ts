// src/config/lineworks-auth-v1.ts
import axios from 'axios';
import * as crypto from 'crypto';

export class LineWorksAuthV1 {
  private botId: string;
  private botSecret: string;
  private domainId: string;
  private apiId: string;
  private consumerKey: string;
  private serverId: string;
  private privateKey: string;
  
  constructor() {
    this.botId = process.env.LINEWORKS_BOT_ID!;
    this.botSecret = process.env.LINEWORKS_BOT_SECRET!;
    this.domainId = process.env.LINEWORKS_DOMAIN_ID!;
    
    // API 1.0에 필요한 추가 정보
    this.apiId = process.env.LINEWORKS_API_ID || '';
    this.consumerKey = process.env.LINEWORKS_CONSUMER_KEY || '';
    this.serverId = process.env.LINEWORKS_SERVER_ID || '';
    this.privateKey = process.env.LINEWORKS_PRIVATE_KEY || '';
  }

  /**
   * API 1.0 Server Token 발급
   */
  async getServerToken(): Promise<string> {
    try {
      const url = `https://apis.worksmobile.com/${this.apiId}/server/token`;
      
      const params = new URLSearchParams();
      params.append('grant_type', 'urn:x-oath:params:oauth:grant-type:jwt-bearer');
      params.append('assertion', this.generateJWT());
      
      const response = await axios.post(url, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      
      return response.data.access_token;
    } catch (error: any) {
      console.error('Server Token 발급 실패:', error.response?.data || error.message);
      throw error;
    }
  }
  
  /**
   * JWT 생성 (API 1.0용)
   */
  private generateJWT(): string {
    const header = {
      alg: 'RS256',
      typ: 'JWT'
    };
    
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: this.serverId,
      sub: this.serverId,
      iat: now,
      exp: now + 3600
    };
    
    // 실제로는 Private Key로 서명해야 함
    // 여기서는 간단히 표시
    return 'jwt_token_here';
  }
  
  /**
   * Bot 메시지 전송 (API 1.0)
   */
  async sendMessage(userId: string, message: string): Promise<void> {
    try {
      const token = await this.getServerToken();
      const url = `https://apis.worksmobile.com/${this.apiId}/message/v1/bot/${this.botId}/message/push`;
      
      const data = {
        botId: this.botId,
        userId: userId,
        content: {
          type: 'text',
          text: message
        }
      };
      
      await axios.post(url, data, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('메시지 전송 성공');
    } catch (error: any) {
      console.error('메시지 전송 실패:', error.response?.data || error.message);
      throw error;
    }
  }
}

// 간단한 테스트
export async function testV1Auth() {
  console.log('\n=== LINE WORKS API v1.0 테스트 ===');
  console.log('API ID:', process.env.LINEWORKS_API_ID);
  console.log('Consumer Key:', process.env.LINEWORKS_CONSUMER_KEY);
  console.log('Server ID:', process.env.LINEWORKS_SERVER_ID);
  
  if (!process.env.LINEWORKS_API_ID) {
    console.log('❌ API v1.0 정보가 없습니다. API v2.0을 사용해야 합니다.');
    return;
  }
  
  try {
    const auth = new LineWorksAuthV1();
    const token = await auth.getServerToken();
    console.log('✅ Server Token 발급 성공!');
  } catch (error) {
    console.error('❌ API v1.0 인증 실패:', error);
  }
}