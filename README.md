# LED Rental MCP - Kakao Chatbot & Advanced LINE WORKS Bot Integration

LED 렌탈/설치 견적을 자동화하는 Kakao 챗봇과 **고도화된 AI 파싱 기능**을 갖춘 LINE WORKS 봇 통합 시스템입니다. MCP(Model Context Protocol)를 통해 Claude와 연동되며, **자연어 처리**로 복잡한 일정 정보를 자동으로 추출하여 Notion 데이터베이스와 LINE WORKS 캘린더에 저장합니다.

## 🚨 Claude AI를 위한 핵심 정보

### 프로젝트 불변 규칙
- **Notion 필드명**: 아래 [Notion 데이터베이스 스키마](#-notion-데이터베이스-스키마) 참조
- **무대 높이**: 0mm 허용
- **서비스 타입**: 설치, 렌탈, 멤버쉽 (정확히 이 명칭 사용)
- **구분선**: `━━━━` (4개)로 통일
- **LED 해상도**: 모듈당 168x168px 기준

### 현재 상태 (2025-08-16)
- **ES Module** 전환 완료
- **모든 import에 .js 확장자** 추가 완료
- **Railway 배포** 정상 작동 중
- **TypeScript strict mode**: Phase 1 완료
- **메시지 중앙화**: 완료
- **Notion 폴링**: 10분 간격 작동 중
- **날짜 기반 스케줄러**: 1시간 간격 작동 중
- **이전 단계 기능**: 구현 완료 ✨
- **메시지 톤 개선**: 이모지 최소화, 간결한 문구 ✨
- **UI 개선**: 진행 상황 표시 ([현재/전체]) ✨
- **견적 계산 개선**: 멤버쉽/렌탈 계산 로직 수정 ✨
- **LINE WORKS 봇**: 구현 완료, 인증 성공 ✨
- **카카오 엔티티 문제**: 해결 완료 (엔티티 삭제) ✨
- **🆕 고도화된 MCP 캘린더 연동**: 자연어 파싱으로 스마트 일정 관리 ✨

## 🚀 주요 기능

### 1. Kakao 챗봇
- 대화형 견적 상담 (렌탈/설치/멤버쉽 구분)
- 세션 기반 대화 상태 관리
- 서비스별 맞춤 프로세스
- **이전 단계로 돌아가기 기능** ✨
- **간결하고 친절한 메시지 톤** ✨
- **진행 상황 표시** ([3/10] 형식) ✨
- **단축어 지원**: "처음", "이전" ✨

### 2. 🆕 고도화된 LINE WORKS 봇 
- **프로젝트 현황 조회**: "강남LED 현황"
- **일정 관리**: "오늘 일정", "이번주 일정"
- **재고 확인**: "재고 현황"
- **🤖 AI 스마트 일정 등록**: 복잡한 자연어 처리
- **OAuth 2.0 인증**: Service Account + JWT
- **실시간 메시지 응답**: 업무 정보 즉시 제공

### 3. 🆕 고도화된 MCP 캘린더 연동
- **Claude가 직접 캘린더 관리**: MCP를 통한 LINE WORKS 캘린더 API 호출
- **🧠 AI 자연어 파싱**: 복잡한 일정 정보 자동 추출
- **이중 저장**: Notion + LINE WORKS 캘린더 동시 저장
- **Service Account 권한**: Bot 제한 우회, 강력한 캘린더 관리
- **스마트 기능**: 참석자, 회의유형, 우선순위, 준비물 자동 인식

#### 🧠 AI 자연어 파싱 기능
```
입력: "다음 주 화요일 오후 3시에 강남 스타벅스에서 김대리와 중요한 프로젝트 회의, 30분 전 알림, PPT 준비"

AI 자동 추출:
✅ 날짜: 2025-08-26 (정확한 날짜 계산)
⏰ 시간: 15:00
📌 제목: 프로젝트 회의
📍 장소: 강남 스타벅스
👥 참석자: 김대리 (김대리@anyractive.co.kr)
📋 유형: 내부 회의
⚡ 우선순위: 높음 🔴
🔔 알림: 30분 전
📝 준비물: PPT
📊 AI 신뢰도: 85%
```

#### 🎯 캘린더 이벤트 고도화
- **아이콘 제목**: `🔴 🏢 프로젝트 회의 (1명)`
- **참석자 자동 이메일 생성**: `김대리@anyractive.co.kr`
- **우선순위 기반 설정**: 중요도 1-9, 공개/비공개 자동 결정
- **스마트 알림**: 중요한 일정만 자동 알림 발송
- **회의 유형 분류**: 내부회의, 고객미팅, 프레젠테이션 등

### 4. Notion 연동
- 견적 데이터 자동 저장
- 실시간 상태 관리
- 파일 업로드 처리
- **운반비 구간별 계산** (200개 이하/201-400개/401개 이상) ✨

### 5. 자동화 시스템
- **폴링 (10분마다)**: 상태 변경 감지, 파일 업로드 감지
- **스케줄러 (1시간마다)**: 날짜 기반 자동 상태 변경
- **담당자 자동 멘션**: 서비스별 적절한 담당자 알림
- **Notion 메시지 템플릿 기반 알림** ✨

## 💰 가격 정책 업데이트 (2025년 기준)

### 멤버쉽 서비스
- **LED 모듈**: 500개까지 무료, 501개부터 34,000원/개
- **지지구조물**: 평방미터당 20,000원(4m 미만) / 25,000원(4m 이상)
- **컨트롤러**: 200인치 미만 200,000원 / 이상 500,000원
- **파워**: 250인치 이상만 500,000원
- **오퍼레이터**: 280,000원/일
- **설치인력**: 160,000원/명 (모듈 수량별 차등)

### 렌탈 서비스 (실내)
- **계산 항목**: LED 모듈 + 운반비 + 오퍼레이터 + 기간할증
- **기간 할증**: 1-3일(1.0배), 4-6일(1.1배), 7-9일(1.2배), 10일+(1.3배)
- **나머지 항목**: 0원 처리

### 운반비 구간 (모든 서비스)
- 200개 이하: 200,000원
- 201-400개: 500,000원  
- 401개 이상: 700,000원

## 🤖 봇 통합 시스템

### Kakao 챗봇 엔드포인트
- URL: `/kakao/skill`
- 메서드: POST
- 모든 발화를 스킬 서버에서 처리 (엔티티 제거)

### LINE WORKS 봇 엔드포인트
- URL: `/lineworks/callback`
- 메서드: POST
- Webhook 서명 검증 포함

### 🆕 고도화된 MCP 캘린더 연동
- **도구명**: `lineworks_calendar`
- **액션**: `create` (일정 생성), `get` (일정 조회)
- **API**: `https://www.worksapis.com/v1.0/users/{userId}/calendar/events`
- **자연어 파싱**: `AdvancedCalendarParser` 클래스 사용
- **AI 신뢰도**: 30% 이상일 때 등록, 70% 이상 권장

### 상태 확인 엔드포인트
| 엔드포인트 | 메서드 | 설명 |
|------------|--------|------|
| `/polling/status` | GET | Notion 폴링 상태 확인 |
| `/scheduler/status` | GET | 날짜 기반 스케줄러 상태 |
| `/lineworks/send-test` | POST | LINE WORKS 메시지 테스트 |

## 📊 Notion 데이터베이스 스키마

### 기본 정보 필드
| 필드명 | 타입 | 설명 | 필수 |
|--------|------|------|------|
| 행사명 | title | 행사/프로젝트 이름 | ✅ |
| 고객사 | select | 고객 회사명 | ✅ |
| 고객명 | rich_text | 고객 담당자 이름 | ✅ |
| 고객 연락처 | phone_number | 고객 연락처 | ✅ |
| 행사장 | rich_text | 행사 장소 | ✅ |
| 담당자 | people | 내부 담당자 | ⚪ |

### 서비스 관련 필드
| 필드명 | 타입 | 설명 | 사용 서비스 |
|--------|------|------|------------|
| 서비스 유형 | select | 설치/렌탈/멤버쉽/일정 | 전체 |
| 행사 상태 | status | 진행 상태 | 전체 |
| 멤버 코드 | rich_text | 멤버쉽 코드 | 멤버쉽 |
| 설치 환경 | select | 실내/실외 | 설치, 렌탈 |
| 설치 공간 | select | 기업/상가/병원 등 | 설치 |
| 설치 예산 | select | 예산 범위 | 설치, 렌탈(실외) |
| 문의 목적 | select | 정보조사/견적 등 | 설치, 렌탈(실외) |
| 지지구조물 방식 | select | 목공/단독 설치 | 렌탈 |

### 일정 필드
| 필드명 | 타입 | 설명 | 형식 |
|--------|------|------|------|
| 행사 일정 | rich_text | 행사 기간 | YYYY-MM-DD ~ YYYY-MM-DD |
| 설치 일정 | date | 설치일 | YYYY-MM-DD |
| 리허설 일정 | date | 리허설일 | YYYY-MM-DD |
| 철거 일정 | date | 철거일 | YYYY-MM-DD |

### LED 정보 필드 (1-5개소)
각 LED별로 다음 필드들이 존재 (예: LED1, LED2, ... LED5):

| 필드명 | 타입 | 설명 |
|--------|------|------|
| LED{n} 크기 | rich_text | LED 크기 (예: 6000x3000) |
| LED{n} 무대 높이 | number | 무대 높이 (mm) |
| LED{n} 오퍼레이터 필요 | checkbox | 오퍼레이터 필요 여부 |
| LED{n} 오퍼레이터 일수 | number | 오퍼레이터 일수 |
| LED{n} 프롬프터 연결 | checkbox | 프롬프터 연결 여부 |
| LED{n} 중계카메라 연결 | checkbox | 중계카메라 연결 여부 |
| LED{n} 모듈 수량 | number | LED 모듈 개수 |
| LED{n} 대각선 인치 | rich_text | 대각선 크기 |
| LED{n} 해상도 | rich_text | 해상도 정보 (168px/모듈) |
| LED{n} 소비전력 | rich_text | 소비 전력 |
| LED{n} 전기설치 방식 | rich_text | 전기 설치 방식 |

### 비용 필드
| 필드명 | 타입 | 설명 |
|--------|------|------|
| 견적 금액 | number | 총 견적 금액 (VAT 포함) |
| LED 모듈 비용 | number | LED 모듈 비용 |
| 지지구조물 비용 | number | 구조물 설치 비용 |
| 컨트롤러 및 스위치 비용 | number | 컨트롤러 비용 |
| 파워 비용 | number | 전원 장치 비용 |
| 설치철거인력 비용 | number | 인력 비용 |
| 오퍼레이터 비용 | number | 오퍼레이터 비용 |
| 운반 비용 | number | 운송 비용 |
| 기간 할증 비용 | number | 렌탈 기간 할증 |

### 기타 필드
| 필드명 | 타입 | 설명 |
|--------|------|------|
| 총 LED 모듈 수량 | number | 전체 모듈 개수 |
| 문의요청 사항 | rich_text | 추가 요청사항 |
| 견적서 | files | 견적서 파일 |
| 요청서 | files | 요청서 파일 |

## 🛠️ 기술 스택

- **Runtime**: Node.js 18+ (ES Modules)
- **Language**: TypeScript 5.7.2
- **Framework**: Express 4.21.2
- **주요 라이브러리**:
  - `@modelcontextprotocol/sdk`: ^1.16.0
  - `@notionhq/client`: ^2.2.15
  - `jsonwebtoken`: ^9.0.2 (LINE WORKS)
  - `axios`: ^1.11.0
  - `xlsx`: ^0.18.5

## 🔧 설치 및 실행

### 사전 요구사항
- Node.js 18.0.0 이상
- npm 9.0.0 이상
- Notion API 키
- Kakao 개발자 계정
- LINE WORKS 개발자 계정

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

3. .env 파일 편집:
```env
# Notion API 설정
NOTION_API_KEY=your_notion_api_key
NOTION_DATABASE_ID=your_database_id

# 담당자 설정 (한 줄로 작성)
MANAGERS_CONFIG={"managers":[{"name":"유준수","notionId":"225d872b-594c-8157-b968-0002e2380097","department":"구축팀","isActive":true},{"name":"최수삼","notionId":"237d872b-594c-8174-9ab2-00024813e3a9","department":"렌탈팀","isActive":true}]}

# LINE WORKS Bot (고도화된 캘린더 기능)
LINEWORKS_BOT_ID=your_bot_id
LINEWORKS_BOT_SECRET=your_bot_secret
LINEWORKS_CLIENT_ID=your_client_id
LINEWORKS_CLIENT_SECRET=your_client_secret
LINEWORKS_DOMAIN_ID=your_domain_id
LINEWORKS_SERVICE_ACCOUNT_ID=your_service_account_id
LINEWORKS_PRIVATE_KEY=your_private_key_with_newlines_as_\n

# 기본 주소지
STORAGE_ADDRESS=경기 고양시 덕양구 향동동 396, 현대테라타워DMC 337호

# 포트 설정
PORT=3000
```

4. 의존성 설치:
```bash
npm install
```

### 개발 모드 실행
```bash
npm run dev
```

### 프로덕션 빌드 실행
```bash
npm run build
npm start
```

### 테스트
```bash
# LINE WORKS 인증 테스트
npm run test:lineworks
```

## 🌐 배포 (Railway)

이 프로젝트는 Railway에 최적화되어 있습니다:

1. GitHub 저장소를 Railway에 연결
2. 환경 변수 설정 (Railway 대시보드)
3. 자동 배포 활성화

배포 URL: `https://[your-app-name].railway.app`

### Railway 환경 변수 설정

Railway 대시보드에서 모든 환경 변수를 설정해야 합니다:
- Notion API 관련
- LINE WORKS 관련 (Private Key는 한 줄로)
- 담당자 설정

## 📱 카카오 개발자 콘솔 설정

### 스킬 서버 URL 등록
- URL: `https://[your-app-name].railway.app/kakao/skill`
- 메서드: POST
- Content-Type: application/json

### 엔티티 설정 주의사항
- @SERVICE_TYPE 엔티티 삭제 또는 비활성화
- 모든 발화를 스킬 서버에서 처리하도록 설정

## 💬 LINE WORKS 설정

### Developers Console 설정
1. Bot 생성 및 활성화
2. OAuth Scopes 설정: `bot`, `bot.message`, `user.read`, `calendar`, `calendar.read`
3. Service Account 생성
4. Private Key 다운로드
5. Callback URL 설정: `https://[your-app-name].railway.app/lineworks/callback`

### 🆕 고도화된 MCP 캘린더 설정
- **API 엔드포인트**: `https://www.worksapis.com/v1.0/users/{userId}/calendar/events`
- **필요 권한**: `calendar`, `calendar.read`
- **자연어 파싱**: AI가 복잡한 문장에서 정보 자동 추출
- **스마트 기능**: 참석자 이메일 자동 생성, 우선순위 기반 설정

### 사용 방법
1. LINE WORKS 앱에서 봇 검색
2. 대화 시작
3. 명령어:
   - "안녕" - 사용법 안내
   - "[프로젝트명] 현황" - 프로젝트 조회
   - "오늘 일정" / "이번주 일정" - 일정 확인
   - "재고 현황" - LED 재고 확인
   - **🆕 "다음 주 화요일 오후 3시에 강남 스타벅스에서 김대리와 중요한 프로젝트 회의, 30분 전 알림, PPT 준비"** - AI 스마트 일정 등록

## 💬 사용자 인터페이스

### Kakao 챗봇 대화 기능
- **처음으로**: "처음", "처음부터", "처음으로", "초기화", "리셋" 입력 시 처음부터 다시 시작
- **이전 단계**: "이전", "뒤로", "돌아가" 입력 시 이전 단계로 돌아가기
- **Quick Reply**: 각 단계별 빠른 선택 버튼 제공
- **진행 상황 표시**: [현재/전체] 형식으로 진행 단계 표시

### 메시지 형식
```
[3/10] LED 크기를 알려주세요.

💡 가로x세로 형식으로 입력해 주시면 됩니다.
예시: 5000x3000
```

### LED 정보 표시 형식
- **설정 완료**: `LED1: 6000x3000 (무대높이 : 600mm)`
- **최종 확인 (렌탈)**: `LED1: 6000x3000mm (2016x1008px, 무대높이 : 600mm)`
- **최종 확인 (멤버쉽)**: `LED1: 6000x3000mm (2016x1008px, 14.4kW, 오퍼레이터 2일)`

### 🆕 고도화된 MCP 캘린더 일정 등록
```
사용자: "다음 주 화요일 오후 3시에 강남 스타벅스에서 김대리와 중요한 프로젝트 회의, 30분 전 알림, PPT 준비"

봇 응답:
✅ 고도화된 AI로 LINE WORKS 캘린더에 일정을 등록했습니다!

📅 날짜: 2025-08-26
⏰ 시간: 15:00
📌 제목: 프로젝트 회의
📍 장소: 강남 스타벅스
👥 참석자: 김대리
📋 유형: 내부 회의
⚡ 우선순위: 높음 🔴
🔔 알림: 30분 전
📝 준비물: PPT

🤖 AI 분석 결과:
📊 신뢰도: 85%
🔍 인식된 정보:
  • 날짜: 2025-08-26
  • 시간: 15:00
  • 제목: 프로젝트 회의
  • 장소: 강남 스타벅스
  • 참석자: 김대리
  • 회의 유형: internal
  • 우선순위: high
  • 알림: 30분 전

💾 저장 위치:
• Notion: ✅ 성공
• LINE WORKS 캘린더: ✅ 성공
```

## 🐛 트러블슈팅

### ES Module Import 오류
- 모든 상대 경로 import에 .js 확장자 추가 필요
- package.json: `"type": "module"`
- tsconfig.json: `"module": "ES2022"`

### Railway 배포 실패
- TypeScript를 dependencies에 포함 확인
- 환경 변수 설정 확인
- 빌드 로그 확인

### LINE WORKS 인증 오류
- Private Key 환경 변수 형식 확인 (줄바꿈을 \n으로)
- Service Account ID 확인
- OAuth Scopes 설정 확인: `bot`, `bot.message`, `user.read`, `calendar`, `calendar.read`

### 🆕 고도화된 MCP 캘린더 연동 오류
- **403 Forbidden**: calendar scope 권한 확인
- **404 Not Found**: API 엔드포인트 확인 (`https://www.worksapis.com/v1.0/users/{userId}/calendar/events`)
- **400 Bad Request**: `INVALID_CALENDAR_PROPERTY` → 지원되지 않는 속성 제거
- **AI 파싱 실패**: 신뢰도 30% 미만 시 더 구체적인 입력 요청
- **참석자 이메일 오류**: 이름 → 이메일 변환 로직 확인

### Notion 자동화 오류
- MANAGERS_CONFIG는 한 줄 JSON으로 작성
- Notion API 키와 데이터베이스 ID 확인
- "행사 일정" 필드는 텍스트 타입 (날짜 형식 준수)

### Circular Dependency 오류
- process-config.ts와 messages.ts 순환 참조 주의
- QUICK_REPLIES_CONFIG 분리로 해결

### 카카오 챗봇 FAQ 문제
- 엔티티(@SERVICE_TYPE) 삭제 또는 비활성화
- 모든 발화를 스킬 서버에서 처리하도록 설정

## 📝 메시지 변경 방법

1. **카카오 챗봇 메시지**: `src/constants/messages.ts` 파일 수정
2. **Notion 내부 메시지**: `src/constants/notion-messages.ts` 파일 수정
3. **프로세스 변경**: `src/config/process-config.ts` 파일 수정
4. **🆕 자연어 파싱 설정**: `src/utils/nlp-calendar-parser.ts` 파일 수정

## 📞 담당자 정보

- **설치 서비스**: 유준수 구축팀장
- **렌탈 서비스**: 최수삼 렌탈팀장
- **멤버쉽 서비스**: 최수삼 렌탈팀장

## 🔄 최근 업데이트

### 2025-08-16 🆕
- ✅ **고도화된 자연어 파싱** 완료
- ✅ **AI 기반 일정 정보 추출**: 참석자, 회의유형, 우선순위, 준비물 자동 인식
- ✅ **LINE WORKS 캘린더 API 완전 통합**: 장소, 참석자, 알림, 우선순위 모든 기능 지원
- ✅ **스마트 캘린더 이벤트**: 아이콘 제목, 자동 이메일 생성, 신뢰도 기반 검증
- ✅ **복잡한 자연어 처리**: "다음 주 화요일 오후 3시에 강남 스타벅스에서 김대리와 중요한 프로젝트 회의" 완벽 파싱

### 2025-08-15 🆕
- ✅ MCP 캘린더 연동 완료
- ✅ LINE WORKS Calendar API 통합 (`https://www.worksapis.com/v1.0/users/{userId}/calendar/events`)
- ✅ 자연어 일정 파싱 ("내일 오후 2시 회의" → 캘린더 이벤트)
- ✅ Claude가 직접 캘린더 관리 (MCP를 통한 Service Account 권한 활용)
- ✅ Notion + LINE WORKS 캘린더 동시 저장

### 2025-08-11 ✨
- ✅ LINE WORKS 봇 구현 완료
- ✅ OAuth 2.0 인증 (Service Account + JWT)
- ✅ 프로젝트 현황, 일정, 재고 조회 기능
- ✅ 카카오 엔티티 문제 해결 (엔티티 삭제)

### 2025-08-08
- ✅ UI 개선: 진행 상황 표시 ([현재/전체])
- ✅ 첫 질문에 단축어 안내 추가
- ✅ 렌탈 실외 프로세스 버그 수정
- ✅ LED 해상도 계산 수정 (168px/모듈)
- ✅ 운반비 구간별 계산 (200/400/401개 기준)
- ✅ 렌탈 실내 견적 계산 개선
- ✅ LED 정보 표시 형식 개선 (수량 제거, 해상도 추가)
- ✅ Notion 멘션 메시지 템플릿 적용

### 2025-08-02
- ✅ 멤버쉽 견적 계산 로직 수정
- ✅ 새로운 비용 계산 기준 적용
- ✅ 오퍼레이터 비용 0원 처리 개선

### 2025-07-28
- ✅ Notion 데이터베이스 스키마 문서화
- ✅ 렌탈 실외 프로세스 개선
- ✅ 메시지 톤 친절하게 개선
- ✅ 서비스별 최종 메시지 차별화
- ✅ 이전 단계로 돌아가기 기능 추가
- ✅ 이모지 최소화 및 메시지 간결화

### 2025-07-27
- ✅ Notion 메시지 중앙화 완료
- ✅ 날짜 기반 스케줄러 추가
- ✅ "행사 일정" 텍스트 필드 처리

## 👥 기여

작성자: 허지성
회사: 오리온디스플레이

## 📄 라이선스

오리온디스플레이 © 2025