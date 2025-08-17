// src/server.ts - 수정된 버전

import express, { Request, Response, NextFunction } from 'express/index.js';
import dotenv from 'dotenv';
import { handleKakaoWebhook } from './tools/kakao-chatbot.js';
import { startPollingService, getPollingService } from './tools/notion-polling.js';
import { startSchedulerService, getSchedulerService } from './tools/notion-scheduler.js';
import lineWorksRouter from './tools/lineworks-bot.js';
import oauthRoutes from './tools/oauth-routes.js';
import userAdminRoutes from './routes/user-admin.js';

// 환경 변수 로드
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 모든 요청 로깅 (디버깅용)
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  if (req.path !== '/api/users/dashboard') {
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
    service: 'LED Rental System with Claude MCP Integration',
    version: '3.0.0',
    features: [
      'Kakao Chatbot',
      'LINE WORKS Bot with Claude MCP',
      'Smart Calendar (Claude MCP)',
      'Project Management (Claude MCP)',
      'User Management System',
      'Notion Integration'
    ],
    mcp: {
      description: 'Claude AI를 통한 자연어 프로젝트 관리'
    },
    timestamp: new Date().toISOString()
  });
});

// 🆕 MCP 관련 엔드포인트
app.get('/mcp/status', async (_req: Request, res: Response) => {
  try {
    // 동적 import로 MCP 클라이언트 가져오기
    const { getMCPClient } = await import('./tools/mcp-client.js');
    const mcpClient = getMCPClient();
    const status = mcpClient.getConnectionStatus();
    
    res.json({
      connected: status,
      server: 'Claude MCP Server',
      tools: [
        'notion_project - 프로젝트 생성/업데이트/검색',
        'lineworks_calendar - 캘린더 관리',
        'create_notion_estimate - 견적 생성'
      ],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.json({
      connected: false,
      error: 'MCP 클라이언트를 로드할 수 없습니다.',
      timestamp: new Date().toISOString()
    });
  }
});

app.post('/mcp/connect', async (_req: Request, res: Response) => {
  try {
    const { getMCPClient } = await import('./tools/mcp-client.js');
    const mcpClient = getMCPClient();
    await mcpClient.connect();
    
    res.json({
      success: true,
      message: 'Claude MCP Server 연결 성공',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Claude MCP Server 연결 실패',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// 폴링 상태 확인 엔드포인트
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
        'User Management Sync',
        'Auto Cache Invalidation'
      ]
    },
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

// 라우터 연결
app.use('/api/users', userAdminRoutes);
app.use('/lineworks', lineWorksRouter);
app.use('/', oauthRoutes);

// Kakao 스킬 웹훅 엔드포인트
app.post('/kakao/skill', handleKakaoWebhook);

// 🆕 시스템 상태 체크 엔드포인트 (MCP 포함)
app.get('/system/status', async (_req: Request, res: Response) => {
  try {
    const { userService } = await import('./models/user-model.js');
    const users = await userService.getAllUsers();
    const registeredUsers = users.filter(u => !u.id.startsWith('default-'));
    const unregisteredUsers = users.filter(u => u.id.startsWith('default-'));

    let mcpStatus = false;
    try {
      const { getMCPClient } = await import('./tools/mcp-client.js');
      const mcpClient = getMCPClient();
      mcpStatus = mcpClient.getConnectionStatus();
    } catch {
      mcpStatus = false;
    }

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
        mcp: {
          connected: mcpStatus,
          server: 'Claude MCP Server',
          description: 'Claude AI 자연어 처리 서버'
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
      '/ - Health check (MCP 상태 포함)',
      '/mcp/status - MCP 연결 상태',
      '/mcp/connect - MCP 서버 연결',
      '/api/users/dashboard - User management dashboard',
      '/api/users - User management API',
      '/kakao/skill - Kakao chatbot webhook',
      '/lineworks/callback - LINE WORKS bot webhook (Claude MCP 통합)',
      '/lineworks/test-claude-mcp - Claude MCP 테스트',
      '/system/status - System status (MCP 포함)'
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
const server = app.listen(PORT, async () => {
  console.log(`🚀 LED Rental System with Claude MCP Integration`);
  console.log(`✅ Server is running on port ${PORT}`);
  console.log(`📍 Webhook endpoints:`);
  console.log(`   - Kakao: http://localhost:${PORT}/kakao/skill`);
  console.log(`   - LINE WORKS: http://localhost:${PORT}/lineworks/callback (Claude MCP 통합)`);
  console.log(`🧑‍💼 User Management:`);
  console.log(`   - Dashboard: http://localhost:${PORT}/api/users/dashboard`);
  console.log(`   - API: http://localhost:${PORT}/api/users`);
  console.log(`🤖 Claude MCP Integration:`);
  console.log(`   - Status: http://localhost:${PORT}/mcp/status`);
  console.log(`   - Test: http://localhost:${PORT}/lineworks/test-claude-mcp`);
  
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

  // 사용자 관리 시스템 체크
  if (!process.env.NOTION_USER_DATABASE_ID) {
    console.warn(`⚠️  NOTION_USER_DATABASE_ID not set. User management features will be limited.`);
  } else {
    console.log('✅ User management database configured');
  }

  // 🆕 Claude MCP 클라이언트 연결 시도
  console.log('🤖 Starting Claude MCP Client connection...');
  try {
    const { getMCPClient } = await import('./tools/mcp-client.js');
    const mcpClient = getMCPClient();
    await mcpClient.connect();
    console.log('✅ Claude MCP Client connected successfully');
    console.log('🎯 Ready for AI-powered project management!');
  } catch (error) {
    console.error('❌ Failed to connect to Claude MCP Client:', error);
    console.log('⚠️  프로젝트 관리 기능이 제한될 수 있습니다.');
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  const pollingService = getPollingService();
  const schedulerService = getSchedulerService();
  pollingService.stopPolling();
  schedulerService.stopScheduler();
  
  // MCP 클라이언트 연결 해제
  try {
    const { getMCPClient } = await import('./tools/mcp-client.js');
    const mcpClient = getMCPClient();
    await mcpClient.disconnect();
  } catch {
    // MCP 클라이언트 연결 해제 실패 시 무시
  }
  
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Shutting down gracefully...');
  const pollingService = getPollingService();
  const schedulerService = getSchedulerService();
  pollingService.stopPolling();
  schedulerService.stopScheduler();
  
  // MCP 클라이언트 연결 해제
  try {
    const { getMCPClient } = await import('./tools/mcp-client.js');
    const mcpClient = getMCPClient();
    await mcpClient.disconnect();
  } catch {
    // MCP 클라이언트 연결 해제 실패 시 무시
  }
  
  server.close(() => {
    process.exit(0);
  });
});

export default app;