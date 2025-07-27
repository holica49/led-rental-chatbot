# LED Rental MCP - Kakao Chatbot Integration

LED 렌탈/설치 견적을 자동화하는 Kakao 챗봇 서버입니다. MCP(Model Context Protocol)를 통해 Claude와 연동되며, Notion 데이터베이스와 연동하여 업무를 자동화합니다.

## 🚨 Claude AI를 위한 핵심 정보

### 프로젝트 불변 규칙
- **Notion 필드명**: `고객명` (~~고객담당자~~ ❌)
- **무대 높이**: 0mm 허용
- **서비스 타입**: 설치, 렌탈, 멤버쉽 (정확히 이 명칭 사용)
- **설치 서비스**: 담당자 언급 제외
- **구분선**: `━━━━` (4개)로 통일

### 현재 상태
- **ES Module** 전환 완료 (2025-07-25)
- **모든 import에 .js 확장자** 추가 완료
- **Railway 배포** 정상 작동 중
- **TypeScript strict mode**: Phase 1 완료 (strictNullChecks, noImplicitAny)
- **메시지 중앙화**: 완료 (2025-07-25)
- **Notion 폴링**: 10분 간격 작동 중 (2025-07-26)
- **날짜 기반 스케줄러**: 1시간 간격 작동 중 (2025-07-27)
- **Notion 메시지 중앙화**: 완료 (2025-07-27)

## 🚀 주요 기능

### 1. Kakao 챗봇
- 대화형 견적 상담 (렌탈/설치/멤버쉽 구분)
- 세션 기반 대화 상태 관리
- 서비스별 맞춤 프로세스

### 2. Notion 연동
- 견적 데이터 자동 저장
- 실시간 상태 관리
- 파일 업로드 처리

### 3. 자동화 시스템
- **폴링 (10분마다)**: 상태 변경 감지, 파일 업로드 감지
- **스케줄러 (1시간마다)**: 날짜 기반 자동 상태 변경
- **담당자 자동 멘션**: 서비스별 적절한 담당자 알림

## 🤖 Notion 자동화 상세

### 서비스별 프로세스

#### 설치 서비스
1. 견적 요청 → 견적 검토 (자동)
2. 견적 검토 → 견적 승인 (수동)
3. 견적 승인 → 설치 중 (행사 전날 자동)
4. 설치 중 → 완료 (수동)

#### 렌탈/멤버쉽 서비스
1. 견적 요청 → 견적 검토 (자동)
2. 견적 검토 → 견적 승인 (파일 업로드 시 자동)
3. 견적 승인 → 배차 완료 (수동)
4. 배차 완료 → 구인 완료 (수동)
5. 구인 완료 → 설치 중 (행사 전날 자동)
6. 설치 중 → 운영 중 (행사 시작일 자동)
7. 운영 중 → 철거 중 (행사 종료일 자동)
8. 철거 중 → 완료 (수동)

### 자동화 트리거

#### 파일 업로드 감지 (렌탈/멤버쉽만)
- 견적 검토 상태에서 견적서 + 요청서 업로드 → 자동 승인

#### 날짜 기반 자동 변경
- 견적 승인/구인 완료 → 설치 중 (행사 전날)
- 설치 중 → 운영 중 (행사 시작일, 렌탈/멤버쉽만)
- 운영 중 → 철거 중 (행사 종료일)
- 철거 전날 알림 (배차 준비)

## 🛠️ 기술 스택

- **Runtime**: Node.js 18+ (ES Modules)
- **Language**: TypeScript 5.7.2
- **Framework**: Express 4.21.2
- **주요 라이브러리**:
  - `@modelcontextprotocol/sdk`: ^1.16.0
  - `@notionhq/client`: ^2.2.15
  - `xlsx`: ^0.18.5

## 📊 Notion 데이터베이스 필드명 (절대 변경 금지)

### 기본 정보
- `행사명` (title)
- `고객사` (select)
- `고객명` (rich_text) ← ⚠️ '고객담당자' 아님!
- `고객 연락처` (phone_number)
- `행사장` (rich_text)
- `행사 일정` (rich_text) ← "YYYY-MM-DD ~ YYYY-MM-DD" 형식

### 서비스 정보
- `서비스 유형` (select): 설치, 렌탈, 멤버쉽
- `행사 상태` (status): 견적 요청, 견적 검토, 견적 승인 등

### LED 정보 (1-5개소)
- `LED{n} 크기` (rich_text)
- `LED{n} 무대 높이` (number) ← 0mm 허용
- `LED{n} 오퍼레이터 필요` (checkbox)
- `LED{n} 오퍼레이터 일수` (number)

### 파일 정보
- `견적서` (files)
- `요청서` (files)

### 일정 정보
- `설치 일정` (date)
- `리허설 일정` (date)
- `철거 일정` (date)

## 💰 가격 정책 (2024년 기준)

### 배차 로직 (LED 모듈 수량 기준)
- 80개 이하: 1.4톤 리프트 화물차 1대
- 81-208개: 3.5톤 리프트 화물차 1대
- 209-288개: 3.5톤 리프트 화물차 1대 + 1.4톤 리프트 화물차 1대
- 289-416개: 3.5톤 리프트 화물차 2대
- 417개 이상: 3.5톤 리프트 화물차 (208개당 1대)

