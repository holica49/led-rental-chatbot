import { notionService } from './notion-service.js';

export const notionMCPTool = {
  definition: {
    name: 'create_notion_event',
    description: 'Notion에 새 LED 렌탈 행사를 생성합니다 (최대 5개소 LED 지원)',
    inputSchema: {
      type: 'object',
      properties: {
        eventName: { type: 'string', description: '행사명' },
        customerName: { type: 'string', description: '고객사명' },
        eventDate: { type: 'string', description: '행사 일정 (YYYY-MM-DD)' },
        venue: { type: 'string', description: '행사장' },
        customerContact: { type: 'string', description: '고객 연락처' },
        
        // 일정 정보
        installDate: { type: 'string', description: '설치 일정' },
        dismantleDate: { type: 'string', description: '철거 일정' },
        rehearsalDate: { type: 'string', description: '리허설 일정' },
        
        // LED 개소별 정보
        led1: {
          type: 'object',
          description: 'LED 1번째 개소 정보',
          properties: {
            size: { type: 'string' },
            stageHeight: { type: 'number' },
            moduleCount: { type: 'number' },
            needOperator: { type: 'boolean' },
            operatorDays: { type: 'number' }
          }
        },
        led2: {
          type: 'object',
          description: 'LED 2번째 개소 정보',
          properties: {
            size: { type: 'string' },
            stageHeight: { type: 'number' },
            moduleCount: { type: 'number' },
            needOperator: { type: 'boolean' },
            operatorDays: { type: 'number' }
          }
        },
        led3: {
          type: 'object',
          description: 'LED 3번째 개소 정보',
          properties: {
            size: { type: 'string' },
            stageHeight: { type: 'number' },
            moduleCount: { type: 'number' },
            needOperator: { type: 'boolean' },
            operatorDays: { type: 'number' }
          }
        },
        led4: {
          type: 'object',
          description: 'LED 4번째 개소 정보',
          properties: {
            size: { type: 'string' },
            stageHeight: { type: 'number' },
            moduleCount: { type: 'number' },
            needOperator: { type: 'boolean' },
            operatorDays: { type: 'number' }
          }
        },
        led5: {
          type: 'object',
          description: 'LED 5번째 개소 정보',
          properties: {
            size: { type: 'string' },
            stageHeight: { type: 'number' },
            moduleCount: { type: 'number' },
            needOperator: { type: 'boolean' },
            operatorDays: { type: 'number' }
          }
        },
        
        // 비용 정보
        totalQuoteAmount: { type: 'number', description: '총 견적 금액' },
        totalModuleCount: { type: 'number', description: '총 LED 모듈 수량' },
        ledModuleCost: { type: 'number', description: 'LED 모듈 비용' },
        structureCost: { type: 'number', description: '지지구조물 비용' },
        controllerCost: { type: 'number', description: '컨트롤러 비용' },
        powerCost: { type: 'number', description: '파워 비용' },
        installationCost: { type: 'number', description: '설치철거 비용' },
        operatorCost: { type: 'number', description: '오퍼레이터 비용' },
        transportCost: { type: 'number', description: '운반 비용' },
        
        // 링크
        requestSheetUrl: { type: 'string', description: '요청서 링크' },
        quoteSheetUrl: { type: 'string', description: '견적서 링크' }
      },
      required: ['eventName', 'customerName', 'eventDate', 'venue']
    }
  },

  handler: async (args: any) => {
    try {
      const {
        eventName,
        customerName,
        eventDate,
        venue,
        customerContact,
        installDate,
        dismantleDate,
        rehearsalDate,
        led1,
        led2,
        led3,
        led4,
        led5,
        totalQuoteAmount,
        totalModuleCount,
        ledModuleCost,
        structureCost,
        controllerCost,
        powerCost,
        installationCost,
        operatorCost,
        transportCost,
        requestSheetUrl,
        quoteSheetUrl
      } = args;

      // LED 개소 수 계산
      const ledCount = [led1, led2, led3, led4, led5].filter(led => led && led.size).length;

      // Notion에 행사 생성
      const notionEvent = await notionService.createEvent({
        eventName,
        customerName,
        eventStatus: '견적 요청',
        venue,
        customerContact,
        eventDate,
        installDate,
        dismantleDate,
        rehearsalDate,
        led1,
        led2,
        led3,
        led4,
        led5,
        totalQuoteAmount,
        totalModuleCount,
        ledModuleCost,
        structureCost,
        controllerCost,
        powerCost,
        installationCost,
        operatorCost,
        transportCost,
        requestSheetUrl,
        quoteSheetUrl
      });

      const pageId = notionEvent.id;

      // 체크리스트 추가 (LED 개소 수에 맞게)
      await notionService.addChecklistToPage(pageId, ledCount);

      // LED 개소 정보 요약
      const ledSummary = [led1, led2, led3, led4, led5]
        .filter(led => led && led.size)
        .map((led, index) => `LED${index + 1}: ${led.size} (${led.moduleCount}개)`)
        .join(', ');

      return {
        content: [{
          type: 'text',
          text: `✅ Notion에 새 행사가 생성되었습니다!\n📋 행사명: ${eventName}\n🏢 고객사: ${customerName}\n📅 일정: ${eventDate}\n🖥️ LED 개소: ${ledCount}개소 (${ledSummary})\n💰 총 견적: ${totalQuoteAmount?.toLocaleString() || 0}원\n🔗 Notion 페이지: https://notion.so/${pageId.replace(/-/g, '')}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Notion 행사 생성 실패: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
};