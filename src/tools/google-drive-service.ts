// src/tools/google-drive-service.ts

import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';

// 구글 드라이브 서비스 클래스
export class GoogleDriveService {
  private drive: any;
  private sheets: any;
  private initialized = false;
  
  constructor() {
    console.log('GoogleDriveService 생성됨 (초기화 대기 중)');
  }

  private async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      console.log('🔄 googleapis 동적 로딩 시작...');
      
      // 필요한 시점에 googleapis 로드
      const { google } = await import('googleapis');
      
      console.log('✅ googleapis 로드 완료');
      
      // 서비스 계정 인증
      const auth = new google.auth.GoogleAuth({
        keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE,
        scopes: [
          'https://www.googleapis.com/auth/drive',
          'https://www.googleapis.com/auth/spreadsheets'
        ]
      });
      
      this.drive = google.drive({ version: 'v3', auth });
      this.sheets = google.sheets({ version: 'v4', auth });
      this.initialized = true;
      
      console.log('✅ Google Drive 서비스 초기화 완료');
    } catch (error) {
      console.error('❌ Google Drive 서비스 초기화 실패:', error);
      throw error;
    }
  }

  /**
   * 견적서/요청서 자동 생성 및 저장
   */
  async generateQuoteAndRequestFiles(eventData: any, quote: any) {
    try {
      await this.initialize();
      
      console.log('📄 구글 드라이브에 견적서/요청서 생성 시작...');
      
      const results = {
        quoteFileId: '',
        requestFileId: '',
        quoteFileUrl: '',
        requestFileUrl: ''
      };
      
      // 1. 견적서 생성
      console.log('📊 견적서 생성 중...');
      const quoteResult = await this.createQuoteFile(eventData, quote);
      results.quoteFileId = quoteResult.fileId;
      results.quoteFileUrl = quoteResult.fileUrl;
      
      // 2. 요청서 생성
      console.log('📋 요청서 생성 중...');
      const requestResult = await this.createRequestFile(eventData);
      results.requestFileId = requestResult.fileId;
      results.requestFileUrl = requestResult.fileUrl;
      
      console.log('✅ 구글 드라이브 파일 생성 완료');
      return results;
      
    } catch (error) {
      console.error('❌ 구글 드라이브 파일 생성 실패:', error);
      throw error;
    }
  }

  /**
   * 견적서 파일 생성
   */
  private async createQuoteFile(eventData: any, quote: any) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    // 견적서 템플릿 파일 ID (구글 드라이브에 미리 업로드된 템플릿)
    const templateFileId = process.env.QUOTE_TEMPLATE_FILE_ID;
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    
    // 1. 템플릿 파일 복사
    const fileName = `${eventData.customerName}_견적서_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
    
    const copyResponse = await this.drive.files.copy({
      fileId: templateFileId,
      requestBody: {
        name: fileName,
        parents: [folderId]
      }
    });
    
    const newFileId = copyResponse.data.id;
    
    // 2. 복사된 파일에 데이터 입력
    await this.fillQuoteTemplate(newFileId, eventData, quote);
    
    // 3. 파일 공유 링크 생성
    const fileUrl = await this.createShareableLink(newFileId);
    
    return {
      fileId: newFileId,
      fileUrl: fileUrl
    };
  }

  /**
   * 요청서 파일 생성
   */
  private async createRequestFile(eventData: any) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    // 요청서 템플릿 파일 ID
    const templateFileId = process.env.REQUEST_TEMPLATE_FILE_ID;
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    
    // 1. 템플릿 파일 복사
    const fileName = `${eventData.customerName}_요청서_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
    
    const copyResponse = await this.drive.files.copy({
      fileId: templateFileId,
      requestBody: {
        name: fileName,
        parents: [folderId]
      }
    });
    
    const newFileId = copyResponse.data.id;
    
    // 2. 복사된 파일에 데이터 입력
    await this.fillRequestTemplate(newFileId, eventData);
    
    // 3. 파일 공유 링크 생성
    const fileUrl = await this.createShareableLink(newFileId);
    
    return {
      fileId: newFileId,
      fileUrl: fileUrl
    };
  }

  /**
   * 견적서 템플릿에 데이터 채우기
   */
  private async fillQuoteTemplate(fileId: string, eventData: any, quote: any) {
    try {
      // 구글 시트 API를 사용하여 셀에 데이터 입력
      const values = [
        // 날짜 정보
        [`Date : ${new Date().toISOString().slice(0, 10)}`],
        [`REF NO : ODC-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}Q-01`],
        
        // 고객 정보
        [`Messers: ${eventData.customerName || ''}`],
        [`Attn : ${eventData.contactName} ${eventData.contactTitle}`],
        
        // 조건 정보
        ['발행 후 1주', '-', '협의', '협의', eventData.venue || '', '', '전시 기간과 동일'],
        
        // 견적 항목들
        ['LED Wall', 'LED 모듈(P2.9 500x500mm)', '', quote.ledModules.count < 500 ? 0 : 34000, quote.ledModules.count, '개', quote.ledModules.price],
        ['', `지지구조물(시스템 비계)\n${quote.structure.unitPriceDescription || '4m 미만 (20,000원/㎡)'}`, '', quote.structure.unitPrice, quote.structure.area, '㎡', quote.structure.totalPrice],
        ['', `LED Wall 컨트롤러 및 스위치\n- 200인치 이상 500,000원/개소\n- 200인치 미만 200,000원/개소\n(총 ${quote.controller.count || 1}개소)`, '', Math.round(quote.controller.totalPrice / (quote.controller.count || 1)), quote.controller.count || 1, '개', quote.controller.totalPrice],
        ['', `LED 파워\n- 250인치 이상 500,000원/개소\n- 250인치 이하 무상\n(${quote.power.requiredCount || 0}개소 필요)`, '', quote.power.requiredCount > 0 ? 500000 : 0, quote.power.requiredCount || 0, '개', quote.power.totalPrice],
        ['', `설치/철거 인력\n${quote.installation.workerRange || '60개 이하 (3명)'}`, '', quote.installation.pricePerWorker, quote.installation.workers, '명', quote.installation.totalPrice],
        ['', '오퍼레이팅 인력', '', quote.operation.pricePerDay || 280000, quote.operation.days || 0, '일', quote.operation.totalPrice],
        ['', `운반비\n${quote.transport.range || '200개 이하'}`, '', quote.transport.price, 1, '식', quote.transport.price],
        
        // 합계
        ['소계', '', '', '', '', '', quote.subtotal],
        ['합계금액(VAT 포함)', '', '', '', '', '', quote.total]
      ];
      
      // 특정 범위에 데이터 입력 (실제 템플릿 구조에 맞게 조정 필요)
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: fileId,
        range: 'A1:H25', // 템플릿의 데이터 영역
        valueInputOption: 'RAW',
        requestBody: {
          values: values
        }
      });
      
      console.log('✅ 견적서 데이터 입력 완료');
      
    } catch (error) {
      console.error('❌ 견적서 데이터 입력 실패:', error);
      throw error;
    }
  }

  /**
   * 요청서 템플릿에 데이터 채우기
   */
  private async fillRequestTemplate(fileId: string, eventData: any) {
    try {
      // LED 개소별 정보 구성
      const ledSpecs = eventData.ledSpecs || [];
      const ledSummary = ledSpecs.map((led: any, index: number) => {
        return `LED${index + 1}: ${led.size} (무대높이: ${led.stageHeight}mm)`;
      }).join('\n');
      
      const values = [
        // 행사장 정보
        [eventData.venue || ''],
        
        // 행사 일정
        [eventData.eventStartDate ? new Date(eventData.eventStartDate + ' 10:00') : ''],
        [eventData.eventEndDate ? new Date(eventData.eventEndDate + ' 18:00') : ''],
        
        // LED 사양 정보
        [ledSummary],
        
        // 옵션 정보
        ['X'], // 3D 사용 여부 (기본값)
        [ledSpecs.some((led: any) => led.needOperator) ? 'O' : 'X'], // 오퍼레이터 필요 여부
        ['X'], // 중계 카메라 연동
        ['X'], // 화면 분할 송출
        
        // 담당자 정보
        [`${eventData.contactName} ${eventData.contactTitle} ${eventData.contactPhone}`]
      ];
      
      // 요청서 템플릿의 특정 셀들에 데이터 입력
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: fileId,
        range: 'A1:J55', // 템플릿의 데이터 영역 (실제 구조에 맞게 조정)
        valueInputOption: 'RAW',
        requestBody: {
          values: values.map(v => v)
        }
      });
      
      console.log('✅ 요청서 데이터 입력 완료');
      
    } catch (error) {
      console.error('❌ 요청서 데이터 입력 실패:', error);
      throw error;
    }
  }

  /**
   * 파일 공유 링크 생성
   */
  private async createShareableLink(fileId: string): Promise<string> {
    try {
      // 파일을 링크가 있는 사람은 볼 수 있도록 권한 설정
      await this.drive.permissions.create({
        fileId: fileId,
        requestBody: {
          role: 'reader',
          type: 'anyone'
        }
      });
      
      // 파일 정보 가져오기
      const fileResponse = await this.drive.files.get({
        fileId: fileId,
        fields: 'webViewLink'
      });
      
      return fileResponse.data.webViewLink;
      
    } catch (error) {
      console.error('❌ 공유 링크 생성 실패:', error);
      throw error;
    }
  }

  /**
   * 폴더 내 파일 목록 조회
   */
  async listFilesInFolder(folderId?: string) {
    try {
      await this.initialize();
      
      const targetFolderId = folderId || process.env.GOOGLE_DRIVE_FOLDER_ID;
      
      const response = await this.drive.files.list({
        q: `'${targetFolderId}' in parents and trashed=false`,
        fields: 'files(id, name, createdTime, webViewLink)',
        orderBy: 'createdTime desc'
      });
      
      return response.data.files;
      
    } catch (error) {
      console.error('❌ 폴더 파일 목록 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 파일 삭제
   */
  async deleteFile(fileId: string) {
    try {
      await this.initialize();
      
      await this.drive.files.delete({
        fileId: fileId
      });
      
      console.log(`✅ 파일 삭제 완료: ${fileId}`);
      
    } catch (error) {
      console.error('❌ 파일 삭제 실패:', error);
      throw error;
    }
  }
}

// 구글 드라이브 도구 내보내기
export const googleDriveTool = {
  definition: {
    name: 'generate_quote_files',
    description: '구글 드라이브에 견적서와 요청서를 자동 생성합니다',
    inputSchema: {
      type: 'object',
      properties: {
        eventData: {
          type: 'object',
          description: '행사 정보'
        },
        quote: {
          type: 'object', 
          description: '견적 정보'
        }
      },
      required: ['eventData', 'quote']
    }
  },

  handler: async (args: any) => {
    try {
      const { eventData, quote } = args;
      
      const driveService = new GoogleDriveService();
      const result = await driveService.generateQuoteAndRequestFiles(eventData, quote);
      
      return {
        content: [{
          type: 'text',
          text: `✅ 구글 드라이브에 파일 생성 완료!\n\n📊 견적서: ${result.quoteFileUrl}\n📋 요청서: ${result.requestFileUrl}\n\n🔗 파일들이 지정된 폴더에 저장되었습니다.`
        }],
        files: result
      };
      
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ 구글 드라이브 파일 생성 실패: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
};