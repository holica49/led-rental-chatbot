import { notionClient, DATABASE_ID, NotionEvent, LEDSpecs } from './notion-client.js';

export const notionService = {
  // 새 행사 생성 (다중 LED 개소 지원)
  async createEvent(eventData: NotionEvent) {
    const properties: any = {
      '행사명': {
        title: [
          {
            text: {
              content: eventData.eventName,
            },
          },
        ],
      },
      '행사 상태': {
        status: {
          name: eventData.eventStatus,
        },
      },
      '행사장': {
        rich_text: [
          {
            text: {
              content: eventData.venue || '',
            },
          },
        ],
      },
    };

    // 고객사 정보
    if (eventData.customerName) {
      properties['고객사'] = {
        select: {
          name: eventData.customerName,
        },
      };
    }

    // 고객 연락처
    if (eventData.customerContact) {
      properties['고객 연락처'] = {
        phone_number: eventData.customerContact,
      };
    }

    // 일정 정보
    if (eventData.installDate) {
      properties['설치 일정'] = {
        date: {
          start: eventData.installDate,
        },
      };
    }

    if (eventData.eventDate) {
      properties['행사 일정'] = {
        date: {
          start: eventData.eventDate,
        },
      };
    }

    if (eventData.dismantleDate) {
      properties['철거 일정'] = {
        date: {
          start: eventData.dismantleDate,
        },
      };
    }

    if (eventData.rehearsalDate) {
      properties['리허설 일정'] = {
        date: {
          start: eventData.rehearsalDate,
        },
      };
    }

    // LED1~5 개소별 정보
    const ledInfos = [
      { prefix: 'LED1', data: eventData.led1 },
      { prefix: 'LED2', data: eventData.led2 },
      { prefix: 'LED3', data: eventData.led3 },
      { prefix: 'LED4', data: eventData.led4 },
      { prefix: 'LED5', data: eventData.led5 },
    ];

    ledInfos.forEach(({ prefix, data }) => {
      if (data) {
        if (data.size) {
          properties[`${prefix} 크기`] = {
            rich_text: [
              {
                text: {
                  content: data.size,
                },
              },
            ],
          };
        }

        if (data.stageHeight !== undefined) {
          properties[`${prefix} 무대 높이`] = {
            number: data.stageHeight,
          };
        }

        if (data.moduleCount !== undefined) {
          properties[`${prefix} 모듈 수량`] = {
            number: data.moduleCount,
          };
        }

        if (data.needOperator !== undefined) {
          properties[`${prefix} 오퍼레이터 필요`] = {
            checkbox: data.needOperator,
          };
        }

        if (data.operatorDays !== undefined) {
          properties[`${prefix} 오퍼레이터 일수`] = {
            number: data.operatorDays,
          };
        }
      }
    });

    // 비용 정보
    if (eventData.totalQuoteAmount !== undefined) {
      properties['견적 금액'] = {
        number: eventData.totalQuoteAmount,
      };
    }

    // 🔥 새로 추가된 총 LED 모듈 수량
    if (eventData.totalModuleCount !== undefined) {
      properties['총 LED 모듈 수량'] = {
        number: eventData.totalModuleCount,
      };
    }

    if (eventData.ledModuleCost !== undefined) {
      properties['LED 모듈 비용'] = {
        number: eventData.ledModuleCost,
      };
    }

    if (eventData.structureCost !== undefined) {
      properties['지지구조물 비용'] = {
        number: eventData.structureCost,
      };
    }

    if (eventData.controllerCost !== undefined) {
      properties['컨트롤러 및 스위치 비용'] = {
        number: eventData.controllerCost,
      };
    }

    if (eventData.powerCost !== undefined) {
      properties['파워 비용'] = {
        number: eventData.powerCost,
      };
    }

    if (eventData.installationCost !== undefined) {
      properties['설치철거인력 비용'] = {
        number: eventData.installationCost,
      };
    }

    if (eventData.operatorCost !== undefined) {
      properties['오퍼레이터 비용'] = {
        number: eventData.operatorCost,
      };
    }

    if (eventData.transportCost !== undefined) {
      properties['운반 비용'] = {
        number: eventData.transportCost,
      };
    }

    // 링크 정보
    if (eventData.requestSheetUrl) {
      properties['요청서 링크'] = {
        url: eventData.requestSheetUrl,
      };
    }

    if (eventData.quoteSheetUrl) {
      properties['견적서 링크'] = {
        url: eventData.quoteSheetUrl,
      };
    }

    const response = await notionClient.pages.create({
      parent: { database_id: DATABASE_ID },
      properties,
    });

    return response;
  },

  // 체크리스트 추가 (다중 LED 개소 대응)
  async addChecklistToPage(pageId: string, ledCount: number = 1) {
    const checklistBlocks = [
      {
        object: 'block' as const,
        type: 'heading_2' as const,
        heading_2: {
          rich_text: [
            {
              type: 'text' as const,
              text: {
                content: '📝 견적 및 계약',
              },
            },
          ],
        },
      },
      {
        object: 'block' as const,
        type: 'to_do' as const,
        to_do: {
          rich_text: [
            {
              type: 'text' as const,
              text: {
                content: '요청서 접수 완료 (자동)',
              },
            },
          ],
          checked: false,
        },
      },
      {
        object: 'block' as const,
        type: 'to_do' as const,
        to_do: {
          rich_text: [
            {
              type: 'text' as const,
              text: {
                content: `견적서 정확성 검토 - ${ledCount}개소 LED (수동 ✋)`,
              },
            },
          ],
          checked: false,
        },
      },
      {
        object: 'block' as const,
        type: 'to_do' as const,
        to_do: {
          rich_text: [
            {
              type: 'text' as const,
              text: {
                content: '견적서 고객 전송 (자동)',
              },
            },
          ],
          checked: false,
        },
      },
      {
        object: 'block' as const,
        type: 'to_do' as const,
        to_do: {
          rich_text: [
            {
              type: 'text' as const,
              text: {
                content: '계약 체결 확인 (수동 ✋)',
              },
            },
          ],
          checked: false,
        },
      },
      {
        object: 'block' as const,
        type: 'heading_2' as const,
        heading_2: {
          rich_text: [
            {
              type: 'text' as const,
              text: {
                content: '🚚 배차 및 물류',
              },
            },
          ],
        },
      },
      {
        object: 'block' as const,
        type: 'to_do' as const,
        to_do: {
          rich_text: [
            {
              type: 'text' as const,
              text: {
                content: '배차 SMS 발송 (자동)',
              },
            },
          ],
          checked: false,
        },
      },
      {
        object: 'block' as const,
        type: 'to_do' as const,
        to_do: {
          rich_text: [
            {
              type: 'text' as const,
              text: {
                content: '배차 메시지 정확성 확인 (수동 ✋)',
              },
            },
          ],
          checked: false,
        },
      },
      {
        object: 'block' as const,
        type: 'heading_2' as const,
        heading_2: {
          rich_text: [
            {
              type: 'text' as const,
              text: {
                content: '👷 인력 관리',
              },
            },
          ],
        },
      },
      {
        object: 'block' as const,
        type: 'to_do' as const,
        to_do: {
          rich_text: [
            {
              type: 'text' as const,
              text: {
                content: `당근 알바 작업자 모집 - ${ledCount}개소 (수동 ✋)`,
              },
            },
          ],
          checked: false,
        },
      },
      {
        object: 'block' as const,
        type: 'to_do' as const,
        to_do: {
          rich_text: [
            {
              type: 'text' as const,
              text: {
                content: '설치 작업자 확보 완료 (수동 ✋)',
              },
            },
          ],
          checked: false,
        },
      },
      {
        object: 'block' as const,
        type: 'to_do' as const,
        to_do: {
          rich_text: [
            {
              type: 'text' as const,
              text: {
                content: '철거 작업자 확보 완료 (수동 ✋)',
              },
            },
          ],
          checked: false,
        },
      },
      {
        object: 'block' as const,
        type: 'heading_2' as const,
        heading_2: {
          rich_text: [
            {
              type: 'text' as const,
              text: {
                content: `🔧 설치 및 운영 (${ledCount}개소)`,
              },
            },
          ],
        },
      },
    ];

    // LED 개소별 체크리스트 추가
    for (let i = 1; i <= ledCount; i++) {
      checklistBlocks.push(
        {
          object: 'block' as const,
          type: 'to_do' as const,
          to_do: {
            rich_text: [
              {
                type: 'text' as const,
                text: {
                  content: `LED${i} 설치 완료 (자동)`,
                },
              },
            ],
            checked: false,
          },
        },
        {
          object: 'block' as const,
          type: 'to_do' as const,
          to_do: {
            rich_text: [
              {
                type: 'text' as const,
                text: {
                  content: `LED${i} 테스트 및 점검 (자동)`,
                },
              },
            ],
            checked: false,
          },
        }
      );
    }

    // 운영 및 철거 체크리스트 추가
    checklistBlocks.push(
      {
        object: 'block' as const,
        type: 'to_do' as const,
        to_do: {
          rich_text: [
            {
              type: 'text' as const,
              text: {
                content: '고객 인수확인 (자동)',
              },
            },
          ],
          checked: false,
        },
      },
      {
        object: 'block' as const,
        type: 'heading_2' as const,
        heading_2: {
          rich_text: [
            {
              type: 'text' as const,
              text: {
                content: '🏁 철거 및 정산',
              },
            },
          ],
        },
      },
      {
        object: 'block' as const,
        type: 'to_do' as const,
        to_do: {
          rich_text: [
            {
              type: 'text' as const,
              text: {
                content: '철거일정 고객 확인 (자동)',
              },
            },
          ],
          checked: false,
        },
      },
      {
        object: 'block' as const,
        type: 'to_do' as const,
        to_do: {
          rich_text: [
            {
              type: 'text' as const,
              text: {
                content: `전체 ${ledCount}개소 철거 완료 (자동)`,
              },
            },
          ],
          checked: false,
        },
      },
      {
        object: 'block' as const,
        type: 'to_do' as const,
        to_do: {
          rich_text: [
            {
              type: 'text' as const,
              text: {
                content: '장비 회수 확인 (자동)',
              },
            },
          ],
          checked: false,
        },
      },
      {
        object: 'block' as const,
        type: 'to_do' as const,
        to_do: {
          rich_text: [
            {
              type: 'text' as const,
              text: {
                content: '최종 정산 처리 (자동)',
              },
            },
          ],
          checked: false,
        },
      }
    );

    const response = await notionClient.blocks.children.append({
      block_id: pageId,
      children: checklistBlocks,
    });

    return response;
  },

  // 행사 상태 업데이트
  async updateEventStatus(pageId: string, newStatus: string) {
    const response = await notionClient.pages.update({
      page_id: pageId,
      properties: {
        '행사 상태': {
          status: {
            name: newStatus,
          },
        },
      },
    });

    return response;
  },

  // 견적서 링크 추가
  async addQuoteSheetLink(pageId: string, sheetUrl: string) {
    const response = await notionClient.pages.update({
      page_id: pageId,
      properties: {
        '견적서 링크': {
          url: sheetUrl,
        },
      },
    });

    return response;
  },

  // 요청서 링크 추가
  async addRequestSheetLink(pageId: string, sheetUrl: string) {
    const response = await notionClient.pages.update({
      page_id: pageId,
      properties: {
        '요청서 링크': {
          url: sheetUrl,
        },
      },
    });

    return response;
  },

  // 특정 LED 개소 정보 업데이트
  async updateLEDSpecs(pageId: string, ledNumber: number, specs: LEDSpecs) {
    const prefix = `LED${ledNumber}`;
    const properties: any = {};

    if (specs.size) {
      properties[`${prefix} 크기`] = {
        rich_text: [
          {
            text: {
              content: specs.size,
            },
          },
        ],
      };
    }

    if (specs.moduleCount !== undefined) {
      properties[`${prefix} 모듈 수량`] = {
        number: specs.moduleCount,
      };
    }

    if (specs.needOperator !== undefined) {
      properties[`${prefix} 오퍼레이터 필요`] = {
        checkbox: specs.needOperator,
      };
    }

    if (specs.operatorDays !== undefined) {
      properties[`${prefix} 오퍼레이터 일수`] = {
        number: specs.operatorDays,
      };
    }

    const response = await notionClient.pages.update({
      page_id: pageId,
      properties,
    });

    return response;
  },

  // 모든 행사 조회
  async getEvents(filter?: any) {
    const response = await notionClient.databases.query({
      database_id: DATABASE_ID,
      filter,
      sorts: [
        {
          property: '행사 일정',
          direction: 'ascending',
        },
      ],
    });

    return response.results;
  },

  // 특정 상태의 행사들 조회
  async getEventsByStatus(status: string) {
    return this.getEvents({
      property: '행사 상태',
      status: {
        equals: status,
      },
    });
  },
};