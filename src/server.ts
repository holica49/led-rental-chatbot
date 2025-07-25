import express, { Request, Response, NextFunction } from 'express/index.js';
import dotenv from 'dotenv';
import { handleKakaoWebhook } from './tools/kakao-chatbot.js';

// 환경 변수 로드
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 헬스 체크 엔드포인트
app.get('/', (_req: Request, res: Response) => {
  res.json({ 
    status: 'OK',
    service: 'LED Rental Kakao Chatbot',
    timestamp: new Date().toISOString()
  });
});

// Kakao 스킬 웹훅 엔드포인트
app.post('/kakao/skill', handleKakaoWebhook);

// 404 핸들러
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested endpoint does not exist'
  });
});

// 에러 핸들러
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'An error occurred processing your request'
  });
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`🚀 LED Rental Kakao Chatbot Server`);
  console.log(`✅ Server is running on port ${PORT}`);
  console.log(`📍 Webhook endpoint: http://localhost:${PORT}/kakao/skill`);
  
  // 환경 변수 체크
  const requiredEnvVars = ['NOTION_API_KEY', 'NOTION_DATABASE_ID'];
  const missingVars = requiredEnvVars.filter(v => !process.env[v]);
  
  if (missingVars.length > 0) {
    console.warn(`⚠️  Missing environment variables: ${missingVars.join(', ')}`);
  } else {
    console.log('✅ All required environment variables are set');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

export default app;