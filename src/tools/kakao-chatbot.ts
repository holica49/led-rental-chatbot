import express from 'express';
import bodyParser from 'body-parser';
import { calculateMultiLEDQuote } from './calculate-quote.js';
import { notionMCPTool } from './notion-mcp.js';

const app = express();
app.use(bodyParser.json());

// ngrok 헤더 처리 미들웨어 추가
app.use((req, res, next) => {
  // ngrok 경고 페이지 우회
  res.setHeader('ngrok-skip-browser-warning', 'true');
  next();
});

app.use(bodyParser.json());

// CORS 헤더 추가
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// 사용자 세션 관리
const userSessions: { [key: string]: any } = {};

// 카카오 스킬 서버 엔드포인트
app.post('/skill', async (req, res) => {
  try {
    console.log('요청 받음:', JSON.stringify(req.body, null, 2));
    
    const { userRequest, bot, action } = req.body;
    
    // userRequest가 없는 경우 기본값 설정
    const userId = userRequest?.user?.id || 'default_user';
    const userMessage = userRequest?.utterance || '안녕하세요';
    
    // 사용자 세션 초기화
    if (!userSessions[userId]) {
      userSessions[userId] = {
        step: 'start',
        data: {},
        ledCount: 0,
        currentLED: 1
      };
    }
    
    const session = userSessions[userId];
    const response = await processUserMessage(userMessage, session);
    
    // 카카오 스킬 응답 형식 (any 타입으로 선언)
    const result: any = {
      version: "2.0",
      template: {
        outputs: [
          {
            simpleText: {
              text: response.text
            }
          }
        ]
      }
    };
    
    // quickReplies가 있으면 추가
    if (response.quickReplies && response.quickReplies.length > 0) {
      result.template.quickReplies = response.quickReplies;
    }
    
    console.log('응답 전송:', JSON.stringify(result, null, 2));
    res.json(result);
    
  } catch (error) {
    console.error('스킬 처리 오류:', error);
    res.json({
      version: "2.0",
      template: {
        outputs: [
          {
            simpleText: {
              text: "시스템 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
            }
          }
        ]
      }
    });
  }
});

// 간단한 테스트 엔드포인트 추가
app.get('/test', (req, res) => {
  res.json({
    message: "서버가 정상 작동 중입니다!",
    timestamp: new Date().toISOString()
  });
});

app.post('/test', (req, res) => {
  res.json({
    version: "2.0",
    template: {
      outputs: [
        {
          simpleText: {
            text: "테스트 성공! 서버가 정상 작동합니다."
          }
        }
      ]
    }
  });
});

