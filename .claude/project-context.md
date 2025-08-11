# LED 렌탈 MCP 프로젝트 컨텍스트

## 비즈니스 도메인
오리온디스플레이의 LED 렌탈/설치 업무를 자동화하는 카카오톡 챗봇 시스템

## 핵심 기능
1. **설치 서비스**: 상설 LED 설치 상담 및 견적
2. **렌탈 서비스**: 단기 행사용 LED 렌탈 및 견적
3. **멤버쉽 서비스**: 메쎄이상(001) 전용 특별 가격
4. **자동화 시스템**: Notion 상태 기반 업무 자동화
5. **스케줄러**: 날짜 기반 자동 상태 변경

## 기술 스택 (2025-08-08 기준)
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
│   │   └── process-config.ts        # 프로세스 플로우 설정
│   ├── utils/                       # 유틸리티 함수
│   │   ├── message-utils.ts         # 메시지 포맷팅
│   │   ├── handler-utils.ts         # 핸들러 공통 함수
│   │   ├── session-utils.ts         # 세션 관리
│   │   ├── date-utils.ts            # 날짜 처리
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
│       │   ├── notion-service.ts
│       │   └── mention-service.ts
│       ├── session/                 # 세션 관리
│       ├── kakao-chatbot.ts         # 메인 챗봇 로직
│       ├── notion-mcp.ts            # Notion 연동
│       ├── notion-polling.ts        # 상태 감지 (10분)
│       ├── notion-scheduler.ts      # 날짜 기반 자동화 (1시간)
│       ├── notion-status-automation.ts # 자동화 처리
│       ├── message-processor.ts     # 메시지 처리
│       └── calculate-quote.ts       # 견적 계산
```

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

### 기본 정보
- `행사명` (title) - 행사/프로젝트 이름
- `고객사` (select) - 고객 회사명
- `고객명` (rich_text) - 고객 담당자 이름
- `고객 연락처` (phone_number) - 고객 연락처
- `행사장` (rich_text) - 행사 장소
- `담당자` (people) - 내부 담당자

### 서비스 정보
- `서비스 유형` (select) - 설치, 렌탈, 멤버쉽
- `행사 상태` (status) - 견적 요청, 견적 검토, 견적 승인 등
- `멤버 코드` (rich_text) - 멤버쉽 서비스용 코드

### 환경/상세 정보
- `설치 환경` (select) - 실내/실외
- `설치 공간` (select) - 기업/상가/병원/공공/숙박/전시홀/기타
- `설치 예산` (select) - 예산 범위
- `문의 목적` (select) - 정보 조사/아이디어 기획/견적/구매/기타
- `지지구조물 방식` (select) - 목공 설치/단독 설치

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
- `LED{n} 모듈 수량` (number) - 자동 계산
- `LED{n} 대각선 인치` (rich_text)
- `LED{n} 해상도` (rich_text) - 168x168px/모듈 기준
- `LED{n} 소비전력` (rich_text)
- `LED{n} 전기설치 방식` (rich_text)

### 비용 정보
- `견적 금액` (number) - 총 견적 금액 (VAT 포함)
- `LED 모듈 비용` (number)
- `지지구조물 비용` (number)
- `컨트롤러 및 스위치 비용` (number)
- `파워 비용` (number)
- `설치철거인력 비용` (number)
- `오퍼레이터 비용` (number)
- `운반 비용` (number) - 구간제 적용
- `기간 할증 비용` (number)

### 파일 관리
- `견적서` (files) - 견적서 파일
- `요청서` (files) - 요청서 파일

### 기타
- `총 LED 모듈 수량` (number) - 전체 모듈 개수
- `문의요청 사항` (rich_text) - 추가 요청사항

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

## 코드 품질 지표

### 현재 상태
- TypeScript Coverage: 100%
- Strict Mode: Phase 1 완료
- 코드 중복: 최소화됨
- 메시지 중앙화: 100%
- 자동화: 정상 작동 중
- UI/UX: 대폭 개선됨
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
- Railway 대시보드 - 서버 상태
- Notion 댓글 - 자동화 실행 이력

### 트러블슈팅
- 폴링 안됨: NOTION_API_KEY, DATABASE_ID 확인
- 멘션 안됨: MANAGERS_CONFIG 형식 확인
- 자동화 안됨: Notion 필드명 확인
- 날짜 파싱 오류: 행사 일정 형식 확인
- import 오류: .js 확장자 및 circular dependency 확인

## 현재 개발 중인 기능 🆕

### LINE WORKS 업무봇
- **목적**: 내부 직원용 업무 관리 (프로젝트 현황, 일정, 재고)
- **상태**: 인증 구현 중 (OAuth Scopes 설정 필요)
- **주요 파일**:
  - `src/config/lineworks-auth.ts`
  - `src/tools/lineworks-bot.ts`
  - `src/test-lineworks-auth.ts`
- **남은 작업**:
  - Private Key 설정
  - OAuth Scopes 설정
  - Webhook 구현
  - Railway 배포