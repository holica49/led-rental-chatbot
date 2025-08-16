# LED 렌탈 MCP 프로젝트 컨텍스트

## 비즈니스 도메인
오리온디스플레이의 LED 렌탈/설치 업무를 자동화하는 카카오톡 챗봇 시스템

## 핵심 기능
1. **설치 서비스**: 상설 LED 설치 상담 및 견적
2. **렌탈 서비스**: 단기 행사용 LED 렌탈 및 견적
3. **멤버쉽 서비스**: 메쎄이상(001) 전용 특별 가격
4. **자동화 시스템**: Notion 상태 기반 업무 자동화
5. **스케줄러**: 날짜 기반 자동 상태 변경
6. **LINE WORKS 봇**: 내부 업무 관리 및 프로젝트 현황 조회
7. **MCP 캘린더 연동**: Claude가 직접 LINE WORKS 캘린더 관리
8. **사용자 관리 시스템**: Notion 기반 직원 정보 관리 🆕

## 기술 스택 (2025-08-16 기준)
- **Runtime**: Node.js 18+ (ES Modules)
- **Language**: TypeScript 5.7.2
- **Module System**: ES Modules (`"type": "module"`)
- **Framework**: Express 4.21.2
- **Database**: Notion API (프로젝트 + 사용자 관리)
- **Deployment**: Railway (자동 배포)
- **Session**: In-memory (Redis 마이그레이션 예정)
- **Polling**: 10분 간격 상태 감지
- **Scheduler**: 1시간 간격 날짜 기반 자동화
- **MCP**: Model Context Protocol (Claude 연동)
- **Calendar API**: LINE WORKS Calendar API v1.0
- **User Management**: Notion-based User Database 🆕

## 프로젝트 구조
```
led-rental-mcp/
├── src/
│   ├── server.ts                    # Express 서버 (Railway)
│   ├── index.ts                     # MCP 서버 (Claude)
│   ├── types/                       # TypeScript 타입 정의
│   ├── constants/                   # 상수 정의
│   │   ├── messages.ts              # 카카오톡 메시지
│   │   └── notion-messages.ts       # Notion 자동화 메시지
│   ├── config/                      # 설정 파일
│   │   ├── process-config.ts        # 프로세스 플로우 설정
│   │   └── lineworks-auth.ts        # LINE WORKS 인증 (캘린더 권한 포함)
│   ├── utils/                       # 유틸리티 함수
│   │   ├── message-utils.ts         # 메시지 포맷팅
│   │   ├── handler-utils.ts         # 핸들러 공통 함수
│   │   ├── session-utils.ts         # 세션 관리
│   │   ├── date-utils.ts            # 날짜 처리
│   │   ├── nlp-calendar-parser.ts   # 고도화된 자연어 일정 파싱 🆕
│   │   └── notion-message-utils.ts  # Notion 메시지 유틸
│   ├── models/                      # 데이터 모델 🆕
│   │   └── user-model.ts            # 사용자 관리 모델
│   ├── routes/                      # API 라우트 🆕  
│   │   └── user-admin.ts            # 사용자 관리 API
│   └── tools/
│       ├── handlers/                # 서비스별 핸들러
│       │   ├── install.ts
│       │   ├── rental.ts
│       │   ├── membership.ts
│       │   ├── common-handlers.ts
│       │   └── index.ts
│       ├── validators/              # 입력 검증
│       ├── services/                # 외부 서비스 연동
│       │   ├── notion-service.ts
│       │   ├── mention-service.ts
│       │   └── lineworks-calendar-service.ts  # 사용자 관리 통합 🆕
│       ├── session/                 # 세션 관리
│       ├── kakao-chatbot.ts         # 메인 챗봇 로직
│       ├── notion-mcp.ts            # Notion 연동
│       ├── lineworks-calendar-mcp.ts # MCP 캘린더 도구 🆕
│       ├── lineworks-bot.ts         # LINE WORKS 봇 (MCP 호출)
│       ├── notion-polling.ts        # 상태 감지 (10분)
│       ├── notion-scheduler.ts      # 날짜 기반 자동화 (1시간)
│       ├── notion-status-automation.ts # 자동화 처리
│       ├── message-processor.ts     # 메시지 처리
│       └── calculate-quote.ts       # 견적 계산
```

## 사용자 관리 시스템 아키텍처 🆕

### 기본 구조
```
LINE WORKS User → User Database → Real Email → Calendar Event
                ↗ Notion Search  ↗ Email Mapping ↗ Rich Description
```

