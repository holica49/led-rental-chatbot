# 이원화 봇 구현 가이드

## 🎯 전체 전략
- **카카오톡**: B2C 고객 상담 (FAQ 응답)
- **LINE WORKS**: B2E 업무 관리 (DB 쿼리)

## 📱 카카오톡 고객 상담봇

### 목적
- LED 제품/서비스 문의 응답
- 24/7 고객 상담 자동화
- 견적 문의 1차 응대

### 구현 방법
1. **카카오 i 오픈빌더**
   - FAQ 30-50개 학습
   - 엔티티 정의 (LED타입, 서비스종류)
   - 시나리오 구성

2. **주요 FAQ 카테고리**
   ```
   가격/견적 (10개)
   - "렌탈 가격이 얼마인가요?"
   - "설치 비용은 어떻게 되나요?"
   
   제품 사양 (10개)
   - "P2.5가 뭔가요?"
   - "실내용과 실외용 차이는?"
   
   설치/시공 (10개)
   - "실외 설치 가능한가요?"
   - "설치 기간은 얼마나 걸리나요?"
   ```

3. **폴백 처리**
   ```typescript
   // 기존 스킬 서버에 추가
   if (intent === 'FALLBACK') {
     const faqAnswer = await searchNotionFAQ(utterance);
     if (faqAnswer) return faqAnswer;
     
     return "담당자가 곧 연락드리겠습니다. 
             연락처를 남겨주세요.";
   }
   ```

### 체크리스트
- [ ] 카카오 i 콘솔 접속
- [ ] FAQ 30개 엑셀 정리
- [ ] 오픈빌더 학습 데이터 입력
- [ ] 폴백 블록 설정
- [ ] 테스트 및 배포

## 💼 LINE WORKS 업무관리봇

### 목적
- 프로젝트 현황 실시간 조회
- 일정/리소스 관리
- 업무 보고서 자동 생성
- 팀 협업 지원

### 주요 기능

1. **프로젝트 조회**
   ```
   "강남LED 현황"
   → 진행상태, 담당자, D-day, 이슈사항
   
   "이번주 설치 일정"
   → 요일별 설치 현장 리스트
   ```

2. **리소스 관리**
   ```
   "LED 재고 현황"
   → P2.5: 320개 (80%)
   → P3: 150개 (50%)
   
   "내일 가용 인력"
   → 설치팀: 4명
   → 오퍼레이터: 2명
   ```

3. **보고서 생성**
   ```
   "이번달 렌탈 실적"
   → 자동 집계 및 차트 생성
   → PDF/Excel 다운로드
   ```

### 구현 구조
```
lineworks-business-bot/
├── src/
│   ├── server.ts              # Express 서버
│   ├── handlers/
│   │   ├── project.ts         # 프로젝트 조회
│   │   ├── schedule.ts        # 일정 관리
│   │   ├── resource.ts        # 리소스 현황
│   │   └── report.ts          # 보고서 생성
│   ├── services/
│   │   ├── notion-query.ts    # Notion DB 쿼리
│   │   └── lineworks-api.ts   # LINE WORKS API
│   └── utils/
│       ├── nlp-business.ts    # 업무 특화 NLP
│       └── formatter.ts       # 메시지 포맷팅
```

### LINE WORKS 메시지 예시
```typescript
// Flex Message로 프로젝트 카드 생성
const projectCard = {
  type: 'flex',
  altText: '프로젝트 현황',
  contents: {
    type: 'bubble',
    header: {
      backgroundColor: '#06C755',
      contents: [{
        type: 'text',
        text: '강남LED교체사업',
        color: '#FFFFFF',
        weight: 'bold'
      }]
    },
    body: {
      contents: [
        { type: 'progress', rate: 70 },
        { type: 'text', text: 'D-7 구축예정' },
        { type: 'separator' },
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            { text: '담당', flex: 1 },
            { text: '최수삼 팀장', flex: 2 }
          ]
        }
      ]
    }
  }
};
```

### 자연어 처리 (업무 특화)
```typescript
const businessIntents = {
  PROJECT_STATUS: ['현황', '상태', '진행'],
  SCHEDULE: ['일정', '스케줄', '언제'],
  RESOURCE: ['재고', '가용', '남은'],
  REPORT: ['보고서', '실적', '집계'],
  TEAM: ['팀원', '담당자', '누가']
};

// 프로젝트명 추출
const extractProjectName = (text: string) => {
  // "강남LED", "삼성 프로젝트" 등 추출
};

// 날짜 추출
const extractDateRange = (text: string) => {
  // "이번주", "오늘", "내일" 등 파싱
};
```

## 🚀 구현 로드맵

### Week 1: 카카오 FAQ 구축
- Day 1-2: FAQ 정리 및 학습
- Day 3-4: 테스트 및 개선
- Day 5: 운영 시작

### Week 2: 카카오 안정화
- 학습 데이터 추가
- 폴백 스킬 개선
- 응답 품질 모니터링

### Week 3-4: LINE WORKS 개발
- Week 3: 핵심 기능 구현
- Week 4: UI/UX 최적화 및 테스트

## 📊 성공 지표

### 카카오 고객 상담봇
- FAQ 적중률 > 70%
- 평균 응답 시간 < 1초
- 고객 만족도 > 80%

### LINE WORKS 업무봇  
- 일일 사용률 > 80% (직원)
- 정보 조회 시간 90% 단축
- 보고서 작성 시간 70% 감소

## 🔗 참고 자료
- [카카오 i 오픈빌더 가이드](https://i.kakao.com/docs/getting-started-overview)
- [LINE WORKS Bot API](https://developers.worksmobile.com/kr/docs/bot-api)
- 기존 Notion Service: `src/tools/services/notion-service.ts`