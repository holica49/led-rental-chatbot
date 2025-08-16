// src/routes/user-admin.ts (완전히 수정된 버전)
import express, { Request, Response } from 'express';
import { userService, CreateUserRequest } from '../models/user-model.js';

const router = express.Router();

/**
 * 전체 사용자 목록 조회
 * GET /api/users
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const users = await userService.getAllUsers();
    res.json({
      success: true,
      users,
      count: users.length
    });
  } catch (error) {
    console.error('사용자 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '사용자 목록 조회 중 오류가 발생했습니다.'
    });
  }
});

/**
 * LINE WORKS ID로 사용자 조회 (강제 새로고침 옵션)
 * GET /api/users/lineworks/:userId?refresh=true
 */
router.get('/lineworks/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const forceRefresh = req.query.refresh === 'true';
    
    console.log(`🔍 사용자 조회 요청: ${userId} (강제새로고침: ${forceRefresh})`);
    
    const user = await userService.getUserByLineWorksId(userId, forceRefresh);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      });
    }

    res.json({
      success: true,
      user,
      isRegistered: !user.id.startsWith('default-'),
      cacheStatus: forceRefresh ? 'refreshed' : 'cached'
    });
  } catch (error) {
    console.error('사용자 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '사용자 조회 중 오류가 발생했습니다.'
    });
  }
});

/**
 * 이메일로 사용자 조회
 * GET /api/users/email/:email
 */
router.get('/email/:email', async (req: Request, res: Response) => {
  try {
    const { email } = req.params;
    const user = await userService.getUserByEmail(email);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '사용자를 찾을 수 없습니다.'
      });
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('사용자 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '사용자 조회 중 오류가 발생했습니다.'
    });
  }
});

/**
 * 부서별 사용자 조회
 * GET /api/users/department/:department
 */
router.get('/department/:department', async (req: Request, res: Response) => {
  try {
    const { department } = req.params;
    const users = await userService.getUsersByDepartment(department);
    
    res.json({
      success: true,
      users,
      department,
      count: users.length
    });
  } catch (error) {
    console.error('부서별 사용자 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '부서별 사용자 조회 중 오류가 발생했습니다.'
    });
  }
});

/**
 * 이름으로 사용자 검색
 * GET /api/users/search?name=김대리
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { name } = req.query;
    
    if (!name || typeof name !== 'string') {
      return res.status(400).json({
        success: false,
        message: '검색할 이름을 입력해주세요.'
      });
    }

    const users = await userService.findUsersByName(name);
    
    res.json({
      success: true,
      users,
      searchTerm: name,
      count: users.length
    });
  } catch (error) {
    console.error('사용자 검색 오류:', error);
    res.status(500).json({
      success: false,
      message: '사용자 검색 중 오류가 발생했습니다.'
    });
  }
});

/**
 * 새 사용자 등록
 * POST /api/users
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userData: CreateUserRequest = req.body;
    
    // 필수 필드 검증
    const requiredFields = ['lineWorksUserId', 'email', 'name', 'department', 'position'];
    const missingFields = requiredFields.filter(field => !userData[field as keyof CreateUserRequest]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `필수 필드가 누락되었습니다: ${missingFields.join(', ')}`
      });
    }

    // 기존 사용자 확인 (강제 새로고침)
    const existingUser = await userService.getUserByLineWorksId(userData.lineWorksUserId, true);
    if (existingUser && !existingUser.id.startsWith('default-')) {
      return res.status(409).json({
        success: false,
        message: '이미 등록된 사용자입니다.',
        existingUser
      });
    }

    console.log('📝 새 사용자 등록 시작:', userData);
    
    const newUser = await userService.createUser(userData);
    
    if (!newUser) {
      return res.status(500).json({
        success: false,
        message: '사용자 등록에 실패했습니다.'
      });
    }

    // 등록 후 캐시 무효화
    userService.invalidateUserCache(userData.lineWorksUserId);

    res.status(201).json({
      success: true,
      message: '사용자가 성공적으로 등록되었습니다.',
      user: newUser
    });
  } catch (error) {
    console.error('사용자 등록 오류:', error);
    res.status(500).json({
      success: false,
      message: '사용자 등록 중 오류가 발생했습니다.'
    });
  }
});

/**
 * 사용자 정보 수정
 * PUT /api/users/:userId
 */
