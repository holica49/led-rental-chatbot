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

// 사용자 세션 인터페이스
interface UserSession {
  step: string;
  data: {
    eventName?: string;
    venue?: string;
    customerName?: string;
    eventStartDate?: string;
    eventEndDate?: string;
    contactName?: string;
    contactTitle?: string;
    contactPhone?: string;
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

// LED 크기 검증 함수
function validateAndNormalizeLEDSize(input: string): { valid: boolean; size?: string; error?: string } {
  if (!input || typeof input !== 'string') {
    return { valid: false, error: 'LED 크기를 입력해주세요.' };
  }
  
  const cleanInput = input.replace(/\s/g, '').toLowerCase();
  const patterns = [
    /^(\d+)[x×*](\d+)$/,
    /^(\d+)[x×*]\s*(\d+)$/,
    /^(\d+)\s*[x×*]\s*(\d+)$/,
    /^(\d+)[x×*](\d+)mm$/,
    /^(\d+)mm[x×*](\d+)mm$/
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

// 무대 높이 검증 함수 (버튼 클릭 버그 수정)
function validateStageHeight(input: string): { valid: boolean; height?: number; error?: string } {
  if (!input || typeof input !== 'string') {
    return { valid: false, error: '무대 높이를 입력해주세요.' };
  }
  
  const cleanInput = input.replace(/\s/g, '').toLowerCase();
  
  // 버튼 클릭 텍스트 직접 처리
  const buttonValues: { [key: string]: number } = {
    '600mm': 600,
    '800mm': 800,
    '1000mm': 1000,
    '1200mm': 1200
  };
  
  if (buttonValues[cleanInput]) {
    return { valid: true, height: buttonValues[cleanInput] };
  }
  
  const patterns = [
    /^(\d+)$/,
    /^(\d+)mm$/,
    /^(\d+)cm$/,
    /^(\d+)m$/,
    /^(\d+\.\d+)m$/
  ];
  
  for (const pattern of patterns) {
    const match = cleanInput.match(pattern);
    if (match) {
      let height = parseFloat(match[1]);
      
      if (cleanInput.includes('cm')) {
        height = height * 10;
      } else if (cleanInput.includes('m')) {
        height = height * 1000;
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

// 행사 기간 검증 함수
function validateEventPeriod(input: string): { valid: boolean; startDate?: string; endDate?: string; error?: string } {
  if (!input || typeof input !== 'string') {
    return { valid: false, error: '행사 기간을 입력해주세요.' };
  }
  
  const cleanInput = input.replace(/\s/g, '');
  const patterns = [
    /^(\d{4}-\d{2}-\d{2})~(\d{4}-\d{2}-\d{2})$/,
    /^(\d{4}-\d{2}-\d{2})-(\d{4}-\d{2}-\d{2})$/,
    /^(\d{4}-\d{2}-\d{2})부터(\d{4}-\d{2}-\d{2})까지$/,
    /^(\d{4}-\d{2}-\d{2})에서(\d{4}-\d{2}-\d{2})$/
  ];
  
  for (const pattern of patterns) {
    const match = cleanInput.match(pattern);
    if (match) {
      const [, startDate, endDate] = match;
      
      // 날짜 형식 검증
      const datePattern = /^\d{4}-\d{2}-\d{2}$/;
      if (!datePattern.test(startDate) || !datePattern.test(endDate)) {
        continue;
      }
      
      // 날짜 유효성 검증
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return { valid: false, error: '유효하지 않은 날짜입니다.' };
      }
      
      if (start > end) {
        return { valid: false, error: '시작일이 종료일보다 늦을 수 없습니다.' };
      }
      
      return { valid: true, startDate, endDate };
    }
  }
  
  return { 
    valid: false, 
    error: '행사 기간 형식이 올바르지 않습니다.\n예시: 2025-07-09 ~ 2025-07-11' 
  };
}

// 전화번호 검증 함수
function validatePhoneNumber(input: string): { valid: boolean; phone?: string; error?: string } {
  if (!input || typeof input !== 'string') {
    return { valid: false, error: '전화번호를 입력해주세요.' };
  }
  
  const cleanInput = input.replace(/[-\s]/g, '');
  const patterns = [
    /^010\d{8}$/,
    /^02\d{7,8}$/,
    /^0[3-9]\d{8,9}$/,
    /^070\d{8}$/
  ];
  
  for (const pattern of patterns) {
    if (pattern.test(cleanInput)) {
      // 전화번호 포맷팅
      if (cleanInput.startsWith('010')) {
        return { valid: true, phone: cleanInput.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3') };
      } else if (cleanInput.startsWith('02')) {
        if (cleanInput.length === 9) {
          return { valid: true, phone: cleanInput.replace(/(\d{2})(\d{3})(\d{4})/, '$1-$2-$3') };
        } else {
          return { valid: true, phone: cleanInput.replace(/(\d{2})(\d{4})(\d{4})/, '$1-$2-$3') };
        }
      } else {
        return { valid: true, phone: cleanInput.replace(/(\d{3})(\d{3,4})(\d{4})/, '$1-$2-$3') };
      }
    }
  }
  
  return { 
    valid: false, 
    error: '올바른 전화번호 형식이 아닙니다.\n예시: 010-1234-5678, 02-1234-5678' 
  };
}

// 메시지 처리 함수
async function processUserMessage(message: string, session: UserSession) {
  // 수정 요청 처리 (개선된 버전)
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
    
    case 'get_operator_days':
      return handleOperatorDays(message, session);
    
    case 'get_event_period':
      return handleEventPeriod(message, session);
    
    case 'get_contact_name':
      return handleContactName(message, session);
    
    case 'get_contact_title':
      return handleContactTitle(message, session);
    
    case 'get_contact_phone':
      return handleContactPhone(message, session);
    
    case 'final_confirmation':
      return handleFinalConfirmation(message, session);
    
    default:
      return handleDefault(session);
  }
}

// 수정 요청 감지 (개선된 버전)
function isModificationRequest(message: string): boolean {
  const modificationKeywords = [
    '수정', '바꾸', '변경', '다시', '틀렸', '잘못', '돌아가', '이전',
    '고쳐', '바꿔', '뒤로', '취소', '행사 정보 수정', 'LED 개수 수정'
  ];
  return modificationKeywords.some(keyword => message.includes(keyword));
}

// 초기화 요청 감지
function isResetRequest(message: string): boolean {
  const resetKeywords = ['처음부터', '처음부터 시작', '초기화', '새로', '다시 시작'];
  return resetKeywords.some(keyword => message.includes(keyword));
}

// 수정 요청 처리 (버그 수정 버전)
function handleModificationRequest(message: string, session: UserSession) {
  // 구체적인 수정 요청 처리
  if (message.includes('행사 정보 수정')) {
    session.step = 'get_event_info';
    return {
      text: '행사 정보를 다시 입력해주세요.\n\n행사명과 행사장을 알려주세요.\n예: 커피박람회 / 수원메쎄 2홀',
      quickReplies: []
    };
  }
  
  if (message.includes('LED 개수 수정')) {
    session.step = 'get_led_count';
    session.data.ledSpecs = [];
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
  
  // 일반적인 수정 요청
  const step = session.step;
  
  if (step === 'get_event_info') {
    return {
      text: '행사 정보를 다시 입력해주세요.\n\n행사명과 행사장을 알려주세요.\n예: 커피박람회 / 수원메쎄 2홀',
      quickReplies: []
    };
  }
  
  if (step === 'get_led_count') {
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

// 무대 높이 처리 (버그 수정 버전)
function handleStageHeight(message: string, session: UserSession) {
  const validation = validateStageHeight(message);
  
  if (validation.valid && validation.height !== undefined) {
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
  
  if (needsOperator) {
    session.step = 'get_operator_days';
    return {
      text: `✅ LED ${session.currentLED}번째 개소: 오퍼레이터 필요\n\n📅 오퍼레이터가 몇 일 동안 필요하신가요?\n\n일반적으로 행사 기간 + 리허설 1일입니다.\n\n💡 수정하려면 "수정"이라고 말씀해주세요.`,
      quickReplies: [
        { label: '1일', action: 'message', messageText: '1일' },
        { label: '2일', action: 'message', messageText: '2일' },
        { label: '3일', action: 'message', messageText: '3일' },
        { label: '4일', action: 'message', messageText: '4일' },
        { label: '5일', action: 'message', messageText: '5일' }
      ]
    };
  } else {
    session.data.ledSpecs[currentLedIndex].operatorDays = 0;
    return handleNextLEDOrContinue(session);
  }
}

// 오퍼레이터 일수 처리
function handleOperatorDays(message: string, session: UserSession) {
  const currentLedIndex = session.data.ledSpecs.length - 1;
  const dayMatch = message.match(/(\d+)/);
  
  if (dayMatch) {
    const days = parseInt(dayMatch[1]);
    if (days >= 1 && days <= 10) {
      session.data.ledSpecs[currentLedIndex].operatorDays = days;
      return handleNextLEDOrContinue(session);
    }
  }
  
  return {
    text: '❌ 올바른 일수를 입력해주세요.\n\n1일~10일 사이로 입력해주세요.',
    quickReplies: [
      { label: '1일', action: 'message', messageText: '1일' },
      { label: '2일', action: 'message', messageText: '2일' },
      { label: '3일', action: 'message', messageText: '3일' },
      { label: '4일', action: 'message', messageText: '4일' },
      { label: '5일', action: 'message', messageText: '5일' }
    ]
  };
}

// 다음 LED 또는 계속 진행
function handleNextLEDOrContinue(session: UserSession) {
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
    session.step = 'get_event_period';
    
    // LED 설정 요약 생성
    const ledSummary = session.data.ledSpecs.map((led, index) => {
      const [w, h] = led.size.split('x').map(Number);
      const moduleCount = (w / 500) * (h / 500);
      const operatorText = led.needOperator ? `, 오퍼레이터 ${led.operatorDays}일` : '';
      return `LED${index + 1}: ${led.size} (${led.stageHeight}mm 높이, ${moduleCount}개 모듈${operatorText})`;
    }).join('\n');
    
    return {
      text: `✅ 모든 LED 설정이 완료되었습니다!\n\n📋 설정 요약:\n${ledSummary}\n\n📅 행사 기간을 알려주세요.\n시작일과 종료일을 모두 입력해주세요.\n\n예시: 2025-07-09 ~ 2025-07-11\n\n💡 수정하려면 "수정"이라고 말씀해주세요.`,
      quickReplies: []
    };
  }
}

// 행사 기간 처리
function handleEventPeriod(message: string, session: UserSession) {
  const validation = validateEventPeriod(message);
  
  if (validation.valid && validation.startDate && validation.endDate) {
    session.data.eventStartDate = validation.startDate;
    session.data.eventEndDate = validation.endDate;
    session.step = 'get_contact_name';
    
    return {
      text: `✅ 행사 기간: ${validation.startDate} ~ ${validation.endDate}\n\n👤 담당자님의 성함을 알려주세요.\n\n💡 수정하려면 "수정"이라고 말씀해주세요.`,
      quickReplies: []
    };
  } else {
    return {
      text: `❌ ${validation.error}\n\n다시 입력해주세요:\n\n✅ 올바른 형식:\n• 2025-07-09 ~ 2025-07-11\n• 2025-07-09 - 2025-07-11\n• 2025-07-09부터 2025-07-11까지\n\n💡 시작일과 종료일을 모두 입력해주세요.`,
      quickReplies: []
    };
  }
}

// 날짜 계산 함수
function calculateScheduleDates(startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // 설치 일정: 시작일 하루 전
  const installDate = new Date(start);
  installDate.setDate(installDate.getDate() - 1);
  
  // 리허설 일정: 시작일 하루 전 (설치일과 같음)
  const rehearsalDate = new Date(installDate);
  
  // 철거 일정: 마지막 날
  const dismantleDate = new Date(end);
  
  return {
    eventSchedule: `${startDate} ~ ${endDate}`,
    installSchedule: installDate.toISOString().split('T')[0],
    rehearsalSchedule: rehearsalDate.toISOString().split('T')[0],
    dismantleSchedule: dismantleDate.toISOString().split('T')[0]
  };
}

// 담당자 이름 처리
function handleContactName(message: string, session: UserSession) {
  if (message && message.trim().length > 0) {
    session.data.contactName = message.trim();
    session.step = 'get_contact_title';
    
    return {
      text: `✅ 담당자: ${session.data.contactName}님\n\n💼 직급을 알려주세요.\n\n예시: 과장, 대리, 팀장, 부장 등\n\n💡 수정하려면 "수정"이라고 말씀해주세요.`,
      quickReplies: [
        { label: '과장', action: 'message', messageText: '과장' },
        { label: '대리', action: 'message', messageText: '대리' },
        { label: '팀장', action: 'message', messageText: '팀장' },
        { label: '부장', action: 'message', messageText: '부장' }
      ]
    };
  } else {
    return {
      text: '❌ 담당자 성함을 입력해주세요.\n\n예시: 김철수, 이영희 등',
      quickReplies: []
    };
  }
}

// 담당자 직급 처리
function handleContactTitle(message: string, session: UserSession) {
  if (message && message.trim().length > 0) {
    session.data.contactTitle = message.trim();
    session.step = 'get_contact_phone';
    
    return {
      text: `✅ 직급: ${session.data.contactTitle}\n\n📞 연락처를 알려주세요.\n\n예시: 010-1234-5678, 02-1234-5678\n\n💡 수정하려면 "수정"이라고 말씀해주세요.`,
      quickReplies: []
    };
  } else {
    return {
      text: '❌ 직급을 입력해주세요.\n\n예시: 과장, 대리, 팀장, 부장 등',
      quickReplies: [
        { label: '과장', action: 'message', messageText: '과장' },
        { label: '대리', action: 'message', messageText: '대리' },
        { label: '팀장', action: 'message', messageText: '팀장' },
        { label: '부장', action: 'message', messageText: '부장' }
      ]
    };
  }
}

// 담당자 연락처 처리
function handleContactPhone(message: string, session: UserSession) {
  const validation = validatePhoneNumber(message);
  
  if (validation.valid && validation.phone) {
    session.data.contactPhone = validation.phone;
    session.step = 'final_confirmation';
    
    // 최종 확인 요약 생성
    const ledSummary = session.data.ledSpecs.map((led: any, index: number) => {
      const [w, h] = led.size.split('x').map(Number);
      const moduleCount = (w / 500) * (h / 500);
      return `LED${index + 1}: ${led.size} (${led.stageHeight}mm, ${moduleCount}개)`;
    }).join('\n');
    
    return {
      text: `✅ 모든 정보가 입력되었습니다!\n\n📋 최종 확인\n\n🏢 고객사: ${session.data.customerName}\n📋 행사명: ${session.data.eventName}\n📍 행사장: ${session.data.venue}\n📅 행사 기간: ${session.data.eventStartDate} ~ ${session.data.eventEndDate}\n\n👤 담당자 정보:\n• 성함: ${session.data.contactName}\n• 직급: ${session.data.contactTitle}\n• 연락처: ${session.data.contactPhone}\n\n🖥️ LED 사양:\n${ledSummary}\n\n담당자에게 전달드리겠습니다!`,
      quickReplies: [
        { label: '네, 전달해주세요', action: 'message', messageText: '네' },
        { label: '수정하고 싶어요', action: 'message', messageText: '수정' }
      ]
    };
  } else {
    return {
      text: `❌ ${validation.error}\n\n다시 입력해주세요:\n\n✅ 올바른 형식:\n• 010-1234-5678\n• 02-1234-5678\n• 070-1234-5678\n\n💡 하이픈(-) 없이 입력하셔도 됩니다.`,
      quickReplies: []
    };
  }
}

// 최종 확인 처리
async function handleFinalConfirmation(message: string, session: UserSession) {
  if (message.includes('네') || message.includes('전달')) {
    try {
      // 견적 계산 (내부 계산용)
      const quote = calculateMultiLEDQuote(session.data.ledSpecs);
      
      // 일정 계산
      const schedules = calculateScheduleDates(session.data.eventStartDate!, session.data.eventEndDate!);
      
      // Notion에 저장할 데이터 준비
      const notionData = {
        eventName: session.data.eventName,
        customerName: session.data.customerName,
        eventSchedule: schedules.eventSchedule,
        installSchedule: schedules.installSchedule,
        rehearsalSchedule: schedules.rehearsalSchedule,
        dismantleSchedule: schedules.dismantleSchedule,
        venue: session.data.venue,
        contactName: session.data.contactName,
        contactTitle: session.data.contactTitle,
        contactPhone: session.data.contactPhone,
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
      
      // Notion에 저장
      await notionMCPTool.handler(notionData);
      
      // 세션 초기화
      session.step = 'start';
      session.data = { ledSpecs: [] };
      session.ledCount = 0;
      session.currentLED = 1;
      
      let successMessage = `✅ 견적 요청이 성공적으로 접수되었습니다!\n\n📋 ${notionData.eventName}\n👤 담당자: ${notionData.contactName} ${notionData.contactTitle}\n📞 연락처: ${notionData.contactPhone}\n\n📝 담당자에게 전달되었으며, 곧 연락드리겠습니다!\n\n🔄 새로운 견적을 원하시면 "안녕하세요"라고 말씀해주세요.`;
      
      return {
        text: successMessage,
        quickReplies: [
          { label: '새 견적 요청', action: 'message', messageText: '안녕하세요' },
          { label: '문의사항', action: 'message', messageText: '문의' }
        ]
      };
    } catch (error) {
      console.error('견적 처리 실패:', error);
      return {
        text: `❌ 견적 처리 중 오류가 발생했습니다.\n\n다시 시도해주세요.\n\n오류가 계속되면 담당자에게 문의해주세요.`,
        quickReplies: [
          { label: '다시 시도', action: 'message', messageText: '네' },
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