### 플레이트 케이스
- 모듈 8개당 1개
- 크기: 950x580x1200mm (2단)

## 🚦 프로젝트 구조
led-rental-mcp/
├── src/
│   ├── server.ts              # Express 웹훅 서버 (Railway용)
│   ├── index.ts               # MCP 서버 (stdio)
│   ├── types/                 # TypeScript 타입 정의
│   ├── constants/             # 상수 정의
│   │   ├── messages.ts        # 카카오 메시지
│   │   └── notion-messages.ts # Notion 메시지 (내부용)
│   ├── config/                # 설정 파일
│   │   └── process-config.ts  # 프로세스 플로우 설정
│   ├── utils/                 # 유틸리티 함수
│   │   ├── message-utils.ts   # 메시지 포맷팅
│   │   ├── handler-utils.ts   # 핸들러 공통 함수
│   │   └── notion-message-utils.ts # Notion 메시지 유틸
│   └── tools/
│       ├── handlers/          # 대화 흐름 핸들러
│       ├── services/          # 외부 서비스 연동
│       ├── session/           # 세션 관리
│       ├── validators/        # 입력 검증
│       ├── kakao-chatbot.ts
│       ├── notion-mcp.ts
│       ├── notion-polling.ts  # 10분 간격 폴링
│       ├── notion-scheduler.ts # 1시간 간격 스케줄러
│       ├── notion-status-automation.ts
│       └── calculate-quote.ts
├── .env.example
├── package.json
└── tsconfig.json

## 🔧 설치 및 실행

### 사전 요구사항
- Node.js 18.0.0 이상
- npm 9.0.0 이상
- Notion API 키
- Kakao 개발자 계정

### 환경 설정

1. 저장소 클론:
git clone https://github.com/holica49/led-rental-mcp.git
cd led-rental-mcp

2. 환경 변수 설정:
cp .env.example .env

3. .env 파일 편집:
# Notion API 설정
NOTION_API_KEY=your_notion_api_key
NOTION_DATABASE_ID=your_database_id

# 담당자 설정 (한 줄로 작성)
MANAGERS_CONFIG={"managers":[{"name":"유준수","notionId":"225d872b-594c-8157-b968-0002e2380097","department":"구축팀","isActive":true},{"name":"최수삼","notionId":"237d872b-594c-8174-9ab2-00024813e3a9","department":"렌탈팀","isActive":true}]}

# 기본 주소지
STORAGE_ADDRESS=경기 고양시 덕양구 향동동 396, 현대테라타워DMC 337호

# 포트 설정
PORT=3000

4. 의존성 설치:
npm install

# 개발 모드 실행
npm run dev

# 프로덕션 빌드 실행
npm run build
npm start

# 서버 종료
Ctrl + C

## 🌐 배포 (Railway)
이 프로젝트는 Railway에 최적화되어 있습니다:

GitHub 저장소를 Railway에 연결
환경 변수 설정 (Railway 대시보드)
자동 배포 활성화

배포 URL: https://[your-app-name].railway.app
📱 Kakao 개발자 콘솔 설정

스킬 서버 URL 등록:
https://[your-app-name].railway.app/kakao/skill

메서드: POST
Content-Type: application/json

## 📊 API 엔드포인트
POST /kakao/skill
Kakao 챗봇 웹훅 엔드포인트
GET /polling/status
Notion 폴링 상태 확인
GET /scheduler/status
날짜 기반 스케줄러 상태 확인
POST /polling/trigger
수동으로 상태 변경 트리거 (테스트용)

## 🐛 문제 해결
ES Module Import 오류

모든 상대 경로 import에 .js 확장자 추가 필요
package.json: "type": "module"
tsconfig.json: "module": "ES2022"

Railway 배포 실패

TypeScript를 dependencies에 포함 확인
환경 변수 설정 확인
빌드 로그 확인

Notion 자동화 오류

MANAGERS_CONFIG는 한 줄 JSON으로 작성
Notion API 키와 데이터베이스 ID 확인
"행사 일정" 필드는 텍스트 타입 (날짜 형식 준수)

## 📝 메시지 변경 방법
카카오 챗봇 메시지
src/constants/messages.ts 파일 수정
Notion 내부 메시지
src/constants/notion-messages.ts 파일 수정
프로세스 변경
src/config/process-config.ts 파일 수정

## 📞 담당자 정보

설치 서비스: 유준수 구축팀장
렌탈 서비스: 최수삼 렌탈팀장
멤버쉽 서비스: 최수삼 렌탈팀장

## 🔄 최근 업데이트
2025-07-27

✅ Notion 메시지 중앙화 완료
✅ 날짜 기반 스케줄러 추가
✅ "행사 일정" 텍스트 필드 처리
✅ 서비스별 담당자 자동 멘션

2025-07-26

✅ Notion 폴링 시스템 추가
✅ 상태별 자동화 구현
✅ 파일 업로드 감지 기능
✅ 폴링 주기 10분으로 변경

2025-07-25

✅ ES Module 마이그레이션 완료
✅ TypeScript Strict Mode Phase 1 완료
✅ 메시지 중앙화 리팩토링 완료

## 👥 기여
작성자: 허지성
회사: 오리온디스플레이

## 📄 라이선스
오리온디스플레이 © 2025