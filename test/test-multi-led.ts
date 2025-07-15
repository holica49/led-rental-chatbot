import { notionMCPTool } from '../src/tools/notion-mcp.js';

async function testMultiLEDEvent() {
  console.log('=== 다중 LED 개소 테스트 ===\n');

  const testData = {
    eventName: '메쎄이상 커피박람회 (3개소)',
    customerName: '메쎄이상',
    eventDate: '2025-07-09',
    venue: '수원메쎄 2홀',
    customerContact: '010-1234-5678',
    
    // LED 3개소 정보
    led1: {
      size: '4000x2500',
      stageHeight: 600,
      moduleCount: 40,
      needOperator: true,
      operatorDays: 4
    },
    led2: {
      size: '2000x1500',
      stageHeight: 400,
      moduleCount: 12,
      needOperator: false,
      operatorDays: 0
    },
    led3: {
      size: '1000x1000',
      stageHeight: 300,
      moduleCount: 4,
      needOperator: false,
      operatorDays: 0
    },
    
    // 총 비용
    totalQuoteAmount: 3500000,
    ledModuleCost: 0,
    structureCost: 350000,
    controllerCost: 600000,
    installationCost: 800000,
    operatorCost: 1120000,
    transportCost: 400000
  };

  try {
    const result = await notionMCPTool.handler(testData);
    console.log(result.content[0].text);
  } catch (error) {
    console.error('테스트 실패:', error);
  }
}

testMultiLEDEvent();