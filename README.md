# LED 렌탈 MCP - 카카오톡 챗봇 시스템

## 🚨 Claude AI를 위한 핵심 정보

### 프로젝트 불변 규칙
- **Notion 필드명**: `고객명` (~~고객담당자~~ ❌)
- **무대 높이**: 0mm 허용
- **서비스 타입**: 설치, 렌탈, 멤버쉽 (정확히 이 명칭 사용)
- **설치 서비스**: 담당자 언급 제외

### 현재 리팩토링 상태
- **현재 Phase**: Phase 1 - Week 1 (시작 단계)
- **작업 브랜치**: `main`
- **진행률**: 0%

### 주요 파일 위치
- 핵심 비즈니스 로직: `src/tools/kakao-chatbot.ts`
- Notion 연동: `src/tools/notion-mcp.ts`
- 견적 계산: `src/tools/calculate-quote.ts`
- 타입 정의: `src/types/index.ts`

## 🎯 프로젝트 개요

오리온디스플레이의 LED 렌탈/설치 업무를 자동화하는 카카오톡 챗봇 시스템입니다.

### 주요 기능
1. **🏗️ LED 설치**: 상설 설치 상담 및 견적
2. **📦 LED 렌탈**: 단기 행사용 LED 렌탈 및 견적  
3. **👥 멤버쉽**: 메쎄이상(001) 전용 특별 가격

## 🛠️ 기술 스택
- **Runtime**: Node.js 18.x
- **Language**: TypeScript 5.6.3
- **Framework**: Express.js
- **Database**: Notion API
- **Deployment**: Railway
- **Integration**: Kakao i Open Builder

## 📊 Notion 데이터베이스 필드명 (절대 변경 금지)

### 기본 정보
- `행사명` (title)
- `고객사` (select)
- `고객명` (rich_text) ← ⚠️ '고객담당자' 아님!
- `고객 연락처` (phone_number)
- `행사장` (rich_text)

### 서비스 정보
- `서비스 유형` (select): 설치, 렌탈, 멤버쉽
- `행사 상태` (status): 견적 요청, 견적 검토, 견적 승인 등

### LED 정보 (1-5개소)
- `LED{n} 크기` (rich_text)
- `LED{n} 무대 높이` (number) ← 0mm 허용
- `LED{n} 오퍼레이터 필요` (checkbox)
- `LED{n} 오퍼레이터 일수` (number)

## 💰 가격 정책 (2024년 기준)

### 멤버쉽 서비스
- LED 모듈: 34,000원/개 (500개 이상 시)
- 구조물: 4m 미만 20,000원/㎡, 4m 이상 25,000원/㎡
- 설치 인력: 모듈 수에 따라 3-12명
- 운반비: 200개 이하 20만원, 201-400개 40만원, 400개 초과 70만원

### 렌탈 서비스  
- LED 모듈: 50,000원/개
- 운반비: 60개 이하 30만원, 61-100개 40만원, 101개 이상 50만원
- 기간 할증: 5일 이하 0%, 5-15일 20%, 15-30일 30%

## 📞 담당자 정보
- **설치 서비스**: 유준수 구축팀장 (010-7333-3336)
- **렌탈 서비스**: 
  - 실내: 일반 프로세스
  - 실외: 최수삼 렌탈팀장 (010-2797-2504)

## 🚀 실행 방법

### 개발 환경
```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

환경변수 설정
NOTION_API_KEY=secret_xxxxxxxxxxxxx
NOTION_DATABASE_ID=xxxxxxxxxxxxx
PORT=3000
NODE_ENV=production

📁 프로젝트 구조
led-rental-mcp/
├── src/
│   ├── index.ts             # Express 서버 진입점
│   ├── tools/
│   │   ├── kakao-chatbot.ts   # 카카오톡 챗봇 핸들러
│   │   ├── notion-mcp.ts          # Notion API 연동
│   │   ├── calculate-quote.ts     # 견적 계산 로직
│   │   ├── enhanced-excel.ts      # Excel 파일 생성
│   │   ├── notion-polling.ts      # 상태 변경 감지
│   │   └── notion-status-automation.ts  # 자동화 프로세스
│   └── types/
│       └── index.ts           # TypeScript 타입 정의
├── package.json
├── tsconfig.json
└── railway.json         # Railway 배포 설정

⚠️ 주의사항
Notion 데이터베이스 필드명은 절대 변경하지 마세요
카카오톡 응답은 5초 이내에 완료되어야 합니다
무대 높이는 0mm를 허용합니다
설치 서비스는 담당자 언급을 하지 않습니다

🔄 현재 이슈
서버 재시작 시 세션 데이터 손실 (Redis 마이그레이션 필요)
kakao-chatbot.ts 파일이 너무 큼 (2000줄 이상)
테스트 코드 부재