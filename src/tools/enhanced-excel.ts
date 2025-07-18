import ExcelJS from 'exceljs';
import { LEDQuoteResponse, LEDQuoteRequest, TransportInfo } from '../types/index.js';
import path from 'path';
import fs from 'fs';

export const enhancedExcelTool = {
  definition: {
    name: 'enhanced_excel',
    description: '디자인이 적용된 LED 렌탈 요청서/견적서 Excel 파일을 생성하고 링크를 반환합니다',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['request', 'quote'],
          description: '생성할 파일 타입 (request: 요청서, quote: 견적서)'
        },
        data: {
          type: 'object',
          description: 'Excel에 입력할 데이터'
        },
        returnUrl: {
          type: 'boolean',
          description: '파일 URL 반환 여부 (기본값: false)',
          default: false
        }
      },
      required: ['type', 'data']
    }
  },

  handler: async (args: any) => {
    try {
      const { type, data, returnUrl = false } = args;
      
      let result;
      if (type === 'request') {
        result = await generateStyledRequestExcel(data);
      } else if (type === 'quote') {
        result = await generateStyledQuoteExcel(data);
      } else {
        throw new Error('지원하지 않는 파일 타입입니다.');
      }
      
      // URL 반환이 요청된 경우 파일 정보 포함
      if (returnUrl && result.filePath) {
        const baseUrl = process.env.SERVER_BASE_URL || 'http://localhost:3000';
        const publicUrl = `${baseUrl}/files/${path.basename(result.filePath)}`;
        
        return {
          ...result,
          fileUrl: publicUrl,
          fileName: path.basename(result.filePath)
        };
      }
      
      return result;
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Excel 생성 실패: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
};

// 스타일 상수 정의
const STYLES = {
  header: {
    font: { bold: true, size: 12, color: { argb: 'FF000000' } },
    fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFE0E0E0' } },
    alignment: { horizontal: 'center' as const, vertical: 'middle' as const },
    border: {
      top: { style: 'thin' as const },
      left: { style: 'thin' as const },
      bottom: { style: 'thin' as const },
      right: { style: 'thin' as const }
    }
  },
  title: {
    font: { bold: true, size: 16, color: { argb: 'FF000000' } },
    alignment: { horizontal: 'center' as const, vertical: 'middle' as const }
  },
  label: {
    font: { bold: true, size: 10 },
    alignment: { horizontal: 'center' as const, vertical: 'middle' as const },
    fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFF0F0F0' } },
    border: {
      top: { style: 'thin' as const },
      left: { style: 'thin' as const },
      bottom: { style: 'thin' as const },
      right: { style: 'thin' as const }
    }
  },
  data: {
    font: { size: 10 },
    alignment: { horizontal: 'left' as const, vertical: 'middle' as const },
    border: {
      top: { style: 'thin' as const },
      left: { style: 'thin' as const },
      bottom: { style: 'thin' as const },
      right: { style: 'thin' as const }
    }
  },
  currency: {
    font: { size: 10 },
    alignment: { horizontal: 'right' as const, vertical: 'middle' as const },
    numFmt: '#,##0',
    border: {
      top: { style: 'thin' as const },
      left: { style: 'thin' as const },
      bottom: { style: 'thin' as const },
      right: { style: 'thin' as const }
    }
  }
};

// 스타일이 적용된 요청서 생성
async function generateStyledRequestExcel(data: any) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('LED Wall 요청서');

  // 열 너비 설정
  worksheet.columns = [
    { width: 5 },   // A
    { width: 20 },  // B
    { width: 25 },  // C
    { width: 20 },  // D
    { width: 15 },  // E
    { width: 20 },  // F
    { width: 10 },  // G
    { width: 5 },   // H
    { width: 20 },  // I
    { width: 20 },  // J
    { width: 15 }   // K
  ];

  // 회사 로고 영역 (병합)
  worksheet.mergeCells('A1:K1');
  const logoCell = worksheet.getCell('A1');
  logoCell.value = 'ORION DISPLAY';
  logoCell.font = { bold: true, size: 18, color: { argb: 'FF0066CC' } };
  logoCell.alignment = { horizontal: 'center', vertical: 'middle' };
  logoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F8F8' } };

  // 헤더 설정 (병합된 셀)
  worksheet.mergeCells('B3:G3');
  worksheet.mergeCells('I3:K3');
  
  const headerCell1 = worksheet.getCell('B3');
  headerCell1.value = '1. 주최측 입력 정보';
  headerCell1.font = { bold: true, size: 12, color: { argb: 'FF000000' } };
  headerCell1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
  headerCell1.alignment = { horizontal: 'center', vertical: 'middle' };
  headerCell1.border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  };

  const headerCell2 = worksheet.getCell('I3');
  headerCell2.value = '2. 오리온 입력 정보';
  headerCell2.font = { bold: true, size: 12, color: { argb: 'FF000000' } };
  headerCell2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
  headerCell2.alignment = { horizontal: 'center', vertical: 'middle' };
  headerCell2.border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  };

  // 행사장 정보
  let row = 5;
  const venueCell = worksheet.getCell(`B${row}`);
  venueCell.value = '행사장';
  Object.assign(venueCell, STYLES.label);
  
  const venueDescCell = worksheet.getCell(`C${row}`);
  venueDescCell.value = '도로명 주소 및 층수를 입력하세요';
  Object.assign(venueDescCell, STYLES.label);
  
  const venueDataCell = worksheet.getCell(`D${row}`);
  venueDataCell.value = data.venue || data.eventLocation || '';
  Object.assign(venueDataCell, STYLES.data);

  // 가견적 헤더
  const estimateCell = worksheet.getCell(`I${row}`);
  estimateCell.value = '가견적';
  estimateCell.font = { bold: true, size: 12, color: { argb: 'FF000000' } };
  estimateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
  estimateCell.alignment = { horizontal: 'center', vertical: 'middle' };
  estimateCell.border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  };

  // 행사 일정 헤더
  row = 7;
  worksheet.mergeCells(`B${row}:C${row}`);
  const scheduleHeaderCell = worksheet.getCell(`B${row}`);
  scheduleHeaderCell.value = '구분';
  Object.assign(scheduleHeaderCell, STYLES.label);
  
  const startCell = worksheet.getCell(`D${row}`);
  startCell.value = '시작';
  Object.assign(startCell, STYLES.label);
  
  const endCell = worksheet.getCell(`F${row}`);
  endCell.value = '종료';
  Object.assign(endCell, STYLES.label);

  // 행사기간
  row = 8;
  const periodLabelCell = worksheet.getCell(`B${row}`);
  periodLabelCell.value = '행사기간';
  Object.assign(periodLabelCell, STYLES.label);
  
  const periodPlaceholderCell = worksheet.getCell(`C${row}`);
  periodPlaceholderCell.value = '2024-00-00 00:00';
  Object.assign(periodPlaceholderCell, STYLES.label);
  
  const startDateCell = worksheet.getCell(`D${row}`);
  if (data.eventStartDate) {
    startDateCell.value = new Date(data.eventStartDate + ' 10:00');
    startDateCell.numFmt = 'yyyy-mm-dd hh:mm';
  }
  Object.assign(startDateCell, STYLES.data);
  
  const endPlaceholderCell = worksheet.getCell(`E${row}`);
  endPlaceholderCell.value = '2024-00-00 00:00';
  Object.assign(endPlaceholderCell, STYLES.label);
  
  const endDateCell = worksheet.getCell(`F${row}`);
  if (data.eventEndDate) {
    endDateCell.value = new Date(data.eventEndDate + ' 18:00');
    endDateCell.numFmt = 'yyyy-mm-dd hh:mm';
  }
  Object.assign(endDateCell, STYLES.data);

  // LED 사양 섹션
  row = 14;
  worksheet.mergeCells(`B${row}:C${row}`);
  const mainStageCell = worksheet.getCell(`B${row}`);
  mainStageCell.value = '메인 무대';
  mainStageCell.font = { bold: true, size: 12, color: { argb: 'FF000000' } };
  mainStageCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
  mainStageCell.alignment = { horizontal: 'center', vertical: 'middle' };
  mainStageCell.border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  };
  
  const arrowCell = worksheet.getCell(`H${row}`);
  arrowCell.value = '→';
  arrowCell.font = { size: 14, bold: true };
  arrowCell.alignment = { horizontal: 'center', vertical: 'middle' };
  
  const spaceCell = worksheet.getCell(`I${row}`);
  spaceCell.value = '설치 필요공간(mm)';
  Object.assign(spaceCell, STYLES.label);

  // LED 사양 정보 (여러 개소 지원)
  row = 15;
  if (data.ledSpecs && data.ledSpecs.length > 0) {
    data.ledSpecs.forEach((led: any, index: number) => {
      const currentRow = row + index * 2;
      
      // LED 크기
      const ledSizeLabelCell = worksheet.getCell(`B${currentRow}`);
      ledSizeLabelCell.value = `LED${index + 1} 사이즈(mm)`;
      Object.assign(ledSizeLabelCell, STYLES.label);
      
      const ledSizeDescCell = worksheet.getCell(`C${currentRow}`);
      ledSizeDescCell.value = '가로 x 높이(500mm 단위로)';
      Object.assign(ledSizeDescCell, STYLES.label);
      
      const ledSizeDataCell = worksheet.getCell(`D${currentRow}`);
      ledSizeDataCell.value = led.size || '';
      Object.assign(ledSizeDataCell, STYLES.data);
      
      // 무대 높이
      const stageHeightLabelCell = worksheet.getCell(`B${currentRow + 1}`);
      stageHeightLabelCell.value = `LED${index + 1} 무대높이(mm)`;
      Object.assign(stageHeightLabelCell, STYLES.label);
      
      const stageHeightDataCell = worksheet.getCell(`D${currentRow + 1}`);
      stageHeightDataCell.value = led.stageHeight || '';
      Object.assign(stageHeightDataCell, STYLES.data);
    });
    
    row += data.ledSpecs.length * 2;
  } else {
    // 기본 LED 사이즈 (단일)
    const ledSizeLabelCell = worksheet.getCell(`B${row}`);
    ledSizeLabelCell.value = 'LED 사이즈(mm)';
    Object.assign(ledSizeLabelCell, STYLES.label);
    
    const ledSizeDescCell = worksheet.getCell(`C${row}`);
    ledSizeDescCell.value = '가로 x 높이(500mm 단위로)';
    Object.assign(ledSizeDescCell, STYLES.label);
    
    const ledSizeDataCell = worksheet.getCell(`D${row}`);
    ledSizeDataCell.value = data.ledSize || '';
    Object.assign(ledSizeDataCell, STYLES.data);
    
    row += 1;
  }

  // 옵션들
  row += 1;
  const options = [
    { label: '3D', value: data.is3D ? 'O' : 'X' },
    { label: '오퍼레이터 필요', value: data.needOperator ? 'O' : 'X' },
    { label: '중계 카메라 연동', value: 'X' },
    { label: '화면 분할 송출', value: 'X' }
  ];

  options.forEach((option, index) => {
    const currentRow = row + index;
    const optionLabelCell = worksheet.getCell(`B${currentRow}`);
    optionLabelCell.value = option.label;
    Object.assign(optionLabelCell, STYLES.label);
    
    const optionDescCell = worksheet.getCell(`C${currentRow}`);
    optionDescCell.value = 'O / X';
    Object.assign(optionDescCell, STYLES.label);
    
    const optionValueCell = worksheet.getCell(`D${currentRow}`);
    optionValueCell.value = option.value;
    Object.assign(optionValueCell, STYLES.data);
  });

  // 시나리오 섹션
  row += options.length + 1;
  const scenarioLabelCell = worksheet.getCell(`B${row}`);
  scenarioLabelCell.value = '시나리오(식순)/콘텐츠 구성';
  Object.assign(scenarioLabelCell, STYLES.label);
  
  const scenarioDescCell = worksheet.getCell(`C${row}`);
  scenarioDescCell.value = '대략적인 시나리오 또는 콘텐츠를 입력해주세요.';
  Object.assign(scenarioDescCell, STYLES.label);
  
  worksheet.mergeCells(`D${row}:K${row + 2}`);
  const scenarioDataCell = worksheet.getCell(`D${row}`);
  scenarioDataCell.value = data.scenario || '';
  scenarioDataCell.font = { size: 10 };
  scenarioDataCell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
  scenarioDataCell.border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  };

  // 담당자 정보
  row += 4;
  const contacts = [
    { label: '현장 관리자', value: data.fieldManager || data.contactName || '' },
    { label: '전기 담당자', value: data.electricManager || '' },
    { label: '무대 담당자', value: data.stageManager || '' }
  ];

  contacts.forEach((contact, index) => {
    const currentRow = row + index;
    const contactLabelCell = worksheet.getCell(`B${currentRow}`);
    contactLabelCell.value = contact.label;
    Object.assign(contactLabelCell, STYLES.label);
    
    const contactDescCell = worksheet.getCell(`C${currentRow}`);
    contactDescCell.value = '이름 직책 연락처';
    Object.assign(contactDescCell, STYLES.label);
    
    const contactDataCell = worksheet.getCell(`D${currentRow}`);
    contactDataCell.value = contact.value;
    Object.assign(contactDataCell, STYLES.data);
  });

  // 파일 저장
  const fileName = `${data.customerName || '고객사'}_${data.eventName || 'LED_Wall'}_요청서_${new Date().toISOString().slice(0, 10)}.xlsx`;
  const filePath = path.join('data', fileName);
  
  if (!fs.existsSync('data')) {
    fs.mkdirSync('data', { recursive: true });
  }

  await workbook.xlsx.writeFile(filePath);

  return {
    content: [{
      type: 'text',
      text: `✨ 스타일이 적용된 요청서 Excel 파일이 생성되었습니다!\n📁 파일명: ${fileName}\n📂 경로: ${filePath}`
    }],
    filePath: filePath,
    fileName: fileName,
    fileType: 'request'
  };
}

