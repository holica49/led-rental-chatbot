describe('Jest 환경 테스트', () => {
  it('기본 테스트가 작동해야 함', () => {
    expect(true).toBe(true);
  });

  it('숫자 계산이 정확해야 함', () => {
    expect(1 + 1).toBe(2);
  });
});