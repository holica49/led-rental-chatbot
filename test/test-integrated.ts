import { calculateQuoteTool } from '../src/tools/calculate-quote.js';
import { notionMCPTool } from '../src/tools/notion-mcp.js';

async function testIntegratedSystem() {
  console.log('=== 통합 시스템 테스트 ===\n');

  // 1. 견적 계산
  const quoteData = {
    ledSize: '4000x2500',
    is3D: false,
    needOperator: true,
    eventStartDate: '2025-07-09',
    eventEndDate: '2025-07-12',
    eventLocation: '수원메쎄 2홀',
    customerName: '메쎄이상'
  };

  console.log('1. 견적 계산 중...');
  const quoteResult = await calculateQuoteTool.handler(quoteData);
  const parsedQuote = JSON.parse(quoteResult.content[0].text);
  console.log(`견적 완료: ${parsedQuote.quote.total.toLocaleString()}원\n`);

  // 2. Notion에 행사 생성
  console.log('2. Notion 행사 생성 중...');
  const notionData = {
    eventName: '메쎄이상 커피박람회',
    customerName: '메쎄이상',
    eventDate: '2025-07-09',
    venue: '수원메쎄 2홀',
    ledSize: '4000x2500',
    is3D: false,
    needOperator: true,
    customerContact: '010-7202-2586',
    quoteAmount: parsedQuote.quote.total
  };

  const notionResult = await notionMCPTool.handler(notionData);
  console.log(notionResult.content[0].text);

  console.log('\n=== 통합 테스트 완료 ===');
  console.log('💡 Notion 데이터베이스에서 생성된 행사를 확인해보세요!');
}

testIntegratedSystem().catch(console.error);