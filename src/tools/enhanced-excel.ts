import * as XLSX from 'xlsx';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

interface ExcelData {
  headers: string[];
  rows: any[][];
  sheetName: string;
}

interface ExcelGenerateOptions {
  sheetName?: string;
  autoWidth?: boolean;
  numberFormat?: string;
  dateFormat?: string;
}

interface EstimateExcelData {
  eventName: string;
  customerName: string;
  contactName: string;
  contactPhone: string;
  venue: string;
  eventDate: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  subtotal: number;
  vat: number;
  total: number;
}

export const enhancedExcelTool = {
  name: 'generate_excel',
  description: 'Generate Excel files for estimates and reports',
  
  inputSchema: {
    type: 'object' as const,
    properties: {
      type: {
        type: 'string',
        enum: ['estimate', 'report', 'custom'],
        description: 'Type of Excel file to generate'
      },
      data: {
        type: 'object',
        description: 'Data for Excel generation'
      },
      options: {
        type: 'object',
        description: 'Excel generation options'
      }
    },
    required: ['type', 'data']
  },

  handler: async (args: { type: string; data: any; options?: ExcelGenerateOptions }) => {
    try {
      let workbook: XLSX.WorkBook;
      
      switch (args.type) {
        case 'estimate':
          workbook = generateEstimateExcel(args.data as EstimateExcelData);
          break;
        case 'report':
          workbook = generateReportExcel(args.data);
          break;
        case 'custom':
          workbook = generateCustomExcel(args.data, args.options);
          break;
        default:
          throw new McpError(ErrorCode.InvalidRequest, `Unknown Excel type: ${args.type}`);
      }

      // 바이너리 문자열로 변환
      const excelBuffer = XLSX.write(workbook, { 
        bookType: 'xlsx', 
        type: 'buffer',
        cellStyles: true,
        bookSST: true
      });

      // Base64로 인코딩
      const base64 = Buffer.from(excelBuffer).toString('base64');
      
      return {
        success: true,
        data: base64,
        filename: generateFilename(args.type, args.data),
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      };

    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to generate Excel: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
};

// 견적서 엑셀 생성
function generateEstimateExcel(data: EstimateExcelData): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  
  // 견적서 데이터 구성
  const wsData: any[][] = [
    ['LED 디스플레이 견적서'],
    [],
    ['고객 정보'],
    ['고객사', data.customerName, '', '행사명', data.eventName],
    ['담당자', data.contactName, '', '연락처', data.contactPhone],
    ['행사장', data.venue, '', '행사일', data.eventDate],
    [],
    ['견적 내역'],
    ['품목', '수량', '단가', '금액']
  ];

  // 견적 항목 추가
  data.items.forEach(item => {
    wsData.push([
      item.description,
      item.quantity,
      item.unitPrice,
      item.totalPrice
    ]);
  });

  // 합계 추가
  wsData.push(
    [],
    ['', '', '소계', data.subtotal],
    ['', '', 'VAT(10%)', data.vat],
    ['', '', '총액', data.total]
  );

  // 워크시트 생성
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  
  // 스타일 적용
  applyEstimateStyles(ws);
  
  // 열 너비 설정
  ws['!cols'] = [
    { wch: 30 }, // 품목
    { wch: 10 }, // 수량
    { wch: 15 }, // 단가
    { wch: 15 }, // 금액
    { wch: 15 }  // 추가 열
  ];

  // 셀 병합
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }, // 제목
    { s: { r: 2, c: 0 }, e: { r: 2, c: 4 } }, // 고객 정보
    { s: { r: 7, c: 0 }, e: { r: 7, c: 4 } }  // 견적 내역
  ];

  XLSX.utils.book_append_sheet(wb, ws, '견적서');
  
  return wb;
}

