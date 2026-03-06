import { useReducer, useEffect, useRef, useCallback, useState } from 'react';
import {
  generateParticipants,
  generateTimerSteps,
  calculateTotalDuration,
  formatTime,
  formatDuration,
  getParticipantColor,
  PRESETS,
  type TimerStep,
  type Participant
} from '../lib/timer-logic';
import { AudioManager, WakeLockManager } from '../lib/audio-wakelock';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from './ui/alert-dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  PlayIcon,
  PauseIcon,
  SkipForwardIcon,
  SkipBackIcon,
  RotateCcwIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  SettingsIcon,
  CheckIcon
} from 'lucide-react';

interface TimerState {
  participantCount: number;
  participants: Participant[];
  steps: TimerStep[];
  currentStepIndex: number;
  remainingSec: number;
  isRunning: boolean;
  talkSec: number;
  pairSec: number;
}

type TimerAction =
  | { type: 'SET_PARTICIPANT_COUNT'; count: number }
  | { type: 'START' }
  | { type: 'PAUSE' }
  | { type: 'TICK' }
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  | { type: 'JUMP_TO_STEP'; index: number }
  | { type: 'RESET' }
  | { type: 'UPDATE_TIMES'; talkSec: number; pairSec: number; applyNow: boolean };

function timerReducer(state: TimerState, action: TimerAction): TimerState {
  switch (action.type) {
    case 'SET_PARTICIPANT_COUNT': {
      const participants = generateParticipants(action.count);
      const preset = PRESETS[action.count];
      const steps = generateTimerSteps(participants, preset);
      return {
        ...state,
        participantCount: action.count,
        participants,
        steps,
        currentStepIndex: 0,
        remainingSec: steps[0]?.durationSec || 0,
        isRunning: false,
        talkSec: preset.talkSec,
        pairSec: preset.pairSec
      };
    }
    case 'START':
      return { ...state, isRunning: true };
    case 'PAUSE':
      return { ...state, isRunning: false };
    case 'TICK': {
      if (!state.isRunning || state.remainingSec <= 0) return state;
      const newRemaining = state.remainingSec - 1;
      if (newRemaining <= 0) {
        const nextIndex = state.currentStepIndex + 1;
        if (nextIndex < state.steps.length) {
          return {
            ...state,
            currentStepIndex: nextIndex,
            remainingSec: state.steps[nextIndex].durationSec,
            isRunning: true
          };
        }
        return { ...state, remainingSec: 0, isRunning: false };
      }
      return { ...state, remainingSec: newRemaining };
    }
    case 'NEXT_STEP': {
      const nextIndex = Math.min(state.currentStepIndex + 1, state.steps.length - 1);
      return {
        ...state,
        currentStepIndex: nextIndex,
        remainingSec: state.steps[nextIndex].durationSec,
        isRunning: false
      };
    }
    case 'PREV_STEP': {
      const prevIndex = Math.max(state.currentStepIndex - 1, 0);
      return {
        ...state,
        currentStepIndex: prevIndex,
        remainingSec: state.steps[prevIndex].durationSec,
        isRunning: false
      };
    }
    case 'JUMP_TO_STEP':
      return {
        ...state,
        currentStepIndex: action.index,
        remainingSec: state.steps[action.index].durationSec,
        isRunning: false
      };
    case 'RESET':
      return {
        ...state,
        currentStepIndex: 0,
        remainingSec: state.steps[0]?.durationSec || 0,
        isRunning: false
      };
    case 'UPDATE_TIMES': {
      const newSteps = state.steps.map((step, idx) => {
        const shouldUpdate = action.applyNow || idx > state.currentStepIndex;
        if (!shouldUpdate) return step;
        return {
          ...step,
          durationSec: step.type === 'talk' ? action.talkSec : action.pairSec
        };
      });
      return {
        ...state,
        steps: newSteps,
        talkSec: action.talkSec,
        pairSec: action.pairSec,
        remainingSec: action.applyNow
          ? state.steps[state.currentStepIndex].type === 'talk'
            ? action.talkSec
            : action.pairSec
          : state.remainingSec
      };
    }
    default:
      return state;
  }
}

