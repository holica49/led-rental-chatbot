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

// server.ts에 추가할 프로젝트 관리 엔드포인트들

// 🆕 프로젝트 관리 테스트 엔드포인트
app.post('/project/test-parsing', async (req: Request, res: Response) => {
  try {
    const { text, action } = req.body;
    
    if (!text) {
      return res.status(400).json({
        success: false,
        message: 'text 매개변수가 필요합니다.',
        example: {
          text: '강남 렌탈 수주했어',
          action: 'create' // 또는 'update'
        }
      });
    }

    const { ProjectNLPParser } = await import('./utils/project-nlp-parser.js');
    const parser = new ProjectNLPParser();
    
    let result;
    if (action === 'create') {
      result = parser.parseProjectCreation(text);
    } else if (action === 'update') {
      result = parser.parseProjectUpdate(text);
    } else {
      // 둘 다 시도
      const creation = parser.parseProjectCreation(text);
      const update = parser.parseProjectUpdate(text);
      result = {
        creation,
        update,
        detected: creation ? 'creation' : update ? 'update' : 'none'
      };
    }
    
    res.json({
      success: true,
      input: text,
      action: action || 'auto-detect',
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

// 🆕 프로젝트 검색 엔드포인트
app.get('/project/search', async (req: Request, res: Response) => {
  try {
    const { keyword } = req.query;
    
    if (!keyword || typeof keyword !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'keyword 매개변수가 필요합니다.',
        example: '/project/search?keyword=강남'
      });
    }

    const { Client } = await import('@notionhq/client');
    const notion = new Client({ auth: process.env.NOTION_API_KEY });
    
    const response = await notion.databases.query({
      database_id: process.env.NOTION_DATABASE_ID!,
      filter: {
        property: '행사명',
        title: {
          contains: keyword
        }
      }
    });

    const projects = response.results.map((page: any) => ({
      pageId: page.id,
      projectName: page.properties['행사명']?.title?.[0]?.text?.content || '',
      status: page.properties['행사 상태']?.status?.name || '',
      serviceType: page.properties['서비스 유형']?.select?.name || '',
      customer: page.properties['고객사']?.select?.name || '',
      eventDate: page.properties['행사 일정']?.rich_text?.[0]?.text?.content || '',
      notionUrl: `https://www.notion.so/${page.id.replace(/-/g, '')}`
    }));
    
    res.json({
      success: true,
      keyword,
      projects,
      count: projects.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// 🆕 프로젝트 생성 데모 엔드포인트
app.post('/project/demo', async (req: Request, res: Response) => {
  try {
    const { 
      projectName = '데모 프로젝트',
      serviceType = '렌탈',
      userId = 'demo-user'
    } = req.body;

    const { Client } = await import('@notionhq/client');
    const notion = new Client({ auth: process.env.NOTION_API_KEY });
    
    const response = await notion.pages.create({
      parent: { database_id: process.env.NOTION_DATABASE_ID! },
      properties: {
        '행사명': {
          title: [{
            text: { content: `[데모] ${projectName}` }
          }]
        },
        '서비스 유형': {
          select: { name: serviceType }
        },
        '행사 상태': {
          status: { name: '견적 요청' }
        },
        '문의요청 사항': {
          rich_text: [{
            text: { content: `데모용으로 생성된 프로젝트 (${userId})` }
          }]
        }
      }
    });

    // 댓글 추가
    await notion.comments.create({
      parent: { page_id: response.id },
      rich_text: [{
        type: 'text',
        text: { 
          content: `🧪 데모 프로젝트 생성\n생성자: ${userId}\n생성 시간: ${new Date().toLocaleString('ko-KR')}\n\n이 프로젝트는 테스트용입니다.` 
        }
      }]
    });
    
    res.json({
      success: true,
      message: '데모 프로젝트가 생성되었습니다.',
      project: {
        pageId: response.id,
        projectName: `[데모] ${projectName}`,
        serviceType,
        status: '견적 요청',
        notionUrl: `https://www.notion.so/${response.id.replace(/-/g, '')}`
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

// 🆕 프로젝트 관리 대시보드
app.get('/project/dashboard', async (req: Request, res: Response) => {
  try {
    const { Client } = await import('@notionhq/client');
    const notion = new Client({ auth: process.env.NOTION_API_KEY });
    
    const response = await notion.databases.query({
      database_id: process.env.NOTION_DATABASE_ID!,
      sorts: [
        {
          property: '행사 상태',
          direction: 'ascending'
        }
      ]
    });

    const projects = response.results.map((page: any) => ({
      pageId: page.id,
      projectName: page.properties['행사명']?.title?.[0]?.text?.content || '',
      status: page.properties['행사 상태']?.status?.name || '',
      serviceType: page.properties['서비스 유형']?.select?.name || '',
      customer: page.properties['고객사']?.select?.name || '',
      eventDate: page.properties['행사 일정']?.rich_text?.[0]?.text?.content || '',
      lastEdited: (page as any).last_edited_time
    }));

    const statusCounts = projects.reduce((acc: any, project) => {
      acc[project.status] = (acc[project.status] || 0) + 1;
      return acc;
    }, {});

    const serviceTypeCounts = projects.reduce((acc: any, project) => {
      acc[project.serviceType] = (acc[project.serviceType] || 0) + 1;
      return acc;
    }, {});

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>프로젝트 관리 대시보드</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            body { 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                margin: 0; 
                padding: 20px; 
                background-color: #f5f5f5;
            }
            .container { max-width: 1400px; margin: 0 auto; }
            .header { 
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                color: white;
                padding: 30px; 
                border-radius: 10px; 
                margin-bottom: 20px;
            }
            .stats { 
                display: grid; 
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 20px; 
                margin: 20px 0; 
            }
            .stat-card { 
                background: white; 
                padding: 20px; 
                border-radius: 10px; 
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                text-align: center;
            }
            .section { 
                background: white; 
                padding: 20px; 
                border-radius: 10px; 
                margin: 20px 0;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .projects-table { 
                width: 100%; 
                border-collapse: collapse; 
                margin-top: 15px; 
            }
            .projects-table th, .projects-table td { 
                border: 1px solid #ddd; 
                padding: 12px 8px; 
                text-align: left; 
            }
            .projects-table th { 
                background-color: #667eea; 
                color: white;
                font-weight: 600;
            }
            .projects-table tr:nth-child(even) { background-color: #f9f9f9; }
            .projects-table tr:hover { background-color: #f0f0f0; }
            .status-badge {
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
                font-weight: bold;
            }
            .status-견적요청 { background: #e3f2fd; color: #1976d2; }
            .status-견적검토 { background: #fff3e0; color: #f57c00; }
            .status-견적승인 { background: #e8f5e8; color: #388e3c; }
            .status-완료 { background: #f3e5f5; color: #7b1fa2; }
            .btn { 
                background: #667eea; 
                color: white; 
                padding: 8px 16px; 
                border: none; 
                border-radius: 4px; 
                cursor: pointer; 
                text-decoration: none;
                font-size: 12px;
            }
            .test-section { background: #f8f9fa; padding: 15px; border-radius: 5px; margin-top: 20px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🚀 프로젝트 관리 대시보드</h1>
                <p>자연어 기반 프로젝트 생성 및 관리 시스템</p>
                <p><strong>마지막 업데이트:</strong> ${new Date().toLocaleString('ko-KR')}</p>
            </div>
            
            <div class="stats">
                <div class="stat-card">
                    <h3>총 프로젝트</h3>
                    <div style="font-size: 32px; font-weight: bold; color: #667eea;">${projects.length}개</div>
                </div>
                ${Object.entries(statusCounts).map(([status, count]) => `
                <div class="stat-card">
                    <h3>${status}</h3>
                    <div style="font-size: 24px; font-weight: bold; color: #667eea;">${count}개</div>
                </div>
                `).join('')}
            </div>

            <div class="section">
                <h2>📋 전체 프로젝트 목록</h2>
                <button class="btn" onclick="location.reload()">🔄 새로고침</button>
                
                <table class="projects-table">
                    <thead>
                        <tr>
                            <th>프로젝트명</th>
                            <th>서비스</th>
                            <th>상태</th>
                            <th>고객사</th>
                            <th>행사일정</th>
                            <th>수정일</th>
                            <th>액션</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${projects.map(project => `
                            <tr>
                                <td><strong>${project.projectName}</strong></td>
                                <td>${project.serviceType}</td>
                                <td><span class="status-badge status-${project.status.replace(/\s/g, '')}">${project.status}</span></td>
                                <td>${project.customer || '-'}</td>
                                <td>${project.eventDate || '-'}</td>
                                <td>${new Date(project.lastEdited).toLocaleDateString('ko-KR')}</td>
                                <td>
                                    <a href="https://www.notion.so/${project.pageId.replace(/-/g, '')}" 
                                       target="_blank" class="btn">Notion</a>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            <div class="test-section">
                <h3>🧪 테스트 도구</h3>
                <p>자연어 파싱 테스트:</p>
                <div style="margin: 10px 0;">
                    <input type="text" id="testText" placeholder="예: 강남 렌탈 수주했어" style="width: 300px; padding: 8px;">
                    <button onclick="testParsing()" class="btn">파싱 테스트</button>
                    <button onclick="createDemo()" class="btn" style="background: #4caf50;">데모 생성</button>
                </div>
                <div id="testResult" style="margin-top: 10px; padding: 10px; background: white; border-radius: 4px; display: none;"></div>
            </div>
        </div>

        <script>
            function testParsing() {
                const text = document.getElementById('testText').value;
                if (!text) {
                    alert('텍스트를 입력하세요.');
                    return;
                }

                fetch('/project/test-parsing', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text })
                })
                .then(response => response.json())
                .then(data => {
                    const resultDiv = document.getElementById('testResult');
                    resultDiv.style.display = 'block';
                    resultDiv.innerHTML = '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
                })
                .catch(error => {
                    alert('오류: ' + error.message);
                });
            }

            function createDemo() {
                const projectName = prompt('프로젝트명을 입력하세요:', '테스트 프로젝트');
                if (!projectName) return;

                fetch('/project/demo', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ projectName })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        alert('데모 프로젝트가 생성되었습니다!');
                        location.reload();
                    } else {
                        alert('생성 실패: ' + data.error);
                    }
                })
                .catch(error => {
                    alert('오류: ' + error.message);
                });
            }
        </script>
    </body>
    </html>
    `;
    
    res.send(html);
  } catch (error) {
    console.error('프로젝트 대시보드 생성 오류:', error);
    res.status(500).send('프로젝트 대시보드 로딩 중 오류가 발생했습니다.');
  }
});


export default app;