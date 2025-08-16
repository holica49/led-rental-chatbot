// src/tools/lineworks-bot.ts (default export 추가)
import express, { Request, Response } from 'express';
import { Client } from '@notionhq/client';

const router = express.Router();

// LINE WORKS Auth는 첫 요청 시 초기화
let auth: any = null;

// 🆕 프로젝트 관리 서비스
let projectService: any = null;

// 🆕 대화 컨텍스트 저장 (메모리 기반, 실제로는 Redis 권장)
const conversationContext = new Map<string, {
  type: 'PROJECT_CONFIRMATION' | 'PROJECT_UPDATE',
  data: any,
  timestamp: number
}>();

async function getAuth() {
  if (!auth) {
    const { LineWorksAuth } = await import('../config/lineworks-auth.js');
    auth = new LineWorksAuth();
  }
  return auth;
}

async function getProjectService() {
  if (!projectService) {
    const { ProjectManagementService } = await import('./services/project-management-service.js');
    projectService = new ProjectManagementService();
  }
  return projectService;
}

// Notion 클라이언트 초기화
const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

const databaseId = process.env.NOTION_DATABASE_ID!;

// Webhook 메시지 타입
interface LineWorksMessage {
  type: string;
  source: {
    userId: string;
    domainId: string;
  };
  issuedTime: string;
  content?: {
    type: string;
    text?: string;
    postback?: string;
  };
}

