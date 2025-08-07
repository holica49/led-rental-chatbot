// src/constants/notion-messages.ts

/**
 * Notion 자동화 메시지 중앙 관리
 * 내부 직원 알림용 메시지
 */

// 서비스별 용어 정의
export const SERVICE_TERMINOLOGY = {
  INSTALL: {
    serviceName: '설치',
    projectType: '프로젝트',
    teamName: '구축팀',
    teamLeader: '유준수 구축팀장',
    teamLeaderId: '225d872b-594c-8157-b968-0002e2380097',
    schedule: '구축 일정'
  },
  RENTAL: {
    serviceName: '렌탈',
    projectType: '행사',
    teamName: '렌탈팀',
    teamLeader: '최수삼 렌탈팀장',
    teamLeaderId: '237d872b-594c-8174-9ab2-00024813e3a9',
    schedule: '행사 일정',
    transport: '배차'
  },
  MEMBERSHIP: {
    serviceName: '멤버쉽',
    projectType: '행사',
    teamName: '렌탈팀',
    teamLeader: '최수삼 렌탈팀장',
    teamLeaderId: '237d872b-594c-8174-9ab2-00024813e3a9',
    schedule: '행사 일정',
    transport: '배차'
  }
} as const;

// 공통 메시지 요소
export const COMMON_ELEMENTS = {
  DIVIDER: '━━━━━━━━━━━━━━━━━━━━━━',
  MENTION_REQUEST: '📢 담당자 확인 요청: ',
  TIMESTAMP: '⏰ 자동화 실행 시간: {{timestamp}}',
  QUICK_CHECK: '⏰ 빠른 확인 부탁드립니다!'
} as const;

