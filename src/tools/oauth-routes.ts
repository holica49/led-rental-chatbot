// src/tools/oauth-routes.ts
import express, { Request, Response } from 'express';
import axios from 'axios';
import { randomBytes } from 'crypto';

const router = express.Router();

// 임시 저장소 (실제로는 Redis 등 사용)
const oauthStates = new Map<string, { userId: string; timestamp: number }>();
const userTokens = new Map<string, { accessToken: string; refreshToken: string; expiresAt: number }>();

// OAuth 인증 URL 생성
router.get('/auth/lineworks', (req: Request, res: Response) => {
  const userId = req.query.userId as string;
  
  if (!userId) {
    return res.status(400).send('userId가 필요합니다.');
  }
  
  // CSRF 방지를 위한 state 생성
  const state = randomBytes(16).toString('hex');
  oauthStates.set(state, { userId, timestamp: Date.now() });
  
  // 30분 후 state 삭제
  setTimeout(() => oauthStates.delete(state), 30 * 60 * 1000);
  
  const authUrl = new URL('https://auth.worksmobile.com/oauth2/v2.0/authorize');
  authUrl.searchParams.append('client_id', process.env.LINEWORKS_CLIENT_ID!);
  authUrl.searchParams.append('redirect_uri', `${process.env.APP_URL}/oauth/callback`);
  authUrl.searchParams.append('scope', 'calendar calendar.read calendar.write user.read');
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('state', state);
  
  res.redirect(authUrl.toString());
});

// OAuth 콜백 처리
router.get('/oauth/callback', async (req: Request, res: Response) => {
  const { code, state, error } = req.query;
  
  if (error) {
    return res.status(400).send(`인증 실패: ${error}`);
  }
  
  if (!code || !state) {
    return res.status(400).send('잘못된 요청입니다.');
  }
  
  // State 검증
  const stateData = oauthStates.get(state as string);
  if (!stateData) {
    return res.status(400).send('유효하지 않은 state입니다.');
  }
  
  oauthStates.delete(state as string);
  
  try {
    // Access Token 교환
    const tokenResponse = await axios.post('https://auth.worksmobile.com/oauth2/v2.0/token', {
      grant_type: 'authorization_code',
      client_id: process.env.LINEWORKS_CLIENT_ID,
      client_secret: process.env.LINEWORKS_CLIENT_SECRET,
      code: code,
      redirect_uri: `${process.env.APP_URL}/oauth/callback`
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    const { access_token, refresh_token, expires_in } = tokenResponse.data;
    
    // 사용자별 토큰 저장
    userTokens.set(stateData.userId, {
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: Date.now() + (expires_in * 1000)
    });
    
    // 성공 페이지로 리다이렉트
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>인증 성공</title>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          .success { color: green; font-size: 24px; }
          .info { margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="success">✅ LINE WORKS 캘린더 연동이 완료되었습니다!</div>
        <div class="info">
          <p>이제 LINE WORKS 봇에서 일정을 등록할 수 있습니다.</p>
          <p>예시: "내일 오후 2시 회의"</p>
          <p>이 창은 닫으셔도 됩니다.</p>
        </div>
      </body>
      </html>
    `);
    
  } catch (error) {
    console.error('토큰 교환 실패:', error);
    res.status(500).send('토큰 교환 중 오류가 발생했습니다.');
  }
});

// 사용자 토큰 조회 (내부 API)
export function getUserToken(userId: string): { accessToken: string; refreshToken: string } | null {
  const tokenData = userTokens.get(userId);
  
  if (!tokenData) {
    return null;
  }
  
  // 토큰 만료 확인
  if (Date.now() > tokenData.expiresAt) {
    // TODO: Refresh token으로 갱신
    return null;
  }
  
  return {
    accessToken: tokenData.accessToken,
    refreshToken: tokenData.refreshToken
  };
}

// 인증 상태 확인
export function isUserAuthenticated(userId: string): boolean {
  return userTokens.has(userId);
}

export default router;