### 핵심 컴포넌트
1. **사용자 데이터베이스**: `models/user-model.ts`
   - Notion 기반 직원 정보 저장
   - LINE WORKS ID ↔ 실제 사용자 정보 매핑
   - 부서, 직급, 이메일 등 상세 정보

2. **사용자 관리 API**: `routes/user-admin.ts`
   - RESTful API로 사용자 CRUD 작업
   - 웹 대시보드 제공
   - 참석자 이메일 자동 생성

3. **통합 캘린더 서비스**: `services/lineworks-calendar-service.ts`
   - 사용자 정보 자동 조회
   - 참석자 실제 이메일 매핑
   - 사용자 컨텍스트가 포함된 일정 생성

4. **데이터베이스 스키마**: 
   - 이름 (Title)
   - LINE WORKS ID (Text)
   - 이메일 (Email)
   - 부서/직급 (Select)
   - 활성상태 (Checkbox)

## MCP 캘린더 연동 아키텍처

### 기본 구조
```
사용자 → LINE WORKS 봇 → MCP Server → User DB → LINE WORKS Calendar API
                       ↘ Notion DB (동시 저장)
```

### 핵심 컴포넌트
1. **고도화된 자연어 파싱**: `nlp-calendar-parser.ts`
   - "다음 주 화요일 오후 3시에 강남 스타벅스에서 김대리와 중요한 프로젝트 회의" → 구조화된 이벤트 객체
   - 날짜, 시간, 제목, 참석자, 장소, 우선순위, 회의유형 추출
   - AI 신뢰도 측정 및 검증

2. **MCP 캘린더 도구**: `lineworks-calendar-mcp.ts`
   - Claude가 직접 호출하는 MCP 도구
   - Service Account 권한으로 캘린더 API 호출
   - 사용자 정보와 통합된 일정 생성

3. **LINE WORKS 인증**: `lineworks-auth.ts`
   - 기본 봇 권한: `bot`, `bot.message`, `user.read`
   - 캘린더 권한: `calendar`, `calendar.read`
   - Service Account + JWT 인증

4. **API 엔드포인트**: 
   - `https://www.worksapis.com/v1.0/users/{userId}/calendar/events`
   - 안전한 속성만 사용 (summary, description, location, start, end, transparency)

## 주요 업데이트 (2025-08-16)

### 사용자 관리 시스템 구축 완료 🆕
- **Notion 기반 직원 데이터베이스**: 체계적인 사용자 정보 관리
- **자동 사용자 매핑**: LINE WORKS ID → 실제 사용자 정보
- **스마트 이메일 생성**: 참석자 이름 → 실제 이메일 자동 변환
- **웹 대시보드**: `/api/users/dashboard`에서 사용자 관리
- **RESTful API**: 사용자 CRUD 작업 지원

### 고도화된 자연어 파싱 개선
- **복잡한 날짜 처리**: "이번주 화요일" vs "다음주 화요일" 정확한 구분
- **참석자 인식**: "김대리와 박과장 미팅" → 참석자 자동 추출
- **회의 유형 판단**: "중요한 프로젝트 회의" → internal + high priority
- **AI 신뢰도 측정**: 파싱 결과의 정확도 평가 (0-1)

### LINE WORKS Calendar API 안정화
- **안전한 속성만 사용**: organizer, attendees 등 문제 속성 제거
- **description 활용**: 모든 고급 정보를 설명에 포함
- **사용자 정보 통합**: 등록자, 참석자 실제 정보 표시

# 완료된 작업 (2025-08-15)

### LINE WORKS 봇 구현 완료 ✅
#### 인증 시스템
- OAuth 2.0 (Service Account + JWT) 구현
- Private Key 환경 변수 지원
- Access Token 자동 갱신
- 캘린더 권한 추가 지원

#### 주요 기능
- 프로젝트 현황 조회: "강남LED 현황"
- 일정 관리: "오늘 일정", "이번주 일정"
- 재고 확인: "재고 현황"
- 고도화된 일정 등록: "다음 주 화요일 오후 3시에 강남 스타벅스에서 김대리와 중요한 프로젝트 회의, 30분 전 알림" 🔥
- 웹훅 메시지 처리

#### 배포 상태
- Railway 배포 완료
- Callback URL: https://web-production-fa47.up.railway.app/lineworks/callback
- 정상 작동 확인

### 카카오 챗봇 개선 완료 ✅
- 엔티티(@SERVICE_TYPE) 삭제
- 모든 발화를 스킬 서버에서 처리
- 멤버십 서비스 FAQ 문제 해결