// 상태별 자동화 메시지
export const STATUS_MESSAGES = {
  // 견적 요청 → 견적 검토
  QUOTE_REQUEST_TO_REVIEW: {
    INSTALL: `📊 새로운 설치 프로젝트 견적 요청

✅ 프로젝트 정보:
- 프로젝트명: {{eventName}}
- 고객사: {{customerName}}
- 고객: {{contactName}} {{contactTitle}}
- 연락처: {{contactPhone}}
- 구축 예정지: {{venue}}
- 설치 공간: {{installSpace}} ({{installEnvironment}})
- 설치 기간: {{installSchedule}}
- 설치 예산: {{installBudget}}
- 문의 목적: {{inquiryPurpose}}
- 문의사항: {{additionalRequests}}

📋 다음 단계:
1. 고객 요구사항 검토
2. 견적서 작성
3. "견적 승인"으로 상태 변경

{{mention}}
{{timestamp}}` as const,

    RENTAL: `📊 새로운 렌탈 행사 견적 요청

✅ 행사 정보:
- 행사명: {{eventName}}
- 행사장: {{venue}} ({{installEnvironment}})
- 고객사: {{customerName}}
- 고객: {{contactName}} {{contactTitle}}
- 연락처: {{contactPhone}}
- 행사 기간: {{eventPeriod}}
- 문의사항: {{additionalRequests}}

🖥️ LED 사양:
{{ledSpecs}}

📋 다음 단계:
1. 행사 정보 검토
2. 견적서 또는 요청서 작성
3. 파일 업로드 (자동 승인됨)

{{mention}}
{{timestamp}}` as const,

    MEMBERSHIP: `📊 멤버쉽 행사 견적 요청

✅ 행사 정보:
- 행사명: {{eventName}}
- 행사장: {{venue}}
- 고객사: {{customerName}} (멤버쉽)
- 고객: {{contactName}} {{contactTitle}}
- 연락처: {{contactPhone}}
- 행사 기간: {{eventPeriod}}

🖥️ LED 사양:
{{ledSpecs}}

📋 다음 단계:
1. 행사 정보 검토
2. 견적서 및 요청서 작성
3. 파일 업로드 (자동 승인됨)

{{mention}}
{{timestamp}}` as const,
  },

  // 견적 검토 → 견적 승인
  QUOTE_REVIEW_TO_APPROVED: {
    INSTALL: `✅ 견적 승인됨 - 구축 준비

📋 프로젝트 정보:
- 프로젝트명: {{eventName}}
- 고객사: {{customerName}}
- 구축 예정지: {{venue}}
- 구축 일정: {{installSchedule}}

💰 견적 정보:
- 총 견적 금액: {{totalAmount}}원

📌 다음 단계:
1. 구축팀 일정 조율
2. 장비 및 자재 준비
3. 현장 사전 답사 일정 확정
4. "설치 중"으로 상태 변경 (행사 전날 자동)

{{mention}}
{{timestamp}}` as const,  // as const 추가

    RENTAL: `✅ 견적 승인됨 - 배차 준비

📋 행사 정보:
- 행사명: {{eventName}}
- 고객사: {{customerName}}
- 행사장: {{venue}}
- 행사 기간: {{eventPeriod}}

💰 견적 정보:
- 총 견적 금액: {{totalAmount}}원
- LED 모듈: {{totalModules}}개

🚚 배차 정보:
{{truckInfo}}

📌 다음 단계:
1. 배차 기사 섭외
2. 상하차 일정 확정
3. "배차 완료"로 상태 변경

{{mention}}
{{timestamp}}` as const,  // as const 추가

    MEMBERSHIP: `✅ 멤버쉽 견적 승인 - 배차 준비

📋 행사 정보:
- 행사명: {{eventName}}
- 고객사: {{customerName}} (멤버쉽)
- 행사장: {{venue}}
- 행사 기간: {{eventPeriod}}

💰 견적 정보:
- 총 견적 금액: {{totalAmount}}원
- LED 모듈: {{totalModules}}개

🚚 배차 정보:
{{truckInfo}}

📌 다음 단계:
1. 배차 기사 섭외
2. 상하차 일정 확정
3. "배차 완료"로 상태 변경

{{mention}}
{{timestamp}}` as const,  // as const 추가
  },

  // 견적 승인 → 배차 완료 (렌탈/멤버쉽만)
  APPROVED_TO_DISPATCH: {
    RENTAL: `✅ 배차 완료 - 인력 구인 필요

📋 행사 정보:
- 행사명: {{eventName}}
- 행사장: {{venue}}
- 설치일: {{installDate}}

🚚 배차 확정:
- 차량: {{confirmedTruck}}
- 기사: {{driverInfo}}
- 상차 시간: {{loadingTime}}

👷 필요 인력:
- 설치 인력: {{installWorkers}}명
- 오퍼레이터: {{operatorNeeded}}

📌 다음 단계:
1. 설치 인력 섭외
2. 오퍼레이터 섭외 (필요시)
3. "구인 완료"로 상태 변경

{{mention}}
{{timestamp}}` as const,  // as const 추가

    MEMBERSHIP: `✅ 멤버쉽 배차 완료 - 인력 구인

📋 행사 정보:
- 행사명: {{eventName}}
- 고객사: {{customerName}} (멤버쉽)
- 행사장: {{venue}}
- 설치일: {{installDate}}

🚚 배차 확정:
- 차량: {{confirmedTruck}}
- 기사: {{driverInfo}}
- 상차 시간: {{loadingTime}}

👷 필요 인력:
- 설치 인력: {{installWorkers}}명
- 오퍼레이터: {{operatorNeeded}}

📌 다음 단계:
1. 설치 인력 섭외
2. 오퍼레이터 섭외 (필요시)
3. "구인 완료"로 상태 변경

{{mention}}
{{timestamp}}` as const,  // as const 추가
  },

  // 배차 완료 → 구인 완료
  DISPATCH_TO_RECRUITMENT: {
    RENTAL: `✅ 구인 완료 - 설치 준비 완료

📋 행사 정보:
- 행사명: {{eventName}}
- 행사장: {{venue}}
- 설치일: {{installDate}}

👷 인력 배정 완료:
- 설치팀장: {{installLeader}}
- 설치 인원: {{installTeam}}
- 오퍼레이터: {{operatorInfo}}

📦 최종 체크리스트:
□ 장비 점검 완료
□ 차량 및 기사 확정
□ 인력 배정 완료
□ 고객 연락처 공유
□ 현장 접근 방법 확인

📌 다음 단계:
- 설치일 전날 자동으로 "설치 중" 변경

{{mention}}
{{timestamp}}` as const,  // as const 추가

    MEMBERSHIP: `✅ 멤버쉽 구인 완료 - 설치 준비

📋 행사 정보:
- 행사명: {{eventName}}
- 고객사: {{customerName}} (멤버쉽)
- 행사장: {{venue}}
- 설치일: {{installDate}}

👷 인력 배정 완료:
- 설치팀장: {{installLeader}}
- 설치 인원: {{installTeam}}
- 오퍼레이터: {{operatorInfo}}

📦 최종 체크리스트:
□ 장비 점검 완료
□ 차량 및 기사 확정
□ 인력 배정 완료
□ 고객 연락처 공유
□ 현장 접근 방법 확인

📌 다음 단계:
- 설치일 전날 자동으로 "설치 중" 변경

{{mention}}
{{timestamp}}` as const,  // as const 추가
  },

  // 자동 상태 변경 메시지
  AUTO_STATUS_CHANGES: {
    // 견적 승인/구인 완료 → 설치 중 (행사 전날)
    TO_INSTALLING: `🔧 자동 상태 변경: 설치 중

내일 설치 예정인 행사입니다.

📋 행사 정보:
- 행사명: {{eventName}}
- 행사장: {{venue}}
- 설치일: {{installDate}} (내일)

✅ 설치 전 최종 확인:
□ 장비 적재 완료
□ 인력 집합 시간 공지
□ 현장 담당자 연락
□ 차량 출발 시간 확정

{{mention}}
{{timestamp}}` as const,  // as const 추가

    // 설치 중 → 운영 중 (행사 시작일)
    TO_OPERATING: `🎯 자동 상태 변경: 운영 중

오늘부터 행사가 시작됩니다.

📋 행사 정보:
- 행사명: {{eventName}}
- 행사장: {{venue}}
- 행사 기간: {{eventPeriod}}

✅ 운영 체크사항:
□ 오퍼레이터 현장 도착
□ 장비 정상 작동 확인
□ 비상 연락망 확인

{{mention}}
{{timestamp}}` as const,  // as const 추가

    // 운영 중 → 철거 중 (행사 종료일)
    TO_DISMANTLING: `📦 자동 상태 변경: 철거 중

오늘 행사가 종료됩니다.

📋 행사 정보:
- 행사명: {{eventName}}
- 행사장: {{venue}}
- 철거 예정 시간: {{dismantleTime}}

🚚 철거 배차:
{{dismantleTruckInfo}}

✅ 철거 체크사항:
□ 철거팀 현장 도착
□ 장비 수량 확인
□ 차량 대기 확인

{{mention}}
{{timestamp}}` as const,  // as const 추가
  }
} as const;

