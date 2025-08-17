// src/tools/interactive-conversation.ts - 대화형 정보 수집 시스템

interface ConversationState {
  userId: string;
  projectId?: string;
  step: 'collecting' | 'confirming' | 'completed';
  missingInfo: string[];
  collectedInfo: Record<string, any>;
  lastQuestion: string;
  attempts: number;
  timestamp: number;
}

interface QuestionTemplate {
  field: string;
  question: string;
  validation?: (answer: string) => boolean;
  suggestions?: string[];
  required: boolean;
}

export class InteractiveConversationManager {
  private conversations: Map<string, ConversationState> = new Map();
  private readonly CONVERSATION_TIMEOUT = 10 * 60 * 1000; // 10분

  private questionTemplates: Record<string, QuestionTemplate> = {
    customer: {
      field: 'customer',
      question: '📢 고객사명을 알려주세요.\n예시: "삼성전자", "LG전자", "현대자동차"',
      validation: (answer) => answer.length > 1,
      required: true
    },
    location: {
      field: 'location',
      question: '📍 행사 장소를 알려주세요.\n예시: "코엑스", "킨텍스", "강남역", "홍대입구"',
      validation: (answer) => answer.length > 1,
      required: true
    },
    eventDate: {
      field: 'eventDate',
      question: '📅 행사 일정을 알려주세요.\n예시: "8월 25일", "2025-08-25", "다음 주 화요일"',
      validation: (answer) => /\d+/.test(answer),
      required: true
    },
    ledInfo: {
      field: 'ledInfo',
      question: '📺 LED 정보를 알려주세요.\n\n다음 중 선택하세요:\n1️⃣ LED 개수: "2개소", "3개소"\n2️⃣ LED 크기: "6000x3500", "4000x2000"\n3️⃣ 둘 다: "2개소, 크기는 6000x3500, 4000x2000"',
      validation: (answer) => /\d+/.test(answer),
      required: true
    },
    led1Size: {
      field: 'led1Size',
      question: '📺 LED1의 크기를 알려주세요.\n예시: "6000x3500", "4000x2000", "3000x2000"',
      validation: (answer) => /\d+\s*[x×X]\s*\d+/.test(answer),
      required: true
    },
    led1StageHeight: {
      field: 'led1StageHeight',
      question: '📏 LED1의 무대 높이를 알려주세요.\n예시: "600mm", "800", "1000밀리" (0mm도 가능합니다)',
      validation: (answer) => /\d+/.test(answer),
      required: false
    },
    led2Size: {
      field: 'led2Size',
      question: '📺 LED2의 크기를 알려주세요.\n예시: "4000x2000", "3000x2000", "5000x3000"',
      validation: (answer) => /\d+\s*[x×X]\s*\d+/.test(answer),
      required: true
    },
    led2StageHeight: {
      field: 'led2StageHeight',
      question: '📏 LED2의 무대 높이를 알려주세요.\n예시: "600mm", "800", "1000밀리" (0mm도 가능합니다)',
      validation: (answer) => /\d+/.test(answer),
      required: false
    },
    led3Size: {
      field: 'led3Size',
      question: '📺 LED3의 크기를 알려주세요.\n예시: "4000x2000", "3000x2000", "5000x3000"',
      validation: (answer) => /\d+\s*[x×X]\s*\d+/.test(answer),
      required: true
    },
    led3StageHeight: {
      field: 'led3StageHeight',
      question: '📏 LED3의 무대 높이를 알려주세요.\n예시: "600mm", "800", "1000밀리" (0mm도 가능합니다)',
      validation: (answer) => /\d+/.test(answer),
      required: false
    },
    installEnvironment: {
      field: 'installEnvironment',
      question: '🏢 설치 환경을 알려주세요.\n예시: "실내", "실외", "반야외", "옥상"',
      validation: (answer) => answer.length > 1,
      required: true
    },
    installSpace: {
      field: 'installSpace',
      question: '📐 설치 공간 정보를 알려주세요.\n예시: "10평", "100㎡", "넓은 공간", "좁은 공간"',
      validation: (answer) => answer.length > 1,
      required: true
    },
    installBudget: {
      field: 'installBudget',
      question: '💰 예산 범위를 알려주세요.\n예시: "1000만원", "3000-5000만원", "예산 무관"',
      validation: (answer) => answer.length > 1,
      required: false
    }
  };

