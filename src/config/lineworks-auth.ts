// src/config/lineworks-auth.ts (수정된 버전)
import jwt from 'jsonwebtoken';
import axios from 'axios';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface LineWorksConfig {
  botId: string;
  botSecret: string;
  domainId: string;
  clientId: string;
  clientSecret: string;
  serviceAccount?: string;
}

export class LineWorksAuth {
  private config: LineWorksConfig;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private calendarToken: string | null = null;
  private calendarTokenExpiry: Date | null = null;

  constructor() {
    // 환경 변수 디버깅
    console.log('LINE WORKS 환경 변수 체크:');
    console.log('LINEWORKS_BOT_ID:', process.env.LINEWORKS_BOT_ID ? '설정됨' : '없음');
    console.log('LINEWORKS_BOT_SECRET:', process.env.LINEWORKS_BOT_SECRET ? '설정됨' : '없음');
    console.log('LINEWORKS_CLIENT_ID:', process.env.LINEWORKS_CLIENT_ID ? '설정됨' : '없음');
    console.log('LINEWORKS_CLIENT_SECRET:', process.env.LINEWORKS_CLIENT_SECRET ? '설정됨' : '없음');
    console.log('LINEWORKS_DOMAIN_ID:', process.env.LINEWORKS_DOMAIN_ID ? '설정됨' : '없음');
    
    this.config = {
      botId: process.env.LINEWORKS_BOT_ID!,
      botSecret: process.env.LINEWORKS_BOT_SECRET!,
      domainId: process.env.LINEWORKS_DOMAIN_ID!,
      clientId: process.env.LINEWORKS_CLIENT_ID!,
      clientSecret: process.env.LINEWORKS_CLIENT_SECRET!,
      serviceAccount: process.env.LINEWORKS_SERVICE_ACCOUNT_ID
    };
    
    if (!this.config.botId || !this.config.botSecret || !this.config.domainId) {
      console.error('필수 환경 변수가 누락되었습니다.');
      throw new Error('LINE WORKS 환경 변수가 설정되지 않았습니다.');
    }
  }

  /**
   * Private Key 파일 읽기
   */
  private getPrivateKey(): string {
    // 먼저 환경 변수에서 시도
    if (process.env.LINEWORKS_PRIVATE_KEY) {
      console.log('✅ Private Key를 환경 변수에서 찾았습니다.');
      // 환경 변수의 개행 문자 복원
      return process.env.LINEWORKS_PRIVATE_KEY.replace(/\\n/g, '\n');
    }
    
    // 파일에서 읽기 시도 (로컬 개발용)
    try {
      const keyPath = path.join(process.cwd(), 'private_key.pem');
      const key = fs.readFileSync(keyPath, 'utf8');
      console.log('✅ Private Key 파일을 찾았습니다.');
      return key;
    } catch (error) {
      console.log('❌ Private Key 파일이 없습니다. 환경 변수 LINEWORKS_PRIVATE_KEY를 설정해주세요.');
      throw new Error('Private Key가 필요합니다.');
    }
  }

  /**
   * JWT 토큰 생성 (Service Account 인증용) - 기본 봇 권한
   */
  private generateJWT(): string {
    const currentTime = Math.floor(Date.now() / 1000);
    const privateKey = this.getPrivateKey();
    
    // Service Account ID가 있으면 사용, 없으면 Client ID 사용
    const serviceAccountId = this.config.serviceAccount || `${this.config.clientId}.serviceaccount@${this.config.domainId}`;
    
    console.log('JWT 생성 중...');
    console.log('Service Account ID:', serviceAccountId);
    
    const payload = {
      iss: this.config.clientId,  // Client ID를 발급자로
      sub: serviceAccountId,       // Service Account ID를 주체로
      iat: currentTime,
      exp: currentTime + 3600
    };

    return jwt.sign(payload, privateKey, { 
      algorithm: 'RS256'
    });
  }

  /**
   * JWT 토큰 생성 (캘린더 권한 포함)
   */
  private generateCalendarJWT(): string {
    const currentTime = Math.floor(Date.now() / 1000);
    const privateKey = this.getPrivateKey();
    
    const serviceAccountId = this.config.serviceAccount || `${this.config.clientId}.serviceaccount@${this.config.domainId}`;
    
    console.log('캘린더 JWT 생성 중...');
    console.log('Service Account ID:', serviceAccountId);
    
    const payload = {
      iss: this.config.clientId,
      sub: serviceAccountId,
      iat: currentTime,
      exp: currentTime + 3600
    };

    return jwt.sign(payload, privateKey, { 
      algorithm: 'RS256'
    });
  }

