import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { Client } from '@notionhq/client';

// Notion 클라이언트 초기화
const notion = new Client({
  auth: process.env.NOTION_API_KEY
});

const DATABASE_ID = process.env.NOTION_DATABASE_ID || '';

interface NotionToolInput {
  serviceType: string;
  eventName: string;
  customerName: string;
  venue: string;
  contactName: string;
  contactTitle: string;
  contactPhone: string;
  eventSchedule?: string;
  installSchedule?: string;
  rehearsalSchedule?: string;
  dismantleSchedule?: string;
  totalQuoteAmount?: number;
  additionalRequests?: string;
  
  // LED 관련
  led1?: any;
  led2?: any;
  led3?: any;
  led4?: any;
  led5?: any;
  totalModuleCount?: number;
  ledModuleCost?: number;
  
  // 설치 관련
  installEnvironment?: string;
  installSpace?: string;
  inquiryPurpose?: string;
  installBudget?: string;
  
  // 렌탈 관련
  supportStructureType?: string;
  periodSurchargeAmount?: number;
  transportCost?: number;
  
  // 멤버쉽 관련
  memberCode?: string;
  structureCost?: number;
  controllerCost?: number;
  powerCost?: number;
  installationCost?: number;
  operatorCost?: number;
  maxStageHeight?: number;
  installationWorkers?: number;
  installationWorkerRange?: string;
  controllerCount?: number;
  powerRequiredCount?: number;
  transportRange?: string;
  structureUnitPrice?: number;
  structureUnitPriceDescription?: string;
}

export const notionMCPTool = {
  name: 'create_notion_estimate',
  description: 'Create LED rental/installation estimate in Notion database',
  
  inputSchema: {
    type: 'object' as const,
    properties: {
      serviceType: { type: 'string', description: '서비스 유형 (렌탈/설치/멤버쉽)' },
      eventName: { type: 'string', description: '행사명' },
      customerName: { type: 'string', description: '고객사명' },
      venue: { type: 'string', description: '행사장' },
      contactName: { type: 'string', description: '담당자명' },
      contactTitle: { type: 'string', description: '직급' },
      contactPhone: { type: 'string', description: '연락처' }
    },
    required: ['serviceType', 'eventName', 'customerName', 'contactName', 'contactPhone']
  },

  handler: async (args: NotionToolInput) => {
    try {
      if (!DATABASE_ID) {
        throw new McpError(ErrorCode.InvalidRequest, 'Notion database ID not configured');
      }

      // Notion 페이지 속성 구성
      const properties = buildNotionProperties(args);

      // Notion 페이지 생성
      const response = await notion.pages.create({
        parent: { database_id: DATABASE_ID },
        properties,
        children: buildNotionContent(args)
      });

      return {
        id: response.id,
        url: `https://notion.so/${response.id.replace(/-/g, '')}`,
        message: `✅ Notion 견적서가 생성되었습니다: ${args.eventName}`
      };

    } catch (error) {
      console.error('Notion creation error:', error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to create Notion page: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
};

// Notion 속성 빌드 함수
function buildNotionProperties(args: NotionToolInput): Record<string, any> {
  const properties: any = {
    '행사명': { title: [{ text: { content: args.eventName } }] },
    '서비스유형': { select: { name: args.serviceType } },
    '고객사': { rich_text: [{ text: { content: args.customerName } }] },
    '행사장': { rich_text: [{ text: { content: args.venue || '' } }] },
    '담당자': { rich_text: [{ text: { content: `${args.contactName} ${args.contactTitle || ''}` } }] },
    '연락처': { phone_number: args.contactPhone },
    '상태': { select: { name: '견적요청' } },
    '작성일': { date: { start: new Date().toISOString().split('T')[0] } }
  };

  // 견적 금액
  if (args.totalQuoteAmount !== undefined) {
    properties['견적금액'] = { number: args.totalQuoteAmount };
  }

  // 행사 일정
  if (args.eventSchedule) {
    const dates = args.eventSchedule.split(' ~ ');
    if (dates.length === 2) {
      properties['행사일정'] = {
        date: {
          start: dates[0],
          end: dates[1]
        }
      };
    }
  }

  // 서비스별 추가 속성
  if (args.serviceType === '설치') {
    if (args.installEnvironment) {
      properties['설치환경'] = { select: { name: args.installEnvironment } };
    }
    if (args.inquiryPurpose) {
      properties['문의목적'] = { rich_text: [{ text: { content: args.inquiryPurpose } }] };
    }
  }

  if (args.serviceType === '멤버쉽' && args.memberCode) {
    properties['멤버코드'] = { rich_text: [{ text: { content: args.memberCode } }] };
  }

  return properties;
}

// Notion 페이지 콘텐츠 빌드 함수
function buildNotionContent(args: NotionToolInput): any[] {
  const blocks: any[] = [];

  // 기본 정보 섹션
  blocks.push(
    {
      object: 'block',
      type: 'heading_2',
      heading_2: {
        rich_text: [{ type: 'text', text: { content: '📋 기본 정보' } }]
      }
    },
    {
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [
          { type: 'text', text: { content: `🏢 고객사: ${args.customerName}\n` } },
          { type: 'text', text: { content: `📍 행사장: ${args.venue || '-'}\n` } },
          { type: 'text', text: { content: `👤 담당자: ${args.contactName} ${args.contactTitle || ''}\n` } },
          { type: 'text', text: { content: `📞 연락처: ${args.contactPhone}` } }
        ]
      }
    }
  );

  // LED 사양 섹션
  const ledSpecs = [args.led1, args.led2, args.led3, args.led4, args.led5].filter(Boolean);
  if (ledSpecs.length > 0) {
    blocks.push(
      {
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: '🖥️ LED 사양' } }]
        }
      }
    );

    ledSpecs.forEach((led, index) => {
      blocks.push({
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [{
            type: 'text',
            text: { content: `LED ${index + 1}: ${led.size} (무대높이: ${led.stageHeight}mm)` }
          }]
        }
      });
    });
  }

  // 견적 상세 섹션
  if (args.totalQuoteAmount) {
    blocks.push(
      {
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: '💰 견적 상세' } }]
        }
      },
      {
        object: 'block',
        type: 'table',
        table: {
          table_width: 2,
          has_column_header: true,
          children: buildQuoteTable(args)
        }
      }
    );
  }

  // 추가 요청사항
  if (args.additionalRequests && args.additionalRequests !== '없음') {
    blocks.push(
      {
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: '💬 추가 요청사항' } }]
        }
      },
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ type: 'text', text: { content: args.additionalRequests } }]
        }
      }
    );
  }

  return blocks;
}

