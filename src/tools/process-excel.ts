import ExcelJS from 'exceljs';
import { LEDQuoteResponse, LEDQuoteRequest, TransportInfo } from '../types/index.js';
import path from 'path';
import fs from 'fs';

export const processExcelTool = {
  definition: {
    name: 'process_excel',
    description: 'LED 렌탈 요청서/견적서 Excel 파일을 생성합니다',
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
        }
      },
      required: ['type', 'data']
    }
  },

  handler: async (args: any) => {
    try {
      const { type, data } = args;
      
      if (type === 'request') {
        return await generateRequestExcel(data);
      } else if (type === 'quote') {
        return await generateQuoteExcel(data);
      } else {
        throw new Error('지원하지 않는 파일 타입입니다.');
      }
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

// 요청서 Excel 생성
async function generateRequestExcel(data: any) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('LED Wall 요청서');

  // 헤더 설정
  worksheet.getCell('B1').value = '1. 주최측 입력 정보';
  worksheet.getCell('I1').value = '2. 오리온 입력 정보';

  // 스타일 설정 (타입 오류 수정)
  const headerCell1 = worksheet.getCell('B1');
  headerCell1.font = { bold: true, size: 12 };
  headerCell1.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  };
  headerCell1.alignment = { horizontal: 'center', vertical: 'middle' };

  const headerCell2 = worksheet.getCell('I1');
  headerCell2.font = { bold: true, size: 12 };
  headerCell2.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  };
  headerCell2.alignment = { horizontal: 'center', vertical: 'middle' };

  // 주최측 정보 입력
  worksheet.getCell('B4').value = '행사장';
  worksheet.getCell('C4').value = '도로명 주소 및 층수를 입력하세요';
  worksheet.getCell('D4').value = data.eventLocation || '';

  worksheet.getCell('B6').value = '구분';
  worksheet.getCell('D6').value = '시작';
  worksheet.getCell('F6').value = '종료';

  worksheet.getCell('B7').value = '행사기간';
  worksheet.getCell('C7').value = '2024-00-00 00:00';
  worksheet.getCell('D7').value = data.eventStartDate ? new Date(data.eventStartDate + ' 10:00') : '';
  worksheet.getCell('E7').value = '2024-00-00 00:00';
  worksheet.getCell('F7').value = data.eventEndDate ? new Date(data.eventEndDate + ' 18:00') : '';

  worksheet.getCell('B8').value = '무대설치';
  worksheet.getCell('B9').value = '무대해체';
  worksheet.getCell('B10').value = '리허설(예상)';

  // LED 사양 정보
  worksheet.getCell('B13').value = '메인 무대';
  worksheet.getCell('H13').value = '→';
  worksheet.getCell('I13').value = '설치 필요공간(mm)';

  worksheet.getCell('B14').value = 'LED 사이즈(mm)';
  worksheet.getCell('C14').value = '가로 x 높이(500mm 단위로)';
  worksheet.getCell('D14').value = data.ledSize || '';

  worksheet.getCell('B15').value = '3D';
  worksheet.getCell('C15').value = 'O / X';
  worksheet.getCell('D15').value = data.is3D ? 'O' : 'X';

  worksheet.getCell('B16').value = '오퍼레이터 필요';
  worksheet.getCell('C16').value = 'O / X';
  worksheet.getCell('D16').value = data.needOperator ? 'O' : 'X';

  worksheet.getCell('B17').value = '중계 카메라 연동';
  worksheet.getCell('C17').value = 'O / X';
  worksheet.getCell('D17').value = 'X';

  worksheet.getCell('B18').value = '화면 분할 송출';
  worksheet.getCell('C18').value = 'O / X';
  worksheet.getCell('D18').value = 'X';

  // 시나리오 정보
  worksheet.getCell('B22').value = '시나리오(식순)/\n콘텐츠 구성';
  worksheet.getCell('C22').value = '대략적인 시나리오 또는 콘텐츠를 입력해주세요.';
  worksheet.getCell('D22').value = data.scenario || '';

  // 담당자 정보
  worksheet.getCell('B24').value = '현장 관리자';
  worksheet.getCell('C24').value = '이름 직책 연락처';
  worksheet.getCell('D24').value = data.fieldManager || '';

  // 파일 저장
  const fileName = `${data.customerName}_${data.eventName || 'LED_Wall'}_요청서_${new Date().toISOString().slice(0, 10)}.xlsx`;
  const filePath = path.join('data', fileName);
  
  // data 폴더 생성
  if (!fs.existsSync('data')) {
    fs.mkdirSync('data', { recursive: true });
  }

  await workbook.xlsx.writeFile(filePath);

  return {
    content: [{
      type: 'text',
      text: `요청서 Excel 파일이 생성되었습니다: ${fileName}\n파일 경로: ${filePath}`
    }]
  };
}