  /**
   * Access Token 발급 (기본 봇 권한)
   */
  async getAccessToken(forceRefresh = false): Promise<string> {
    if (!forceRefresh && this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    console.log('LINE WORKS Access Token 발급 중...');
    
    try {
      const jwtToken = this.generateJWT();
      
      const params = new URLSearchParams({
        assertion: jwtToken,
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        scope: 'bot bot.message user.read'
      });
      
      const response = await axios.post(
        'https://auth.worksmobile.com/oauth2/v2.0/token',
        params.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = new Date(Date.now() + (response.data.expires_in - 300) * 1000);

      console.log('✅ LINE WORKS Access Token 발급 성공');
      
      if (!this.accessToken) {
        throw new Error('Access token이 비어있습니다');
      }
      
      return this.accessToken;
      
    } catch (error: any) {
      console.error('❌ Access Token 발급 실패');
      console.error('오류 내용:', error.response?.data || error.message);
      
      if (error.response?.data?.error === 'invalid_grant') {
        console.log('\n💡 해결 방법:');
        console.log('1. LINE WORKS Console에서 Service Account를 생성하세요');
        console.log('2. Private Key를 다운로드하여 프로젝트 루트에 private_key.pem으로 저장하세요');
        console.log('3. .env 파일에 LINEWORKS_SERVICE_ACCOUNT_ID를 추가하세요');
      }
      
      throw new Error(`Access token 발급 실패: ${error.response?.data?.error_description || error.message}`);
    }
  }

  /**
   * Access Token 발급 (캘린더 권한 포함) - 수정된 버전
   */
  async getAccessTokenWithCalendarScope(): Promise<string> {
    // 캐시된 토큰이 있고 유효하면 반환
    if (this.calendarToken && this.calendarTokenExpiry && this.calendarTokenExpiry > new Date()) {
      return this.calendarToken;
    }

    console.log('LINE WORKS 캘린더 Access Token 발급 중...');
    
    try {
      const jwtToken = this.generateCalendarJWT();
      
      const params = new URLSearchParams({
        assertion: jwtToken,
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        scope: 'bot bot.message user.read calendar calendar.read'
      });
      
      const response = await axios.post(
        'https://auth.worksmobile.com/oauth2/v2.0/token',
        params.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      this.calendarToken = response.data.access_token;
      this.calendarTokenExpiry = new Date(Date.now() + (response.data.expires_in - 300) * 1000);

      console.log('✅ LINE WORKS 캘린더 Access Token 발급 성공');
      
      if (!this.calendarToken) {
        throw new Error('캘린더 Access token이 비어있습니다');
      }
      
      return this.calendarToken;
      
    } catch (error: any) {
      console.error('❌ 캘린더 Access token 발급 실패:', error.response?.data || error.message);
      
      // 캘린더 권한이 없으면 기본 토큰 반환
      if (error.response?.data?.error === 'invalid_scope') {
        console.log('⚠️ 캘린더 권한이 없습니다. 기본 토큰을 사용합니다.');
        return this.getAccessToken();
      }
      
      throw error;
    }
  }

  /**
   * Webhook 서명 검증
   */
  verifySignature(body: string, signature: string): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', this.config.botSecret)
      .update(body)
      .digest('base64');
    
    return signature === expectedSignature;
  }

  /**
   * API 호출용 헤더 생성
   */
  async getAuthHeaders(): Promise<{ Authorization: string; 'Content-Type': string }> {
    const token = await this.getAccessToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }
  
  /**
   * Bot 정보 조회 (테스트용)
   */
  async getBotInfo(): Promise<any> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await axios.get(
        `https://www.worksapis.com/v1.0/bots/${this.config.botId}`,
        { headers }
      );
      return response.data;
    } catch (error: any) {
      console.error('Bot 정보 조회 실패:', error.response?.data || error.message);
      throw error;
    }
  }
  
  /**
   * 메시지 전송
   */
  async sendMessage(userId: string, content: any): Promise<void> {
    try {
      const headers = await this.getAuthHeaders();
      
      // content 객체로 감싸기
      const requestBody = {
        content: content
      };
      
      console.log('메시지 전송 요청:', JSON.stringify(requestBody, null, 2));
      
      const response = await axios.post(
        `https://www.worksapis.com/v1.0/bots/${this.config.botId}/users/${userId}/messages`,
        requestBody,
        { headers }
      );
      
      console.log('✅ 메시지 전송 성공');
      return response.data;
    } catch (error: any) {
      console.error('❌ 메시지 전송 실패:', error.response?.data || error.message);
      throw error;
    }
  }
}