  /**
   * 프로젝트 생성 시 추가 정보가 필요한지 확인
   */
  checkMissingInfoForCreation(projectInfo: any, serviceType: string): string[] {
    const missing: string[] = [];

    // 공통 필수 정보
    if (!projectInfo.customer) missing.push('customer');
    if (!projectInfo.location) missing.push('location');
    if (!projectInfo.eventDate) missing.push('eventDate');

    // 서비스별 필수 정보
    switch (serviceType) {
      case '렌탈':
      case '멤버쉽':
        if (!projectInfo.ledInfos || projectInfo.ledInfos.length === 0) {
          missing.push('ledInfo');
        } else {
          // LED 정보 상세 체크
          projectInfo.ledInfos.forEach((led: any, index: number) => {
            if (!led.size) missing.push(`led${index + 1}Size`);
            if (led.stageHeight === undefined) missing.push(`led${index + 1}StageHeight`);
          });
        }
        break;
      
      case '설치':
        if (!projectInfo.installEnvironment) missing.push('installEnvironment');
        if (!projectInfo.installSpace) missing.push('installSpace');
        if (!projectInfo.installBudget) missing.push('installBudget');
        break;
    }

    return missing;
  }

  /**
   * 대화형 정보 수집 시작
   */
  startInteractiveCollection(
    userId: string, 
    missingInfo: string[], 
    existingInfo: Record<string, any>,
    projectId?: string
  ): { needsInteraction: boolean; firstQuestion?: string } {
    
    if (missingInfo.length === 0) {
      return { needsInteraction: false };
    }

    // 기존 대화 정리
    this.cleanupExpiredConversations();
    
    // 새 대화 상태 생성
    const conversationState: ConversationState = {
      userId,
      projectId,
      step: 'collecting',
      missingInfo: [...missingInfo],
      collectedInfo: { ...existingInfo },
      lastQuestion: '',
      attempts: 0,
      timestamp: Date.now()
    };

    this.conversations.set(userId, conversationState);

    // 첫 번째 질문 생성
    const firstQuestion = this.generateNextQuestion(userId);
    
    console.log('📝 대화형 수집 시작:', { userId, missingInfo, firstQuestion });
    
    return {
      needsInteraction: true,
      firstQuestion
    };
  }

  /**
   * 사용자 응답 처리
   */
  processUserResponse(userId: string, response: string): {
    isComplete: boolean;
    nextQuestion?: string;
    collectedInfo?: Record<string, any>;
    needsConfirmation?: boolean;
    confirmationMessage?: string;
    error?: string;
  } {
    const conversation = this.conversations.get(userId);
    
    if (!conversation) {
      return {
        isComplete: false,
        error: '진행 중인 대화를 찾을 수 없습니다. "신규 프로젝트"로 다시 시작해주세요.'
      };
    }

    console.log('📞 사용자 응답 처리:', { userId, response, step: conversation.step });

    // 취소 요청 확인
    if (this.isCancelRequest(response)) {
      this.conversations.delete(userId);
      return {
        isComplete: true,
        error: '대화가 취소되었습니다. 언제든 다시 시작할 수 있습니다.'
      };
    }

    // 확인 단계 처리
    if (conversation.step === 'confirming') {
      return this.processConfirmationResponse(userId, response);
    }

    // 정보 수집 단계 처리
    if (conversation.step === 'collecting') {
      return this.processCollectionResponse(userId, response);
    }

    return {
      isComplete: false,
      error: '알 수 없는 상태입니다. 다시 시도해주세요.'
    };
  }

  /**
   * 정보 수집 응답 처리
   */
  private processCollectionResponse(userId: string, response: string): any {
    const conversation = this.conversations.get(userId);
    if (!conversation) return { isComplete: false };

    const currentField = conversation.missingInfo[0];
    const template = this.questionTemplates[currentField];

    if (!template) {
      console.error('❌ 알 수 없는 필드:', currentField);
      conversation.missingInfo.shift(); // 문제가 있는 필드 제거
      
      if (conversation.missingInfo.length === 0) {
        return this.proceedToConfirmation(userId);
      }
      
      return {
        isComplete: false,
        nextQuestion: this.generateNextQuestion(userId)
      };
    }

    // 유효성 검사
    if (template.validation && !template.validation(response)) {
      conversation.attempts++;
      
      if (conversation.attempts >= 3) {
        // 3번 실패 시 스킵 또는 기본값 사용
        if (!template.required) {
          console.log('📝 선택적 필드 스킵:', currentField);
          conversation.missingInfo.shift();
          conversation.attempts = 0;
          
          if (conversation.missingInfo.length === 0) {
            return this.proceedToConfirmation(userId);
          }
          
          return {
            isComplete: false,
            nextQuestion: this.generateNextQuestion(userId)
          };
        } else {
          return {
            isComplete: false,
            nextQuestion: `❌ 3번 입력이 잘못되었습니다. 다시 한번 정확히 입력해주세요:\n\n${template.question}\n\n💡 "취소"라고 하면 대화를 중단할 수 있습니다.`
          };
        }
      }
      
      return {
        isComplete: false,
        nextQuestion: `❌ 입력 형식이 올바르지 않습니다. (${conversation.attempts}/3)\n\n${template.question}`
      };
    }

    // 성공적으로 수집
    conversation.collectedInfo[currentField] = this.parseResponse(currentField, response);
    conversation.missingInfo.shift();
    conversation.attempts = 0;

    console.log('✅ 정보 수집 성공:', { field: currentField, value: conversation.collectedInfo[currentField] });

    // 더 필요한 정보가 있는지 확인
    if (conversation.missingInfo.length > 0) {
      return {
        isComplete: false,
        nextQuestion: this.generateNextQuestion(userId)
      };
    }

    // 모든 정보 수집 완료 - 확인 단계로
    return this.proceedToConfirmation(userId);
  }