## 주요 업데이트 (2025-08-08)

### 1. UI/UX 개선
- **진행 상황 표시**: `[현재단계/전체단계]` 형식으로 진행률 표시
- **이전 답변 제거**: 가독성 향상을 위해 이전 답변 표시 제거
- **단축어 안내**: 첫 인사말에 "처음", "이전" 단축어 사용법 안내
- **LED 정보 표시 개선**: 
  - LED 수량(모듈 개수) 제거
  - 단위(mm) 표시 추가
  - 해상도(px) 표시 추가 (멤버쉽, 렌탈 실내)

### 2. 프로세스 개선
- **렌탈 실외 버그 수정**: 
  - LED 입력 후 행사 기간 중복 질문 제거
  - 지지구조물 선택 스킵 처리
- **세션 초기화 문제 해결**: "처음부터" 선택 시 서비스 선택 중복 표시 수정

### 3. 견적 계산 로직
- **멤버쉽 서비스**:
  - LED 모듈: 500개까지 무료, 501개부터 34,000원
  - 오퍼레이터: 280,000원/일
- **렌탈 실내 서비스**:
  - LED 모듈, 운반비, 오퍼레이터, 기간할증만 계산
  - 나머지 항목(구조물, 컨트롤러, 전원, 설치비) 0원 처리
- **운반비 구간제**:
  - 200개 이하: 200,000원
  - 201~400개: 500,000원
  - 401개 이상: 700,000원
- **LED 해상도**: 모듈당 168x168px 기준으로 계산

### 4. Notion 연동 개선
- **멤버쉽 운반비 저장**: 렌탈과 동일하게 운반비 필드 저장
- **LED 정보 저장**: 대각선 인치, 해상도, 소비전력, 전기설치 방식 저장
- **언급 메시지 템플릿**: notion-messages.ts 템플릿 사용으로 통일
- **설치 서비스 메시지**: 프로젝트 정보에 추가 필드 표시

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

### 3. 담당자 멘션 규칙
- **설치**: 유준수 구축팀장
- **렌탈/멤버쉽**: 최수삼 렌탈팀장

## Notion 데이터베이스 스키마
⚠️ **아래 필드명은 절대 변경 불가**

### 프로젝트 관리 데이터베이스
- `행사명` (title) - 행사/프로젝트 이름
- `고객사` (select) - 고객 회사명
- `고객명` (rich_text) - 고객 담당자 이름
- `고객 연락처` (phone_number) - 고객 연락처
- `행사장` (rich_text) - 행사 장소
- `담당자` (people) - 내부 담당자
- [나머지 스키마는 README.md 참조]

### 사용자 관리 데이터베이스 🆕
- `이름` (title) - 사용자 이름
- `LINE WORKS ID` (rich_text) - LINE WORKS 사용자 ID
- `이메일` (email) - 이메일 주소
- `부서` (select) - 부서명 (개발팀, 마케팅팀, 영업팀 등)
- `직급` (select) - 직급 (사장, 이사, 부장, 차장, 과장, 대리, 사원)
- `표시명` (rich_text) - 표시용 이름
- `활성상태` (checkbox) - 활성/비활성
- `등록일` (date) - 등록 날짜
- `수정일` (date) - 마지막 수정 날짜

## 중요 주의사항

1. **Notion 필드명 절대 변경 금지**
2. **무대 높이 0mm 허용 필수**
3. **"행사 일정"은 텍스트 타입 (date 아님)**
4. **모든 import에 .js 확장자 필수**
5. **Kakao 응답은 5초 이내**
6. **구분선은 ━━━━ (4개)로 통일**
7. **MANAGERS_CONFIG는 한 줄 JSON**
8. **이전 단계 키워드: "이전", "뒤로", "돌아가"**
9. **처음으로 키워드: "처음", "처음부터", "처음으로"**
10. **LED 해상도 계산: 모듈당 168x168px**
11. **사용자 관리 데이터베이스 ID 필수 설정** 🆕
12. **참석자 이메일은 사용자 DB에서 자동 매핑** 🆕

## LINE WORKS Calendar API 🆕

### API 엔드포인트
- **URL**: `https://www.worksapis.com/v1.0/users/{userId}/calendar/events`
- **Method**: POST

### 필수 권한
- `bot`: 봇 기본 권한
- `bot.message`: 메시지 전송
- `user.read`: 사용자 정보 조회
- `calendar`: 캘린더 접근
- `calendar.read`: 캘린더 읽기