// 파일 업로드 관련 메시지
export const FILE_MESSAGES = {
  // 파일 일부만 업로드됨
  PARTIAL_UPLOAD: {
    ALL: `📎 파일 업로드 확인

✅ 업로드 완료: {{uploadedFile}}
❌ 업로드 대기: {{missingFile}}

{{missingFile}}를 업로드하면 자동으로 "견적 승인" 상태로 변경됩니다.

⏰ 확인 시간: {{timestamp}}`
  },

  // 파일 모두 업로드됨 (자동 승인)
  AUTO_APPROVAL: {
    RENTAL: `✅ 파일 업로드 완료 - 자동 승인

견적서와 요청서가 모두 업로드되어 자동으로 "견적 승인" 상태로 변경되었습니다.

📎 업로드 파일:
- 견적서 ✅
- 요청서 ✅

📌 다음 단계:
1. 배차 정보 확인
2. 배차 기사 섭외
3. "배차 완료"로 상태 변경

{{mention}}
{{timestamp}}` as const,  // as const 추가

    MEMBERSHIP: `✅ 멤버쉽 파일 완료 - 자동 승인

견적서와 요청서가 모두 업로드되어 자동으로 "견적 승인" 상태로 변경되었습니다.

📎 업로드 파일:
- 견적서 ✅
- 요청서 ✅

📌 다음 단계:
1. 배차 정보 확인
2. 배차 기사 섭외
3. "배차 완료"로 상태 변경

{{mention}}
{{timestamp}}` as const,  // as const 추가
  }
} as const;

// 에러 메시지
export const ERROR_MESSAGES = {
  AUTOMATION_ERROR: `❌ 자동화 오류 발생

상태: {{oldStatus}} → {{newStatus}}
오류: {{errorMessage}}

담당자가 수동으로 처리해주세요.

{{mention}}
⏰ 오류 발생 시간: {{timestamp}}`,

  FILE_APPROVAL_ERROR: `❌ 자동 승인 실패

오류: {{errorMessage}}

담당자가 수동으로 "견적 승인"으로 변경해주세요.

{{mention}}
⏰ 오류 발생 시간: {{timestamp}}`
} as const;

// 특수 알림 메시지
export const SPECIAL_NOTIFICATIONS = {
  // 철거 전날 알림
  DISMANTLE_REMINDER: `🚨 내일 철거 예정 알림

📋 행사 정보:
- 행사명: {{eventName}}
- 행사장: {{venue}}
- 철거일: {{dismantleDate}} (내일)

🚚 철거 배차 필요:
{{dismantleTruckInfo}}

📞 연락처:
- 고객: {{contactName}} ({{contactPhone}})

⚠️ 철거팀 사전 준비사항:
1. 철거 인력 확정
2. 차량 및 기사 확정
3. 철거 시간 고객 확인
4. 철거 동선 확인

{{mention}}
{{timestamp}}` as const,  // as const 추가
} as const;

// 서비스 타입 정의
export type NotionServiceType = 'INSTALL' | 'RENTAL' | 'MEMBERSHIP';

// 서비스 타입 변환 함수
export function getNotionServiceType(serviceType: string): NotionServiceType {
  switch (serviceType) {
    case '설치':
      return 'INSTALL';
    case '렌탈':
      return 'RENTAL';
    case '멤버쉽':
      return 'MEMBERSHIP';
    default:
      return 'RENTAL'; // 기본값
  }
}

// 담당자 ID 가져오기
export function getManagerId(serviceType: NotionServiceType): string {
  return SERVICE_TERMINOLOGY[serviceType].teamLeaderId;
}

// 담당자 이름 가져오기
export function getManagerName(serviceType: NotionServiceType): string {
  return SERVICE_TERMINOLOGY[serviceType].teamLeader;
}