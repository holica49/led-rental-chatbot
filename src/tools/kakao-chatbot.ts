import express from 'express';
import bodyParser from 'body-parser';
import { calculateMultiLEDQuote } from './calculate-quote.js';
import { notionMCPTool } from './notion-mcp.js';

const app = express();

// ngrok 헤더 처리 미들웨어
app.use((req, res, next) => {
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

// 개선된 사용자 세션 인터페이스
interface UserSession {
  step: string;
  data: {
    eventName?: string;
    venue?: string;
    customerName?: string;
    eventDate?: string;
    ledSpecs: Array<{
      size: string;
      stageHeight?: number;
      needOperator: boolean;
      operatorDays: number;
    }>;
  };
  ledCount: number;
  currentLED: number;
  lastMessage?: string;
}

// 사용자 세션 관리
const userSessions: { [key: string]: UserSession } = {};

// 간단한 테스트 엔드포인트
app.get('/test', (req, res) => {
  res.json({
    message: "서버가 정상 작동 중입니다!",
    timestamp: new Date().toISOString()
  });
});

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
        data: {
          ledSpecs: []
        },
        ledCount: 0,
        currentLED: 1
      };
    }
    
    const session = userSessions[userId];
    session.lastMessage = userMessage;
    
    const response = await processUserMessage(userMessage, session);
    
    // 카카오 스킬 응답 형식
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

// 개선된 LED 크기 검증 함수
function validateAndNormalizeLEDSize(input: string): { valid: boolean; size?: string; error?: string } {
  if (!input || typeof input !== 'string') {
    return { valid: false, error: 'LED 크기를 입력해주세요.' };
  }
  
  // 다양한 형식 지원: 5000x3000, 5000*3000, 5000×3000, 5000 x 3000 등
  const cleanInput = input.replace(/\s/g, '').toLowerCase();
  const patterns = [
    /^(\d+)[x×*](\d+)$/,           // 5000x3000, 5000*3000, 5000×3000
    /^(\d+)[x×*]\s*(\d+)$/,       // 5000x 3000
    /^(\d+)\s*[x×*]\s*(\d+)$/,    // 5000 x 3000
    /^(\d+)[x×*](\d+)mm$/,        // 5000x3000mm
    /^(\d+)mm[x×*](\d+)mm$/       // 5000mmx3000mm
  ];
  
  for (const pattern of patterns) {
    const match = cleanInput.match(pattern);
    if (match) {
      const [, widthStr, heightStr] = match;
      const width = parseInt(widthStr);
      const height = parseInt(heightStr);
      
      if (width % 500 !== 0 || height % 500 !== 0) {
        return { 
          valid: false, 
          error: `LED 크기는 500mm 단위로 입력해주세요.\n입력하신 크기: ${width}x${height}\n가까운 크기: ${Math.round(width/500)*500}x${Math.round(height/500)*500}` 
        };
      }
      
      if (width < 500 || height < 500) {
        return { valid: false, error: 'LED 크기는 최소 500x500mm 이상이어야 합니다.' };
      }
      
      return { valid: true, size: `${width}x${height}` };
    }
  }
  
  return { 
    valid: false, 
    error: 'LED 크기 형식이 올바르지 않습니다.\n예시: 4000x2500, 4000*2500, 4000×2500' 
  };
}

// 무대 높이 검증 함수
function validateStageHeight(input: string): { valid: boolean; height?: number; error?: string } {
  if (!input || typeof input !== 'string') {
    return { valid: false, error: '무대 높이를 입력해주세요.' };
  }
  
  const cleanInput = input.replace(/\s/g, '').toLowerCase();
  const patterns = [
    /^(\d+)$/,           // 600
    /^(\d+)mm$/,         // 600mm
    /^(\d+)cm$/,         // 60cm
    /^(\d+)m$/,          // 0.6m
    /^(\d+\.\d+)m$/      // 0.6m
  ];
  
  for (const pattern of patterns) {
    const match = cleanInput.match(pattern);
    if (match) {
      let height = parseFloat(match[1]);
      
      // 단위 변환
      if (cleanInput.includes('cm')) {
        height = height * 10; // cm to mm
      } else if (cleanInput.includes('m')) {
        height = height * 1000; // m to mm
      }
      
      if (height < 100 || height > 10000) {
        return { 
          valid: false, 
          error: '무대 높이는 100mm(10cm) ~ 10000mm(10m) 사이로 입력해주세요.' 
        };
      }
      
      return { valid: true, height: Math.round(height) };
    }
  }
  
  return { 
    valid: false, 
    error: '무대 높이 형식이 올바르지 않습니다.\n예시: 600, 600mm, 60cm, 0.6m' 
  };
}

