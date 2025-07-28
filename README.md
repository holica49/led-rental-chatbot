# LED Rental MCP - Kakao Chatbot Integration

LED 렌탈/설치 견적을 자동화하는 Kakao 챗봇 서버입니다. MCP(Model Context Protocol)를 통해 Claude와 연동되며, Notion 데이터베이스와 연동하여 업무를 자동화합니다.

## 🚨 Claude AI를 위한 핵심 정보

### 프로젝트 불변 규칙
- **Notion 필드명**: 아래 [Notion 데이터베이스 스키마](#-notion-데이터베이스-스키마) 참조
- **무대 높이**: 0mm 허용
- **서비스 타입**: 설치, 렌탈, 멤버쉽 (정확히 이 명칭 사용)
- **구분선**: `━━━━` (4개)로 통일

### 현재 상태 (2025-07-28)
- **ES Module** 전환 완료
- **모든 import에 .js 확장자** 추가 완료
- **Railway 배포** 정상 작동 중
- **TypeScript strict mode**: Phase 1 완료
- **메시지 중앙화**: 완료
- **Notion 폴링**: 10분 간격 작동 중
- **날짜 기반 스케줄러**: 1시간 간격 작동 중
- **이전 단계 기능**: 구현 완료 ✨
- **메시지 톤 개선**: 이모지 최소화, 간결한 문구 ✨

## 🚀 주요 기능

### 1. Kakao 챗봇
- 대화형 견적 상담 (렌탈/설치/멤버쉽 구분)
- 세션 기반 대화 상태 관리
- 서비스별 맞춤 프로세스
- **이전 단계로 돌아가기 기능** ✨
- **간결하고 친절한 메시지 톤** ✨

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

#### 렌탈 서비스
1. 견적 요청 → 견적 검토 (자동)
2. 견적 검토 → 견적 승인 (파일 업로드 시 자동)
3. 견적 승인 → 배차 완료 (수동)
4. 배차 완료 → 구인 완료 (수동)
5. 구인 완료 → 설치 중 (행사 전날 자동)
6. 설치 중 → 운영 중 (행사 시작일 자동)
7. 운영 중 → 철거 중 (행사 종료일 자동)
8. 철거 중 → 완료 (수동)

#### 멤버쉽 서비스
- 렌탈과 동일한 프로세스
- VIP 회원 전용 특별 가격 적용

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
| 서비스 유형 | select | 설치/렌탈/멤버쉽 | 전체 |
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
| LED{n} 해상도 | rich_text | 해상도 정보 |
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
  - `xlsx`: ^0.18.5

## 💰 가격 정책 (2024년 기준)

### 배차 로직 (LED 모듈 수량 기준)
- 80개 이하: 1.4톤 리프트 화물차 1대
- 81-208개: 3.5톤 리프트 화물차 1대
- 209-288개: 3.5톤 리프트 화물차 1대 + 1.4톤 리프트 화물차 1대
- 289-416개: 3.5톤 리프트 화물차 2대
- 417개 이상: 3.5톤 리프트 화물차 (208개당 1대)

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

3. .env 파일 편집:
```env
# Notion API 설정
NOTION_API_KEY=your_notion_api_key
NOTION_DATABASE_ID=your_database_id

# 담당자 설정 (한 줄로 작성)
MANAGERS_CONFIG={"managers":[{"name":"유준수","notionId":"225d872b-594c-8157-b968-0002e2380097","department":"구축팀","isActive":true},{"name":"최수삼","notionId":"237d872b-594c-8174-9ab2-00024813e3a9","department":"렌탈팀","isActive":true}]}

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

## 🌐 배포 (Railway)

이 프로젝트는 Railway에 최적화되어 있습니다:

1. GitHub 저장소를 Railway에 연결
2. 환경 변수 설정 (Railway 대시보드)
3. 자동 배포 활성화

배포 URL: `https://[your-app-name].railway.app`

## 📱 Kakao 개발자 콘솔 설정

스킬 서버 URL 등록:
- URL: `https://[your-app-name].railway.app/kakao/skill`
- 메서드: POST
- Content-Type: application/json

## 📊 API 엔드포인트

| 엔드포인트 | 메서드 | 설명 |
|------------|--------|------|
| `/kakao/skill` | POST | Kakao 챗봇 웹훅 |
| `/polling/status` | GET | Notion 폴링 상태 확인 |
| `/scheduler/status` | GET | 날짜 기반 스케줄러 상태 |
| `/polling/trigger` | POST | 수동 상태 변경 트리거 |

## 💬 사용자 인터페이스

### 대화 기능
- **처음으로**: "처음", "처음부터", "처음으로", "초기화", "리셋" 입력 시 처음부터 다시 시작
- **이전 단계**: "이전", "뒤로", "돌아가" 입력 시 이전 단계로 돌아가기
- **Quick Reply**: 각 단계별 빠른 선택 버튼 제공

### 메시지 형식
```
✅ 이전 답변 확인
━━━━
현재 질문

💡 도움말 또는 예시
```

### ES Module Import 오류
- 모든 상대 경로 import에 .js 확장자 추가 필요
- package.json: `"type": "module"`
- tsconfig.json: `"module": "ES2022"`

### Railway 배포 실패
- TypeScript를 dependencies에 포함 확인
- 환경 변수 설정 확인
- 빌드 로그 확인

### Notion 자동화 오류
- MANAGERS_CONFIG는 한 줄 JSON으로 작성
- Notion API 키와 데이터베이스 ID 확인
- "행사 일정" 필드는 텍스트 타입 (날짜 형식 준수)

## 📝 메시지 변경 방법

1. **카카오 챗봇 메시지**: `src/constants/messages.ts` 파일 수정
2. **Notion 내부 메시지**: `src/constants/notion-messages.ts` 파일 수정
3. **프로세스 변경**: `src/config/process-config.ts` 파일 수정

## 📞 담당자 정보

- **설치 서비스**: 유준수 구축팀장
- **렌탈 서비스**: 최수삼 렌탈팀장
- **멤버쉽 서비스**: 최수삼 렌탈팀장

## 🔄 최근 업데이트

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