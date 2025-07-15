import { calculateQuoteTool } from '../src/tools/calculate-quote.js';

async function testCalculateQuote() {
  console.log('=== LED 렌탈 견적 계산 테스트 ===\n');

  const testData = {
    ledSize: '4000x2500',
    is3D: false,
    needOperator: true,
    eventStartDate: '2025-07-09',
    eventEndDate: '2025-07-12',
    eventLocation: '수원메쎄 2홀',
    customerName: '메쎄이상'
  };

  console.log('입력 데이터:');
  console.log(JSON.stringify(testData, null, 2));
  console.log('\n' + '='.repeat(50) + '\n');

  try {
    const result = await calculateQuoteTool.handler(testData);
    console.log('견적 계산 결과:');
    console.log(result.content[0].text);
  } catch (error) {
    console.error('테스트 실패:', error);
  }
}

testCalculateQuote();