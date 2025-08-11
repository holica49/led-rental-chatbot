// src/config/lineworks-auth.ts
import jwt from 'jsonwebtoken';
import axios from 'axios';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export class LineWorksAuth {
  private botId: string;
  private botSecret: string;
  private domainId: string;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor() {
    this.botId = process.env.LINEWORKS_BOT_ID!;
    this.botSecret = process.env.LINEWORKS_BOT_SECRET!;
    this.domainId = process.env.LINEWORKS_DOMAIN_ID!;
    
    if (!this.botId || !this.botSecret || !this.domainId) {
      throw new Error('LINE WORKS 환경 변수가 설정되지 않았습니다.');
    }
  }

  /**
   * Private Key 파일 읽기 (필요한 경우)
   */
    private getPrivateKey(): string {
    // 파일에서 읽기
    const keyPath = path.join(process.cwd(), 'private_key.pem');
    return fs.readFileSync(keyPath, 'utf8');
    }

  /**
   * JWT 토큰 생성 (Service Account 인증용)
   */
  private generateJWT(): string {
    const currentTime = Math.floor(Date.now() / 1000);
    
    const header = {
      alg: 'RS256',
      typ: 'JWT'
    };
    
    const payload = {
      iss: this.botId,
      sub: this.botId,
      iat: currentTime,
      exp: currentTime + 3600
    };

    // RS256 방식 시도
    try {
      const privateKey = this.getPrivateKey();
      return jwt.sign(payload, privateKey, { 
        algorithm: 'RS256',
        header: header
      });
    } catch (error) {
      // RS256 실패 시 HS256으로 폴백
      console.log('RS256 실패, HS256으로 시도...');
      return jwt.sign(payload, this.botSecret, { 
        algorithm: 'HS256',
        header: { alg: 'HS256', typ: 'JWT' }
      });
    }
  }

  /**
   * Access Token 발급 - Bot 전용
   */
  async getAccessToken(forceRefresh = false): Promise<string> {
    if (!forceRefresh && this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    console.log('LINE WORKS Access Token 발급 중...');
    
    try {
      // 방법 1: Service Account 인증
      const jwtToken = this.generateJWT();
      
      const params = new URLSearchParams();
      params.append('grant_type', 'urn:ietf:params:oauth:grant-type:jwt-bearer');
      params.append('assertion', jwtToken);
      
      const response = await axios.post(
        'https://auth.worksmobile.com/oauth2/v2.0/token',
        params,
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
      // 방법 2: Client Credentials 방식 시도
      console.log('Service Account 실패, Client Credentials 시도...');
      
      try {
        const params = new URLSearchParams();
        params.append('grant_type', 'client_credentials');
        params.append('client_id', this.botId);
        params.append('client_secret', this.botSecret);
        params.append('scope', 'bot');
        
        const response = await axios.post(
          'https://auth.worksmobile.com/oauth2/v2.0/token',
          params,
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            }
          }
        );

        this.accessToken = response.data.access_token;
        this.tokenExpiry = new Date(Date.now() + (response.data.expires_in - 300) * 1000);

        console.log('✅ LINE WORKS Access Token 발급 성공 (Client Credentials)');
        
        if (!this.accessToken) {
          throw new Error('Access token이 비어있습니다');
        }
        
        return this.accessToken;
        
      } catch (error2: any) {
        console.error('❌ 모든 인증 방법 실패');
        console.error('Service Account 오류:', error.response?.data || error.message);
        console.error('Client Credentials 오류:', error2.response?.data || error2.message);
        throw new Error(`Access token 발급 실패: ${error.response?.data?.error_description || error.message}`);
      }
    }
  }

  /**
   * Webhook 서명 검증
   */
  verifySignature(body: string, signature: string): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', this.botSecret)
      .update(body)
      .digest('base64');
    
    return signature === expectedSignature;
  }

  /**
   * API 호출용 헤더 생성
   */
  async getAuthHeaders(): Promise<{ Authorization: string }> {
    const token = await this.getAccessToken();
    return {
      Authorization: `Bearer ${token}`
    };
  }
  
  /**
   * 토큰 유효성 확인
   */
  isTokenValid(): boolean {
    return !!(this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date());
  }
  
  /**
   * Bot 정보 조회 (테스트용)
   */
  async getBotInfo(): Promise<any> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await axios.get(
        `https://www.worksapis.com/v1.0/bots/${this.botId}`,
        { headers }
      );
      return response.data;
    } catch (error: any) {
      console.error('Bot 정보 조회 실패:', error.response?.data || error.message);
      throw error;
    }
  }
}