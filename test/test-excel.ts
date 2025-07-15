import { calculateQuoteTool } from '../src/tools/calculate-quote.js';
import { processExcelTool } from '../src/tools/process-excel.js';

async function testExcelGeneration() {
  console.log('=== Excel 생성 테스트 ===\n');

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
  
  console.log('견적 계산 완료!\n');

  // 2. 요청서 Excel 생성
  console.log('2. 요청서 Excel 생성 중...');
  const requestData = {
    ...quoteData,
    eventName: 'LED Wall 렌탈',
    scenario: '커피 박람회\n- 개막식\n- 제품 소개\n- 시상식',
    fieldManager: '강동호 책임 010-7202-2586'
  };

  const requestResult = await processExcelTool.handler({
    type: 'request',
    data: requestData
  });
  
  console.log(requestResult.content[0].text);
  console.log('');

  // 3. 견적서 Excel 생성
  console.log('3. 견적서 Excel 생성 중...');
  const quoteExcelData = {
    ...quoteData,
    quote: parsedQuote.quote,
    transport: parsedQuote.transport
  };

  const quoteExcelResult = await processExcelTool.handler({
    type: 'quote',
    data: quoteExcelData
  });

  console.log(quoteExcelResult.content[0].text);
  console.log('\n=== 테스트 완료 ===');
}

testExcelGeneration().catch(console.error);