export const testLEDSpecs = {
  small: {
    size: '3000x2000',
    stageHeight: 600,
    needOperator: false,
    operatorDays: 0,
    prompterConnection: false,
    relayConnection: false
  },
  medium: {
    size: '4000x2500',
    stageHeight: 800,
    needOperator: true,
    operatorDays: 2,
    prompterConnection: true,
    relayConnection: false
  },
  large: {
    size: '6000x3000',
    stageHeight: 1000,
    needOperator: true,
    operatorDays: 3,
    prompterConnection: true,
    relayConnection: true
  }
};

export const testCustomerData = {
  customerName: '테스트고객사',
  contactName: '김테스트',
  contactTitle: '팀장',
  contactPhone: '010-1234-5678',
  eventName: '테스트 행사',
  venue: '테스트 행사장'
};