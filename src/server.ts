import express, { Request, Response, NextFunction } from 'express/index.js';
import dotenv from 'dotenv';
import { handleKakaoWebhook } from './tools/kakao-chatbot.js';
import { startPollingService, getPollingService } from './tools/notion-polling.js';

// 환경 변수 로드
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// PORT 디버깅
console.log('Environment PORT:', process.env.PORT);
console.log('Using PORT:', PORT);

// 미들웨어
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 모든 요청 로깅 (디버깅용)
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  console.log('Headers:', req.headers);
  if (req.body) {
    console.log('Body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

// CORS 설정
app.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// 헬스 체크 엔드포인트
app.get('/', (_req: Request, res: Response) => {
  res.json({ 
    status: 'OK',
    service: 'LED Rental Kakao Chatbot',
    timestamp: new Date().toISOString()
  });
});

// 폴링 상태 확인 엔드포인트
app.get('/polling/status', (_req: Request, res: Response) => {
  const pollingService = getPollingService();
  const status = pollingService.getPollingStatus();
  
  res.json({
    status: 'OK',
    polling: status,
    timestamp: new Date().toISOString()
  }); 
});

// 수동 트리거 엔드포인트 (테스트용)
app.post('/polling/trigger', async (req: Request, res: Response) => {
  try {
    const { pageId, status } = req.body;
    const pollingService = getPollingService();
    const result = await pollingService.manualTrigger(pageId, status);
    
    res.json({
      success: true,
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// 테스트 엔드포인트
app.post('/test', (req: Request, res: Response) => {
  console.log('Test endpoint hit:', req.body);
  res.json({
    success: true,
    received: req.body,
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

// 서버 시작 - 한 번만!
const server = app.listen(PORT, () => {
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
    
    // Notion 폴링 서비스 시작
    console.log('🔄 Starting Notion polling service...');
    startPollingService().then(() => {
      console.log('✅ Notion polling service started');
    }).catch(error => {
      console.error('❌ Failed to start Notion polling service:', error);
    });
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  const pollingService = getPollingService();
  pollingService.stopPolling();
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  const pollingService = getPollingService();
  pollingService.stopPolling();
  server.close(() => {
    process.exit(0);
  });
});

export default app;