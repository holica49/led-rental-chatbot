# LED Rental MCP - Kakao Chatbot Integration

LED 렌탈/설치 견적을 자동화하는 Kakao 챗봇 서버입니다. MCP(Model Context Protocol)를 통해 Claude와 연동되며, Notion 데이터베이스와 Excel 파일 생성을 지원합니다.

## 🚨 Claude AI를 위한 핵심 정보

### 프로젝트 불변 규칙
- **Notion 필드명**: `고객명` (~~고객담당자~~ ❌)
- **무대 높이**: 0mm 허용
- **서비스 타입**: 설치, 렌탈, 멤버쉽 (정확히 이 명칭 사용)
- **설치 서비스**: 담당자 언급 제외

### 현재 상태 (2025-07-25)
- **ES Module** 전환 완료 ✅
- **TypeScript Strict Mode Phase 1** 완료 ✅
- **메시지 중앙화 리팩토링** 진행 중 🚧
- **Railway 배포** 정상 작동 중 ✅

## 🚀 주요 기능

- **Kakao 챗봇**: 대화형 견적 상담 (렌탈/설치 구분)
- **Notion 연동**: 견적 데이터 자동 저장 및 관리
- **파일 업로드**: 견적서를 Notion에 직접 등록
- **실시간 가격 계산**: LED 사양별 자동 견적
- **세션 관리**: 사용자별 대화 상태 유지

## 🛠️ 기술 스택

- **Runtime**: Node.js 18+ (ES Modules)
- **Language**: TypeScript 5.7.2
- **Framework**: Express 4.21.2
- **주요 라이브러리**:
  - `@modelcontextprotocol/sdk`: ^1.16.0
  - `@notionhq/client`: ^2.2.15
  - `xlsx`: ^0.18.5

## 📂 프로젝트 구조

```
led-rental-mcp/
├── src/
│   ├── server.ts              # Express 웹훅 서버 (Railway용)
│   ├── index.ts               # MCP 서버 (stdio)
│   ├── constants/             # 상수 정의
│   │   └── messages.ts        # 메시지 중앙화
│   ├── config/                # 설정 파일
│   │   └── process-config.ts  # 프로세스 플로우 설정
│   ├── utils/                 # 유틸리티 함수
│   │   ├── message-utils.ts   # 메시지 포맷팅
│   │   └── handler-utils.ts   # 핸들러 공통 함수
│   ├── types/                 # TypeScript 타입 정의
│   └── tools/
│       ├── handlers/          # 대화 흐름 핸들러
│       │   ├── install.ts     # 설치 서비스
│       │   ├── rental.ts      # 렌탈 서비스
│       │   ├── membership.ts  # 멤버쉽 서비스
│       │   └── common.ts      # 공통 핸들러
│       ├── services/          # 외부 서비스 연동
│       ├── session/           # 세션 관리
│       ├── validators/        # 입력 검증
│       ├── kakao-chatbot.ts   # 카카오 챗봇 메인
│       ├── notion-mcp.ts      # Notion 연동
│       └── calculate-quote.ts # 견적 계산
├── .claude/                   # Claude Desktop 설정
├── package.json
└── tsconfig.json
```

## 💡 문구 및 프로세스 변경 방법

### 문구 변경
`src/constants/messages.ts` 파일에서 모든 사용자 대화 문구를 관리합니다.

```typescript
// 예시: 인사말 변경
MESSAGES.GREETING = '안녕하세요! 오비스입니다.';

// 예시: 버튼 라벨 변경
BUTTONS.SERVICE_INSTALL = '🏢 설치 문의';
```

### 프로세스 변경
`src/config/process-config.ts` 파일에서 대화 플로우를 수정합니다.

```typescript
// 예시: 새로운 단계 추가
INSTALL: {
  steps: {
    // 기존 단계들...
    new_step: {
      id: 'new_step',
      nextStep: 'next_step_id',
      required: true,
      validation: 'validateFunction'
    }
  }
}
```

### Quick Reply 버튼 변경
`process-config.ts`의 `QUICK_REPLIES_CONFIG`에서 버튼 옵션을 수정합니다.

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

## 🔧 설치 및 실행

### 사전 요구사항
- Node.js 18.0.0 이상
- npm 9.0.0 이상
- Notion API 키
- Kakao 개발자 계정

### 환경 설정

1. 저장소 클론:
```bash
git clone https://github.com/holica49/led-rental-mcp.git
cd led-rental-mcp
```

2. 환경 변수 설정:
```bash
cp .env.example .env
```

`.env` 파일 편집:
```env
NOTION_API_KEY=your_notion_api_key
NOTION_DATABASE_ID=your_database_id
PORT=3000
```

3. 의존성 설치:
```bash
npm install
```

### 개발 모드 실행
```bash
npm run dev
```

### 프로덕션 빌드 및 실행
```bash
npm run build
npm start
```

## 🌐 배포 (Railway)

이 프로젝트는 Railway에 최적화되어 있습니다:

1. GitHub 저장소를 Railway에 연결
2. 환경 변수 설정 (Railway 대시보드)
3. 자동 배포 활성화

배포 URL: `https://[your-app-name].railway.app`

## 📱 Kakao 개발자 콘솔 설정

1. 스킬 서버 URL 등록:
   ```
   https://[your-app-name].railway.app/kakao/skill
   ```

2. 메서드: POST
3. Content-Type: application/json

## 🧪 테스트

```bash
# 타입 체크
npm run typecheck

# 빌드 테스트
npm run build

# 린트 (설정 시)
npm run lint
```

## 🔄 최근 업데이트 (2025-07-25)

### 완료된 작업
- ✅ ES Module 전환
- ✅ TypeScript Strict Mode Phase 1 (`strictNullChecks`, `noImplicitAny`)
- ✅ 메시지 중앙화 시스템 구축
- ✅ 프로세스 설정 파일 분리
- ✅ 핸들러 유틸리티 함수 추가

### 진행 중인 작업
- 🚧 핸들러 파일 리팩토링 (install.ts 완료)
- 🚧 테스트 코드 작성

### 예정된 작업
- 📋 TypeScript Strict Mode Phase 2
- 📋 Redis 세션 저장소 마이그레이션
- 📋 에러 로깅 시스템 구축
- 📋 성능 최적화

## 📞 담당자 정보

- **설치 서비스**: 유준수 구축팀장 (010-7333-3336)
- **렌탈 서비스**: 
  - 실내: 일반 프로세스
  - 실외: 최수삼 렌탈팀장 (010-2797-2504)

## 👥 기여

- 작성자: 허지성
- 회사: 오리온디스플레이

## 📄 라이선스
오리온디스플레이