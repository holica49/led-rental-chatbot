import { enhancedExcelTool } from '../src/tools/enhanced-excel.js';
import { calculateQuoteTool } from '../src/tools/calculate-quote.js';

async function testEnhancedExcel() {
  console.log('=== 향상된 Excel 생성 테스트 ===\n');

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

  // 2. 스타일이 적용된 요청서 Excel 생성
  console.log('2. 스타일 요청서 Excel 생성 중...');
  const requestData = {
    ...quoteData,
    eventName: 'LED Wall 렌탈',
    scenario: '커피 박람회\n- 개막식: 오전 10시\n- 제품 소개: 오후 2시\n- 시상식: 오후 5시\n- 폐막식: 오후 6시',
    fieldManager: '강동호 책임 010-7202-2586',
    electricManager: 'KH 담당자',
    stageManager: '더퍼스트'
  };

  const styledRequestResult = await enhancedExcelTool.handler({
    type: 'request',
    data: requestData
  });
  
  console.log(styledRequestResult.content[0].text);
  console.log('');

  // 3. 스타일이 적용된 견적서 Excel 생성
  console.log('3. 스타일 견적서 Excel 생성 중...');
  const quoteExcelData = {
    ...quoteData,
    quote: parsedQuote.quote,
    transport: parsedQuote.transport
  };

  const styledQuoteResult = await enhancedExcelTool.handler({
    type: 'quote',
    data: quoteExcelData
  });

  console.log(styledQuoteResult.content[0].text);
  console.log('\n=== 테스트 완료 ===');
  console.log('💡 data 폴더에서 생성된 Excel 파일들을 확인해보세요!');
  console.log('   - 전문적인 디자인 적용');
  console.log('   - 색상 구분 및 테두리');
  console.log('   - 회사 로고 및 서명');
}

testEnhancedExcel().catch(console.error);