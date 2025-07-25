# LED 렌탈 MCP 프로젝트 컨텍스트

## 비즈니스 도메인
오리온디스플레이의 LED 렌탈/설치 업무를 자동화하는 카카오톡 챗봇 시스템

## 핵심 기능
1. **설치 서비스**: 상설 LED 설치 상담 및 견적
2. **렌탈 서비스**: 단기 행사용 LED 렌탈 및 견적
3. **멤버쉽 서비스**: 메쎄이상(001) 전용 특별 가격

## 기술 스택 (2025-07-25 기준)
- **Runtime**: Node.js 18+ (ES Modules)
- **Language**: TypeScript 5.7.2
- **Module System**: ES Modules (`"type": "module"`)
- **Framework**: Express 4.21.2
- **Database**: Notion API
- **Deployment**: Railway (자동 배포)
- **Session**: In-memory (Redis 마이그레이션 예정)

## 프로젝트 구조
led-rental-mcp/
├── src/
│   ├── server.ts              # Express 서버 (Railway)
│   ├── index.ts               # MCP 서버 (Claude)
│   ├── types/                 # TypeScript 타입 정의
│   ├── constants/             # 상수 정의
│   │   └── messages.ts        # 모든 메시지 중앙화
│   ├── config/                # 설정 파일
│   │   └── process-config.ts  # 프로세스 플로우 설정
│   ├── utils/                 # 유틸리티 함수
│   │   ├── message-utils.ts   # 메시지 포맷팅
│   │   └── handler-utils.ts   # 핸들러 공통 함수
│   └── tools/
│       ├── handlers/          # 서비스별 핸들러
│       │   ├── install.ts
│       │   ├── rental.ts
│       │   ├── membership.ts
│       │   ├── common-handlers.ts
│       │   └── index.ts
│       ├── validators/        # 입력 검증
│       ├── services/          # 외부 서비스 연동
│       ├── session/           # 세션 관리
│       ├── kakao-chatbot.ts   # 메인 챗봇 로직
│       ├── notion-mcp.ts      # Notion 연동
│       └── calculate-quote.ts # 견적 계산

## Notion 데이터베이스 스키마
⚠️ **아래 필드명은 절대 변경 불가**

### 기본 정보
- `행사명` (title)
- `고객사` (select)
- `고객명` (rich_text) ← ⚠️ '고객담당자' 아님!
- `고객 연락처` (phone_number)
- `행사장` (rich_text)
- `서비스 유형` (select): 설치, 렌탈, 멤버쉽
- `행사 상태` (status)

### LED 정보 (1-5개소)
- `LED{n} 크기` (rich_text) - 예: "6000x3000"
- `LED{n} 무대 높이` (number) ← **0mm 허용**
- `LED{n} 오퍼레이터 필요` (checkbox)
- `LED{n} 오퍼레이터 일수` (number)

### 견적 정보
- `총 견적` (number)
- `부가세 포함` (number)
- `견적서` (files) ← 파일 업로드

## 리팩토링 현황 (2025-07-25)

### ✅ 완료된 작업
1. **ES Module 전환 완료**
   - 모든 import에 `.js` 확장자 추가
   - Railway 배포 정상 작동

2. **TypeScript Strict Mode Phase 1 완료**
   - `strictNullChecks` 활성화
   - `noImplicitAny` 활성화
   - 47개 타입 오류 해결

3. **메시지 중앙화 완료**
   - `constants/messages.ts` - 모든 메시지 통합
   - `utils/message-utils.ts` - 메시지 포맷팅 유틸리티
   - `utils/handler-utils.ts` - 핸들러 공통 유틸리티
   - 구분선 통일 (`━━━━`)

4. **프로세스 설정 분리**
   - `config/process-config.ts` - 대화 플로우 설정
   - Quick Reply 설정 중앙화

5. **핸들러 리팩토링 완료**
   - ✅ `handlers/install.ts`
   - ✅ `handlers/rental.ts`
   - ✅ `handlers/membership.ts`
   - ✅ `handlers/common-handlers.ts`
   - ✅ `handlers/index.ts`
   - ✅ `message-processor.ts`

### 🎯 개선된 코드 구조

#### 메시지 처리 패턴
```typescript
// Before: 하드코딩된 메시지
text: `✅ 설치 지역: ${region}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n어떤 공간에...`

// After: 유틸리티 함수 사용
text: confirmAndAsk('설치 지역', region, MESSAGES.SELECT_SPACE)


Quick Reply 패턴
// Before: 수동 생성
quickReplies: [
  { label: '🏢 기업', action: 'message', messageText: '기업' },
  // ...
]

// After: 헬퍼 함수 사용
quickReplies: createQuickReplies([
  { label: BUTTONS.SPACE_CORPORATE, value: '기업' },
  // ...
])

문구/프로세스 변경 방법
문구 변경

src/constants/messages.ts 파일 수정
원하는 메시지 찾아서 변경
빌드 및 배포

프로세스 변경

src/config/process-config.ts 파일 수정
대화 플로우 단계 추가/제거/수정
빌드 및 배포

버튼 변경

src/constants/messages.ts의 BUTTONS 섹션 수정
src/config/process-config.ts의 QUICK_REPLIES_CONFIG 수정

주요 파일 역할
constants/messages.ts

모든 사용자 대화 메시지
버튼 라벨
검증 에러 메시지
성공 메시지 템플릿

utils/message-utils.ts

메시지 포맷팅 함수
구분선 관리
LED 정보 포맷팅
이모지 상수

utils/handler-utils.ts

Quick Reply 생성
공통 검증 로직
LED 관련 헬퍼 함수
세션 데이터 처리

config/process-config.ts

서비스별 대화 플로우 정의
단계별 진행 설정
Quick Reply 구성

중요 주의사항

Notion 필드명 절대 변경 금지
무대 높이 0mm 허용 필수
설치 서비스는 담당자 언급 안함
모든 import에 .js 확장자 필수
Kakao 응답은 5초 이내
구분선은 ━━━━ (4개)로 통일

현재 이슈 및 개선 필요사항
⏳ 진행 예정

테스트 코드 작성
Redis 세션 저장소 마이그레이션
TypeScript Strict Mode Phase 2

📅 장기 계획

에러 로깅 시스템 구축
성능 모니터링 도구 연동
API 문서화
다국어 지원

코드 품질 지표
현재 상태

TypeScript Coverage: 100%
Strict Mode: Phase 1 완료
코드 중복: 최소화됨
메시지 중앙화: 100%
테스트 커버리지: 0% (개선 필요)

목표

테스트 커버리지: 80%
Strict Mode: 전체 활성화
성능: 모든 응답 < 1초
가용성: 99.9%