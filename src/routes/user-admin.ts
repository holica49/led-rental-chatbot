// src/routes/user-admin.ts (사용자 관리 API)
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
 * LINE WORKS ID로 사용자 조회
 * GET /api/users/lineworks/:userId
 */
router.get('/lineworks/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const user = await userService.getUserByLineWorksId(userId);
    
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

    // 기존 사용자 확인
    const existingUser = await userService.getUserByLineWorksId(userData.lineWorksUserId);
    if (existingUser && existingUser.id !== `default-${userData.lineWorksUserId}`) {
      return res.status(409).json({
        success: false,
        message: '이미 등록된 사용자입니다.'
      });
    }

    const newUser = await userService.createUser(userData);
    
    if (!newUser) {
      return res.status(500).json({
        success: false,
        message: '사용자 등록에 실패했습니다.'
      });
    }

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
    
    const success = await userService.updateUser(userId, updates);
    
    if (!success) {
      return res.status(500).json({
        success: false,
        message: '사용자 정보 수정에 실패했습니다.'
      });
    }

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
 * 사용자 관리 대시보드 (간단한 HTML)
 * GET /api/users/dashboard
 */
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const users = await userService.getAllUsers();
    const departments = [...new Set(users.map(u => u.department))];
    
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>사용자 관리 대시보드</title>
        <meta charset="utf-8">
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { background: #f0f0f0; padding: 20px; border-radius: 5px; }
            .stats { display: flex; gap: 20px; margin: 20px 0; }
            .stat-card { background: #e8f4fd; padding: 15px; border-radius: 5px; }
            .users-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            .users-table th, .users-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            .users-table th { background-color: #f2f2f2; }
            .add-user { background: #4CAF50; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>🧑‍💼 LED 렌탈 사용자 관리</h1>
            <p>LINE WORKS 연동 사용자 현황</p>
        </div>
        
        <div class="stats">
            <div class="stat-card">
                <h3>총 사용자</h3>
                <p style="font-size: 24px; margin: 0;">${users.length}명</p>
            </div>
            <div class="stat-card">
                <h3>부서 수</h3>
                <p style="font-size: 24px; margin: 0;">${departments.length}개</p>
            </div>
            <div class="stat-card">
                <h3>활성 사용자</h3>
                <p style="font-size: 24px; margin: 0;">${users.filter(u => u.isActive).length}명</p>
            </div>
        </div>

        <h2>📋 사용자 목록</h2>
        <table class="users-table">
            <thead>
                <tr>
                    <th>이름</th>
                    <th>이메일</th>
                    <th>부서</th>
                    <th>직급</th>
                    <th>LINE WORKS ID</th>
                    <th>상태</th>
                </tr>
            </thead>
            <tbody>
                ${users.map(user => `
                    <tr>
                        <td>${user.name}</td>
                        <td>${user.email}</td>
                        <td>${user.department}</td>
                        <td>${user.position}</td>
                        <td>${user.lineWorksUserId}</td>
                        <td>${user.isActive ? '✅ 활성' : '❌ 비활성'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <h2>🔧 API 엔드포인트</h2>
        <ul>
            <li><strong>GET</strong> /api/users - 전체 사용자 목록</li>
            <li><strong>GET</strong> /api/users/lineworks/:userId - LINE WORKS ID로 조회</li>
            <li><strong>GET</strong> /api/users/search?name=이름 - 이름으로 검색</li>
            <li><strong>POST</strong> /api/users - 새 사용자 등록</li>
            <li><strong>POST</strong> /api/users/generate-email - 참석자 이메일 생성</li>
        </ul>
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