  /**
   * 응답 파싱
   */
  private parseResponse(field: string, response: string): any {
    switch (field) {
      case 'led1StageHeight':
      case 'led2StageHeight':
      case 'led3StageHeight':
        const heightMatch = response.match(/(\d+)/);
        return heightMatch ? parseInt(heightMatch[1]) : 0;
      
      case 'led1Size':
      case 'led2Size':
      case 'led3Size':
        const sizeMatch = response.match(/(\d+)\s*[x×X]\s*(\d+)/);
        return sizeMatch ? `${sizeMatch[1]}x${sizeMatch[2]}` : response;
      
      case 'eventDate':
        // 날짜 형식 정규화
        if (/\d{1,2}\s*월\s*\d{1,2}\s*일/.test(response)) {
          const match = response.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
          if (match) {
            const currentYear = new Date().getFullYear();
            return `${currentYear}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
          }
        }
        return response;
      
      default:
        return response.trim();
    }
  }

  /**
   * 다음 질문 생성
   */
  private generateNextQuestion(userId: string): string {
    const conversation = this.conversations.get(userId);
    if (!conversation || conversation.missingInfo.length === 0) {
      return '모든 정보가 수집되었습니다.';
    }

    const currentField = conversation.missingInfo[0];
    const template = this.questionTemplates[currentField];
    
    if (!template) {
      console.error('❌ 알 수 없는 필드 템플릿:', currentField);
      return '정보를 수집하는 중 오류가 발생했습니다.';
    }

    const progressInfo = `[${conversation.missingInfo.length > 5 ? conversation.missingInfo.length - 5 + 1 : conversation.missingInfo.length}/${conversation.missingInfo.length > 5 ? 6 : conversation.missingInfo.length}]`;
    
    conversation.lastQuestion = template.question;
    conversation.timestamp = Date.now();

    return `${progressInfo} ${template.question}\n\n💬 "취소"라고 하면 언제든 중단할 수 있습니다.`;
  }

  /**
   * 확인 단계로 전환
   */
  private proceedToConfirmation(userId: string): any {
    const conversation = this.conversations.get(userId);
    if (!conversation) return { isComplete: false };

    conversation.step = 'confirming';
    
    let message = '📋 수집된 정보를 확인해주세요:\n\n';
    
    Object.entries(conversation.collectedInfo).forEach(([key, value]) => {
      const label = this.getFieldLabel(key);
      message += `${label}: ${value}\n`;
    });
    
    message += '\n✅ 정보가 맞다면 "확인" 또는 "맞아요"';
    message += '\n❌ "수정" 또는 "다시"를 입력하면 수정할 수 있습니다.';
    message += '\n🚫 "취소"를 입력하면 취소됩니다.';
    
    return {
      isComplete: false,
      needsConfirmation: true,
      confirmationMessage: message
    };
  }

  /**
   * 필드 라벨 변환
   */
  private getFieldLabel(field: string): string {
    const labels: Record<string, string> = {
      customer: '🏢 고객사',
      location: '📍 장소',
      eventDate: '📅 일정',
      led1Size: '📺 LED1 크기',
      led1StageHeight: '📏 LED1 무대높이',
      led2Size: '📺 LED2 크기', 
      led2StageHeight: '📏 LED2 무대높이',
      led3Size: '📺 LED3 크기',
      led3StageHeight: '📏 LED3 무대높이',
      installEnvironment: '🏢 설치환경',
      installSpace: '📐 설치공간',
      installBudget: '💰 예산'
    };
    
    return labels[field] || field;
  }

  /**
   * 확인 응답 처리
   */
  private processConfirmationResponse(userId: string, response: string): any {
    const conversation = this.conversations.get(userId);
    if (!conversation) return { isComplete: false };

    const lowerResponse = response.toLowerCase();
    
    if (lowerResponse.includes('확인') || lowerResponse.includes('맞') || lowerResponse.includes('좋') || lowerResponse.includes('네')) {
      const collectedInfo = conversation.collectedInfo;
      this.conversations.delete(userId);
      
      return {
        isComplete: true,
        collectedInfo
      };
    }
    
    if (lowerResponse.includes('수정') || lowerResponse.includes('다시')) {
      // 수정 모드로 전환
      conversation.step = 'collecting';
      return {
        isComplete: false,
        nextQuestion: '어떤 정보를 수정하시겠습니까?\n\n' +
                     '예시: "고객사", "LED 크기", "일정" 등을 입력하세요.'
      };
    }
    
    if (lowerResponse.includes('취소')) {
      this.conversations.delete(userId);
      return {
        isComplete: true,
        error: '프로젝트 생성이 취소되었습니다.'
      };
    }
    
    return {
      isComplete: false,
      nextQuestion: '확인, 수정, 취소 중 하나를 선택해주세요.',
      error: '명확한 응답을 해주세요.'
    };
  }

  /**
   * 유틸리티 함수들
   */
  private isCancelRequest(response: string): boolean {
    const cancelKeywords = ['취소', '그만', '끝', '종료', '나가'];
    return cancelKeywords.some(keyword => response.includes(keyword));
  }

  private cleanupExpiredConversations(): void {
    const now = Date.now();
    for (const [userId, conversation] of this.conversations.entries()) {
      if (now - conversation.timestamp > this.CONVERSATION_TIMEOUT) {
        console.log('🧹 만료된 대화 정리:', userId);
        this.conversations.delete(userId);
      }
    }
  }

  /**
   * 진행 중인 대화 확인
   */
  hasActiveConversation(userId: string): boolean {
    this.cleanupExpiredConversations();
    return this.conversations.has(userId);
  }

  /**
   * 대화 상태 조회
   */
  getConversationState(userId: string): ConversationState | undefined {
    return this.conversations.get(userId);
  }

  /**
   * 대화 강제 종료
   */
  endConversation(userId: string): void {
    this.conversations.delete(userId);
    console.log('🔚 대화 강제 종료:', userId);
  }

  /**
   * 수집된 정보로 프로젝트 생성 텍스트 생성 (대화형 전용)
   */
  generateProjectCreationText(info: Record<string, any>): string {
    // 프로젝트명 결정 (고객사 기반으로 생성)
    const projectName = info.customer ? `${info.customer} 프로젝트` : (info.projectName || '신규 프로젝트');
    const serviceType = info.serviceType || '렌탈';
    
    let text = `${projectName} ${serviceType} 수주했어`;
    
    if (info.customer && !projectName.includes(info.customer)) {
      text += `. 고객사는 ${info.customer}`;
    }
    if (info.location) text += `. 장소는 ${info.location}`;
    if (info.eventDate) text += `. 일정은 ${info.eventDate}`;
    
    // LED 정보 추가
    if (info.led1Size) {
      text += `. LED1 크기는 ${info.led1Size}`;
      if (info.led1StageHeight !== undefined) text += `, 무대높이 ${info.led1StageHeight}mm`;
    }
    if (info.led2Size) {
      text += `. LED2 크기는 ${info.led2Size}`;
      if (info.led2StageHeight !== undefined) text += `, 무대높이 ${info.led2StageHeight}mm`;
    }
    if (info.led3Size) {
      text += `. LED3 크기는 ${info.led3Size}`;
      if (info.led3StageHeight !== undefined) text += `, 무대높이 ${info.led3StageHeight}mm`;
    }
    
    // 설치 관련 정보
    if (info.installEnvironment) text += `. 설치환경은 ${info.installEnvironment}`;
    if (info.installSpace) text += `. 설치공간은 ${info.installSpace}`;
    if (info.installBudget) text += `. 예산은 ${info.installBudget}`;
    
    console.log('📋 대화형 프로젝트 생성 텍스트:', text);
    
    return text;
  }
}

// 싱글톤 인스턴스
let conversationManagerInstance: InteractiveConversationManager | null = null;

export function getConversationManager(): InteractiveConversationManager {
  if (!conversationManagerInstance) {
    conversationManagerInstance = new InteractiveConversationManager();
  }
  return conversationManagerInstance;
}