export function Timer() {
  const [state, dispatch] = useReducer(timerReducer, {
    participantCount: 4,
    participants: generateParticipants(4),
    steps: generateTimerSteps(generateParticipants(4), PRESETS[4]),
    currentStepIndex: 0,
    remainingSec: PRESETS[4].talkSec,
    isRunning: false,
    talkSec: PRESETS[4].talkSec,
    pairSec: PRESETS[4].pairSec
  });

  const audioManagerRef = useRef(new AudioManager());
  const wakeLockManagerRef = useRef(new WakeLockManager());
  const [audioInitialized, setAudioInitialized] = useState(false);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [showStepsList, setShowStepsList] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [tempTalkMin, setTempTalkMin] = useState(Math.floor(state.talkSec / 60));
  const [tempTalkSecOnly, setTempTalkSecOnly] = useState(state.talkSec % 60);
  const [tempPairMin, setTempPairMin] = useState(Math.floor(state.pairSec / 60));
  const [tempPairSecOnly, setTempPairSecOnly] = useState(state.pairSec % 60);
  const [applyNow, setApplyNow] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const resetTimerRef = useRef<number | null>(null);
  const [showCompletionDialog, setShowCompletionDialog] = useState(false);

  const previousRemainingRef = useRef(state.remainingSec);
  const isComplete = state.currentStepIndex === state.steps.length - 1 && state.remainingSec === 0;

  useEffect(() => {
    if (!state.isRunning) return;
    const interval = window.setInterval(() => {
      dispatch({ type: 'TICK' });
    }, 1000);
    return () => clearInterval(interval);
  }, [state.isRunning]);

  useEffect(() => {
    if (previousRemainingRef.current === 1 && state.remainingSec === 0) {
      audioManagerRef.current.playFinishSound();
    }
    previousRemainingRef.current = state.remainingSec;
  }, [state.remainingSec]);

  useEffect(() => {
    if (isComplete) {
      setShowCompletionDialog(true);
    }
  }, [isComplete]);

  useEffect(() => {
    if (state.isRunning && !wakeLockActive) {
      wakeLockManagerRef.current.request().then((success) => {
        if (success) setWakeLockActive(true);
      });
    } else if (!state.isRunning && wakeLockActive) {
      wakeLockManagerRef.current.release().then(() => {
        setWakeLockActive(false);
      });
    }
  }, [state.isRunning, wakeLockActive]);

  useEffect(() => {
    setTempTalkMin(Math.floor(state.talkSec / 60));
    setTempTalkSecOnly(state.talkSec % 60);
    setTempPairMin(Math.floor(state.pairSec / 60));
    setTempPairSecOnly(state.pairSec % 60);
  }, [state.talkSec, state.pairSec]);

  const handleStart = useCallback(async () => {
    if (!audioInitialized) {
      const success = await audioManagerRef.current.initialize();
      setAudioInitialized(success);
    }
    dispatch({ type: 'START' });
  }, [audioInitialized]);

  const handleResetMouseDown = () => {
    resetTimerRef.current = window.setTimeout(() => {
      setIsResetting(true);
      dispatch({ type: 'RESET' });
      window.setTimeout(() => setIsResetting(false), 200);
    }, 800);
  };

  const handleResetMouseUp = () => {
    if (resetTimerRef.current) {
      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  };

  const handleTimeUpdate = () => {
    const newTalkSec = tempTalkMin * 60 + tempTalkSecOnly;
    const newPairSec = tempPairMin * 60 + tempPairSecOnly;
    dispatch({ type: 'UPDATE_TIMES', talkSec: newTalkSec, pairSec: newPairSec, applyNow });
    setShowSettings(false);
    setApplyNow(false);
  };

  const currentStep = state.steps[state.currentStepIndex];
  const nextStep = state.steps[state.currentStepIndex + 1];
  const totalDuration = calculateTotalDuration(state.steps);

  const renderColoredLabel = (step: TimerStep) => {
    const speakerColor = getParticipantColor(step.speaker);

    if (step.type === 'talk') {
      return (
        <>
          <span style={{ color: speakerColor, backgroundColor: 'rgba(255, 255, 255, 0.5)', padding: '0px 4px', borderRadius: '2px', display: 'inline-block' }}>{step.speaker}</span> 発表
        </>
      );
    }

    const questionerColor = getParticipantColor(step.questioner!);
    return (
      <>
        <span style={{ color: speakerColor, backgroundColor: 'rgba(255, 255, 255, 0.5)', padding: '0px 4px', borderRadius: '2px', display: 'inline-block' }}>{step.speaker}</span>
        ×
        <span style={{ color: questionerColor, backgroundColor: 'rgba(255, 255, 255, 0.5)', padding: '0px 4px', borderRadius: '2px', display: 'inline-block' }}>{step.questioner}</span> 質問
      </>
    );
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-3 p-2 pt-3">
      {/* 人数選択 */}
      <Card className="border-2 border-green-100 p-4 shadow-md">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-[#006837]">テーブル人数</h3>
            <span className="text-xl font-bold text-[#006837]">{state.participantCount}人</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[3, 4, 5, 6].map((count) => (
              <Button
                key={count}
                onClick={() => dispatch({ type: 'SET_PARTICIPANT_COUNT', count })}
                variant={state.participantCount === count ? 'default' : 'outline'}
                className={
                  state.participantCount === count
                    ? 'h-12 bg-[#006837] text-base text-white hover:bg-[#005028]'
                    : 'h-12 border-2 border-gray-300 text-base text-gray-600 hover:bg-gray-50'
                }
              >
                {count}人
              </Button>
            ))}
          </div>
        </div>
      </Card>

      {/* メインタイマー */}
      <Card className="border-2 border-green-200 bg-gradient-to-br from-[#7cb342] to-[#8bc34a] px-[30px] py-[32px] shadow-xl">
        {currentStep ? (
          <div className="space-y-4 text-center">
            <div className="text-[32px] font-bold text-white drop-shadow-md">{renderColoredLabel(currentStep)}</div>
            <div className="text-8xl font-bold tabular-nums text-white drop-shadow-lg md:text-9xl">{formatTime(state.remainingSec)}</div>
            {nextStep && <div className="text-[24px] font-bold text-white/90 drop-shadow">次: {renderColoredLabel(nextStep)}</div>}
            {isComplete && <div className="animate-bounce text-4xl font-bold text-white drop-shadow-lg">🎉 完了！</div>}
          </div>
        ) : (
          <div className="text-center text-2xl text-white/80">ステップがありません</div>
        )}
      </Card>

      {/* 操作ボタン */}
      <div className="-mt-2 grid grid-cols-2 gap-3">
        <Button size="lg" onClick={state.isRunning ? () => dispatch({ type: 'PAUSE' }) : handleStart} className="col-span-2 h-20 text-2xl bg-[#006837] text-white shadow-lg transition-all hover:bg-[#005028] hover:shadow-xl">
          {state.isRunning ? (
            <>
              <PauseIcon className="mr-3 h-8 w-8" />
              一時停止
            </>
          ) : (
            <>
              <PlayIcon className="mr-3 h-8 w-8" />
              開始
            </>
          )}
        </Button>
        <Button size="lg" variant="outline" onClick={() => dispatch({ type: 'PREV_STEP' })} disabled={state.currentStepIndex === 0} className="h-16 text-lg">
          <SkipBackIcon className="mr-2 h-6 w-6" />
          戻る
        </Button>
        <Button size="lg" variant="outline" onClick={() => dispatch({ type: 'NEXT_STEP' })} disabled={state.currentStepIndex === state.steps.length - 1} className="h-16 text-lg">
          次へ
          <SkipForwardIcon className="ml-2 h-6 w-6" />
        </Button>
        <Button
          size="lg"
          variant="destructive"
          onMouseDown={handleResetMouseDown}
          onMouseUp={handleResetMouseUp}
          onMouseLeave={handleResetMouseUp}
          onTouchStart={handleResetMouseDown}
          onTouchEnd={handleResetMouseUp}
          className={`col-span-2 h-16 text-lg ${isResetting ? 'scale-95' : ''}`}
        >
          <RotateCcwIcon className="mr-2 h-6 w-6" />
          リセット（長押し）
        </Button>
      </div>

      {/* 設定パネル */}
      <Collapsible open={showSettings} onOpenChange={setShowSettings}>
        <Card className="p-4">
          <CollapsibleTrigger className="flex w-full items-center justify-between">
            <div className="flex items-center gap-2">
              <SettingsIcon className="h-5 w-5" />
              <span className="font-semibold">時間設定</span>
            </div>
            <ChevronDownIcon className={`h-5 w-5 transition-transform ${showSettings ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="talk-time">発表時間</Label>
              <div className="flex items-center justify-center gap-4">
                <div className="flex flex-col items-center gap-1">
                  <Button type="button" variant="outline" size="sm" onClick={() => setTempTalkMin(Math.min(99, tempTalkMin + 1))} className="h-8 w-14 rounded-none border-b-0 p-0">
                    <ChevronUpIcon className="h-5 w-5" />
                  </Button>
                  <Input id="talk-time-min" type="number" value={tempTalkMin} onChange={(e) => setTempTalkMin(Math.max(0, Number(e.target.value)))} min={0} max={99} className="h-12 w-16 text-center text-lg [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                  <Button type="button" variant="outline" size="sm" onClick={() => setTempTalkMin(Math.max(0, tempTalkMin - 1))} className="h-8 w-14 rounded-none border-t-0 p-0">
                    <ChevronDownIcon className="h-5 w-5" />
                  </Button>
                </div>
                <span className="text-base font-medium">分</span>
                <div className="flex flex-col items-center gap-1">
                  <Button type="button" variant="outline" size="sm" onClick={() => setTempTalkSecOnly(Math.min(59, tempTalkSecOnly + 1))} className="h-8 w-14 rounded-none border-b-0 p-0">
                    <ChevronUpIcon className="h-5 w-5" />
                  </Button>
                  <Input id="talk-time-sec" type="number" value={tempTalkSecOnly} onChange={(e) => setTempTalkSecOnly(Math.max(0, Math.min(59, Number(e.target.value))))} min={0} max={59} className="h-12 w-16 text-center text-lg [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                  <Button type="button" variant="outline" size="sm" onClick={() => setTempTalkSecOnly(Math.max(0, tempTalkSecOnly - 1))} className="h-8 w-14 rounded-none border-t-0 p-0">
                    <ChevronDownIcon className="h-5 w-5" />
                  </Button>
                </div>
                <span className="text-base font-medium">秒</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pair-time">質問時間</Label>
              <div className="flex items-center justify-center gap-4">
                <div className="flex flex-col items-center gap-1">
                  <Button type="button" variant="outline" size="sm" onClick={() => setTempPairMin(Math.min(99, tempPairMin + 1))} className="h-8 w-14 rounded-none border-b-0 p-0">
                    <ChevronUpIcon className="h-5 w-5" />
                  </Button>
                  <Input id="pair-time-min" type="number" value={tempPairMin} onChange={(e) => setTempPairMin(Math.max(0, Number(e.target.value)))} min={0} max={99} className="h-12 w-16 text-center text-lg [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                  <Button type="button" variant="outline" size="sm" onClick={() => setTempPairMin(Math.max(0, tempPairMin - 1))} className="h-8 w-14 rounded-none border-t-0 p-0">
                    <ChevronDownIcon className="h-5 w-5" />
                  </Button>
                </div>
                <span className="text-base font-medium">分</span>
                <div className="flex flex-col items-center gap-1">
                  <Button type="button" variant="outline" size="sm" onClick={() => setTempPairSecOnly(Math.min(59, tempPairSecOnly + 1))} className="h-8 w-14 rounded-none border-b-0 p-0">
                    <ChevronUpIcon className="h-5 w-5" />
                  </Button>
                  <Input id="pair-time-sec" type="number" value={tempPairSecOnly} onChange={(e) => setTempPairSecOnly(Math.max(0, Math.min(59, Number(e.target.value))))} min={0} max={59} className="h-12 w-16 text-center text-lg [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                  <Button type="button" variant="outline" size="sm" onClick={() => setTempPairSecOnly(Math.max(0, tempPairSecOnly - 1))} className="h-8 w-14 rounded-none border-t-0 p-0">
                    <ChevronDownIcon className="h-5 w-5" />
                  </Button>
                </div>
                <span className="text-base font-medium">秒</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input type="checkbox" id="apply-now" checked={applyNow} onChange={(e) => setApplyNow(e.target.checked)} className="h-4 w-4" />
              <Label htmlFor="apply-now" className="text-sm">現在の工程にも適用</Label>
            </div>
            <Button onClick={handleTimeUpdate} className="w-full">
              <CheckIcon className="mr-2 h-4 w-4" />
              適用
            </Button>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* 工程一覧 */}
      <Collapsible open={showStepsList} onOpenChange={setShowStepsList}>
        <Card className="p-4">
          <CollapsibleTrigger className="flex w-full items-center justify-between">
            <div>
              <span className="font-semibold">工程一覧</span>
              <span className="ml-2 text-sm text-gray-600">({state.currentStepIndex + 1}/{state.steps.length}) 総時間: {formatDuration(totalDuration)}</span>
            </div>
            <ChevronDownIcon className={`h-5 w-5 transition-transform ${showStepsList ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4">
            <div className="max-h-96 space-y-2 overflow-y-auto">
              {state.steps.map((step, index) => (
                <button
                  key={step.id}
                  onClick={() => dispatch({ type: 'JUMP_TO_STEP', index })}
                  className={`w-full rounded-lg border-2 p-3 text-left transition-all ${index === state.currentStepIndex ? 'border-[#7cb342] bg-green-100 shadow-sm' : 'border-transparent bg-gray-50 hover:bg-green-50'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-medium ${index === state.currentStepIndex ? 'text-[#006837]' : 'text-gray-700'}`}>
                      {index + 1}. {renderColoredLabel(step)}
                    </span>
                    <span className="text-sm text-gray-600">{formatTime(step.durationSec)}</span>
                  </div>
                </button>
              ))}
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Wake Lock非対応警告 */}
      {!wakeLockManagerRef.current.isWakeLockSupported() && (
        <Card className="border-yellow-200 bg-yellow-50 p-4">
          <p className="text-sm text-yellow-800">⚠️ このブラウザはスリープ防止機能に対応していません。画面がオフにならないよう設定してください。</p>
        </Card>
      )}

      {/* 完了ダイアログ */}
      <AlertDialog open={showCompletionDialog} onOpenChange={setShowCompletionDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-center text-2xl">おつかれさまでした！</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-center text-base">
              <div>TLはスレッド作成をお願いいたします。</div>
              <div>最後まで交流会をお楽しみください🐾</div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowCompletionDialog(false)} className="bg-[#006837] hover:bg-[#005028]">閉じる</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