// 견적서 Excel 생성
async function generateQuoteExcel(data: any) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('견적서');

  // 회사 정보
  worksheet.getCell('B2').value = '서울시 금천구 가산디지털1로 181 (가산W센터) 807호';
  worksheet.getCell('B3').value = 'Tel + 82 10 9767 5001 / Fax + 82 2 6678 8560 / Email: hjs@oriondisplay.net';

  // 견적서 제목
  const titleCell = worksheet.getCell('B6');
  titleCell.value = '견적서';
  titleCell.font = { bold: true, size: 16 };
  titleCell.alignment = { horizontal: 'center' };

  // 날짜 및 참조번호
  worksheet.getCell('G8').value = 'Date :';
  worksheet.getCell('H8').value = new Date();
  worksheet.getCell('G9').value = 'REF NO :';
  worksheet.getCell('H9').value = `ODC-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}Q-01`;

  // 고객 정보
  worksheet.getCell('B12').value = `Messers: ${data.customerName || ''}`;
  worksheet.getCell('B13').value = 'Attn : ';

  // 조건 정보
  worksheet.getCell('B17').value = 'Price validity';
  worksheet.getCell('C17').value = 'Payment terms';
  worksheet.getCell('D17').value = 'Delivery';
  worksheet.getCell('E17').value = 'Shipment';
  worksheet.getCell('F17').value = 'Destination';
  worksheet.getCell('H17').value = 'Warranty term';

  worksheet.getCell('B18').value = '발행 후 1주';
  worksheet.getCell('C18').value = '-';
  worksheet.getCell('D18').value = '협의';
  worksheet.getCell('E18').value = '협의';
  worksheet.getCell('F18').value = data.eventLocation || '';
  worksheet.getCell('H18').value = '전시 기간과 동일';

  // 견적 항목 헤더
  worksheet.getCell('B21').value = 'ITEM';
  worksheet.getCell('C21').value = 'DESCRIPTION';
  worksheet.getCell('E21').value = '단가';
  worksheet.getCell('F21').value = '수량';
  worksheet.getCell('G21').value = '단위';
  worksheet.getCell('H21').value = 'AMOUNT(원화)';

  // 견적 항목들
  let row = 22;
  const quote = data.quote;

  // LED Wall
  worksheet.getCell(`B${row}`).value = 'LED Wall';
  worksheet.getCell(`C${row}`).value = 'LED 모듈(P2.9 500x500mm)';
  worksheet.getCell(`E${row}`).value = quote.ledModules.count < 500 ? 0 : 34000;
  worksheet.getCell(`F${row}`).value = quote.ledModules.count;
  worksheet.getCell(`G${row}`).value = '개';
  worksheet.getCell(`H${row}`).value = quote.ledModules.price;
  row++;

  // 지지구조물
  worksheet.getCell(`C${row}`).value = `지지구조물(시스템 비계)\n - 4m 이상 25,000원/㎡\n - 4m 미만 20,000원/㎡`;
  worksheet.getCell(`E${row}`).value = quote.structure.unitPrice;
  worksheet.getCell(`F${row}`).value = quote.structure.area;
  worksheet.getCell(`G${row}`).value = '㎡';
  worksheet.getCell(`H${row}`).value = quote.structure.totalPrice;
  row++;

  // 컨트롤러
  worksheet.getCell(`C${row}`).value = `LED Wall 컨트롤러 및 스위치\n - 200인치 이상 500,000원/개소\n - 200인치 미만 200,000원/개소`;
  worksheet.getCell(`E${row}`).value = quote.controller.price;
  worksheet.getCell(`F${row}`).value = 1;
  worksheet.getCell(`G${row}`).value = '개';
  worksheet.getCell(`H${row}`).value = quote.controller.price;
  row++;

  // LED 파워
  worksheet.getCell(`C${row}`).value = `LED 파워\n - 250인치 이상 500,000원/개소\n - 250인치 이하 무상`;
  worksheet.getCell(`E${row}`).value = quote.power.price || 0;
  worksheet.getCell(`F${row}`).value = quote.power.price > 0 ? 1 : 0;
  worksheet.getCell(`G${row}`).value = '개';
  worksheet.getCell(`H${row}`).value = quote.power.price;
  row++;

  // 설치/철거 인력
  worksheet.getCell(`C${row}`).value = '설치/철거 인력';
  worksheet.getCell(`E${row}`).value = quote.installation.pricePerWorker;
  worksheet.getCell(`F${row}`).value = quote.installation.workers;
  worksheet.getCell(`G${row}`).value = '명';
  worksheet.getCell(`H${row}`).value = quote.installation.totalPrice;
  row++;

  // 오퍼레이팅 인력
  worksheet.getCell(`C${row}`).value = '오퍼레이팅 인력';
  worksheet.getCell(`E${row}`).value = quote.operation.pricePerDay;
  worksheet.getCell(`F${row}`).value = quote.operation.days;
  worksheet.getCell(`G${row}`).value = '일';
  worksheet.getCell(`H${row}`).value = quote.operation.totalPrice;
  row++;

  // 운반비
  worksheet.getCell(`C${row}`).value = `운반비\n - 200개 이하 200,000원\n - 200개 초과 시 ,별도 협의`;
  worksheet.getCell(`E${row}`).value = quote.transport.price;
  worksheet.getCell(`F${row}`).value = 1;
  worksheet.getCell(`G${row}`).value = '식';
  worksheet.getCell(`H${row}`).value = quote.transport.price;
  row++;

  // 합계
  worksheet.getCell(`B${row + 1}`).value = '소계';
  worksheet.getCell(`H${row + 1}`).value = quote.subtotal;
  worksheet.getCell(`B${row + 2}`).value = '합계금액(VAT 포함)';
  worksheet.getCell(`H${row + 2}`).value = quote.total;

  // 파일 저장
  const fileName = `${data.customerName}_견적서_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xlsx`;
  const filePath = path.join('data', fileName);

  await workbook.xlsx.writeFile(filePath);

  return {
    content: [{
      type: 'text',
      text: `견적서 Excel 파일이 생성되었습니다: ${fileName}\n파일 경로: ${filePath}\n\n견적 요약:\n- 총 ${quote.ledModules.count}개 LED 모듈\n- 총액: ${quote.total.toLocaleString()}원 (VAT 포함)`
    }]
  };
}