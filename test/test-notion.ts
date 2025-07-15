import { notionMCPTool } from '../src/tools/notion-mcp.js';

async function testNotionIntegration() {
  console.log('=== Notion 연동 테스트 ===\n');

  const testData = {
    eventName: '메쎄이상 커피박람회',
    customerName: '메쎄이상',
    eventDate: '2025-07-09',
    venue: '수원메쎄 2홀',
    ledSize: '4000x2500',
    is3D: false,
    needOperator: true,
    customerContact: '010-1234-5678',
    quoteAmount: 2420000
  };

  try {
    const result = await notionMCPTool.handler(testData);
    console.log(result.content[0].text);
  } catch (error) {
    console.error('테스트 실패:', error);
  }
}

testNotionIntegration();