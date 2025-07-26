# LED 렌탈 MCP 프로젝트 컨텍스트

## 비즈니스 도메인
오리온디스플레이의 LED 렌탈/설치 업무를 자동화하는 카카오톡 챗봇 시스템

## 핵심 기능
1. **설치 서비스**: 상설 LED 설치 상담 및 견적
2. **렌탈 서비스**: 단기 행사용 LED 렌탈 및 견적
3. **멤버쉽 서비스**: 메쎄이상(001) 전용 특별 가격
4. **자동화 시스템**: Notion 상태 기반 업무 자동화

## 기술 스택 (2025-07-26 기준)
- **Runtime**: Node.js 18+ (ES Modules)
- **Language**: TypeScript 5.7.2
- **Module System**: ES Modules (`"type": "module"`)
- **Framework**: Express 4.21.2
- **Database**: Notion API
- **Deployment**: Railway (자동 배포)
- **Session**: In-memory (Redis 마이그레이션 예정)
- **Polling**: 30초 간격 상태 감지

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
│       ├── notion-polling.ts  # 상태 감지
│       ├── notion-status-automation.ts # 자동화
│       └── calculate-quote.ts # 견적 계산

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

### 설치 서비스 전용
- `설치 환경` (select) - 실내, 실외
- `설치 공간` (select) - 기업, 상가, 병원 등
- `문의 목적` (select) - 정보 조사, 견적 등
- `설치 예산` (select) - 예산 범위

### 렌탈/멤버쉽 서비스 전용
- `지지구조물 방식` (select) - 목공 설치, 단독 설치

### LED 정보 (1-5개소)
각 LED별 속성 (n = 1~5):
- `LED{n} 크기` (rich_text) - 예: "6000x3000"
- `LED{n} 무대 높이` (number) - mm 단위
- `LED{n} 오퍼레이터 필요` (checkbox)
- `LED{n} 오퍼레이터 일수` (number)
- `LED{n} 프롬프터 연결` (checkbox)
- `LED{n} 중계카메라 연결` (checkbox)

### LED 자동 계산 정보 (읽기 전용)
각 LED별 자동 계산값:
- `LED{n} 모듈 수량` (number)
- `LED{n} 대각선 인치` (rich_text)
- `LED{n} 해상도` (rich_text)
- `LED{n} 소비전력` (rich_text)
- `LED{n} 전기설치 방식` (rich_text)

### 견적 정보
- `견적 금액` (number) - VAT 제외 금액
- `총 LED 모듈 수량` (number) - 전체 모듈 수
- `LED 모듈 비용` (number)
- `지지구조물 비용` (number)
- `컨트롤러 및 스위치 비용` (number)
- `파워 비용` (number)
- `설치철거인력 비용` (number)
- `오퍼레이터 비용` (number)
- `운반 비용` (number)
- `기간 할증 비용` (number) - 렌탈용

### 파일 관리
- `견적서` (files) - 견적서 파일
- `요청서` (files) - 요청서 파일

### 일정 정보
- `행사 일정` (rich_text) - 행사 기간
- `설치 일정` (date) - 설치일
- `리허설 일정` (date) - 리허설일
- `철거 일정` (date) - 철거일

### 기타
- `담당자` (people) - Notion 담당자
- `문의요청 사항` (rich_text) - 추가 요청사항


## 자동화 시스템

### 상태 변경 감지 (30초 폴링)
1. **견적 요청 → 견적 검토**
   - 견적 정보 자동 계산
   - 견적 내역 댓글 추가
   - 담당자 멘션

2. **견적 검토 → 견적 승인**
   - 파일 업로드 감지
   - 견적서/요청서 모두 있으면 자동 승인
   - 상태 변경 알림

3. **견적 승인 → 구인 완료**
   - 배차 정보 생성
   - 설치 인력 정보
   - 담당자 멘션

### 담당자 멘션 규칙
- **설치**: 유준수 구축팀장
- **렌탈/멤버쉽**: 최수삼 렌탈팀장
- **기본**: 설정된 모든 활성 담당자

### 🚧 개선 필요사항
현재 Notion 자동화 메시지들이 하드코딩되어 있어 다음과 같은 개선이 필요:

1. **메시지 중앙화**
   - notion-status-automation.ts의 모든 메시지를 constants로 이동
   - notion-polling.ts의 메시지들도 포함
   - mention-service.ts의 알림 메시지 포함

2. **서비스별 메시지 차별화**
   - 설치: 구축/설치 관련 용어 사용
   - 렌탈: 행사/대여 관련 용어 사용
   - 멤버쉽: VIP/회원 관련 용어 사용

3. **상태별 메시지 차별화**
   - 견적 검토: 견적 계산 및 검토 요청
   - 견적 승인: 배차 및 준비 사항
   - 구인 완료: 최종 체크 및 실행
   - 설치 중/운영 중/철거 중: 진행 상황 업데이트

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

# 중요 주의사항
Notion 필드명 절대 변경 금지
무대 높이 0mm 허용 필수
설치 서비스는 담당자 언급 안함
모든 import에 .js 확장자 필수
Kakao 응답은 5초 이내
구분선은 ━━━━ (4개)로 통일
MANAGERS_CONFIG는 한 줄 JSON

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
자동화: 정상 작동 중
테스트 커버리지: 0% (개선 필요)

목표

테스트 커버리지: 80%
Strict Mode: 전체 활성화
성능: 모든 응답 < 1초
가용성: 99.9%

배포 및 운영
Railway 배포

GitHub main 브랜치 자동 배포
환경 변수는 Railway 대시보드에서 관리
로그는 Railway Logs에서 확인

모니터링

/polling/status - 폴링 상태 확인
Railway 대시보드 - 서버 상태
Notion 댓글 - 자동화 실행 이력

트러블슈팅

폴링 안됨: NOTION_API_KEY, DATABASE_ID 확인
멘션 안됨: MANAGERS_CONFIG 형식 확인
자동화 안됨: Notion 필드명 확인