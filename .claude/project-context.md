# LED 렌탈 MCP 프로젝트 컨텍스트

## 비즈니스 도메인
오리온디스플레이의 LED 렌탈/설치 업무를 자동화하는 카카오톡 챗봇 시스템

## 핵심 기능
1. **설치 서비스**: 상설 LED 설치 상담 및 견적
2. **렌탈 서비스**: 단기 행사용 LED 렌탈 및 견적
3. **멤버쉽 서비스**: 메쎄이상(001) 전용 특별 가격
4. **자동화 시스템**: Notion 상태 기반 업무 자동화
5. **스케줄러**: 날짜 기반 자동 상태 변경

## 기술 스택 (2025-07-27 기준)
- **Runtime**: Node.js 18+ (ES Modules)
- **Language**: TypeScript 5.7.2
- **Module System**: ES Modules (`"type": "module"`)
- **Framework**: Express 4.21.2
- **Database**: Notion API
- **Deployment**: Railway (자동 배포)
- **Session**: In-memory (Redis 마이그레이션 예정)
- **Polling**: 10분 간격 상태 감지
- **Scheduler**: 1시간 간격 날짜 기반 자동화

## 프로젝트 구조
led-rental-mcp/
├── src/
│   ├── server.ts                    # Express 서버 (Railway)
│   ├── index.ts                     # MCP 서버 (Claude)
│   ├── types/                       # TypeScript 타입 정의
│   ├── constants/                   # 상수 정의
│   │   ├── messages.ts              # 카카오톡 메시지
│   │   └── notion-messages.ts       # Notion 자동화 메시지
│   ├── config/                      # 설정 파일
│   │   └── process-config.ts        # 프로세스 플로우 설정
│   ├── utils/                       # 유틸리티 함수
│   │   ├── message-utils.ts         # 메시지 포맷팅
│   │   ├── handler-utils.ts         # 핸들러 공통 함수
│   │   └── notion-message-utils.ts  # Notion 메시지 유틸
│   └── tools/
│       ├── handlers/                # 서비스별 핸들러
│       │   ├── install.ts
│       │   ├── rental.ts
│       │   ├── membership.ts
│       │   ├── common-handlers.ts
│       │   └── index.ts
│       ├── validators/              # 입력 검증
│       ├── services/                # 외부 서비스 연동
│       ├── session/                 # 세션 관리
│       ├── kakao-chatbot.ts         # 메인 챗봇 로직
│       ├── notion-mcp.ts            # Notion 연동
│       ├── notion-polling.ts        # 상태 감지 (10분)
│       ├── notion-scheduler.ts      # 날짜 기반 자동화 (1시간)
│       ├── notion-status-automation.ts # 자동화 처리
│       └── calculate-quote.ts       # 견적 계산

## 자동화 시스템

### 1. 폴링 시스템 (10분마다)
- **상태 변경 감지**: 수동으로 변경된 상태 감지
- **파일 업로드 감지**: 견적서/요청서 업로드 확인
- **자동 승인**: 렌탈/멤버쉽만 파일 완료 시 자동 승인

### 2. 스케줄러 시스템 (1시간마다)
- **견적 승인 → 설치 중**: 행사 전날 자동
- **설치 중 → 운영 중**: 행사 시작일 자동
- **운영 중 → 철거 중**: 행사 종료일 자동
- **철거 알림**: 철거 전날 배차 알림

### 3. 상태별 자동화
1. **견적 요청 → 견적 검토**
   - 견적 정보 자동 계산
   - 견적 내역 댓글 추가
   - 담당자 멘션

2. **견적 검토 → 견적 승인**
   - 파일 업로드 감지 (렌탈/멤버쉽)
   - 자동 승인 처리
   - 상태 변경 알림

3. **견적 승인 → 배차 완료**
   - 배차 정보 생성
   - 트럭 대수/크기 자동 계산
   - 담당자 멘션

### 담당자 멘션 규칙
- **설치**: 유준수 구축팀장
- **렌탈/멤버쉽**: 최수삼 렌탈팀장

