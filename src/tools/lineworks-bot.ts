// src/tools/lineworks-bot.ts (고도화된 파서 통합 버전)
import express, { Request, Response } from 'express';
import { Client } from '@notionhq/client';

const router = express.Router();

// LINE WORKS Auth는 첫 요청 시 초기화
let auth: any = null;

async function getAuth() {
  if (!auth) {
    const { LineWorksAuth } = await import('../config/lineworks-auth.js');
    auth = new LineWorksAuth();
  }
  return auth;
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

// MCP 직접 호출 함수 (고도화된 파서 사용)
async function callMCPDirect(toolName: string, args: Record<string, unknown>): Promise<any> {
  try {
    console.log('📞 고도화된 MCP 직접 호출:', toolName, args);
    
    // LineWorksCalendarService 직접 import하여 사용
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
    // 메시지 전송 실패해도 프로세스는 계속 진행
  }
}

// 프로젝트 현황 조회
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

// 일정 조회
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
      // 이번주 필터링 (간단한 구현)
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      
      filtered = response.results.filter((p: any) => {
        const eventDate = p.properties['행사 일정']?.rich_text?.[0]?.text?.content;
        if (!eventDate) return false;
        // 날짜 파싱 로직 (간단한 구현)
        return true; // 실제로는 날짜 범위 체크 필요
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

// Webhook 처리 (고도화된 일정 처리)
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
      
      // 간단한 의도 분석
      if (lowerText.includes('안녕') || lowerText.includes('하이')) {
        responseText = '안녕하세요! LED 렌탈 업무봇입니다.\n\n' +
                      '다음과 같은 기능을 사용할 수 있습니다:\n' +
                      '📊 프로젝트 조회: "강남LED 현황"\n' +
                      '📅 일정 조회: "오늘 일정", "이번주 일정"\n' +
                      '📦 재고 확인: "재고 현황"\n' +
                      '📝 스마트 일정 등록: "다음 주 화요일 오후 3시에 강남 스타벅스에서 김대리와 중요한 프로젝트 회의, 30분 전 알림"';
      }
      // 고도화된 일정 등록 - MCP 호출
      else if (
        (text.includes('일정') && (text.includes('등록') || text.includes('추가'))) ||
        (text.includes('시') && (text.includes('오늘') || text.includes('내일') || text.includes('모레') || text.includes('다음'))) ||
        (text.includes('요일') && text.includes('시')) ||
        /\d{4}[-\/]\d{1,2}[-\/]\d{1,2}/.test(text) || // 날짜 형식 포함
        text.includes('회의') || text.includes('미팅') || text.includes('만남') ||
        text.includes('약속') || text.includes('면담')
      ) {
        try {
          console.log('📅 고도화된 MCP를 통한 캘린더 일정 등록 시작');
          
          // 1. Notion에 저장 (기존 로직 유지)
          let notionSuccess = false;
          
          // 간단한 파싱으로 Notion 저장
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
                    status: { name: '견적 요청' }  // "예정" 대신 "견적 요청" 사용
                  },
                  '문의요청 사항': {
                    rich_text: [{
                      text: { content: `LINE WORKS에서 등록: ${text}` }
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
          
          // 2. 고도화된 MCP로 LINE WORKS 캘린더에 저장
          const mcpResult = await callMCPDirect('lineworks_calendar', {
            action: 'create',
            userId: userId,
            text: text
          });
          
          console.log('📅 고도화된 MCP 캘린더 결과:', mcpResult);
          
          // 3. 고도화된 결과 메시지 생성
          if (mcpResult.success) {
            responseText = mcpResult.message + 
                          `\n\n💾 저장 위치:\n` +
                          `• Notion: ${notionSuccess ? '✅ 성공' : '❌ 실패'}\n` +
                          `• LINE WORKS 캘린더: ✅ 성공`;
            
            // 파싱 신뢰도가 낮은 경우 추가 안내
            if (mcpResult.parsedInfo?.confidence && mcpResult.parsedInfo.confidence < 0.7) {
              responseText += `\n\n⚠️ 파싱 신뢰도가 ${Math.round(mcpResult.parsedInfo.confidence * 100)}%입니다. 일정을 확인해주세요.`;
            }
          } else {
            responseText = `🤖 스마트 일정 등록 결과:\n\n` +
                          `• Notion: ${notionSuccess ? '✅ 성공' : '❌ 실패'}\n` +
                          `• LINE WORKS 캘린더: ❌ 실패\n\n` +
                          `오류: ${mcpResult.message}`;
          }
          
        } catch (error) {
          console.error('❌ 고도화된 일정 등록 전체 오류:', error);
          responseText = '일정 등록 중 오류가 발생했습니다. 다시 시도해주세요.\n\n💡 예시: "내일 오후 2시에 강남역에서 김대리와 프로젝트 회의"';
        }
      }
      // 내 캘린더 조회 - 고도화된 MCP 호출
      else if (text.includes('내 일정') || text.includes('내일정') || text.includes('캘린더')) {
        try {
          const mcpResult = await callMCPDirect('lineworks_calendar', {
            action: 'get',
            userId: userId,
            range: 'week'
          });
          
          if (mcpResult.success && mcpResult.events.length > 0) {
            responseText = '📅 이번 주 일정:\n\n';
            
            // 고도화된 이벤트 정보 표시
            if (mcpResult.summary) {
              responseText += `${mcpResult.summary}\n\n`;
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
              
              // 고도화된 정보 표시
              if (event.attendees && event.attendees.length > 0) {
                responseText += `  👥 ${event.attendees.join(', ')}\n`;
              }
              
              if (event.preparation && event.preparation.length > 0) {
                responseText += `  📝 ${event.preparation.join(', ')}\n`;
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
        // 프로젝트명 추출
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
                      '• 스마트 일정 등록: "다음 주 화요일 오후 3시에 강남 스타벅스에서 김대리와 중요한 프로젝트 회의, 30분 전 알림"\n' +
                      '• 내 캘린더: "내 일정"';
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

export default router;