router.put('/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const updates: Partial<CreateUserRequest> = req.body;
    
    console.log('📝 사용자 정보 수정:', userId, updates);
    
    const success = await userService.updateUser(userId, updates);
    
    if (!success) {
      return res.status(500).json({
        success: false,
        message: '사용자 정보 수정에 실패했습니다.'
      });
    }

    // 수정 후 전체 캐시 무효화
    userService.invalidateUserCache();

    res.json({
      success: true,
      message: '사용자 정보가 성공적으로 수정되었습니다.'
    });
  } catch (error) {
    console.error('사용자 수정 오류:', error);
    res.status(500).json({
      success: false,
      message: '사용자 정보 수정 중 오류가 발생했습니다.'
    });
  }
});

/**
 * 참석자 이메일 생성
 * POST /api/users/generate-email
 */
router.post('/generate-email', async (req: Request, res: Response) => {
  try {
    const { attendeeName } = req.body;
    
    if (!attendeeName) {
      return res.status(400).json({
        success: false,
        message: '참석자 이름이 필요합니다.'
      });
    }

    const email = await userService.generateEmailForAttendee(attendeeName);
    
    res.json({
      success: true,
      attendeeName,
      email
    });
  } catch (error) {
    console.error('이메일 생성 오류:', error);
    res.status(500).json({
      success: false,
      message: '이메일 생성 중 오류가 발생했습니다.'
    });
  }
});

/**
 * 캐시 무효화
 * POST /api/users/invalidate-cache
 */
router.post('/invalidate-cache', async (req: Request, res: Response) => {
  try {
    const { lineWorksUserId } = req.body;
    
    userService.invalidateUserCache(lineWorksUserId);
    
    res.json({
      success: true,
      message: lineWorksUserId 
        ? `사용자 ${lineWorksUserId}의 캐시가 삭제되었습니다.`
        : '전체 사용자 캐시가 삭제되었습니다.'
    });
  } catch (error) {
    console.error('캐시 무효화 오류:', error);
    res.status(500).json({
      success: false,
      message: '캐시 무효화 중 오류가 발생했습니다.'
    });
  }
});

