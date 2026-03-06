import { describe, it, expect } from 'vitest';
import {
  generateParticipants,
  generateTimerSteps,
  calculateTotalDuration,
  formatTime,
  formatDuration,
  PRESETS
} from './timer-logic';

describe('generateParticipants', () => {
  it('3人の参加者を生成できる', () => {
    const p = generateParticipants(3);
    expect(p.length).toBe(3);
    expect(p[0].id).toBe('A');
    expect(p[0].isLeader).toBe(true);
    expect(p[1].id).toBe('B');
    expect(p[1].isLeader).toBe(false);
  });

  it('6人の参加者を正しく生成できる', () => {
    const p = generateParticipants(6);
    expect(p.length).toBe(6);
    expect(p[5].id).toBe('F');
    expect(p[5].isLeader).toBe(false);
  });

  it('範囲外の人数はエラーを投げる', () => {
    expect(() => generateParticipants(2)).toThrow();
    expect(() => generateParticipants(7)).toThrow();
  });
});

describe('generateTimerSteps - 発表順', () => {
  it('3人: 発表順はB→C→A（リーダーが最後）', () => {
    const p = generateParticipants(3);
    const steps = generateTimerSteps(p, PRESETS[3]);
    const talkSteps = steps.filter(s => s.type === 'talk');
    expect(talkSteps.length).toBe(3);
    expect(talkSteps[0].speaker).toBe('B');
    expect(talkSteps[1].speaker).toBe('C');
    expect(talkSteps[2].speaker).toBe('A');
  });

  it('4人: 発表順はB→C→D→A', () => {
    const p = generateParticipants(4);
    const steps = generateTimerSteps(p, PRESETS[4]);
    const talkSteps = steps.filter(s => s.type === 'talk');
    expect(talkSteps[0].speaker).toBe('B');
    expect(talkSteps[1].speaker).toBe('C');
    expect(talkSteps[2].speaker).toBe('D');
    expect(talkSteps[3].speaker).toBe('A');
  });
});

describe('generateTimerSteps - 質問順', () => {
  it('3人: Bの発表→質問順はA→C（リーダー優先）', () => {
    const p = generateParticipants(3);
    const steps = generateTimerSteps(p, PRESETS[3]);
    // steps[0] = B talk, steps[1] = B×A pair, steps[2] = B×C pair
    expect(steps[1].type).toBe('pair');
    expect(steps[1].speaker).toBe('B');
    expect(steps[1].questioner).toBe('A');
    expect(steps[2].questioner).toBe('C');
  });

  it('3人: Aの発表→質問順はB→C（リーダー発表時はP2から）', () => {
    const p = generateParticipants(3);
    const steps = generateTimerSteps(p, PRESETS[3]);
    // steps[6] = A talk, steps[7] = A×B pair, steps[8] = A×C pair
    expect(steps[6].type).toBe('talk');
    expect(steps[6].speaker).toBe('A');
    expect(steps[7].questioner).toBe('B');
    expect(steps[8].questioner).toBe('C');
  });
});

describe('generateTimerSteps - step数', () => {
  it('3人: 9ステップ（発表3 + 質問6）', () => {
    const p = generateParticipants(3);
    const steps = generateTimerSteps(p, PRESETS[3]);
    expect(steps.length).toBe(9);
  });

  it('4人: 16ステップ（発表4 + 質問12）', () => {
    const p = generateParticipants(4);
    const steps = generateTimerSteps(p, PRESETS[4]);
    expect(steps.length).toBe(16);
  });

  it('5人: 25ステップ（発表5 + 質問20）', () => {
    const p = generateParticipants(5);
    const steps = generateTimerSteps(p, PRESETS[5]);
    expect(steps.length).toBe(25);
  });

  it('6人: 36ステップ（発表6 + 質問30）', () => {
    const p = generateParticipants(6);
    const steps = generateTimerSteps(p, PRESETS[6]);
    expect(steps.length).toBe(36);
  });
});

describe('calculateTotalDuration', () => {
  it('3人の総所要時間: 1170秒', () => {
    const p = generateParticipants(3);
    const steps = generateTimerSteps(p, PRESETS[3]);
    expect(calculateTotalDuration(steps)).toBe(1170);
  });
});

describe('formatTime', () => {
  it('90秒 → 1:30', () => expect(formatTime(90)).toBe('1:30'));
  it('0秒 → 0:00', () => expect(formatTime(0)).toBe('0:00'));
  it('3661秒 → 61:01', () => expect(formatTime(3661)).toBe('61:01'));
});

describe('formatDuration', () => {
  it('90秒 → 1:30', () => expect(formatDuration(90)).toBe('1:30'));
  it('3661秒 → 1:01:01', () => expect(formatDuration(3661)).toBe('1:01:01'));
});
