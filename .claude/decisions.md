# 기술 결정 사항

## 2025-07-25 결정 사항

### 모듈 시스템
- **결정**: CommonJS → ES Modules
- **이유**: 
  - @modelcontextprotocol/sdk가 ES Module only
  - 최신 Node.js 표준 따르기
  - Tree shaking 등 최적화 가능
- **영향**: 모든 import에 `.js` 확장자 필수

### Excel 기능 변경
- **결정**: Excel 생성 → Notion 파일 업로드
- **이유**: 
  - 중앙화된 문서 관리
  - Notion 내에서 모든 것 처리
  - 별도 파일 관리 불필요
- **구현**: Notion API의 파일 업로드 기능 활용

### TypeScript 설정
- **결정**: Strict mode 일시적 비활성화
- **이유**: 47개 타입 오류로 즉시 배포 불가
- **계획**: 점진적 활성화 (2025 Q3)

## 기존 결정 사항 (유지)

### 아키텍처
- **패턴**: 레이어드 아키텍처
- **구조**: 
  - handlers/ - 프레젠테이션 레이어
  - services/ - 비즈니스 로직
  - validators/ - 입력 검증
  - types/ - 도메인 모델

### 배포 플랫폼
- **선택**: Railway
- **이유**: 
  - GitHub 자동 배포
  - 환경 변수 관리 용이
  - 무료 티어 제공
  - HTTPS 자동 지원

### 상태 관리
- **현재**: In-memory 세션
- **미래**: Redis (계획됨)
- **이유**: 
  - 서버 재시작 시 세션 유지
  - 수평 확장 가능
  - TTL 기반 자동 만료

## 변경하지 않을 사항

### 핵심 의존성
1. **Node.js 18+** - LTS 버전
2. **TypeScript** - 타입 안정성
3. **Notion API** - 데이터베이스
4. **Express** - 웹 프레임워크

### 비즈니스 규칙
1. **가격 정책** - calculate-quote.ts
2. **대화 플로우** - 서비스별 핸들러
3. **Notion 필드명** - 절대 변경 금지
4. **Kakao 응답 형식** - version 2.0

### API 엔드포인트
- `/kakao/skill` - 변경 불가 (Kakao 등록됨)

## 향후 고려사항

### 모니터링
- **옵션**: Sentry, DataDog, New Relic
- **결정 시기**: 사용자 증가 시

### 캐싱
- **옵션**: Redis, Memory Cache
- **적용 대상**: Notion API 응답

### 테스트 전략
- **단위 테스트**: Jest
- **E2E 테스트**: Supertest
- **목표 커버리지**: 80%