export function isModificationRequest(message: string): boolean {
  const modificationKeywords = [
    '수정', '바꾸', '변경', '다시', '틀렸', '잘못', '돌아가', '이전',
    '고쳐', '바꿔', '뒤로', '취소'
  ];
  return modificationKeywords.some(keyword => message.includes(keyword));
}

export function isResetRequest(message: string): boolean {
  const resetKeywords = ['처음부터', '처음부터 시작', '초기화', '새로', '다시 시작'];
  return resetKeywords.some(keyword => message.includes(keyword));
}