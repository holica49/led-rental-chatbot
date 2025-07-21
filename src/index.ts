import dotenv from 'dotenv';
import express from 'express';
import bodyParser from 'body-parser';
import { startPollingService } from './tools/notion-polling.js';

// 환경변수 로드
dotenv.config();

// Express 앱 생성
const app = express();

// 미들웨어 설정
app.use(bodyParser.json());
app.use((req, res, next) => {
  res.setHeader('ngrok-skip-browser-warning', 'true');
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// 헬스체크 엔드포인트
app.get('/health', (_req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'LED 렌탈 MCP'
  });
});

// 루트 엔드포인트
app.get('/', (_req, res) => {
  res.json({
    message: 'LED 렌탈 MCP 서버가 실행 중입니다.',
    endpoints: ['/health', '/skill', '/test']
  });
});

// 카카오 챗봇 라우터 import
import { skillRouter } from './tools/kakao-chatbot.js';
app.use(skillRouter);

// 서버 시작
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('🚀 LED 렌탈 MCP 서버가 시작되었습니다.');
  console.log(`📌 환경: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 포트: ${PORT}`);
  console.log(`🚀 카카오 스킬 서버가 포트 ${PORT}에서 실행 중입니다.`);
  console.log(`📡 스킬 엔드포인트: http://localhost:${PORT}/skill`);
  
  // Notion 폴링 서비스 시작
  startPollingService().then(() => {
    console.log('🔄 Notion 폴링 서비스가 시작되었습니다.');
  }).catch(error => {
    console.error('❌ Notion 폴링 서비스 시작 실패:', error);
  });
});