## Notion 데이터베이스 스키마
⚠️ **아래 필드명은 절대 변경 불가**

### 기본 정보
- `행사명` (title) - 행사/프로젝트 이름
- `고객사` (select) - 고객 회사명
- `고객명` (rich_text) - 고객 담당자 이름
- `고객 연락처` (phone_number) - 고객 연락처
- `행사장` (rich_text) - 행사 장소

### 서비스 정보
- `서비스 유형` (select) - 설치, 렌탈, 멤버쉽
- `행사 상태` (status) - 견적 요청, 견적 검토, 견적 승인 등
- `멤버 코드` (rich_text) - 멤버쉽 서비스용 코드

### 일정 정보 (⚠️ 주의: 행사 일정은 텍스트 타입)
- `행사 일정` (rich_text) - "YYYY-MM-DD ~ YYYY-MM-DD" 형식
- `설치 일정` (date) - 설치일
- `리허설 일정` (date) - 리허설일
- `철거 일정` (date) - 철거일

### LED 정보 (1-5개소)
각 LED별 속성 (n = 1~5):
- `LED{n} 크기` (rich_text) - 예: "6000x3000"
- `LED{n} 무대 높이` (number) - mm 단위
- `LED{n} 오퍼레이터 필요` (checkbox)
- `LED{n} 오퍼레이터 일수` (number)
- `LED{n} 프롬프터 연결` (checkbox)
- `LED{n} 중계카메라 연결` (checkbox)

### 파일 관리
- `견적서` (files) - 견적서 파일
- `요청서` (files) - 요청서 파일

## 환경 변수 설정

### 필수 환경 변수
# Notion API
NOTION_API_KEY=your_notion_api_key
NOTION_DATABASE_ID=your_database_id

# 담당자 설정 (한 줄로)
MANAGERS_CONFIG={"managers":[{"name":"담당자명","notionId":"notion-id","department":"부서","isActive":true}]}

# 기타
PORT=3000
STORAGE_ADDRESS=경기 고양시 덕양구 향동동 396, 현대테라타워DMC 337호

## 중요 주의사항

Notion 필드명 절대 변경 금지
무대 높이 0mm 허용 필수
"행사 일정"은 텍스트 타입 (date 아님)
모든 import에 .js 확장자 필수
Kakao 응답은 5초 이내
구분선은 ━━━━ (4개)로 통일
MANAGERS_CONFIG는 한 줄 JSON

## 코드 품질 지표
현재 상태

TypeScript Coverage: 100%
Strict Mode: Phase 1 완료
코드 중복: 최소화됨
메시지 중앙화: 100%
자동화: 정상 작동 중
테스트 커버리지: 0% (개선 필요)

목표

테스트 커버리지: 80%
Strict Mode: 전체 활성화
성능: 모든 응답 < 1초
가용성: 99.9%

## 배포 및 운영
Railway 배포

GitHub main 브랜치 자동 배포
환경 변수는 Railway 대시보드에서 관리
로그는 Railway Logs에서 확인

모니터링

/polling/status - 폴링 상태 확인
/scheduler/status - 스케줄러 상태 확인
Railway 대시보드 - 서버 상태
Notion 댓글 - 자동화 실행 이력

트러블슈팅

폴링 안됨: NOTION_API_KEY, DATABASE_ID 확인
멘션 안됨: MANAGERS_CONFIG 형식 확인
자동화 안됨: Notion 필드명 확인
날짜 파싱 오류: 행사 일정 형식 확인

## 📝 4. README.md 업데이트