// 개선된 메시지 처리 함수
async function processUserMessage(message: string, session: UserSession) {
  // 수정 요청 처리
  if (isModificationRequest(message)) {
    return handleModificationRequest(message, session);
  }
  
  // 초기화 요청 처리
  if (isResetRequest(message)) {
    return handleResetRequest(session);
  }
  
  switch (session.step) {
    case 'start':
      return handleStart(session);
    
    case 'confirm_customer':
      return handleCustomerConfirm(message, session);
    
    case 'get_event_info':
      return handleEventInfo(message, session);
    
    case 'get_led_count':
      return handleLEDCount(message, session);
    
    case 'get_led_specs':
      return handleLEDSpecs(message, session);
    
    case 'get_stage_height':
      return handleStageHeight(message, session);
    
    case 'get_operator_needs':
      return handleOperatorNeeds(message, session);
    
    case 'get_dates':
      return handleDates(message, session);
    
    case 'confirm_quote':
      return handleQuoteConfirmation(message, session);
    
    default:
      return handleDefault(session);
  }
}

// 수정 요청 감지
function isModificationRequest(message: string): boolean {
  const modificationKeywords = [
    '수정', '바꾸', '변경', '다시', '틀렸', '잘못', '돌아가', '이전',
    '고쳐', '바꿔', '뒤로', '취소', '처음부터'
  ];
  return modificationKeywords.some(keyword => message.includes(keyword));
}

// 초기화 요청 감지
function isResetRequest(message: string): boolean {
  const resetKeywords = ['처음부터', '초기화', '새로', '다시 시작'];
  return resetKeywords.some(keyword => message.includes(keyword));
}

// 수정 요청 처리
function handleModificationRequest(message: string, session: UserSession) {
  const step = session.step;
  
  if (step === 'get_event_info') {
    session.step = 'get_event_info';
    return {
      text: '행사 정보를 다시 입력해주세요.\n\n행사명과 행사장을 알려주세요.\n예: 커피박람회 / 수원메쎄 2홀',
      quickReplies: []
    };
  }
  
  if (step === 'get_led_count') {
    session.step = 'get_led_count';
    return {
      text: 'LED 개수를 다시 선택해주세요.\n\n몇 개소의 LED가 필요하신가요?',
      quickReplies: [
        { label: '1개소', action: 'message', messageText: '1' },
        { label: '2개소', action: 'message', messageText: '2' },
        { label: '3개소', action: 'message', messageText: '3' },
        { label: '4개소', action: 'message', messageText: '4' },
        { label: '5개소', action: 'message', messageText: '5' }
      ]
    };
  }
  
  if (step === 'get_led_specs' && session.data.ledSpecs.length > 0) {
    // 마지막 LED 정보 삭제
    session.data.ledSpecs.pop();
    session.currentLED = session.data.ledSpecs.length + 1;
    
    return {
      text: `LED ${session.currentLED}번째 개소의 크기를 다시 입력해주세요.\n\n다양한 형식으로 입력 가능합니다:\n• 4000x2500\n• 4000*2500\n• 4000×2500\n• 4000 x 2500`,
      quickReplies: [
        { label: '4000x2500', action: 'message', messageText: '4000x2500' },
        { label: '2000x1500', action: 'message', messageText: '2000x1500' },
        { label: '1000x1000', action: 'message', messageText: '1000x1000' }
      ]
    };
  }
  
  // 일반적인 수정 요청
  return {
    text: '어떤 정보를 수정하시겠습니까?',
    quickReplies: [
      { label: '행사 정보', action: 'message', messageText: '행사 정보 수정' },
      { label: 'LED 개수', action: 'message', messageText: 'LED 개수 수정' },
      { label: '처음부터', action: 'message', messageText: '처음부터 시작' }
    ]
  };
}