// 스타일이 적용된 견적서 생성
async function generateStyledQuoteExcel(data: any) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('견적서');

  // 열 너비 설정
  worksheet.columns = [
    { width: 5 },   // A
    { width: 15 },  // B
    { width: 30 },  // C
    { width: 15 },  // D
    { width: 15 },  // E
    { width: 10 },  // F
    { width: 10 },  // G
    { width: 15 }   // H
  ];

  // 회사 정보
  worksheet.getCell('B2').value = '서울시 금천구 가산디지털1로 181 (가산W센터) 1107호';
  worksheet.getCell('B2').font = { size: 11 };
  
  worksheet.getCell('B3').value = 'Tel + 82 2 6678 8523 / Fax + 82 2 6678 8560 / Email: leejh0421@oriondisplay.net';
  worksheet.getCell('B3').font = { size: 10 };

  // 견적서 제목
  worksheet.mergeCells('B6:H6');
  const titleCell = worksheet.getCell('B6');
  titleCell.value = '견적서';
  titleCell.font = { bold: true, size: 16, color: { argb: 'FF000000' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F3FF' } };

  // 날짜 및 참조번호
  worksheet.getCell('G8').value = 'Date :';
  worksheet.getCell('G8').font = { bold: true };
  worksheet.getCell('H8').value = new Date();
  worksheet.getCell('H8').numFmt = 'yyyy-mm-dd';

  worksheet.getCell('G9').value = 'REF NO :';
  worksheet.getCell('G9').font = { bold: true };
  worksheet.getCell('H9').value = `ODC-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}Q-01`;

  // 고객 정보
  worksheet.getCell('B12').value = `Messers: ${data.customerName || ''}`;
  worksheet.getCell('B12').font = { bold: true, size: 12 };
  
  worksheet.getCell('B13').value = 'Attn : ';
  worksheet.getCell('B13').font = { bold: true };

  // 조건 정보 (테이블 형태)
  const conditionHeaders = ['Price validity', 'Payment terms', 'Delivery', 'Shipment', 'Destination', '', 'Warranty term'];
  const conditionValues = ['발행 후 1주', '-', '협의', '협의', data.eventLocation || data.venue || '', '', '전시 기간과 동일'];

  conditionHeaders.forEach((header, index) => {
    const col = String.fromCharCode(66 + index); // B, C, D, E, F, G, H
    const headerCell = worksheet.getCell(`${col}17`);
    headerCell.value = header;
    headerCell.font = { bold: true, size: 10 };
    headerCell.alignment = { horizontal: 'center', vertical: 'middle' };
    headerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };
    headerCell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };

    const valueCell = worksheet.getCell(`${col}18`);
    valueCell.value = conditionValues[index];
    valueCell.font = { size: 10 };
    valueCell.alignment = { horizontal: 'left', vertical: 'middle' };
    valueCell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  });

  // 견적 항목 헤더
  const itemHeaders = ['ITEM', 'DESCRIPTION', '', '단가', '수량', '단위', 'AMOUNT(원화)'];
  itemHeaders.forEach((header, index) => {
    const col = String.fromCharCode(66 + index);
    const cell = worksheet.getCell(`${col}21`);
    cell.value = header;
    cell.font = { bold: true, size: 12, color: { argb: 'FF000000' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  });

  // 견적 항목들
  let row = 22;
  const quote = data.quote;

  if (!quote) {
    // 견적 데이터가 없는 경우 기본 항목 표시
    const defaultItems = [
      { item: 'LED Wall', description: 'LED 모듈(P2.9 500x500mm)', unitPrice: 0, quantity: 0, unit: '개', amount: 0 },
      { item: '', description: '지지구조물(시스템 비계)', unitPrice: 0, quantity: 0, unit: '㎡', amount: 0 },
      { item: '', description: 'LED Wall 컨트롤러 및 스위치', unitPrice: 0, quantity: 0, unit: '개', amount: 0 },
      { item: '', description: '설치/철거 인력', unitPrice: 0, quantity: 0, unit: '명', amount: 0 },
      { item: '', description: '운반비', unitPrice: 0, quantity: 1, unit: '식', amount: 0 }
    ];

    defaultItems.forEach((item, index) => {
      const currentRow = row + index;
      addItemRow(worksheet, currentRow, item);
    });

    row += defaultItems.length;
  } else {
    // 견적 데이터가 있는 경우
    const items = [
      {
        item: 'LED Wall',
        description: 'LED 모듈(P2.9 500x500mm)',
        unitPrice: quote.ledModules?.count < 500 ? 0 : 34000,
        quantity: quote.ledModules?.count || 0,
        unit: '개',
        amount: quote.ledModules?.price || 0
      },
      {
        item: '',
        description: `지지구조물(시스템 비계)\n${quote.structure?.unitPriceDescription || '4m 미만 (20,000원/㎡)'}`,
        unitPrice: quote.structure?.unitPrice || 20000,
        quantity: quote.structure?.area || 0,
        unit: '㎡',
        amount: quote.structure?.totalPrice || 0
      },
      {
        item: '',
        description: `LED Wall 컨트롤러 및 스위치\n- 200인치 이상 500,000원/개소\n- 200인치 미만 200,000원/개소\n(총 ${quote.controller?.count || 1}개소)`,
        unitPrice: quote.controller?.count ? Math.round((quote.controller?.totalPrice || 0) / quote.controller.count) : (quote.controller?.totalPrice || 0),
        quantity: quote.controller?.count || 1,
        unit: '개',
        amount: quote.controller?.totalPrice || 0
      },
      {
        item: '',
        description: `LED 파워\n- 250인치 이상 500,000원/개소\n- 250인치 이하 무상\n(${quote.power?.requiredCount || 0}개소 필요)`,
        unitPrice: (quote.power?.requiredCount && quote.power.requiredCount > 0) ? 500000 : 0,
        quantity: quote.power?.requiredCount || 0,
        unit: '개',
        amount: quote.power?.totalPrice || 0
      },
      {
        item: '',
        description: `설치/철거 인력\n${quote.installation?.workerRange || '60개 이하 (3명)'}`,
        unitPrice: quote.installation?.pricePerWorker || 160000,
        quantity: quote.installation?.workers || 0,
        unit: '명',
        amount: quote.installation?.totalPrice || 0
      },
      {
        item: '',
        description: '오퍼레이팅 인력',
        unitPrice: quote.operation?.pricePerDay || 280000,
        quantity: quote.operation?.days || 0,
        unit: '일',
        amount: quote.operation?.totalPrice || 0
      },
      {
        item: '',
        description: `운반비\n${quote.transport?.range || '200개 이하'}`,
        unitPrice: quote.transport?.price || 0,
        quantity: 1,
        unit: '식',
        amount: quote.transport?.price || 0
      }
    ];

    items.forEach((item, index) => {
      const currentRow = row + index;
      addItemRow(worksheet, currentRow, item);
    });

    row += items.length;
  }

  // 합계 섹션
  row += 1;
  
  // 소계
  const subtotalLabelCell = worksheet.getCell(`B${row}`);
  subtotalLabelCell.value = '소계';
  subtotalLabelCell.font = { bold: true };
  
  const subtotalValueCell = worksheet.getCell(`H${row}`);
  subtotalValueCell.value = quote?.subtotal || 0;
  subtotalValueCell.font = { bold: true, size: 10 };
  subtotalValueCell.alignment = { horizontal: 'right', vertical: 'middle' };
  subtotalValueCell.numFmt = '#,##0';

  // 총계
  row++;
  const totalLabelCell = worksheet.getCell(`B${row}`);
  totalLabelCell.value = '합계금액(VAT 포함)';
  totalLabelCell.font = { bold: true, size: 12 };
  totalLabelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE6E6' } };
  
  const totalValueCell = worksheet.getCell(`H${row}`);
  totalValueCell.value = quote?.total || 0;
  totalValueCell.font = { bold: true, size: 12 };
  totalValueCell.alignment = { horizontal: 'right', vertical: 'middle' };
  totalValueCell.numFmt = '#,##0';
  totalValueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE6E6' } };

  // 하단 메모
  row += 3;
  worksheet.getCell(`B${row}`).value = '본 견적서에 대하여 외부 유출 금할것을 당부드립니다.';
  worksheet.getCell(`B${row}`).font = { size: 10, italic: true };

  // 은행 정보
  row += 2;
  worksheet.getCell(`B${row}`).value = '■ Bank Account';
  worksheet.getCell(`B${row}`).font = { bold: true };

  const bankInfo = [
    { label: 'Bank name', value: ': KEB 하나은행' },
    { label: 'Address', value: ': 131, Gasan digital 1-ro, Geumcheon-gu, Seoul, Republic of Korea' },
    { label: '  SWIFT Code', value: ': KOEXKRSE' },
    { label: '  Account No.', value: ': 332-910038-86404(원화)' },
    { label: '  Beneficiary', value: ': Oriondisplay Co.,ltd.' }
  ];

  bankInfo.forEach((info, index) => {
    row++;
    worksheet.getCell(`B${row}`).value = info.label;
    worksheet.getCell(`B${row}`).font = { size: 10 };
    
    worksheet.getCell(`C${row}`).value = info.value;
    worksheet.getCell(`C${row}`).font = { size: 10 };
  });

  // 회사 서명
  row += 3;
  worksheet.mergeCells(`F${row}:H${row}`);
  const signatureCell = worksheet.getCell(`F${row}`);
  signatureCell.value = 'Oriondisplay Co.,Ltd.';
  signatureCell.font = { bold: true, size: 12 };
  signatureCell.alignment = { horizontal: 'center', vertical: 'middle' };

  // 파일 저장
  const fileName = `${data.customerName || '고객사'}_견적서_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xlsx`;
  const filePath = path.join('data', fileName);
  
  if (!fs.existsSync('data')) {
    fs.mkdirSync('data', { recursive: true });
  }

  await workbook.xlsx.writeFile(filePath);

  return {
    content: [{
      type: 'text',
      text: `✨ 스타일이 적용된 견적서 Excel 파일이 생성되었습니다!\n📁 파일명: ${fileName}\n📂 경로: ${filePath}\n\n💰 견적 요약:\n- 총 ${quote?.ledModules?.count || 0}개 LED 모듈\n- 설치인력: ${quote?.installation?.workers || 0}명\n- 총액: ${quote?.total?.toLocaleString() || 0}원 (VAT 포함)`
    }],
    filePath: filePath,
    fileName: fileName,
    fileType: 'quote'
  };
}

// 견적 항목 행 추가 헬퍼 함수
function addItemRow(worksheet: ExcelJS.Worksheet, row: number, item: any) {
  const itemCell = worksheet.getCell(`B${row}`);
  itemCell.value = item.item;
  itemCell.font = { size: 10 };
  itemCell.alignment = { horizontal: 'left', vertical: 'middle' };
  itemCell.border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  };
  
  const descCell = worksheet.getCell(`C${row}`);
  descCell.value = item.description;
  descCell.font = { size: 10 };
  descCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
  descCell.border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  };
  
  const unitPriceCell = worksheet.getCell(`E${row}`);
  unitPriceCell.value = item.unitPrice;
  unitPriceCell.font = { size: 10 };
  unitPriceCell.alignment = { horizontal: 'right', vertical: 'middle' };
  unitPriceCell.numFmt = '#,##0';
  unitPriceCell.border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  };
  
  const quantityCell = worksheet.getCell(`F${row}`);
  quantityCell.value = item.quantity;
  quantityCell.font = { size: 10 };
  quantityCell.alignment = { horizontal: 'left', vertical: 'middle' };
  quantityCell.border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  };
  
  const unitCell = worksheet.getCell(`G${row}`);
  unitCell.value = item.unit;
  unitCell.font = { size: 10 };
  unitCell.alignment = { horizontal: 'left', vertical: 'middle' };
  unitCell.border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  };
  
  const amountCell = worksheet.getCell(`H${row}`);
  amountCell.value = item.amount;
  amountCell.font = { size: 10 };
  amountCell.alignment = { horizontal: 'right', vertical: 'middle' };
  amountCell.numFmt = '#,##0';
  amountCell.border = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' }
  };
}