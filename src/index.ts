import dotenv from 'dotenv';

// 환경변수 로드
dotenv.config();

// 카카오 챗봇 서버 시작
import './tools/kakao-chatbot.js';

console.log('🚀 LED 렌탈 MCP 서버가 시작되었습니다.');
console.log(`📌 환경: ${process.env.NODE_ENV || 'development'}`);
console.log(`🔗 포트: ${process.env.PORT || 3000}`);