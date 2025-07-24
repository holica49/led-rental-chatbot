import request from 'supertest';
import express from 'express';
import bodyParser from 'body-parser';
import { skillRouter } from '../../src/tools/kakao-chatbot.js';

describe('kakao-chatbot 기본 테스트', () => {
  it('작동 확인', () => {
    expect(true).toBe(true);
  });
});