```markdown
# LED Rental MCP - Kakao Chatbot Integration

LED 렌탈/설치 견적을 자동화하는 Kakao 챗봇 서버입니다. MCP(Model Context Protocol)를 통해 Claude와 연동되며, Notion 데이터베이스 자동화를 지원합니다.

## 🚨 Claude AI를 위한 핵심 정보

### 프로젝트 불변 규칙
- **Notion 필드명**: `고객명` (~~고객담당자~~ ❌)
- **무대 높이**: 0mm 허용
- **서비스 타입**: 설치, 렌탈, 멤버쉽 (정확히 이 명칭 사용)
- **행사 일정**: 텍스트 타입 "YYYY-MM-DD ~ YYYY-MM-DD"
- **구분선**: `━━━━` (4개)로 통일

### 현재 상태 (2025-07-27)
- **ES Module** 전환 완료
- **모든 import에 .js 확장자** 추가 완료
- **Railway 배포** 정상 작동 중
- **TypeScript strict mode**: Phase 1 완료
- **메시지 중앙화**: 완료
- **Notion 폴링**: 10분 간격 정상 작동 중
- **날짜 기반 스케줄러**: 1시간 간격 정상 작동 중

## 🚀 주요 기능

- **Kakao 챗봇**: 대화형 견적 상담 (렌탈/설치 구분)
- **Notion 연동**: 견적 데이터 자동 저장 및 관리
- **자동화 시스템**: 
  - 상태 변경 자동 감지 (10분마다)
  - 날짜 기반 자동 상태 변경 (1시간마다)
  - 파일 업로드 자동 승인
  - 담당자 자동 멘션
- **실시간 가격 계산**: LED 사양별 자동 견적
- **세션 관리**: 사용자별 대화 상태 유지

## 🤖 Notion 자동화 기능

### 1. 상태 변경 감지 (폴링 - 10분마다)
- 수동 상태 변경 감지 및 자동화 실행
- 파일 업로드 감지 (렌탈/멤버쉽만 자동 승인)
- 담당자 멘션 알림

### 2. 날짜 기반 자동화 (스케줄러 - 1시간마다)
- **견적 승인 → 설치 중**: 행사 전날
- **설치 중 → 운영 중**: 행사 시작일
- **운영 중 → 철거 중**: 행사 종료일
- **철거 알림**: 철거 전날 배차 요청

### 3. 상태별 자동화
1. **견적 검토**: 견적 정보 자동 생성 및 댓글 추가
2. **견적 승인**: 배차 정보 자동 생성
3. **구인 완료**: 최종 체크리스트 생성
4. **파일 업로드 감지**: 견적서/요청서 모두 업로드 시 자동 승인

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

### 서비스 정보
- `서비스 유형` (select): 설치, 렌탈, 멤버쉽
- `행사 상태` (status): 견적 요청, 견적 검토, 견적 승인 등

### 일정 정보
- `행사 일정` (rich_text): "2025-07-26 ~ 2025-07-28" 형식
- `설치 일정` (date): 설치일
- `철거 일정` (date): 철거일

### LED 정보 (1-5개소)
- `LED{n} 크기` (rich_text)
- `LED{n} 무대 높이` (number) ← 0mm 허용
- `LED{n} 오퍼레이터 필요` (checkbox)
- `LED{n} 오퍼레이터 일수` (number)

### 파일 정보
- `견적서` (files)
- `요청서` (files)

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

## 🚦 프로젝트 구조
led-rental-mcp/
├── src/
│   ├── server.ts                    # Express 웹훅 서버
│   ├── index.ts                     # MCP 서버
│   ├── constants/                   # 상수 정의
│   │   ├── messages.ts              # 카카오톡 메시지
│   │   └── notion-messages.ts       # Notion 자동화 메시지
│   ├── utils/                       # 유틸리티
│   │   └── notion-message-utils.ts  # Notion 메시지 유틸
│   └── tools/
│       ├── notion-polling.ts        # 상태 감지 (10분)
│       ├── notion-scheduler.ts      # 날짜 자동화 (1시간)
│       └── notion-status-automation.ts # 자동화 처리

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

.env 파일 편집:
# Notion API 설정
NOTION_API_KEY=your_notion_api_key
NOTION_DATABASE_ID=your_database_id

# 담당자 설정 (한 줄로 작성)
MANAGERS_CONFIG={"managers":[{"name":"유준수","notionId":"225d872b-594c-8157-b968-0002e2380097","department":"구축팀","isActive":true},{"name":"최수삼","notionId":"237d872b-594c-8174-9ab2-00024813e3a9","department":"렌탈팀","isActive":true}]}

# 기본 주소지
STORAGE_ADDRESS=경기 고양시 덕양구 향동동 396, 현대테라타워DMC 337호

# 포트 설정
PORT=3000

3. 의존성 설치:
npm install

### 개발 모드 실행
npm run dev

### 프로덕션 빌드 및 실행
npm run build
npm start

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



## 🔌 Claude Desktop 연동

1. Claude Desktop 설정 파일 위치:

Windows: %APPDATA%\Claude\claude_desktop_config.json
macOS: ~/Library/Application Support/Claude/claude_desktop_config.json


2. MCP 서버 추가:
{
  "mcpServers": {
    "led-rental-mcp": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "C:/path/to/led-rental-mcp",
      "env": {
        "NOTION_API_KEY": "your_api_key",
        "NOTION_DATABASE_ID": "your_database_id"
      }
    }
  }
}

## 📊 API 엔드포인트
POST /kakao/skill
Kakao 챗봇 웹훅 엔드포인트
GET /polling/status
Notion 폴링 상태 확인 (10분 간격)
GET /scheduler/status
Notion 스케줄러 상태 확인 (1시간 간격)
POST /polling/trigger
수동으로 상태 변경 트리거 (테스트용)

## 🧪 테스트
# 타입 체크
npm run typecheck

# 린트
npm run lint

# 포맷
npm run format

## 🐛 문제 해결
ES Module Import 오류

모든 상대 경로 import에 .js 확장자 추가 필요
package.json: "type": "module"
tsconfig.json: "module": "ES2022"

Railway 배포 실패

TypeScript를 dependencies에 포함 확인
환경 변수 설정 확인
빌드 로그 확인

Notion 폴링 오류

MANAGERS_CONFIG는 한 줄 JSON으로 작성
Notion API 키와 데이터베이스 ID 확인
담당자 Notion ID가 올바른지 확인

행사 일정 오류

"행사 일정"은 텍스트 타입이어야 함
"YYYY-MM-DD ~ YYYY-MM-DD" 형식 준수

## 📝 문구/프로세스 변경 방법
문구 변경

카카오톡 메시지: src/constants/messages.ts
Notion 자동화 메시지: src/constants/notion-messages.ts
빌드 및 배포

프로세스 변경

src/config/process-config.ts 파일 수정
대화 플로우 단계 추가/제거/수정
빌드 및 배포

📞 담당자 정보

설치 서비스: 유준수 구축팀장 (010-7333-3336)
렌탈 서비스: 최수삼 렌탈팀장 (010-2797-2504)
멤버쉽 서비스: 최수삼 렌탈팀장 (010-2797-2504)

## 🔄 최근 업데이트
2025-07-27

✅ Notion 메시지 중앙화 시스템 구현
✅ 날짜 기반 자동화 스케줄러 추가
✅ 폴링 주기 최적화 (30초 → 10분)
✅ 텍스트 타입 "행사 일정" 필드 지원

2025-07-26

✅ Notion 폴링 시스템 추가
✅ 상태별 자동화 구현
✅ 파일 업로드 감지 기능
✅ 담당자 자동 멘션

2025-07-25

✅ ES Module 마이그레이션 완료
✅ TypeScript Strict Mode Phase 1 완료
✅ 메시지 중앙화 리팩토링 완료
✅ 핸들러 구조 개선 완료

## 👥 기여

작성자: 허지성
회사: 오리온디스플레이

## 📄 라이선스
오리온디스플레이

## 📋 서비스 유형
1. LED 렌탈

단기 행사용 LED 디스플레이 렌탈
기간별 할증 자동 계산
설치/철거 일정 관리

2. LED 설치

상설 LED 디스플레이 설치
실내/실외 환경별 맞춤 상담
설치 공간 및 예산 분석

3. 멤버쉽 서비스

기업 회원 전용 할인 서비스
멤버 코드 기반 인증
맞춤형 견적 제공