// 초기화 처리
function handleResetRequest(session: UserSession) {
  session.step = 'start';
  session.data = { ledSpecs: [] };
  session.ledCount = 0;
  session.currentLED = 1;
  
  return {
    text: '견적 요청을 처음부터 다시 시작합니다.\n\n안녕하세요! LED 렌탈 자동 견적 시스템입니다.\n\n혹시 메쎄이상 관계자이신가요?',
    quickReplies: [
      { label: '네, 맞습니다', action: 'message', messageText: '네' },
      { label: '아니요', action: 'message', messageText: '아니요' }
    ]
  };
}

// 시작 처리
function handleStart(session: UserSession) {
  session.step = 'confirm_customer';
  
  return {
    text: '안녕하세요! LED 렌탈 자동 견적 시스템입니다.\n\n혹시 메쎄이상 관계자이신가요?',
    quickReplies: [
      { label: '네, 맞습니다', action: 'message', messageText: '네' },
      { label: '아니요', action: 'message', messageText: '아니요' }
    ]
  };
}

// 고객 확인 처리
function handleCustomerConfirm(message: string, session: UserSession) {
  if (message.includes('네') || message.includes('맞') || message.includes('예')) {
    session.step = 'get_event_info';
    session.data.customerName = '메쎄이상';
    
    return {
      text: '메쎄이상 관계자님 안녕하세요! 😊\n\n행사명과 행사장을 알려주세요.\n예: 커피박람회 / 수원메쎄 2홀\n\n💡 나중에 수정하고 싶으시면 "수정"이라고 말씀해주세요.',
      quickReplies: []
    };
  } else {
    session.step = 'start';
    return {
      text: '죄송합니다. 현재는 메쎄이상 전용 서비스입니다.\n다른 문의사항이 있으시면 담당자에게 연락해주세요.',
      quickReplies: [
        { label: '처음으로', action: 'message', messageText: '처음부터' }
      ]
    };
  }
}

// 행사 정보 처리
function handleEventInfo(message: string, session: UserSession) {
  const parts = message.split('/').map(part => part.trim());
  
  if (parts.length >= 2) {
    session.data.eventName = parts[0];
    session.data.venue = parts[1];
    session.step = 'get_led_count';
    
    return {
      text: `✅ 행사 정보 확인\n📋 행사명: ${session.data.eventName}\n📍 행사장: ${session.data.venue}\n\n몇 개소의 LED가 필요하신가요? (1-5개소)\n\n💡 수정하려면 "수정"이라고 말씀해주세요.`,
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
      text: '❌ 형식이 올바르지 않습니다.\n\n올바른 형식으로 다시 입력해주세요:\n📝 행사명 / 행사장\n\n예시:\n• 커피박람회 / 수원메쎄 2홀\n• 전시회 / 킨텍스 1홀\n• 컨퍼런스 / 코엑스 컨벤션홀',
      quickReplies: []
    };
  }
}

// LED 개수 처리
function handleLEDCount(message: string, session: UserSession) {
  const count = parseInt(message);
  
  if (count >= 1 && count <= 5) {
    session.ledCount = count;
    session.currentLED = 1;
    session.step = 'get_led_specs';
    session.data.ledSpecs = [];
    
    return {
      text: `✅ 총 ${count}개소의 LED 설정을 진행하겠습니다.\n\n🖥️ LED 1번째 개소의 크기를 알려주세요.\n\n다양한 형식으로 입력 가능:\n• 4000x2500\n• 4000*2500\n• 4000×2500\n• 4000 x 2500\n\n💡 수정하려면 "수정"이라고 말씀해주세요.`,
      quickReplies: [
        { label: '4000x2500', action: 'message', messageText: '4000x2500' },
        { label: '2000x1500', action: 'message', messageText: '2000x1500' },
        { label: '1000x1000', action: 'message', messageText: '1000x1000' }
      ]
    };
  } else {
    return {
      text: '❌ 1-5개소 사이의 숫자를 선택해주세요.\n\n최대 5개소까지 설정 가능합니다.',
      quickReplies: [
        { label: '1개소', action: 'message', messageText: '1' },
        { label: '2개소', action: 'message', messageText: '2' },
        { label: '3개소', action: 'message', messageText: '3' },
        { label: '4개소', action: 'message', messageText: '4' },
        { label: '5개소', action: 'message', messageText: '5' }
      ]
    };
  }
}

