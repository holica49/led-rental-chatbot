import express, { Request, Response } from 'express';
import { Client } from '@notionhq/client';
import { getMCPClient } from './mcp-client.js';
import { getConversationManager } from './interactive-conversation.js';

const router = express.Router();
const conversationManager = getConversationManager();

// LINE WORKS Auth는 첫 요청 시 초기화
let auth: any = null;

async function getAuth() {
  if (!auth) {
    const { LineWorksAuth } = await import('../config/lineworks-auth.js');
    auth = new LineWorksAuth();
  }
  return auth;
}

// Notion 클라이언트 초기화 (기존 기능용)
const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

const databaseId = process.env.NOTION_DATABASE_ID!;

// MCP 클라이언트 가져오기
const mcpClient = getMCPClient();

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

// 🆕 Claude MCP를 통한 프로젝트 관리 호출
async function callClaudeMCP(toolName: string, args: Record<string, unknown>): Promise<any> {
  try {
    console.log('🚀 Claude MCP 호출:', toolName, args);
    
    const response = await mcpClient.callTool({
      tool: toolName,
      arguments: args
    });
    
    if (!response.success) {
      console.error('❌ Claude MCP 오류:', response.error);
      return {
        success: false,
        message: response.error || 'MCP 요청이 실패했습니다.'
      };
    }
    
    // MCP 응답에서 실제 결과 추출
    const result = response.result?.content?.[0]?.text;
    if (result) {
      try {
        // JSON 문자열인 경우 파싱
        const parsedResult = JSON.parse(result);
        console.log('✅ Claude MCP 성공:', parsedResult);
        return parsedResult;
      } catch {
        // 일반 텍스트인 경우 그대로 반환
        console.log('✅ Claude MCP 텍스트 응답:', result);
        return {
          success: true,
          message: result
        };
      }
    }
    
    console.log('✅ Claude MCP 원시 응답:', response.result);
    return response.result;
    
  } catch (error) {
    console.error('❌ Claude MCP 호출 오류:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// 캘린더 MCP 호출 (기존 유지)
async function callCalendarMCP(toolName: string, args: Record<string, unknown>): Promise<any> {
  return callClaudeMCP('lineworks_calendar', args);
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

// 프로젝트 현황 조회 (기존 유지)
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

// 🆕 프로젝트 관리 의도 감지
function detectProjectIntent(text: string): { 
  isProject: boolean; 
  isCreation: boolean; 
  isUpdate: boolean; 
  isAdvancedUpdate: boolean;
} {
  const creationPatterns = [
    /(수주|따냄|맡기|맡아|시작|진행|들어왔).*(?:했어|됐어|완료)/,
    /(?:렌탈|설치|구축|멤버쉽).*(?:수주|따냄|맡기)/,
    /(?:프로젝트|건).*(?:새로|시작|맡아)/
  ];

  const updatePatterns = [
    /(?:견적|상태|일정|고객).*(?:변경|수정|업데이트|완료|추가)/,
    /(?:LED|크기|수량).*(?:변경|수정|바꿔)/,
    /(?:특이사항|메모|참고).*(?:추가|변경)/,
    /[가-힣A-Za-z0-9]+\s*(?:견적|승인|완료|진행|시작)/
  ];

  // 고도화된 업데이트 패턴 (복수 정보 포함)
  const advancedUpdatePatterns = [
    /(?:은|는|이|가)\s*\d+개소/,
    /LED크기는?\s*\d+x\d+/,
    /무대높이는?\s*(?:둘\s*다|모두|전부)?\s*\d+/,
    /고객사가?\s*[가-힣A-Za-z0-9]+/,
    /처음\s*써보는/,
    /친절한\s*설명/
  ];

  const isCreation = creationPatterns.some(pattern => pattern.test(text));
  const isUpdate = updatePatterns.some(pattern => pattern.test(text));
  const isAdvancedUpdate = advancedUpdatePatterns.some(pattern => pattern.test(text));
  const isProject = isCreation || isUpdate || isAdvancedUpdate;

  return { isProject, isCreation, isUpdate, isAdvancedUpdate };
}

// Webhook 처리 (Claude MCP 통합)
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

      // 🆕 Claude MCP를 통한 프로젝트 관리
      const projectIntent = detectProjectIntent(text);
      
      if (projectIntent.isProject) {
        try {
          let mcpResult;
          
          if (projectIntent.isCreation) {
            console.log('🆕 Claude MCP 프로젝트 생성 요청');
            mcpResult = await callClaudeMCP('notion_project', {
              action: 'create',
              text: text,
              userId: userId
            });
          } else if (projectIntent.isAdvancedUpdate || projectIntent.isUpdate) {
            console.log('📝 Claude MCP 프로젝트 업데이트 요청');
            mcpResult = await callClaudeMCP('notion_project', {
              action: 'update',
              text: text,
              userId: userId
            });
          }
          
          if (mcpResult?.success) {
            responseText = mcpResult.message || '프로젝트 처리가 완료되었습니다.';
            
            if (projectIntent.isAdvancedUpdate) {
              responseText += '\n\n🚀 Claude AI가 복합 정보를 자동으로 파싱하여 처리했습니다!';
            }
          } else {
            responseText = mcpResult?.message || '프로젝트 처리 중 오류가 발생했습니다.';
          }
          
        } catch (error) {
          console.error('❌ Claude MCP 프로젝트 관리 오류:', error);
          responseText = 'Claude AI 프로젝트 처리 중 오류가 발생했습니다. 다시 시도해주세요.';
        }
      }
      // 기존 기능들 (안녕, 내 정보, 사용자 목록, 일정 등록, 내 캘린더, 프로젝트 현황, 일정 조회, 재고) 
      else if (lowerText.includes('안녕') || lowerText.includes('하이') || lowerText.includes('도움말')) {
        responseText = '안녕하세요! LED 렌탈 업무봇입니다.\n\n' +
                      '🚀 Claude AI를 통한 기능들:\n' +
                      '📊 프로젝트 조회: "강남LED 현황"\n' +
                      '📅 일정 조회: "오늘 일정", "이번주 일정"\n' +
                      '📦 재고 확인: "재고 현황"\n' +
                      '📝 스마트 일정 등록: "8월 19일 오후 5시에 강남 코엑스에서 메쎄이상 회의"\n' +
                      '👤 사용자 정보: "내 정보", "정보 갱신"\n' +
                      '📋 사용자 목록: "사용자 목록" (관리자용)\n' +
                      '📱 내 캘린더: "내 일정"\n\n' +
                      '🤖 Claude AI 프로젝트 관리:\n' +
                      '• 프로젝트 생성: "코엑스팝업 구축 수주했어"\n' +
                      '• 프로젝트 업데이트: "코엑스팝업 견적 완료했어"\n' +
                      '• 상태 변경: "코엑스팝업 승인됐어"\n' +
                      '• 복합 정보 업데이트: "코엑스팝업은 2개소이고, LED크기는 6000x3000, 4000x2500이야"\n' +
                      '• 일정 변경: "코엑스팝업 일정 8월 25일로 변경"\n\n' +
                      '💡 모든 프로젝트 관리는 Claude AI가 자동으로 처리합니다!';
      }
      // ... 기존 다른 기능들 유지 (사용자 정보, 일정 등록 등)
      else if (lowerText.includes('내 정보') || lowerText.includes('사용자 정보')) {
        // 기존 코드 유지
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
      // 캘린더 일정 등록 - Claude MCP 호출
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
          console.log('📅 Claude MCP를 통한 캘린더 일정 등록');
          
          const mcpResult = await callCalendarMCP('lineworks_calendar', {
            action: 'create',
            userId: userId,
            text: text
          });
          
          console.log('📅 Claude MCP 캘린더 결과:', mcpResult);
          
          if (mcpResult.success) {
            responseText = mcpResult.message + '\n\n🤖 Claude AI가 자연어를 분석하여 자동으로 일정을 등록했습니다!';
          } else {
            responseText = `📅 일정 등록 결과:\n\n` +
                          `오류: ${mcpResult.message}\n\n` +
                          `💡 예시: "8월 19일 오후 5시에 강남 코엑스에서 메쎄이상 회의"`;
          }
          
        } catch (error) {
          console.error('❌ Claude MCP 일정 등록 오류:', error);
          responseText = 'Claude AI 일정 등록 중 오류가 발생했습니다. 다시 시도해주세요.';
        }
      }
      // 기존 프로젝트 현황 조회
      else if (lowerText.includes('현황') && !lowerText.includes('재고')) {
        const projectName = text.replace(/현황|프로젝트|조회/g, '').trim();
        if (projectName) {
          responseText = await getProjectStatus(projectName);
        } else {
          responseText = '프로젝트명을 입력해주세요. (예: "강남LED 현황")';
        }
      }
      else {
        responseText = '이해하지 못했습니다. 다음과 같이 말씀해주세요:\n\n' +
                      '🤖 Claude AI 프로젝트 관리:\n' +
                      '• 프로젝트 생성: "코엑스팝업 구축 수주했어"\n' +
                      '• 프로젝트 업데이트: "코엑스팝업 견적 완료했어"\n' +
                      '• 복합 정보 업데이트: "코엑스팝업은 2개소이고, LED크기는 6000x3000, 4000x2500이야"\n\n' +
                      '📋 기본 기능:\n' +
                      '• 프로젝트 조회: "강남LED 현황"\n' +
                      '• 일정 조회: "오늘 일정"\n' +
                      '• 재고 확인: "재고 현황"\n' +
                      '• 캘린더 일정: "8월 19일 오후 5시에 강남 코엑스에서 회의"\n' +
                      '• 사용자 정보: "내 정보"\n\n' +
                      '💡 모든 요청은 Claude AI가 자동으로 분석하여 처리합니다!';
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

// 🆕 Claude MCP 테스트 엔드포인트
router.post('/test-claude-mcp', async (req: Request, res: Response) => {
  try {
    const { userId, text, tool = 'notion_project', action = 'create' } = req.body;
    
    if (!userId || !text) {
      return res.status(400).json({ 
        error: 'userId와 text가 필요합니다.',
        examples: [
          {
            userId: 'user123',
            text: '코엑스 팝업 렌탈 수주했어',
            tool: 'notion_project',
            action: 'create'
          },
          {
            userId: 'user123', 
            text: '코엑스 팝업은 2개소이고, LED크기는 6000x3000, 4000x2500이야',
            tool: 'notion_project', 
            action: 'update'
          }
        ]
      });
    }
    
    // MCP 연결 상태 확인
    const connectionStatus = mcpClient.getConnectionStatus();
    
    const result = await callClaudeMCP(tool, {
      action: action,
      text: text,
      userId: userId
    });
    
    res.json({
      success: true,
      mcpConnection: connectionStatus,
      tool,
      action,
      result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Claude MCP 테스트 오류:', error);
    res.status(500).json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// MCP 연결 상태 확인 엔드포인트
router.get('/mcp/status', (req: Request, res: Response) => {
  const status = mcpClient.getConnectionStatus();
  res.json({
    connected: status,
    timestamp: new Date().toISOString()
  });
});

// Webhook 처리 (대화형 기능 통합)
router.post('/callback', async (req: Request, res: Response) => {
  try {
    console.log('LINE WORKS Webhook 수신:', JSON.stringify(req.body, null, 2));
    
    const message = req.body as LineWorksMessage;
    
    if (message.content?.type === 'text' && message.content.text) {
      const userId = message.source.userId;
      const text = message.content.text;
      const lowerText = text.toLowerCase();
      
      let responseText = '';

      // 🆕 진행 중인 대화가 있는지 확인
      if (conversationManager.hasActiveConversation(userId)) {
        console.log('📞 진행 중인 대화 감지 - 사용자 응답 처리');
        
        const conversationResult = conversationManager.processUserResponse(userId, text);
        
        if (conversationResult.error && conversationResult.isComplete) {
          responseText = conversationResult.error;
        } else if (conversationResult.needsConfirmation && conversationResult.confirmationMessage) {
          responseText = conversationResult.confirmationMessage;
        } else if (conversationResult.isComplete && conversationResult.collectedInfo) {
          // 수집된 정보로 프로젝트 생성
          try {
            const projectCreationText = generateProjectCreationText(conversationResult.collectedInfo);
            console.log('📋 수집된 정보로 프로젝트 생성:', projectCreationText);
            
            const mcpResult = await callClaudeMCP('notion_project', {
              action: 'create',
              text: projectCreationText,
              userId: userId
            });
            
            if (mcpResult?.success) {
              responseText = '🎉 대화를 통해 프로젝트가 성공적으로 생성되었습니다!\n\n' + mcpResult.message;
            } else {
              responseText = '❌ 프로젝트 생성에 실패했습니다: ' + (mcpResult?.message || 'Unknown error');
            }
          } catch (error) {
            console.error('❌ 대화형 프로젝트 생성 오류:', error);
            responseText = '프로젝트 생성 중 오류가 발생했습니다.';
          }
        } else if (conversationResult.nextQuestion) {
          responseText = conversationResult.nextQuestion;
        } else {
          responseText = '죄송합니다. 다시 시도해주세요.';
        }
      }
      // 🆕 Claude MCP를 통한 프로젝트 관리 (대화형 기능 추가)
      else {
        const projectIntent = detectProjectIntent(text);
        
        if (projectIntent.isProject) {
          try {
            let mcpResult;
            
            if (projectIntent.isCreation) {
              console.log('🆕 Claude MCP 프로젝트 생성 요청');
              mcpResult = await callClaudeMCP('notion_project', {
                action: 'create',
                text: text,
                userId: userId
              });
              
              // 🔄 프로젝트 생성 시 추가 정보 필요한지 확인
              if (mcpResult?.success) {
                const missingInfo = checkMissingProjectInfo(text);
                if (missingInfo.length > 0) {
                  console.log('❓ 추가 정보 필요:', missingInfo);
                  
                  const interactionResult = conversationManager.startInteractiveCollection(
                    userId, 
                    missingInfo, 
                    extractExistingInfo(text)
                  );
                  
                  if (interactionResult.needsInteraction && interactionResult.firstQuestion) {
                    responseText = mcpResult.message + 
                                  '\n\n📝 더 정확한 견적을 위해 추가 정보가 필요합니다:\n\n' + 
                                  interactionResult.firstQuestion;
                  } else {
                    responseText = mcpResult.message;
                  }
                } else {
                  responseText = mcpResult.message;
                }
              } else {
                responseText = mcpResult?.message || '프로젝트 생성 중 오류가 발생했습니다.';
              }
              
            } else if (projectIntent.isAdvancedUpdate || projectIntent.isUpdate) {
              console.log('📝 Claude MCP 프로젝트 업데이트 요청');
              mcpResult = await callClaudeMCP('notion_project', {
                action: 'update',
                text: text,
                userId: userId
              });
              
              if (mcpResult?.success) {
                responseText = mcpResult.message;
                
                if (projectIntent.isAdvancedUpdate) {
                  responseText += '\n\n🚀 Claude AI가 복합 정보를 자동으로 파싱하여 처리했습니다!';
                }
              } else {
                responseText = mcpResult?.message || '프로젝트 업데이트 중 오류가 발생했습니다.';
              }
            }
            
          } catch (error) {
            console.error('❌ Claude MCP 프로젝트 관리 오류:', error);
            responseText = 'Claude AI 프로젝트 처리 중 오류가 발생했습니다. 다시 시도해주세요.';
          }
        }
        // 기존 다른 기능들...
        else if (lowerText.includes('안녕') || lowerText.includes('하이') || lowerText.includes('도움말')) {
          responseText = '안녕하세요! LED 렌탈 업무봇입니다.\n\n' +
                        '🚀 Claude AI를 통한 기능들:\n' +
                        '📊 프로젝트 조회: "강남LED 현황"\n' +
                        '📅 일정 조회: "오늘 일정", "이번주 일정"\n' +
                        '📦 재고 확인: "재고 현황"\n' +
                        '📝 스마트 일정 등록: "8월 19일 오후 5시에 강남 코엑스에서 메쎄이상 회의"\n' +
                        '👤 사용자 정보: "내 정보", "정보 갱신"\n' +
                        '📋 사용자 목록: "사용자 목록" (관리자용)\n' +
                        '📱 내 캘린더: "내 일정"\n\n' +
                        '🤖 Claude AI 프로젝트 관리 (대화형):\n' +
                        '• 프로젝트 생성: "코엑스팝업 구축 수주했어"\n' +
                        '• 대화형 정보 수집: 부족한 정보는 자동으로 질문합니다\n' +
                        '• 프로젝트 업데이트: "코엑스팝업 견적 완료했어"\n' +
                        '• 복합 정보 업데이트: "코엑스팝업은 2개소이고, LED크기는 6000x3000, 4000x2500이야"\n' +
                        '• 일정 변경: "코엑스팝업 일정 8월 25일로 변경"\n\n' +
                        '💬 대화 중 언제든 "취소"라고 하면 중단됩니다!\n' +
                        '💡 모든 프로젝트 관리는 Claude AI가 자동으로 처리하고 필요시 추가 질문합니다!';
        }
        // ... 기존 다른 기능들 유지
        else {
          responseText = '이해하지 못했습니다. 다음과 같이 말씀해주세요:\n\n' +
                        '🤖 Claude AI 프로젝트 관리 (대화형):\n' +
                        '• 프로젝트 생성: "코엑스팝업 구축 수주했어"\n' +
                        '• 프로젝트 업데이트: "코엑스팝업 견적 완료했어"\n' +
                        '• 복합 정보 업데이트: "코엑스팝업은 2개소이고, LED크기는 6000x3000, 4000x2500이야"\n\n' +
                        '📋 기본 기능:\n' +
                        '• 프로젝트 조회: "강남LED 현황"\n' +
                        '• 일정 조회: "오늘 일정"\n' +
                        '• 재고 확인: "재고 현황"\n' +
                        '• 캘린더 일정: "8월 19일 오후 5시에 강남 코엑스에서 회의"\n' +
                        '• 사용자 정보: "내 정보"\n\n' +
                        '💬 프로젝트 생성 시 부족한 정보는 대화를 통해 자동으로 수집합니다!\n' +
                        '💡 모든 요청은 Claude AI가 자동으로 분석하여 처리합니다!';
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

/**
 * 수집된 정보로 프로젝트 생성 텍스트 생성
 */
function generateProjectCreationText(info: Record<string, any>): string {
  let text = `${info.projectName || '신규 프로젝트'} ${info.serviceType || '렌탈'} 수주했어`;
  
  if (info.customer) text += `. 고객사는 ${info.customer}`;
  if (info.location) text += `. 장소는 ${info.location}`;
  if (info.eventDate) text += `. 일정은 ${info.eventDate}`;
  
  if (info.ledInfo && info.ledInfo.ledInfos) {
    text += `. LED는 ${info.ledInfo.count}개소이고 크기는 `;
    const sizes = info.ledInfo.ledInfos.map((led: any) => led.size).join(', ');
    text += sizes;
    
    if (info.ledInfo.ledInfos[0]?.stageHeight) {
      text += `. 무대높이는 모두 ${info.ledInfo.ledInfos[0].stageHeight}mm`;
    }
  } else {
    if (info.led1Size) {
      text += `. LED1 크기는 ${info.led1Size}`;
      if (info.led1StageHeight) text += `, 무대높이 ${info.led1StageHeight}mm`;
    }
    if (info.led2Size) {
      text += `. LED2 크기는 ${info.led2Size}`;
      if (info.led2StageHeight) text += `, 무대높이 ${info.led2StageHeight}mm`;
    }
  }
  
  return text;
}

/**
 * 프로젝트에서 부족한 정보 확인
 */
function checkMissingProjectInfo(text: string): string[] {
  const missing: string[] = [];
  
  // 기본 체크
  if (!/(고객사|고객|회사)/.test(text)) missing.push('customer');
  if (!/(장소|위치|코엑스|킨텍스|강남|홍대)/.test(text)) missing.push('location');
  if (!/(일정|날짜|\d+월\s*\d+일)/.test(text)) missing.push('eventDate');
  
  // LED 정보 체크
  const hasLEDSize = /\d+\s*[x×X]\s*\d+/.test(text);
  const hasLEDCount = /\d+\s*개소/.test(text);
  
  if (!hasLEDSize && !hasLEDCount) {
    missing.push('ledInfo');
  } else if (hasLEDCount && !hasLEDSize) {
    const countMatch = text.match(/(\d+)\s*개소/);
    const count = countMatch ? parseInt(countMatch[1]) : 1;
    
    for (let i = 1; i <= count; i++) {
      missing.push(`led${i}Size`);
      missing.push(`led${i}StageHeight`);
    }
  }
  
  return missing;
}

/**
 * 기존 정보 추출
 */
function extractExistingInfo(text: string): Record<string, any> {
  const info: Record<string, any> = {};
  
  // 프로젝트명
  const serviceKeywords = ['설치', '구축', '렌탈', '멤버쉽', '수주'];
  for (const keyword of serviceKeywords) {
    const index = text.indexOf(keyword);
    if (index > 0) {
      info.projectName = text.substring(0, index).trim();
      info.serviceType = keyword === '수주' ? '렌탈' : keyword;
      break;
    }
  }
  
  // 고객사
  const customerMatch = text.match(/(?:고객사|고객|회사)는?\s*([가-힣A-Za-z0-9]+)/);
  if (customerMatch) info.customer = customerMatch[1];
  
  // 장소
  const locationMatch = text.match(/(?:장소|위치)는?\s*([가-힣A-Za-z0-9]+)/);
  if (locationMatch) info.location = locationMatch[1];
  
  return info;
}

// ... 기존 다른 함수들 유지

export default router;