// MCP 직접 호출 함수 (기존)
async function callMCPDirect(toolName: string, args: Record<string, unknown>): Promise<any> {
  try {
    console.log('📞 고도화된 MCP 직접 호출:', toolName, args);
    
    const { LineWorksCalendarService } = await import('./services/lineworks-calendar-service.js');
    const calendarService = new LineWorksCalendarService();
    
    if (toolName === 'lineworks_calendar') {
      if (args.action === 'create') {
        if (!args.text) {
          throw new Error('일정 내용(text)이 필요합니다.');
        }
        return calendarService.createCalendarEvent({
          userId: args.userId as string,
          text: args.text as string,
          userEmail: args.userEmail as string | undefined
        });
      } else if (args.action === 'get') {
        return calendarService.getEvents({
          userId: args.userId as string,
          userEmail: args.userEmail as string | undefined,
          range: (args.range as 'today' | 'week') || 'week'
        });
      } else {
        throw new Error('지원되지 않는 액션입니다.');
      }
    } else {
      throw new Error(`지원되지 않는 도구: ${toolName}`);
    }
    
  } catch (error) {
    console.error('❌ 고도화된 MCP 직접 호출 오류:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// 메시지 전송 헬퍼
async function sendTextMessage(userId: string, text: string) {
  try {
    const authInstance = await getAuth();
    await authInstance.sendMessage(userId, {
      type: 'text',
      text: text
    });
  } catch (error) {
    console.error('메시지 전송 실패:', error);
  }
}

// 프로젝트 현황 조회 (기존)
async function getProjectStatus(projectName: string): Promise<string> {
  try {
    const response = await notion.databases.query({
      database_id: databaseId,
      filter: {
        property: '행사명',
        title: {
          contains: projectName
        }
      }
    });
    
    if (response.results.length === 0) {
      return `"${projectName}" 프로젝트를 찾을 수 없습니다.`;
    }
    
    const project: any = response.results[0];
    const status = project.properties['행사 상태']?.status?.name || '상태 없음';
    const customer = project.properties['고객사']?.select?.name || '미정';
    const eventDate = project.properties['행사 일정']?.rich_text?.[0]?.text?.content || '일정 미정';
    
    return `📊 ${projectName} 현황\n` +
           `상태: ${status}\n` +
           `고객사: ${customer}\n` +
           `일정: ${eventDate}`;
  } catch (error) {
    console.error('프로젝트 조회 오류:', error);
    return '프로젝트 조회 중 오류가 발생했습니다.';
  }
}

// 일정 조회 (기존)
async function getSchedule(dateRange: string): Promise<string> {
  try {
    const today = new Date();
    const response = await notion.databases.query({
      database_id: databaseId,
      sorts: [
        {
          property: '행사 일정',
          direction: 'ascending'
        }
      ]
    });
    
    let filtered = response.results;
    
    if (dateRange === '오늘') {
      filtered = response.results.filter((p: any) => {
        const eventDate = p.properties['행사 일정']?.rich_text?.[0]?.text?.content;
        return eventDate && eventDate.includes(today.toISOString().split('T')[0]);
      });
    } else if (dateRange === '이번주') {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      
      filtered = response.results.filter((p: any) => {
        const eventDate = p.properties['행사 일정']?.rich_text?.[0]?.text?.content;
        if (!eventDate) return false;
        return true;
      });
    }
    
    if (filtered.length === 0) {
      return `${dateRange} 예정된 일정이 없습니다.`;
    }
    
    let message = `📅 ${dateRange} 일정:\n\n`;
    filtered.forEach((p: any) => {
      const name = p.properties['행사명']?.title?.[0]?.text?.content || '제목 없음';
      const date = p.properties['행사 일정']?.rich_text?.[0]?.text?.content || '일정 미정';
      const status = p.properties['행사 상태']?.status?.name || '상태 없음';
      message += `• ${name}\n  ${date} (${status})\n\n`;
    });
    
    return message;
  } catch (error) {
    console.error('일정 조회 오류:', error);
    return '일정 조회 중 오류가 발생했습니다.';
  }
}

// 🆕 프로젝트 관리 의도 감지
function isProjectManagementIntent(text: string): { 
  isProject: boolean; 
  isCreation: boolean; 
  isUpdate: boolean; 
} {
  const creationPatterns = [
    /(수주|따냄|맡기|맡아|시작|진행|들어왔).*(?:했어|됐어|완료)/,
    /(?:렌탈|설치|구축|멤버쉽).*(?:수주|따냄|맡기)/,
    /(?:프로젝트|건).*(?:새로|시작|맡아)/
  ];

  const updatePatterns = [
    /(?:견적|상태|일정|고객).*(?:변경|수정|업데이트|완료|추가)/,
    /(?:LED|크기|수량).*(?:변경|수정|바꿔)/,
    /(?:특이사항|메모|참고).*(?:추가|변경)/
  ];

  const isCreation = creationPatterns.some(pattern => pattern.test(text));
  const isUpdate = updatePatterns.some(pattern => pattern.test(text));
  const isProject = isCreation || isUpdate;

  return { isProject, isCreation, isUpdate };
}

// 🆕 대화 컨텍스트 정리 (5분 후 만료)
function cleanupContext() {
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  for (const [userId, context] of conversationContext.entries()) {
    if (context.timestamp < fiveMinutesAgo) {
      conversationContext.delete(userId);
    }
  }
}

// Webhook 처리 (프로젝트 관리 기능 추가)
router.post('/callback', async (req: Request, res: Response) => {
  try {
    console.log('LINE WORKS Webhook 수신:', JSON.stringify(req.body, null, 2));
    
    const message = req.body as LineWorksMessage;
    
    // 텍스트 메시지 처리
    if (message.content?.type === 'text' && message.content.text) {
      const userId = message.source.userId;
      const text = message.content.text;
      const lowerText = text.toLowerCase();
      
      let responseText = '';

      // 대화 컨텍스트 정리
      cleanupContext();

      // 기존 컨텍스트 확인
      const context = conversationContext.get(userId);

      // 🆕 컨텍스트 기반 응답 처리
      if (context && context.type === 'PROJECT_CONFIRMATION') {
        if (lowerText.includes('생성') || lowerText.includes('확인') || lowerText.includes('네') || lowerText.includes('예')) {
          // 프로젝트 생성 확정
          try {
            const projectMgmt = await getProjectService();
            const result = await projectMgmt.confirmProjectCreation(context.data, userId);
            
            responseText = result.message;
            conversationContext.delete(userId);  // 컨텍스트 정리
            
          } catch (error) {
            console.error('❌ 프로젝트 생성 확정 오류:', error);
            responseText = '프로젝트 생성 중 오류가 발생했습니다.';
            conversationContext.delete(userId);
          }
        } else if (lowerText.includes('취소') || lowerText.includes('아니') || lowerText.includes('안해')) {
          responseText = '❌ 프로젝트 생성이 취소되었습니다.';
          conversationContext.delete(userId);
        } else {
          responseText = '✅ "생성" 또는 "확인"을 입력하면 프로젝트가 생성됩니다.\n❌ "취소"를 입력하면 취소됩니다.';
        }
      }
      // 🆕 프로젝트 관리 명령어 처리
      else {
        const projectIntent = isProjectManagementIntent(text);
        
        if (projectIntent.isProject) {
          try {
            const projectMgmt = await getProjectService();
            
            if (projectIntent.isCreation) {
              console.log('🆕 프로젝트 생성 요청 감지');
              
              const result = await projectMgmt.createProjectFromNLP(text, userId);
              
              if (result.needsConfirmation) {
                // 확인이 필요한 경우 컨텍스트 저장
                conversationContext.set(userId, {
                  type: 'PROJECT_CONFIRMATION',
                  data: result.parsedInfo,
                  timestamp: Date.now()
                });
              }
              
              responseText = result.message;
              
            } else if (projectIntent.isUpdate) {
              console.log('📝 프로젝트 업데이트 요청 감지');
              
              const result = await projectMgmt.updateProjectFromNLP(text, userId);
              responseText = result.message;
            }
            
          } catch (error) {
            console.error('❌ 프로젝트 관리 오류:', error);
            responseText = '프로젝트 처리 중 오류가 발생했습니다.';
          }
        }
        // 기존 기능들
        else if (lowerText.includes('안녕') || lowerText.includes('하이') || lowerText.includes('도움말')) {
          responseText = '안녕하세요! LED 렌탈 업무봇입니다.\n\n' +
                        '다음과 같은 기능을 사용할 수 있습니다:\n' +
                        '📊 프로젝트 조회: "강남LED 현황"\n' +
                        '📅 일정 조회: "오늘 일정", "이번주 일정"\n' +
                        '📦 재고 확인: "재고 현황"\n' +
                        '📝 스마트 일정 등록: "8월 19일 오후 5시에 강남 코엑스에서 메쎄이상 회의"\n' +
                        '👤 사용자 정보: "내 정보", "정보 갱신"\n' +
                        '📋 사용자 목록: "사용자 목록" (관리자용)\n' +
                        '📱 내 캘린더: "내 일정"\n\n' +
                        '🆕 프로젝트 관리:\n' +
                        '• 프로젝트 생성: "강남 렌탈 수주했어", "청주오스코 구축 맡기로 했어"\n' +
                        '• 프로젝트 업데이트: "강남 렌탈 견적 완료했어", "청주오스코 LED 크기 변경"';
        }
        // 사용자 정보 조회/갱신 (기존)
        else if (lowerText.includes('내 정보') || lowerText.includes('사용자 정보') || lowerText.includes('정보 갱신') || lowerText.includes('프로필')) {
          try {
            console.log('👤 사용자 정보 조회/갱신 요청');
            
            const { userService } = await import('../models/user-model.js');
            const userProfile = await userService.getUserByLineWorksId(userId, true);
            
            if (userProfile && !userProfile.id.startsWith('default-')) {
              responseText = '👤 사용자 정보 (최신):\n\n' +
                            `이름: ${userProfile.name}\n` +
                            `부서: ${userProfile.department}\n` +
                            `직급: ${userProfile.position}\n` +
                            `이메일: ${userProfile.email}\n` +
                            `상태: ${userProfile.isActive ? '✅ 활성' : '❌ 비활성'}\n` +
                            `등록일: ${userProfile.createdAt}\n\n` +
                            `💡 정보가 틀렸다면 관리자에게 문의하세요.`;
            } else {
              responseText = '❌ 미등록 사용자입니다.\n\n' +
                            `LINE WORKS ID: ${userId}\n\n` +
                            `📝 사용자 등록이 필요합니다:\n` +
                            `1. 관리자에게 사용자 등록 요청\n` +
                            `2. 또는 직접 등록: ${process.env.APP_URL || 'https://web-production-fa47.up.railway.app'}/api/users/dashboard\n\n` +
                            `등록 후 "정보 갱신" 명령어로 다시 확인하세요.`;
            }
            
            userService.invalidateUserCache(userId);
            
          } catch (error) {
            console.error('❌ 사용자 정보 조회 오류:', error);
            responseText = '사용자 정보 조회 중 오류가 발생했습니다.';
          }
        }
        // 사용자 목록 조회 (기존)
        else if (lowerText.includes('사용자 목록') || lowerText.includes('전체 사용자')) {
          try {
            const { userService } = await import('../models/user-model.js');
            const allUsers = await userService.getAllUsers();
            
            if (allUsers.length === 0) {
              responseText = '📋 등록된 사용자가 없습니다.';
            } else {
              responseText = `📋 등록된 사용자 목록 (${allUsers.length}명):\n\n`;
              
              const usersByDept = allUsers.reduce((acc: any, user) => {
                if (!acc[user.department]) acc[user.department] = [];
                acc[user.department].push(user);
                return acc;
              }, {});
              
              for (const [dept, users] of Object.entries(usersByDept)) {
                responseText += `【${dept}】\n`;
                (users as any[]).forEach(user => {
                  responseText += `  • ${user.name}${user.position} (${user.email})\n`;
                });
                responseText += '\n';
              }
              
              responseText += `💻 웹 대시보드: ${process.env.APP_URL || 'https://web-production-fa47.up.railway.app'}/api/users/dashboard`;
            }
          } catch (error) {
            console.error('❌ 사용자 목록 조회 오류:', error);
            responseText = '사용자 목록 조회 중 오류가 발생했습니다.';
          }
        }
        // 고도화된 일정 등록 - MCP 호출 (기존)
        else if (
          (text.includes('일정') && (text.includes('등록') || text.includes('추가'))) ||
          (text.includes('시') && (text.includes('오늘') || text.includes('내일') || text.includes('모레') || text.includes('다음') || text.includes('월') && text.includes('일'))) ||
          (text.includes('요일') && text.includes('시')) ||
          /\d{1,2}\s*월\s*\d{1,2}\s*일/.test(text) ||
          /\d{4}[-\/]\d{1,2}[-\/]\d{1,2}/.test(text) ||
          text.includes('회의') || text.includes('미팅') || text.includes('만남') ||
          text.includes('약속') || text.includes('면담')
        ) {
          try {
            console.log('📅 고도화된 MCP를 통한 캘린더 일정 등록 시작');
            
            const { userService } = await import('../models/user-model.js');
            const userProfile = await userService.getUserByLineWorksId(userId, true);
            
            let notionSuccess = false;
            
            const { parseCalendarText } = await import('../utils/nlp-calendar-parser.js');
            const parsed = parseCalendarText(text);
            
            if (parsed) {
              try {
                await notion.pages.create({
                  parent: { database_id: databaseId },
                  properties: {
                    '행사명': {
                      title: [{
                        text: { content: `[일정] ${parsed.title}` }
                      }]
                    },
                    '행사 일정': {
                      rich_text: [{
                        text: { content: `${parsed.date} ${parsed.time}` }
                      }]
                    },
                    '서비스 유형': {
                      select: { name: '일정' }
                    },
                    '행사 상태': {
                      status: { name: '견적 요청' }
                    },
                    '문의요청 사항': {
                      rich_text: [{
                        text: { content: `LINE WORKS에서 등록 (${userProfile?.name || userId}): ${text}` }
                      }]
                    }
                  }
                });
                notionSuccess = true;
                console.log('✅ Notion 저장 성공');
              } catch (error) {
                console.error('❌ Notion 저장 실패:', error);
              }
            }
            
            const mcpResult = await callMCPDirect('lineworks_calendar', {
              action: 'create',
              userId: userId,
              text: text
            });
            
            console.log('📅 고도화된 MCP 캘린더 결과:', mcpResult);
            
            if (mcpResult.success) {
              responseText = mcpResult.message + 
                            `\n\n💾 저장 위치:\n` +
                            `• Notion: ${notionSuccess ? '✅ 성공' : '❌ 실패'}\n` +
                            `• LINE WORKS 캘린더: ✅ 성공`;
              
              if (userProfile && !userProfile.id.startsWith('default-')) {
                responseText += `\n\n👤 등록자: ${userProfile.department} ${userProfile.name}${userProfile.position}`;
              } else {
                responseText += `\n\n⚠️ 미등록 사용자입니다. "내 정보" 명령어로 사용자 등록을 확인하세요.`;
              }
              
              if (mcpResult.parsedInfo?.confidence && mcpResult.parsedInfo.confidence < 0.7) {
                responseText += `\n\n⚠️ 파싱 신뢰도가 ${Math.round(mcpResult.parsedInfo.confidence * 100)}%입니다. 일정을 확인해주세요.`;
              }
            } else {
              responseText = `🤖 스마트 일정 등록 결과:\n\n` +
                            `• Notion: ${notionSuccess ? '✅ 성공' : '❌ 실패'}\n` +
                            `• LINE WORKS 캘린더: ❌ 실패\n\n` +
                            `오류: ${mcpResult.message}`;
              
              if (userProfile && !userProfile.id.startsWith('default-')) {
                responseText += `\n\n👤 시도한 사용자: ${userProfile.department} ${userProfile.name}${userProfile.position}`;
              }
            }
            
          } catch (error) {
            console.error('❌ 고도화된 일정 등록 전체 오류:', error);
            responseText = '일정 등록 중 오류가 발생했습니다. 다시 시도해주세요.\n\n💡 예시: "8월 19일 오후 5시에 강남 코엑스에서 메쎄이상 회의"';
          }
        }
        // 내 캘린더 조회 - 고도화된 MCP 호출 (기존)
        else if (text.includes('내 일정') || text.includes('내일정') || text.includes('캘린더')) {
          try {
            const mcpResult = await callMCPDirect('lineworks_calendar', {
              action: 'get',
              userId: userId,
              range: 'week'
            });
            
            if (mcpResult.success && mcpResult.events.length > 0) {
              responseText = '📅 이번 주 일정:\n\n';
              
              if (mcpResult.user) {
                responseText += `👤 ${mcpResult.user.department} ${mcpResult.user.name}${mcpResult.user.position}\n\n`;
              }
              
              mcpResult.events.forEach((event: any) => {
                if (event.displaySummary) {
                  responseText += `${event.displaySummary}\n`;
                } else {
                  const start = new Date(event.startDateTime || event.start?.dateTime);
                  const dateStr = start.toLocaleDateString('ko-KR');
                  const timeStr = start.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
                  responseText += `• ${dateStr} ${timeStr} - ${event.summary}\n`;
                }
                
                if (event.location) {
                  responseText += `  📍 ${event.location}\n`;
                }
                
                responseText += '\n';
              });
            } else {
              responseText = '이번 주 등록된 일정이 없습니다.';
            }
          } catch (error) {
            console.error('❌ 고도화된 캘린더 조회 오류:', error);
            responseText = '캘린더 조회 중 오류가 발생했습니다.';
          }
        }
        // 기존 기능들
        else if (lowerText.includes('현황') && !lowerText.includes('재고')) {
          const projectName = text.replace(/현황|프로젝트|조회/g, '').trim();
          if (projectName) {
            responseText = await getProjectStatus(projectName);
          } else {
            responseText = '프로젝트명을 입력해주세요. (예: "강남LED 현황")';
          }
        }
        else if (lowerText.includes('일정') && !text.includes('등록') && !text.includes('내')) {
          if (lowerText.includes('오늘')) {
            responseText = await getSchedule('오늘');
          } else if (lowerText.includes('이번주')) {
            responseText = await getSchedule('이번주');
          } else {
            responseText = '일정 조회 기간을 지정해주세요. (예: "오늘 일정", "이번주 일정")';
          }
        }
        else if (lowerText.includes('재고')) {
          responseText = '📦 LED 재고 현황:\n\n' +
                        '• P2.5: 320개 (재고 충분)\n' +
                        '• P3.0: 150개 (재고 보통)\n' +
                        '• P4.0: 80개 (재고 부족)\n' +
                        '• P5.0: 200개 (재고 충분)';
        }
        else {
          responseText = '이해하지 못했습니다. 다음과 같이 말씀해주세요:\n\n' +
                        '• 프로젝트 조회: "강남LED 현황"\n' +
                        '• 일정 조회: "오늘 일정"\n' +
                        '• 재고 확인: "재고 현황"\n' +
                        '• 스마트 일정 등록: "8월 19일 오후 5시에 강남 코엑스에서 메쎄이상 회의"\n' +
                        '• 사용자 정보: "내 정보", "정보 갱신"\n' +
                        '• 내 캘린더: "내 일정"\n\n' +
                        '🆕 프로젝트 관리:\n' +
                        '• 프로젝트 생성: "강남 렌탈 수주했어"\n' +
                        '• 프로젝트 업데이트: "강남 렌탈 견적 완료했어"\n\n' +
                        '💡 "도움말"을 입력하면 전체 기능을 확인할 수 있습니다.';
        }
      }
      
      // 응답 전송
      await sendTextMessage(userId, responseText);
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook 처리 오류:', error);
    res.status(500).send('Error');
  }
});

// 메시지 전송 테스트 엔드포인트
router.post('/send-test', async (req: Request, res: Response) => {
  try {
    const { userId, message } = req.body;
    
    if (!userId || !message) {
      return res.status(400).json({ error: 'userId와 message가 필요합니다.' });
    }
    
    await sendTextMessage(userId, message);
    res.json({ success: true });
  } catch (error) {
    console.error('메시지 전송 오류:', error);
    res.status(500).json({ error: '메시지 전송 실패' });
  }
});

// 🆕 프로젝트 관리 테스트 엔드포인트
router.post('/test-project', async (req: Request, res: Response) => {
  try {
    const { userId, text, action } = req.body;
    
    if (!userId || !text) {
      return res.status(400).json({ 
        error: 'userId와 text가 필요합니다.',
        example: {
          userId: 'user123',
          text: '강남 렌탈 수주했어',
          action: 'create' // 또는 'update'
        }
      });
    }
    
    const projectMgmt = await getProjectService();
    let result;
    
    if (action === 'create') {
      result = await projectMgmt.createProjectFromNLP(text, userId);
    } else if (action === 'update') {
      result = await projectMgmt.updateProjectFromNLP(text, userId);
    } else {
      // 자동 감지
      const projectIntent = isProjectManagementIntent(text);
      if (projectIntent.isCreation) {
        result = await projectMgmt.createProjectFromNLP(text, userId);
      } else if (projectIntent.isUpdate) {
        result = await projectMgmt.updateProjectFromNLP(text, userId);
      } else {
        return res.json({
          success: false,
          message: '프로젝트 관리 의도를 감지할 수 없습니다.',
          intent: projectIntent
        });
      }
    }
    
    res.json({
      success: true,
      result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('프로젝트 테스트 오류:', error);
    res.status(500).json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// default export 추가
export default router;