### 안전한 요청 형식 (검증됨)
```json
{
  "eventComponents": [
    {
      "eventId": "claude-user-{timestamp}-{random}",
      "summary": "🔴 🏢 프로젝트 회의",
      "description": "상세 정보 (사용자 정보, 참석자, 준비물 등)",
      "location": "강남 스타벅스",
      "start": {
        "dateTime": "2025-08-19T15:00:00",
        "timeZone": "Asia/Seoul"
      },
      "end": {
        "dateTime": "2025-08-19T16:00:00", 
        "timeZone": "Asia/Seoul"
      },
      "transparency": "OPAQUE"
    }
  ]
}
```

### 사용하지 않는 속성 (문제 발생)
- `organizer` - 주최자 정보
- `attendees` - 참석자 배열
- `visibility` - 공개/비공개
- `sequence` - 시퀀스 번호
- `reminders` - 알림 설정
- `priority` - 우선순위
- `sendNotification` - 알림 발송

## 환경 변수 (업데이트됨)

### 필수 환경 변수
```env
# Notion API
NOTION_API_KEY=your_notion_api_key
NOTION_DATABASE_ID=your_project_database_id
NOTION_USER_DATABASE_ID=your_user_database_id  # 🆕

# LINE WORKS
LINEWORKS_BOT_ID=your_bot_id
LINEWORKS_BOT_SECRET=your_bot_secret
LINEWORKS_CLIENT_ID=your_client_id
LINEWORKS_CLIENT_SECRET=your_client_secret
LINEWORKS_DOMAIN_ID=your_domain_id
LINEWORKS_SERVICE_ACCOUNT_ID=your_service_account_id
LINEWORKS_PRIVATE_KEY=your_private_key_with_newlines_as_\n

# 담당자 설정 (한 줄 JSON)
MANAGERS_CONFIG={"managers":[{"name":"유준수","notionId":"...","department":"구축팀","isActive":true},{"name":"최수삼","notionId":"...","department":"렌탈팀","isActive":true}]}
```

## 코드 품질 지표

### 현재 상태
- TypeScript Coverage: 100%
- Strict Mode: Phase 1 완료
- 코드 중복: 최소화됨
- 메시지 중앙화: 100%
- 자동화: 정상 작동 중
- UI/UX: 대폭 개선됨
- 사용자 관리: 시스템화 완료 🆕
- 자연어 파싱: AI 기반 고도화 🆕
- 테스트 커버리지: 0% (개선 필요)

### 목표
- 테스트 커버리지: 80%
- Strict Mode: 전체 활성화
- 성능: 모든 응답 < 1초
- 가용성: 99.9%

## 배포 및 운영

### Railway 배포
- GitHub main 브랜치 자동 배포
- 환경 변수는 Railway 대시보드에서 관리
- 로그는 Railway Logs에서 확인

### 모니터링
- `/polling/status` - 폴링 상태 확인
- `/scheduler/status` - 스케줄러 상태 확인
- `/api/users/dashboard` - 사용자 관리 대시보드 🆕
- Railway 대시보드 - 서버 상태
- Notion 댓글 - 자동화 실행 이력

### 트러블슈팅
- 폴링 안됨: NOTION_API_KEY, DATABASE_ID 확인
- 멘션 안됨: MANAGERS_CONFIG 형식 확인
- 자동화 안됨: Notion 필드명 확인
- 날짜 파싱 오류: 행사 일정 형식 확인
- import 오류: .js 확장자 및 circular dependency 확인
- 사용자 관리 오류: NOTION_USER_DATABASE_ID 확인 🆕
- 캘린더 API 오류: 지원되지 않는 속성 사용 확인 🆕

## 현재 개발 중인 기능

### 완료된 기능 ✅
- **LINE WORKS 업무봇**: 내부 직원용 업무 관리 (프로젝트 현황, 일정, 재고)
- **MCP 캘린더 연동**: Claude가 직접 캘린더 API 호출
- **고도화된 자연어 파싱**: AI 기반 복잡한 일정 정보 추출
- **사용자 관리 시스템**: Notion 기반 직원 정보 관리

### 향후 개선 계획
- **테스트 코드 작성**: 단위 테스트 및 통합 테스트
- **성능 최적화**: 응답 시간 개선
- **오류 처리 강화**: 더 나은 오류 메시지 및 복구 로직
- **사용자 경험 개선**: 더 직관적인 대화 플로우