// 견적 테이블 생성 함수
function buildQuoteTable(args: NotionToolInput): any[] {
  const rows: any[] = [
    // 헤더 행
    {
      type: 'table_row',
      table_row: {
        cells: [
          [{ type: 'text', text: { content: '항목', link: null }, annotations: { bold: true } }],
          [{ type: 'text', text: { content: '금액', link: null }, annotations: { bold: true } }]
        ]
      }
    }
  ];

  // 항목별 행 추가
  const items = [
    { label: 'LED 모듈', value: args.ledModuleCost },
    { label: '구조물', value: args.structureCost },
    { label: '프로세서', value: args.controllerCost },
    { label: '전원', value: args.powerCost },
    { label: '설치비', value: args.installationCost },
    { label: '운영인력', value: args.operatorCost },
    { label: '운송비', value: args.transportCost },
    { label: '기간 할증', value: args.periodSurchargeAmount }
  ];

  items.forEach(item => {
    if (item.value !== undefined && item.value > 0) {
      rows.push({
        type: 'table_row',
        table_row: {
          cells: [
            [{ type: 'text', text: { content: item.label } }],
            [{ type: 'text', text: { content: `${item.value.toLocaleString()}원` } }]
          ]
        }
      });
    }
  });

  // 총액 행
  if (args.totalQuoteAmount) {
    rows.push({
      type: 'table_row',
      table_row: {
        cells: [
          [{ type: 'text', text: { content: '총액 (VAT 포함)', link: null }, annotations: { bold: true } }],
          [{ 
            type: 'text', 
            text: { content: `${args.totalQuoteAmount.toLocaleString()}원` }, 
            annotations: { bold: true, color: 'blue' } 
          }]
        ]
      }
    });
  }

  return rows;
}