// LED 사양 처리
function handleLEDSpecs(message: string, session: UserSession) {
  const validation = validateAndNormalizeLEDSize(message);
  
  if (validation.valid && validation.size) {
    // LED 사양 임시 저장
    session.data.ledSpecs.push({
      size: validation.size,
      needOperator: false,
      operatorDays: 0
    });
    
    session.step = 'get_stage_height';
    
    return {
      text: `✅ LED ${session.currentLED}번째 개소: ${validation.size}\n\n📐 이 LED의 무대 높이를 알려주세요.\n\n다양한 형식으로 입력 가능:\n• 600 (mm)\n• 600mm\n• 60cm\n• 0.6m\n\n💡 수정하려면 "수정"이라고 말씀해주세요.`,
      quickReplies: [
        { label: '600mm', action: 'message', messageText: '600mm' },
        { label: '800mm', action: 'message', messageText: '800mm' },
        { label: '1000mm', action: 'message', messageText: '1000mm' },
        { label: '1200mm', action: 'message', messageText: '1200mm' }
      ]
    };
  } else {
    return {
      text: `❌ ${validation.error}\n\n다시 입력해주세요:\n\n✅ 올바른 형식:\n• 4000x2500\n• 4000*2500\n• 4000×2500\n• 4000 x 2500\n\n💡 500mm 단위로만 입력 가능합니다.`,
      quickReplies: [
        { label: '4000x2500', action: 'message', messageText: '4000x2500' },
        { label: '2000x1500', action: 'message', messageText: '2000x1500' },
        { label: '1000x1000', action: 'message', messageText: '1000x1000' }
      ]
    };
  }
}

// 무대 높이 처리
function handleStageHeight(message: string, session: UserSession) {
  const validation = validateStageHeight(message);
  
  if (validation.valid && validation.height !== undefined) {
    // 현재 LED에 무대 높이 추가
    const currentLedIndex = session.data.ledSpecs.length - 1;
    session.data.ledSpecs[currentLedIndex].stageHeight = validation.height;
    
    session.step = 'get_operator_needs';
    
    return {
      text: `✅ LED ${session.currentLED}번째 개소 무대 높이: ${validation.height}mm\n\n👨‍💼 이 LED에 오퍼레이터가 필요하신가요?\n\n오퍼레이터는 LED 화면 조작 및 콘텐츠 관리를 담당합니다.\n\n💡 수정하려면 "수정"이라고 말씀해주세요.`,
      quickReplies: [
        { label: '네, 필요합니다', action: 'message', messageText: '네' },
        { label: '아니요, 필요 없습니다', action: 'message', messageText: '아니요' }
      ]
    };
  } else {
    return {
      text: `❌ ${validation.error}\n\n다시 입력해주세요:\n\n✅ 올바른 형식:\n• 600 (mm 단위)\n• 600mm\n• 60cm\n• 0.6m\n\n📏 일반적인 무대 높이: 600mm~1200mm`,
      quickReplies: [
        { label: '600mm', action: 'message', messageText: '600mm' },
        { label: '800mm', action: 'message', messageText: '800mm' },
        { label: '1000mm', action: 'message', messageText: '1000mm' },
        { label: '1200mm', action: 'message', messageText: '1200mm' }
      ]
    };
  }
}

// 오퍼레이터 필요 여부 처리
function handleOperatorNeeds(message: string, session: UserSession) {
  const currentLedIndex = session.data.ledSpecs.length - 1;
  const needsOperator = message.includes('네') || message.includes('필요');
  
  session.data.ledSpecs[currentLedIndex].needOperator = needsOperator;
  session.data.ledSpecs[currentLedIndex].operatorDays = needsOperator ? 4 : 0;
  
  if (session.currentLED < session.ledCount) {
    session.currentLED++;
    session.step = 'get_led_specs';
    
    return {
      text: `✅ LED ${session.currentLED - 1}번째 개소 설정 완료\n\n🖥️ LED ${session.currentLED}번째 개소의 크기를 알려주세요.\n\n다양한 형식으로 입력 가능:\n• 4000x2500\n• 4000*2500\n• 4000×2500`,
      quickReplies: [
        { label: '4000x2500', action: 'message', messageText: '4000x2500' },
        { label: '2000x1500', action: 'message', messageText: '2000x1500' },
        { label: '1000x1000', action: 'message', messageText: '1000x1000' }
      ]
    };
  } else {
    session.step = 'get_dates';
    
    // LED 설정 요약 생성
    const ledSummary = session.data.ledSpecs.map((led, index) => {
      const [w, h] = led.size.split('x').map(Number);
      const moduleCount = (w / 500) * (h / 500);
      return `LED${index + 1}: ${led.size} (${led.stageHeight}mm 높이, ${moduleCount}개 모듈${led.needOperator ? ', 오퍼레이터 필요' : ''})`;
    }).join('\n');
    
    return {
      text: `✅ 모든 LED 설정이 완료되었습니다!\n\n📋 설정 요약:\n${ledSummary}\n\n📅 행사 날짜를 알려주세요.\n예: 2025-07-09\n\n💡 수정하려면 "수정"이라고 말씀해주세요.`,
      quickReplies: []
    };
  }
}

