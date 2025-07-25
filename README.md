# LED Rental MCP - Kakao Chatbot Integration

LED 렌탈/설치 견적을 자동화하는 Kakao 챗봇 서버입니다. MCP(Model Context Protocol)를 통해 Claude와 연동되며, Notion 데이터베이스와 Excel 파일 생성을 지원합니다.

## 🚨 Claude AI를 위한 핵심 정보

### 프로젝트 불변 규칙
- **Notion 필드명**: `고객명` (~~고객담당자~~ ❌)
- **무대 높이**: 0mm 허용
- **서비스 타입**: 설치, 렌탈, 멤버쉽 (정확히 이 명칭 사용)
- **설치 서비스**: 담당자 언급 제외

### 현재 상태
- **ES Module** 전환 완료 (2025-07-25)
- **모든 import에 .js 확장자** 추가 완료
- **Railway 배포** 정상 작동 중
- **TypeScript strict mode**: 비활성화 (개선 필요)

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

## 🚦 프로젝트 구조

```
led-rental-mcp/
├── src/
│   ├── server.ts          # Express 웹훅 서버 (Railway용)
│   ├── index.ts           # MCP 서버 (stdio)
│   ├── types/             # TypeScript 타입 정의
│   └── tools/
│       ├── handlers/      # 대화 흐름 핸들러
│       ├── services/      # 외부 서비스 연동
│       ├── session/       # 세션 관리
│       ├── utils/         # 유틸리티
│       ├── validators/    # 입력 검증
│       ├── kakao-chatbot.ts
│       ├── notion-mcp.ts
│       ├── calculate-quote.ts
│       └── message-processor.ts
├── .claude/              # Claude Desktop 설정
├── package.json
└── tsconfig.json
```

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

## 🔌 Claude Desktop 연동

1. Claude Desktop 설정 파일 위치:
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`

2. MCP 서버 추가:
```json
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
```

## 📊 API 엔드포인트

### POST /kakao/skill

Kakao 챗봇 웹훅 엔드포인트

**요청 형식**:
```json
{
  "userRequest": {
    "user": {
      "id": "user_id"
    },
    "utterance": "사용자 메시지"
  }
}
```

**응답 형식**:
```json
{
  "version": "2.0",
  "template": {
    "outputs": [{
      "simpleText": {
        "text": "응답 메시지"
      }
    }],
    "quickReplies": [...]
  }
}
```

## 🧪 테스트

```bash
# 타입 체크
npm run typecheck

# 린트
npm run lint

# 포맷
npm run format
```

## 🐛 문제 해결

### ES Module Import 오류
- 모든 상대 경로 import에 `.js` 확장자 추가 필요
- package.json: `"type": "module"`
- tsconfig.json: `"module": "ES2022"`

### Railway 배포 실패
- TypeScript를 dependencies에 포함 확인
- 환경 변수 설정 확인
- 빌드 로그 확인

## 📝 현재 이슈 및 개선 필요사항

1. **TypeScript Strict Mode 비활성화**
   - 현재 47개의 타입 오류로 인해 비활성화
   - 점진적 활성화 필요

2. **세션 관리**
   - 현재: 메모리 기반 (서버 재시작 시 손실)
   - 목표: Redis 기반 영구 세션

3. **코드 구조**
   - kakao-chatbot.ts가 2000줄 이상
   - 추가 분리 및 리팩토링 필요

4. **테스트 코드**
   - 현재 테스트 코드 부재
   - 단위 테스트 및 통합 테스트 필요

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


## 📋 서비스 유형

### 1. LED 렌탈
- 단기 행사용 LED 디스플레이 렌탈
- 기간별 할증 자동 계산
- 설치/철거 일정 관리

### 2. LED 설치
- 상설 LED 디스플레이 설치
- 실내/실외 환경별 맞춤 상담
- 설치 공간 및 예산 분석

### 3. 멤버쉽 서비스
- 기업 회원 전용 할인 서비스
- 멤버 코드 기반 인증
- 맞춤형 견적 제공