/**
 * 사용자 관리 대시보드 (개선된 HTML)
 * GET /api/users/dashboard
 */
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const users = await userService.getAllUsers();
    const departments = [...new Set(users.map(u => u.department))];
    const registeredUsers = users.filter(u => !u.id.startsWith('default-'));
    const defaultUsers = users.filter(u => u.id.startsWith('default-'));
    
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>사용자 관리 대시보드</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            body { 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                margin: 0; 
                padding: 20px; 
                background-color: #f5f5f5;
            }
            .container { max-width: 1200px; margin: 0 auto; }
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
            .stat-card h3 { margin: 0 0 10px 0; color: #333; }
            .stat-card .number { font-size: 32px; font-weight: bold; color: #667eea; }
            .section { 
                background: white; 
                padding: 20px; 
                border-radius: 10px; 
                margin: 20px 0;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .users-table { 
                width: 100%; 
                border-collapse: collapse; 
                margin-top: 15px; 
            }
            .users-table th, .users-table td { 
                border: 1px solid #ddd; 
                padding: 12px 8px; 
                text-align: left; 
            }
            .users-table th { 
                background-color: #667eea; 
                color: white;
                font-weight: 600;
            }
            .users-table tr:nth-child(even) { background-color: #f9f9f9; }
            .users-table tr:hover { background-color: #f0f0f0; }
            .btn { 
                background: #667eea; 
                color: white; 
                padding: 12px 24px; 
                border: none; 
                border-radius: 5px; 
                cursor: pointer; 
                text-decoration: none;
                display: inline-block;
                margin: 5px;
            }
            .btn:hover { background: #5a6fd8; }
            .btn-danger { background: #e74c3c; }
            .btn-danger:hover { background: #c0392b; }
            .status-registered { color: #27ae60; font-weight: bold; }
            .status-unregistered { color: #e74c3c; font-weight: bold; }
            .api-section { background: #f8f9fa; padding: 15px; border-radius: 5px; }
            .code { background: #2d3748; color: #f7fafc; padding: 15px; border-radius: 5px; font-family: monospace; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🧑‍💼 LED 렌탈 사용자 관리</h1>
                <p>LINE WORKS 연동 사용자 현황 및 관리</p>
                <p><strong>마지막 업데이트:</strong> ${new Date().toLocaleString('ko-KR')}</p>
            </div>
            
            <div class="stats">
                <div class="stat-card">
                    <h3>총 사용자</h3>
                    <div class="number">${users.length}명</div>
                </div>
                <div class="stat-card">
                    <h3>등록된 사용자</h3>
                    <div class="number">${registeredUsers.length}명</div>
                </div>
                <div class="stat-card">
                    <h3>미등록 사용자</h3>
                    <div class="number">${defaultUsers.length}명</div>
                </div>
                <div class="stat-card">
                    <h3>부서 수</h3>
                    <div class="number">${departments.length}개</div>
                </div>
            </div>

            <div class="section">
                <h2>📋 등록된 사용자 목록</h2>
                <button class="btn" onclick="location.reload()">🔄 새로고침</button>
                <button class="btn btn-danger" onclick="invalidateCache()">🗑️ 캐시 삭제</button>
                
                <table class="users-table">
                    <thead>
                        <tr>
                            <th>이름</th>
                            <th>이메일</th>
                            <th>부서</th>
                            <th>직급</th>
                            <th>LINE WORKS ID</th>
                            <th>상태</th>
                            <th>등록일</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${registeredUsers.map(user => `
                            <tr>
                                <td>${user.name}</td>
                                <td>${user.email}</td>
                                <td>${user.department}</td>
                                <td>${user.position}</td>
                                <td><code>${user.lineWorksUserId}</code></td>
                                <td><span class="status-registered">✅ 등록됨</span></td>
                                <td>${user.createdAt ? new Date(user.createdAt).toLocaleDateString('ko-KR') : '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            ${defaultUsers.length > 0 ? `
            <div class="section">
                <h2>⚠️ 미등록 사용자 목록</h2>
                <p>이 사용자들은 LINE WORKS에서 봇을 사용했지만 아직 등록되지 않았습니다.</p>
                
                <table class="users-table">
                    <thead>
                        <tr>
                            <th>LINE WORKS ID</th>
                            <th>임시 이름</th>
                            <th>임시 이메일</th>
                            <th>상태</th>
                            <th>액션</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${defaultUsers.map(user => `
                            <tr>
                                <td><code>${user.lineWorksUserId}</code></td>
                                <td>${user.name}</td>
                                <td>${user.email}</td>
                                <td><span class="status-unregistered">❌ 미등록</span></td>
                                <td>
                                    <button class="btn" onclick="registerUser('${user.lineWorksUserId}', '${user.name}')">등록</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            ` : ''}

            <div class="section">
                <h2>🔧 API 엔드포인트</h2>
                <div class="api-section">
                    <h3>사용자 조회</h3>
                    <ul>
                        <li><strong>GET</strong> /api/users - 전체 사용자 목록</li>
                        <li><strong>GET</strong> /api/users/lineworks/:userId?refresh=true - LINE WORKS ID로 조회 (강제새로고침)</li>
                        <li><strong>GET</strong> /api/users/search?name=이름 - 이름으로 검색</li>
                        <li><strong>GET</strong> /api/users/department/:department - 부서별 조회</li>
                    </ul>
                    
                    <h3>사용자 관리</h3>
                    <ul>
                        <li><strong>POST</strong> /api/users - 새 사용자 등록</li>
                        <li><strong>PUT</strong> /api/users/:userId - 사용자 정보 수정</li>
                        <li><strong>POST</strong> /api/users/invalidate-cache - 캐시 무효화</li>
                    </ul>
                    
                    <h3>사용자 등록 예시</h3>
                    <div class="code">
POST /api/users
{
  "lineWorksUserId": "user-id-here",
  "email": "user@anyractive.co.kr",
  "name": "홍길동",
  "department": "개발팀",
  "position": "대리"
}
                    </div>
                </div>
            </div>
        </div>

        <script>
            function invalidateCache() {
                if (confirm('전체 사용자 캐시를 삭제하시겠습니까?')) {
                    fetch('/api/users/invalidate-cache', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                    })
                    .then(response => response.json())
                    .then(data => {
                        alert(data.message);
                        location.reload();
                    })
                    .catch(error => {
                        alert('오류가 발생했습니다: ' + error.message);
                    });
                }
            }

            function registerUser(lineWorksUserId, defaultName) {
                const name = prompt('사용자 이름을 입력하세요:', defaultName);
                if (!name) return;
                
                const email = prompt('이메일을 입력하세요:', name + '@anyractive.co.kr');
                if (!email) return;
                
                const department = prompt('부서를 입력하세요:', '개발팀');
                if (!department) return;
                
                const position = prompt('직급을 입력하세요:', '사원');
                if (!position) return;

                fetch('/api/users', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        lineWorksUserId,
                        name,
                        email,
                        department,
                        position
                    })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        alert('사용자가 성공적으로 등록되었습니다!');
                        location.reload();
                    } else {
                        alert('등록 실패: ' + data.message);
                    }
                })
                .catch(error => {
                    alert('오류가 발생했습니다: ' + error.message);
                });
            }
        </script>
    </body>
    </html>
    `;
    
    res.send(html);
  } catch (error) {
    console.error('대시보드 생성 오류:', error);
    res.status(500).send('대시보드 로딩 중 오류가 발생했습니다.');
  }
});

export default router;