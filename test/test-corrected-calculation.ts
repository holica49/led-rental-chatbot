import { calculateMultiLEDQuote, calculateMultiQuoteTool } from '../src/tools/calculate-quote.js';
import { notionMCPTool } from '../src/tools/notion-mcp.js';

async function testCorrectedCalculation() {
  console.log('=== 수정된 견적 계산 테스트 ===\n');

  // 3개소 LED 사양
  const ledSpecs = [
    { size: '4000x2500', needOperator: true, operatorDays: 4 },   // 40개
    { size: '2000x1500', needOperator: false, operatorDays: 0 },  // 12개  
    { size: '1000x1000', needOperator: false, operatorDays: 0 }   // 4개
  ];

  console.log('📊 LED 개소 정보:');
  ledSpecs.forEach((specs, index) => {
    const [width, height] = specs.size.split('x').map(Number);
    const moduleCount = (width / 500) * (height / 500);
    const structureArea = (width * height) / 1_000_000;
    console.log(`LED${index + 1}: ${specs.size} - ${moduleCount}개 모듈, ${structureArea}㎡ 구조물`);
  });

  // 수정된 견적 계산
  const quote = calculateMultiLEDQuote(ledSpecs);
  
  console.log('\n📊 견적 계산 결과:');
  console.log(`총 LED 모듈: ${quote.ledModules.count}개`);
  console.log(`총 모듈 수 (DB저장용): ${quote.totalModuleCount}개`);
  console.log(`총 구조물 면적: ${quote.structure.area}㎡ (무대높이 무시)`);
  console.log(`운반비: ${quote.transport.price.toLocaleString()}원 (${quote.ledModules.count}개 → 200개 이하)`);
  console.log(`컨트롤러 비용: ${quote.controller.totalPrice.toLocaleString()}원`);
  console.log(`오퍼레이터 비용: ${quote.operation.totalPrice.toLocaleString()}원`);
  console.log(`총액: ${quote.total.toLocaleString()}원 (VAT 포함)\n`);

  // Notion에 저장할 데이터 준비
  const notionData = {
    eventName: '수정된 계산 테스트 (3개소)',
    customerName: '메쎄이상',
    eventDate: '2025-07-09',
    venue: '수원메쎄 2홀',
    customerContact: '010-1234-5678',
    
    led1: { size: '4000x2500', moduleCount: 40, needOperator: true, operatorDays: 4, stageHeight: 600 },
    led2: { size: '2000x1500', moduleCount: 12, needOperator: false, operatorDays: 0, stageHeight: 400 },
    led3: { size: '1000x1000', moduleCount: 4, needOperator: false, operatorDays: 0, stageHeight: 300 },
    
    totalQuoteAmount: quote.total,
    totalModuleCount: quote.totalModuleCount,
    ledModuleCost: quote.ledModules.price,
    structureCost: quote.structure.totalPrice,
    controllerCost: quote.controller.totalPrice,
    powerCost: quote.power.totalPrice,
    installationCost: quote.installation.totalPrice,
    operatorCost: quote.operation.totalPrice,
    transportCost: quote.transport.price
  };

  // Notion에 저장
  console.log('📝 Notion에 저장 중...');
  const result = await notionMCPTool.handler(notionData);
  console.log(result.content[0].text);
}

testCorrectedCalculation().catch(console.error);