// 날짜 처리
function handleDates(message: string, session: UserSession) {
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (datePattern.test(message)) {
    session.data.eventDate = message;
    session.step = 'confirm_quote';
    
    // 견적 계산
    const quote = calculateMultiLEDQuote(session.data.ledSpecs);
    
    // 견적 요약 생성
    const ledSummary = session.data.ledSpecs.map((led: any, index: number) => {
      const [w, h] = led.size.split('x').map(Number);
      const moduleCount = (w / 500) * (h / 500);
      return `LED${index + 1}: ${led.size} (${led.stageHeight}mm, ${moduleCount}개)`;
    }).join('\n');
    
    return {
      text: `💰 견적 계산 완료!\n\n📋 ${session.data.eventName}\n📍 ${session.data.venue}\n📅 ${session.data.eventDate}\n\n🖥️ LED 사양:\n${ledSummary}\n\n💵 총 견적 금액: ${quote.total.toLocaleString()}원 (VAT 포함)\n\n이 견적으로 Notion에 저장하시겠습니까?`,
      quickReplies: [
        { label: '네, 저장해주세요', action: 'message', messageText: '저장' },
        { label: '수정하고 싶어요', action: 'message', messageText: '수정' },
        { label: '처음부터 다시', action: 'message', messageText: '처음부터' }
      ]
    };
  } else {
    return {
      text: '❌ 날짜 형식이 올바르지 않습니다.\n\n✅ 올바른 형식: YYYY-MM-DD\n\n예시:\n• 2025-07-09\n• 2025-12-25\n• 2026-01-15\n\n💡 수정하려면 "수정"이라고 말씀해주세요.',
      quickReplies: []
    };
  }
}

// 견적 확인 처리
async function handleQuoteConfirmation(message: string, session: UserSession) {
  if (message.includes('저장') || message.includes('네')) {
    // 견적 계산
    const quote = calculateMultiLEDQuote(session.data.ledSpecs);
    
    // Notion에 저장할 데이터 준비
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
    
    try {
      await notionMCPTool.handler(notionData);
      
      // 세션 초기화
      session.step = 'start';
      session.data = { ledSpecs: [] };
      session.ledCount = 0;
      session.currentLED = 1;
      
      return {
        text: `✅ 견적이 성공적으로 저장되었습니다!\n\n📋 ${session.data.eventName}\n💰 총 견적: ${quote.total.toLocaleString()}원\n\n📝 Notion 데이터베이스에 저장되었으며,\n담당자가 곧 연락드리겠습니다!\n\n🔄 새로운 견적을 원하시면 "안녕하세요"라고 말씀해주세요.`,
        quickReplies: [
          { label: '새 견적 요청', action: 'message', messageText: '안녕하세요' },
          { label: '문의사항', action: 'message', messageText: '문의' }
        ]
      };
    } catch (error) {
      return {
        text: `❌ 저장 중 오류가 발생했습니다.\n\n다시 시도해주세요.\n\n오류가 계속되면 담당자에게 문의해주세요.`,
        quickReplies: [
          { label: '다시 시도', action: 'message', messageText: '저장' },
          { label: '처음부터', action: 'message', messageText: '처음부터' }
        ]
      };
    }
  } else {
    return handleModificationRequest(message, session);
  }
}

// 기본 처리
function handleDefault(session: UserSession) {
  session.step = 'start';
  return {
    text: '안녕하세요! LED 렌탈 자동 견적 시스템입니다.\n\n견적을 시작하시겠습니까?',
    quickReplies: [
      { label: '견적 시작', action: 'message', messageText: '네' },
      { label: '도움말', action: 'message', messageText: '도움말' }
    ]
  };
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`개선된 카카오 스킬 서버가 포트 ${PORT}에서 실행 중입니다.`);
});