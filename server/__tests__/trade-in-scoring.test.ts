import { describe, it, expect } from 'vitest';
import {
  validateIMEI,
  calculateConditionScore,
  determineDecision,
  calculateOffer,
  getConditionQuestionsForDeviceType,
} from '../trade-in-scoring';
import { inferTradeInDeviceType } from '../../shared/trade-in-profile';

describe('trade-in-scoring', () => {
  it('validates a known-good IMEI', () => {
    const imei = '490154203237518'; // common test IMEI
    const res = validateIMEI(imei);
    expect(res.valid).toBe(true);
    expect(res.error).toBeUndefined();
  });

  it('rejects an invalid IMEI length', () => {
    const imei = '12345';
    const res = validateIMEI(imei);
    expect(res.valid).toBe(false);
    expect(res.error).toBeTruthy();
  });

  it('calculates condition score and deductions correctly', () => {
    const questions = [
      {
        id: 'q1',
        question: 'Screen condition',
        options: [
          { value: 'perfect', label: 'Perfect', deduction: 0, isRejection: false },
          { value: 'cracked', label: 'Cracked', deduction: 40, isRejection: false },
        ],
      },
    ];

    const answers = { q1: 'cracked' } as Record<string, string>;
    const { score, deductions, rejections } = calculateConditionScore(answers, questions as any);
    expect(score).toBe(60); // 100 - 40
    expect(deductions).toHaveLength(1);
    expect(rejections).toHaveLength(0);
  });

  it('auto-rejects when iCloud locked', () => {
    const result = determineDecision(80, [], true, false, false, false);
    expect(result.decision).toBe('auto_reject');
    expect(result.reasons).toContain('Device has iCloud lock enabled');
  });

  it('calculates offer based on condition score', () => {
    expect(calculateOffer(1000, 75)).toBe(750);
    expect(calculateOffer(1234, 50)).toBe(Math.round(1234 * 0.5));
  });

  it('infers laptop device types from model naming', () => {
    expect(inferTradeInDeviceType({ brand: 'Apple', model: 'MacBook Pro 14' })).toBe('laptop');
    expect(inferTradeInDeviceType({ brand: 'Dell', model: 'Latitude 5420' })).toBe('laptop');
  });

  it('returns laptop-specific questions without touchscreen checks', () => {
    const laptopQuestions = getConditionQuestionsForDeviceType('laptop');
    const phoneQuestions = getConditionQuestionsForDeviceType('phone');

    expect(laptopQuestions.some((question) => question.question.includes('keyboard and trackpad'))).toBe(true);
    expect(laptopQuestions.some((question) => question.question.includes('touchscreen'))).toBe(false);
    expect(phoneQuestions.some((question) => question.question.includes('touchscreen'))).toBe(true);
  });
});
