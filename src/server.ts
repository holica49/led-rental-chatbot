import express, { Request, Response, NextFunction } from 'express/index.js';
import dotenv from 'dotenv';
import { handleKakaoWebhook } from './tools/kakao-chatbot.js';
import { startPollingService, getPollingService } from './tools/notion-polling.js';
import { startSchedulerService, getSchedulerService } from './tools/notion-scheduler.js';
import lineWorksRouter from './tools/lineworks-bot.js';
import oauthRoutes from './tools/oauth-routes.js';
import userAdminRoutes from './routes/user-admin.js'; // 🆕 사용자 관리 라우트 추가
import { getUserToken, isUserAuthenticated } from './tools/oauth-routes.js';

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
  if (req.path !== '/api/users/dashboard') { // 대시보드 요청은 로그 제외
    console.log('Headers:', req.headers);
    if (req.body && Object.keys(req.body).length > 0) {
      console.log('Body:', JSON.stringify(req.body, null, 2));
    }
  }
  next();
});

// CORS 설정
app.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// 헬스 체크 엔드포인트
app.get('/', (_req: Request, res: Response) => {
  res.json({ 
    status: 'OK',
    service: 'LED Rental Kakao Chatbot & User Management',
    version: '2.0.0',
    features: [
      'Kakao Chatbot',
      'LINE WORKS Bot',
      'Smart Calendar (MCP)',
      'User Management System',
      'Notion Integration'
    ],
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

// 스케줄러 상태 확인 엔드포인트
app.get('/scheduler/status', (_req: Request, res: Response) => {
  const schedulerService = getSchedulerService();
  const status = schedulerService.getSchedulerStatus();
  
  res.json({
    status: 'OK',
    scheduler: status,
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

// 🆕 사용자 관리 라우터 연결
app.use('/api/users', userAdminRoutes);

// LINE WORKS 라우터 연결
app.use('/lineworks', lineWorksRouter);

// OAuth 라우터 연결
app.use('/', oauthRoutes);

// Kakao 스킬 웹훅 엔드포인트
app.post('/kakao/skill', handleKakaoWebhook);

// 테스트 엔드포인트
app.post('/test', (req: Request, res: Response) => {
  console.log('Test endpoint hit:', req.body);
  res.json({
    success: true,
    received: req.body,
    timestamp: new Date().toISOString()
  });
});

// 🆕 시스템 상태 체크 엔드포인트
app.get('/system/status', async (_req: Request, res: Response) => {
  try {
    const { userService } = await import('./models/user-model.js');
    const users = await userService.getAllUsers();
    const registeredUsers = users.filter(u => !u.id.startsWith('default-'));
    const unregisteredUsers = users.filter(u => u.id.startsWith('default-'));

    res.json({
      status: 'OK',
      system: {
        notion: {
          connected: !!process.env.NOTION_API_KEY,
          databaseId: !!process.env.NOTION_DATABASE_ID,
          userDatabaseId: !!process.env.NOTION_USER_DATABASE_ID
        },
        lineWorks: {
          configured: !!(process.env.LINEWORKS_BOT_ID && process.env.LINEWORKS_BOT_SECRET),
          calendarEnabled: !!process.env.LINEWORKS_PRIVATE_KEY
        },
        users: {
          total: users.length,
          registered: registeredUsers.length,
          unregistered: unregisteredUsers.length
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// 404 핸들러
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested endpoint does not exist',
    availableEndpoints: [
      '/ - Health check',
      '/api/users/dashboard - User management dashboard',
      '/api/users - User management API',
      '/kakao/skill - Kakao chatbot webhook',
      '/lineworks/callback - LINE WORKS bot webhook',
      '/system/status - System status'
    ]
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
const server = app.listen(PORT, () => {
  console.log(`🚀 LED Rental Kakao Chatbot & User Management Server`);
  console.log(`✅ Server is running on port ${PORT}`);
  console.log(`📍 Webhook endpoints:`);
  console.log(`   - Kakao: http://localhost:${PORT}/kakao/skill`);
  console.log(`   - LINE WORKS: http://localhost:${PORT}/lineworks/callback`);
  console.log(`🧑‍💼 User Management:`);
  console.log(`   - Dashboard: http://localhost:${PORT}/api/users/dashboard`);
  console.log(`   - API: http://localhost:${PORT}/api/users`);
  
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
    
    // Notion 스케줄러 서비스 시작
    console.log('📅 Starting Notion scheduler service...');
    startSchedulerService().then(() => {
      console.log('✅ Notion scheduler service started');
    }).catch(error => {
      console.error('❌ Failed to start Notion scheduler service:', error);
    });
  }
  
  // LINE WORKS 환경 변수 체크
  const lineWorksVars = ['LINEWORKS_BOT_ID', 'LINEWORKS_BOT_SECRET', 'LINEWORKS_CLIENT_ID', 'LINEWORKS_DOMAIN_ID'];
  const missingLineWorksVars = lineWorksVars.filter(v => !process.env[v]);
  
  if (missingLineWorksVars.length > 0) {
    console.warn(`⚠️  Missing LINE WORKS variables: ${missingLineWorksVars.join(', ')}`);
  } else {
    console.log('✅ All LINE WORKS environment variables are set');
  }

  // 🆕 사용자 관리 시스템 체크
  if (!process.env.NOTION_USER_DATABASE_ID) {
    console.warn(`⚠️  NOTION_USER_DATABASE_ID not set. User management features will be limited.`);
  } else {
    console.log('✅ User management database configured');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  const pollingService = getPollingService();
  const schedulerService = getSchedulerService();
  pollingService.stopPolling();
  schedulerService.stopScheduler();
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  const pollingService = getPollingService();
  const schedulerService = getSchedulerService();
  pollingService.stopPolling();
  schedulerService.stopScheduler();
  server.close(() => {
    process.exit(0);
  });
});

// server.ts에 추가할 엔드포인트들

// 🆕 사용자 캐시 수동 무효화 엔드포인트
app.post('/polling/invalidate-user-cache', async (req: Request, res: Response) => {
  try {
    const { lineWorksUserId } = req.body;
    const pollingService = getPollingService();
    const result = await pollingService.manualUserCacheInvalidation(lineWorksUserId);
    
    res.json({
      success: true,
      message: lineWorksUserId 
        ? `사용자 ${lineWorksUserId}의 캐시가 무효화되었습니다.`
        : '전체 사용자 캐시가 무효화되었습니다.',
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

// 🆕 사용자 관리 폴링 상태 확인 (기존 polling/status 확장)
app.get('/polling/status', (_req: Request, res: Response) => {
  const pollingService = getPollingService();
  const status = pollingService.getPollingStatus();
  
  res.json({
    status: 'OK',
    polling: {
      ...status,
      features: [
        'Project Status Monitoring',
        'File Upload Detection', 
        'User Management Sync', // 🆕
        'Auto Cache Invalidation' // 🆕
      ]
    },
    timestamp: new Date().toISOString()
  }); 
});

// 🆕 사용자 동기화 테스트 엔드포인트
app.post('/polling/test-user-sync', async (req: Request, res: Response) => {
  try {
    const { lineWorksUserId } = req.body;
    
    if (!lineWorksUserId) {
      return res.status(400).json({
        success: false,
        message: 'lineWorksUserId가 필요합니다.'
      });
    }

    // 1. 현재 캐시 상태 확인
    const { userService } = await import('./models/user-model.js');
    const userBefore = await userService.getUserByLineWorksId(lineWorksUserId);
    
    // 2. 캐시 무효화
    userService.invalidateUserCache(lineWorksUserId);
    
    // 3. 새로운 정보 조회
    const userAfter = await userService.getUserByLineWorksId(lineWorksUserId, true);
    
    res.json({
      success: true,
      message: '사용자 동기화 테스트 완료',
      test: {
        lineWorksUserId,
        before: {
          name: userBefore?.name,
          email: userBefore?.email,
          isRegistered: userBefore ? !userBefore.id.startsWith('default-') : false
        },
        after: {
          name: userAfter?.name,
          email: userAfter?.email,
          isRegistered: userAfter ? !userAfter.id.startsWith('default-') : false
        },
        changed: userBefore?.name !== userAfter?.name || 
                 userBefore?.email !== userAfter?.email
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default app;