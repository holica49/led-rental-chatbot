// Lazy evaluation을 위해 함수로 감싸기
export const getQuickRepliesConfig = (BUTTONS: any) => ({
  SERVICE_SELECT: [
    { label: BUTTONS.SERVICE_INSTALL, value: '설치' },
    { label: BUTTONS.SERVICE_RENTAL, value: '렌탈' },
    { label: BUTTONS.SERVICE_MEMBERSHIP, value: '멤버쉽' },
  ],
  
  ENVIRONMENT_SELECT: [
    { label: BUTTONS.INDOOR, value: '실내' },
    { label: BUTTONS.OUTDOOR, value: '실외' },
  ],
  
  SPACE_SELECT: [
    { label: BUTTONS.SPACE_CORPORATE, value: '기업' },
    { label: BUTTONS.SPACE_RETAIL, value: '상가' },
    { label: BUTTONS.SPACE_HOSPITAL, value: '병원' },
    { label: BUTTONS.SPACE_PUBLIC, value: '공공' },
    { label: BUTTONS.SPACE_HOTEL, value: '숙박' },
    { label: BUTTONS.SPACE_EXHIBITION, value: '전시홀' },
    { label: BUTTONS.SPACE_OTHER, value: '기타' },
  ],
  
  PURPOSE_SELECT: [
    { label: BUTTONS.PURPOSE_RESEARCH, value: '정보 조사' },
    { label: BUTTONS.PURPOSE_PLANNING, value: '아이디어 기획' },
    { label: BUTTONS.PURPOSE_QUOTE, value: '견적' },
    { label: BUTTONS.PURPOSE_PURCHASE, value: '구매' },
    { label: BUTTONS.PURPOSE_OTHER, value: '기타' },
  ],
  
  BUDGET_SELECT: [
    { label: BUTTONS.BUDGET_UNDER_10M, value: '1000만원 이하' },
    { label: BUTTONS.BUDGET_10M_30M, value: '1000~3000만원' },
    { label: BUTTONS.BUDGET_30M_50M, value: '3000~5000만원' },
    { label: BUTTONS.BUDGET_50M_100M, value: '5000만원~1억' },
    { label: BUTTONS.BUDGET_OVER_100M, value: '1억 이상' },
    { label: BUTTONS.BUDGET_UNDECIDED, value: '미정' },
  ],
  
  STRUCTURE_SELECT: [
    { label: BUTTONS.STRUCTURE_WOOD, value: '목공 설치' },
    { label: BUTTONS.STRUCTURE_STANDALONE, value: '단독 설치' },
  ],
  
  LED_COUNT_SELECT: [
    { label: BUTTONS.LED_COUNT[0], value: '1' },
    { label: BUTTONS.LED_COUNT[1], value: '2' },
    { label: BUTTONS.LED_COUNT[2], value: '3' },
    { label: BUTTONS.LED_COUNT[3], value: '4' },
    { label: BUTTONS.LED_COUNT[4], value: '5' },
  ],
  
  LED_SIZE_SELECT: [
    { label: BUTTONS.LED_SIZE_6000_3000, value: '6000x3000' },
    { label: BUTTONS.LED_SIZE_4000_3000, value: '4000x3000' },
    { label: BUTTONS.LED_SIZE_4000_2500, value: '4000x2500' },
  ],
  
  STAGE_HEIGHT_SELECT: [
    { label: BUTTONS.STAGE_HEIGHT_0, value: '0mm' },
    { label: BUTTONS.STAGE_HEIGHT_600, value: '600mm' },
    { label: BUTTONS.STAGE_HEIGHT_800, value: '800mm' },
    { label: BUTTONS.STAGE_HEIGHT_1000, value: '1000mm' },
  ],
  
  YES_NO_SELECT: [
    { label: BUTTONS.YES, value: '네' },
    { label: BUTTONS.NO, value: '아니요' },
  ],
  
  TITLE_SELECT: [
    { label: BUTTONS.TITLE_MANAGER, value: '매니저' },
    { label: BUTTONS.TITLE_SENIOR, value: '책임' },
    { label: BUTTONS.TITLE_TEAM_LEADER, value: '팀장' },
    { label: BUTTONS.TITLE_DIRECTOR, value: '이사' },
  ],
  
  DAYS_SELECT: [
    { label: BUTTONS.DAYS[0], value: '1' },
    { label: BUTTONS.DAYS[1], value: '2' },
    { label: BUTTONS.DAYS[2], value: '3' },
    { label: BUTTONS.DAYS[3], value: '4' },
    { label: BUTTONS.DAYS[4], value: '5' },
  ],
  
  NONE_SELECT: [
    { label: BUTTONS.NONE, value: '없음' },
  ],
  
  CONFIRM_SELECT: [
    { label: BUTTONS.CONFIRM, value: '네' },
    { label: BUTTONS.CANCEL, value: '취소' },
  ],
  
  START_OVER_SELECT: [
    { label: BUTTONS.START_OVER, value: '처음부터' },
  ],
  
  NEW_QUOTE_SELECT: [
    { label: BUTTONS.NEW_QUOTE, value: '처음부터' },
  ],
} as const);