async function processUserMessage(message: string, session: any) {
  switch (session.step) {
    case 'start':
      session.step = 'confirm_customer';
      return {
        text: '안녕하세요! LED 렌탈 자동 견적 시스템입니다.\n\n혹시 메쎄이상 관계자이신가요?',
        quickReplies: [
          {
            label: '네, 맞습니다',
            action: 'message',
            messageText: '네'
          },
          {
            label: '아니요',
            action: 'message', 
            messageText: '아니요'
          }
        ]
      };
      
    case 'confirm_customer':
      if (message.includes('네') || message.includes('맞')) {
        session.step = 'get_event_info';
        session.data.customerName = '메쎄이상';
        return {
          text: '메쎄이상 관계자님 안녕하세요! 😊\n\n행사명과 행사장을 알려주세요.\n예: 커피박람회 / 수원메쎄 2홀',
          quickReplies: []
        };
      } else {
        session.step = 'start';
        return {
          text: '죄송합니다. 현재는 메쎄이상 전용 서비스입니다.\n다른 문의사항이 있으시면 담당자에게 연락해주세요.',
          quickReplies: []
        };
      }
      
    case 'get_event_info':
      const parts = message.split('/').map(p => p.trim());
      if (parts.length >= 2) {
        session.data.eventName = parts[0];
        session.data.venue = parts[1];
        session.step = 'get_led_count';
        return {
          text: `📋 행사명: ${session.data.eventName}\n📍 행사장: ${session.data.venue}\n\n몇 개소의 LED가 필요하신가요?`,
          quickReplies: [
            { label: '1개소', action: 'message', messageText: '1' },
            { label: '2개소', action: 'message', messageText: '2' },
            { label: '3개소', action: 'message', messageText: '3' },
            { label: '4개소', action: 'message', messageText: '4' },
            { label: '5개소', action: 'message', messageText: '5' }
          ]
        };
      } else {
        return {
          text: '형식이 올바르지 않습니다.\n다시 입력해주세요.\n예: 커피박람회 / 수원메쎄 2홀',
          quickReplies: []
        };
      }
      
    case 'get_led_count':
      const count = parseInt(message);
      if (count >= 1 && count <= 5) {
        session.ledCount = count;
        session.currentLED = 1;
        session.step = 'get_led_specs';
        session.data.ledSpecs = [];
        return {
          text: `총 ${count}개소의 LED 설정을 진행하겠습니다.\n\nLED 1번째 개소의 크기를 알려주세요.\n500mm 단위로 입력해주세요.`,
          quickReplies: [
            { label: '4000x2500', action: 'message', messageText: '4000x2500' },
            { label: '2000x1500', action: 'message', messageText: '2000x1500' },
            { label: '1000x1000', action: 'message', messageText: '1000x1000' }
          ]
        };
      } else {
        return {
          text: '1-5개소 사이의 숫자를 입력해주세요.',
          quickReplies: [
            { label: '1개소', action: 'message', messageText: '1' },
            { label: '2개소', action: 'message', messageText: '2' },
            { label: '3개소', action: 'message', messageText: '3' }
          ]
        };
      }
      
    case 'get_led_specs':
      // LED 크기 검증 및 처리
      const sizePattern = /^(\d+)x(\d+)$/;
      const match = message.match(sizePattern);
      
      if (match) {
        const [, width, height] = match;
        if (parseInt(width) % 500 === 0 && parseInt(height) % 500 === 0) {
          session.data.ledSpecs.push({
            size: message,
            needOperator: false,
            operatorDays: 0
          });
          
          session.step = 'get_operator_needs';
          return {
            text: `LED ${session.currentLED}번째 개소: ${message}\n\n이 LED에 오퍼레이터가 필요하신가요?`,
            quickReplies: [
              { label: '네, 필요합니다', action: 'message', messageText: '네' },
              { label: '아니요', action: 'message', messageText: '아니요' }
            ]
          };
        }
      }
      
      return {
        text: 'LED 크기는 500mm 단위로 입력해주세요.\n예: 4000x2500, 2000x1500',
        quickReplies: [
          { label: '4000x2500', action: 'message', messageText: '4000x2500' },
          { label: '2000x1500', action: 'message', messageText: '2000x1500' }
        ]
      };
      
    case 'get_operator_needs':
      const currentLedIndex = session.data.ledSpecs.length - 1;
      const needsOperator = message.includes('네') || message.includes('필요');
      
      session.data.ledSpecs[currentLedIndex].needOperator = needsOperator;
      session.data.ledSpecs[currentLedIndex].operatorDays = needsOperator ? 4 : 0;
      
      if (session.currentLED < session.ledCount) {
        session.currentLED++;
        session.step = 'get_led_specs';
        return {
          text: `LED ${session.currentLED}번째 개소의 크기를 알려주세요.`,
          quickReplies: [
            { label: '4000x2500', action: 'message', messageText: '4000x2500' },
            { label: '2000x1500', action: 'message', messageText: '2000x1500' },
            { label: '1000x1000', action: 'message', messageText: '1000x1000' }
          ]
        };
      } else {
        session.step = 'get_dates';
        return {
          text: '행사 날짜를 알려주세요.\n예: 2025-07-09',
          quickReplies: []
        };
      }
      
    case 'get_dates':
      const datePattern = /^\d{4}-\d{2}-\d{2}$/;
      if (datePattern.test(message)) {
        session.data.eventDate = message;
        session.step = 'generate_quote';
        
        // 견적 계산
        const quote = calculateMultiLEDQuote(session.data.ledSpecs);
        
        // Notion에 저장
        const notionData = {
          eventName: session.data.eventName,
          customerName: session.data.customerName,
          eventDate: session.data.eventDate,
          venue: session.data.venue,
          customerContact: '010-0000-0000',
          ...session.data.ledSpecs.reduce((acc: any, led: any, index: number) => {
          acc[`led${index + 1}`] = led;
          return acc;
          }, {}),
          totalQuoteAmount: quote.total,
          totalModuleCount: quote.totalModuleCount,
          ledModuleCost: quote.ledModules.price,
          structureCost: quote.structure.totalPrice,
          controllerCost: quote.controller.totalPrice,
          powerCost: quote.power.totalPrice,
          installationCost: quote.installation.totalPrice,
          operatorCost: quote.operation.totalPrice,
          transportCost: quote.transport.price
        };
        
        await notionMCPTool.handler(notionData);
        
        // 견적 요약 생성
        const ledSummary = session.data.ledSpecs.map((led: any, index: number) => {
          const [w, h] = led.size.split('x').map(Number);
          const moduleCount = (w / 500) * (h / 500);
          return `LED${index + 1}: ${led.size} (${moduleCount}개)`;
        }).join('\n');
        
        // 세션 초기화
        userSessions[session.userId] = null;
        
        return {
          text: `✅ 견적이 완료되었습니다!\n\n📋 ${session.data.eventName}\n📍 ${session.data.venue}\n📅 ${session.data.eventDate}\n\n🖥️ LED 사양:\n${ledSummary}\n\n💰 총 견적 금액: ${quote.total.toLocaleString()}원 (VAT 포함)\n\n견적서가 Notion에 자동 저장되었습니다.\n담당자가 곧 연락드리겠습니다!`,
          quickReplies: [
            { label: '새 견적 요청', action: 'message', messageText: '시작' }
          ]
        };
      } else {
        return {
          text: '날짜 형식이 올바르지 않습니다.\nYYYY-MM-DD 형식으로 입력해주세요.\n예: 2025-07-09',
          quickReplies: []
        };
      }
      
    default:
      session.step = 'start';
      return {
        text: '안녕하세요! LED 렌탈 자동 견적 시스템입니다.\n견적을 시작하시겠습니까?',
        quickReplies: [
          { label: '견적 시작', action: 'message', messageText: '시작' }
        ]
      };
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`카카오 스킬 서버가 포트 ${PORT}에서 실행 중입니다.`);
});