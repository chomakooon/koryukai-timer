export interface Participant {
  id: string;
  isLeader: boolean;
}

export interface StepConfig {
  talkSec: number;
  pairSec: number;
}

export type StepType = 'talk' | 'pair';

export interface TimerStep {
  id: string;
  type: StepType;
  speaker: string;
  questioner?: string;
  durationSec: number;
  label: string;
}

export interface TimerPreset {
  talkSec: number;
  pairSec: number;
}

export const PRESETS: Record<number, TimerPreset> = {
  3: { talkSec: 150, pairSec: 120 },
  4: { talkSec: 150, pairSec: 120 },
  5: { talkSec: 120, pairSec: 90 },
  6: { talkSec: 90, pairSec: 60 }
};

export function generateParticipants(count: number): Participant[] {
  if (count < 3 || count > 6) {
    throw new Error('参加者数は3〜6人である必要があります');
  }

  return Array.from({ length: count }, (_, i) => ({
    id: String.fromCharCode(65 + i),
    isLeader: i === 0
  }));
}

function generateSpeakerOrder(participants: Participant[]): Participant[] {
  const leader = participants[0];
  const others = participants.slice(1);
  return [...others, leader];
}

function generateQuestionOrder(speaker: Participant, allParticipants: Participant[]): Participant[] {
  const leader = allParticipants[0];

  if (speaker.isLeader) {
    return allParticipants.slice(1);
  }

  const others = allParticipants.filter((p) => !p.isLeader && p.id !== speaker.id);
  return [leader, ...others];
}

export function generateTimerSteps(participants: Participant[], config: StepConfig): TimerStep[] {
  const steps: TimerStep[] = [];
  const speakerOrder = generateSpeakerOrder(participants);

  speakerOrder.forEach((speaker) => {
    steps.push({
      id: `talk-${speaker.id}`,
      type: 'talk',
      speaker: speaker.id,
      durationSec: config.talkSec,
      label: `${speaker.id} 発表`
    });

    const questionOrder = generateQuestionOrder(speaker, participants);
    questionOrder.forEach((questioner) => {
      steps.push({
        id: `pair-${speaker.id}-${questioner.id}`,
        type: 'pair',
        speaker: speaker.id,
        questioner: questioner.id,
        durationSec: config.pairSec,
        label: `${speaker.id}×${questioner.id} 質問`
      });
    });
  });

  return steps;
}

export function calculateTotalDuration(steps: TimerStep[]): number {
  return steps.reduce((sum, step) => sum + step.durationSec, 0);
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function getParticipantLabel(id: string): string {
  return id;
}

export function getParticipantColor(id: string): string {
  const colorMap: Record<string, string> = {
    A: '#dc2626',
    B: '#2563eb',
    C: '#7c3aed',
    D: '#ea580c',
    E: '#ca8a04',
    F: '#0891b2'
  };
  return colorMap[id] || '#006837';
}

export function getStepDisplayLabel(step: TimerStep): string {
  const speakerLabel = getParticipantLabel(step.speaker);
  if (step.type === 'talk') {
    return `${speakerLabel} 発表`;
  }
  const questionerLabel = getParticipantLabel(step.questioner!);
  return `${speakerLabel}×${questionerLabel} 質問`;
}