// 보고서 엑셀 생성
function generateReportExcel(data: any): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  
  // 월간 실적 시트
  if (data.monthlyPerformance) {
    const ws = XLSX.utils.json_to_sheet(data.monthlyPerformance);
    applyReportStyles(ws);
    XLSX.utils.book_append_sheet(wb, ws, '월간실적');
  }
  
  // 고객별 분석 시트
  if (data.customerAnalysis) {
    const ws = XLSX.utils.json_to_sheet(data.customerAnalysis);
    applyReportStyles(ws);
    XLSX.utils.book_append_sheet(wb, ws, '고객분석');
  }
  
  // LED 사용 통계 시트
  if (data.ledStatistics) {
    const ws = XLSX.utils.json_to_sheet(data.ledStatistics);
    applyReportStyles(ws);
    XLSX.utils.book_append_sheet(wb, ws, 'LED통계');
  }
  
  return wb;
}

// 커스텀 엑셀 생성
function generateCustomExcel(data: ExcelData, options?: ExcelGenerateOptions): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  
  // 데이터 배열 구성
  const wsData: any[][] = [];
  
  // 헤더 추가
  if (data.headers) {
    wsData.push(data.headers);
  }
  
  // 데이터 행 추가
  if (data.rows) {
    wsData.push(...data.rows);
  }
  
  // 워크시트 생성
  const ws = XLSX.utils.aoa_to_sheet(wsData);
    
  // 숫자 포맷 적용
  if (options?.numberFormat) {
    applyNumberFormat(ws, options.numberFormat);
  }
  
  // 날짜 포맷 적용
  if (options?.dateFormat) {
    applyDateFormat(ws, options.dateFormat);
  }
  
  const sheetName = options?.sheetName || data.sheetName || 'Sheet1';
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  
  return wb;
}

// 견적서 스타일 적용
function applyEstimateStyles(ws: XLSX.WorkSheet): void {
  // 제목 스타일
  if (ws['A1']) {
    (ws['A1'] as any).s = {
      font: { bold: true, sz: 16 },
      alignment: { horizontal: 'center', vertical: 'center' },
      fill: { fgColor: { rgb: 'E3F2FD' } }
    };
  }
  
  // 섹션 헤더 스타일
  ['A3', 'A8'].forEach(cell => {
    if (ws[cell]) {
      (ws[cell] as any).s = {
        font: { bold: true, sz: 12 },
        fill: { fgColor: { rgb: 'F5F5F5' } }
      };
    }
  });
  
  // 테이블 헤더 스타일
  ['A9', 'B9', 'C9', 'D9'].forEach(cell => {
    if (ws[cell]) {
      (ws[cell] as any).s = {
        font: { bold: true },
        alignment: { horizontal: 'center' },
        fill: { fgColor: { rgb: 'E0E0E0' } },
        border: {
          top: { style: 'thin' },
          bottom: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' }
        }
      };
    }
  });
}

function applyReportStyles(ws: XLSX.WorkSheet): void {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  
  // 헤더 행 스타일
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const address = XLSX.utils.encode_cell({ r: 0, c: C });
    if (ws[address]) {
      (ws[address] as any).s = {
        font: { bold: true },
        alignment: { horizontal: 'center' },
        fill: { fgColor: { rgb: 'E3F2FD' } }
      };
    }
  }
}

// 숫자 포맷 적용
function applyNumberFormat(ws: XLSX.WorkSheet, format: string): void {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  
  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const address = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[address];
      if (cell && typeof cell.v === 'number') {
        cell.z = format;
      }
    }
  }
}

// 날짜 포맷 적용
function applyDateFormat(ws: XLSX.WorkSheet, format: string): void {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  
  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const address = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[address];
      if (cell && cell.t === 'd') {
        cell.z = format;
      }
    }
  }
}

// 파일명 생성
function generateFilename(type: string, data: any): string {
  const date = new Date().toISOString().split('T')[0];
  
  switch (type) {
    case 'estimate':
      return `견적서_${data.customerName}_${date}.xlsx`;
    case 'report':
      return `보고서_${date}.xlsx`;
    default:
      return `엑셀_${date}.xlsx`;
  }
}

// 엑셀 읽기 기능
export async function readExcelFile(buffer: Buffer): Promise<ExcelData[]> {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellStyles: true });
    const results: ExcelData[] = [];
    
    workbook.SheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (jsonData.length > 0) {
        const headers = jsonData[0] as string[];
        const rows = jsonData.slice(1) as any[][];
        
        results.push({
          sheetName,
          headers,
          rows
        });
      }
    });
    
    return results;
  } catch (error) {
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to read Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}