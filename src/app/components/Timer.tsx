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
  Play,
  Pause,
  SkipForward,
  SkipBack,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Settings,
  Check
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
    const speakerColor = getParticipantColor(step.speaker); // Will use as background

    if (step.type === 'talk') {
      return (
        <div className="inline-flex items-center gap-2">
          <span style={{ backgroundColor: speakerColor }} className="border-4 border-black px-4 py-1 text-black shadow-brutal-sm font-black text-3xl md:text-5xl">
            {step.speaker}
          </span>
          <span className="font-black text-2xl md:text-4xl uppercase">発表</span>
        </div>
      );
    }

    const questionerColor = getParticipantColor(step.questioner!);
    return (
      <div className="inline-flex items-center gap-2">
        <span style={{ backgroundColor: speakerColor }} className="border-4 border-black px-3 py-1 text-black shadow-brutal-sm font-black text-2xl md:text-4xl">
          {step.speaker}
        </span>
        <span className="font-black text-xl md:text-3xl mx-1">×</span>
        <span style={{ backgroundColor: questionerColor }} className="border-4 border-black px-3 py-1 text-black shadow-brutal-sm font-black text-2xl md:text-4xl">
          {step.questioner}
        </span>
        <span className="font-black text-2xl md:text-4xl uppercase ml-1">質問</span>
      </div>
    );
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 p-2 pt-4">
      {/* 人数選択 */}
      <Card className="border-4 border-black bg-white p-6 shadow-brutal rounded-none">
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b-4 border-black pb-2">
            <h3 className="text-xl font-black uppercase">テーブル人数</h3>
            <span className="text-2xl font-black bg-primary border-2 border-black px-3 py-1">{state.participantCount} 人</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[3, 4, 5, 6].map((count) => (
              <Button
                key={count}
                onClick={() => dispatch({ type: 'SET_PARTICIPANT_COUNT', count })}
                variant="outline"
                className={
                  state.participantCount === count
                    ? 'h-14 border-4 border-black bg-primary text-black font-black text-xl shadow-brutal-sm rounded-none active-brutal'
                    : 'h-14 border-4 border-black bg-white text-black font-bold text-lg shadow-brutal-sm rounded-none active-brutal hover:bg-gray-100'
                }
              >
                {count} 人
              </Button>
            ))}
          </div>
        </div>
      </Card>

      {/* メインタイマー */}
      <Card className="border-4 border-black bg-primary px-4 py-12 md:py-16 shadow-brutal-lg rounded-none relative overflow-hidden">
        {currentStep ? (
          <div className="space-y-8 flex flex-col items-center justify-center text-center relative z-10">
            <div className="mb-4">{renderColoredLabel(currentStep)}</div>
            <div className="text-[7rem] leading-[0.8] md:text-[14rem] font-black tabular-nums tracking-tighter text-black my-4 mix-blend-multiply">
              {formatTime(state.remainingSec)}
            </div>
            {nextStep && (
              <div className="mt-8 pt-6 border-t-4 border-black w-full flex items-center justify-center gap-4">
                <span className="bg-black text-white px-3 py-1 font-bold uppercase text-xl">NEXT</span>
                <div className="scale-75 origin-left">{renderColoredLabel(nextStep)}</div>
              </div>
            )}
            {isComplete && <div className="absolute inset-0 bg-primary flex items-center justify-center animate-pulse z-20"><span className="text-6xl md:text-8xl font-black text-black border-8 border-black bg-white px-8 py-4 shadow-brutal-lg rotate-[-5deg]">🎉 完了！</span></div>}
          </div>
        ) : (
          <div className="text-center text-3xl font-black text-black">ステップがありません</div>
        )}
      </Card>

      {/* 操作ボタン */}
      <div className="grid grid-cols-2 gap-4 md:gap-6 mt-8">
        <Button size="lg" variant="black" onClick={state.isRunning ? () => dispatch({ type: 'PAUSE' }) : handleStart} className="col-span-2 h-24 md:h-32 text-3xl md:text-5xl font-black uppercase active-brutal-lg shadow-brutal-lg rounded-none flex items-center justify-center gap-4">
          {state.isRunning ? (
            <>
              <Pause className="h-10 w-10 md:h-14 md:w-14" />
              PAUSE
            </>
          ) : (
            <>
              <Play className="h-10 w-10 md:h-14 md:w-14" />
              START
            </>
          )}
        </Button>
        <Button size="lg" variant="outline" onClick={() => dispatch({ type: 'PREV_STEP' })} disabled={state.currentStepIndex === 0} className="h-16 md:h-20 text-xl md:text-2xl font-black border-4 border-black bg-white text-black active-brutal shadow-brutal-sm rounded-none hover:bg-gray-100">
          <SkipBack className="mr-2 h-6 w-6 md:h-8 md:w-8" />
          BACK
        </Button>
        <Button size="lg" variant="outline" onClick={() => dispatch({ type: 'NEXT_STEP' })} disabled={state.currentStepIndex === state.steps.length - 1} className="h-16 md:h-20 text-xl md:text-2xl font-black border-4 border-black bg-white text-black active-brutal shadow-brutal-sm rounded-none hover:bg-gray-100">
          NEXT
          <SkipForward className="ml-2 h-6 w-6 md:h-8 md:w-8" />
        </Button>
        <Button
          size="lg"
          variant="destructive"
          onMouseDown={handleResetMouseDown}
          onMouseUp={handleResetMouseUp}
          onMouseLeave={handleResetMouseUp}
          onTouchStart={handleResetMouseDown}
          onTouchEnd={handleResetMouseUp}
          className={`col-span-2 h-16 md:h-20 text-xl md:text-2xl font-black border-4 border-black bg-destructive text-white active-brutal shadow-brutal-sm rounded-none transition-transform ${isResetting ? 'scale-95' : ''}`}
        >
          <RotateCcw className="mr-2 h-6 w-6 md:h-8 md:w-8" />
          RESET (HOLD)
        </Button>
      </div>

      {/* 設定パネル */}
      <Collapsible open={showSettings} onOpenChange={setShowSettings}>
        <Card className="border-4 border-black bg-white p-6 shadow-brutal rounded-none mb-4 mt-8">
          <CollapsibleTrigger className="flex w-full items-center justify-between font-black text-xl md:text-2xl uppercase">
            <div className="flex items-center gap-2">
              <Settings className="h-6 w-6 md:h-8 md:w-8" />
              <span>時間設定</span>
            </div>
            <ChevronDown className={`h-6 w-6 md:h-8 md:w-8 transition-transform ${showSettings ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="talk-time">発表時間</Label>
              <div className="flex items-center justify-center gap-4">
                <div className="flex flex-col items-center gap-1">
                  <Button type="button" variant="outline" size="sm" onClick={() => setTempTalkMin(Math.min(99, tempTalkMin + 1))} className="h-8 w-14 rounded-none border-t-2 border-x-2 border-b-0 border-black p-0 bg-gray-100 hover:bg-gray-200">
                    <ChevronUp className="h-5 w-5" />
                  </Button>
                  <Input id="talk-time-min" type="number" value={tempTalkMin} onChange={(e) => setTempTalkMin(Math.max(0, Number(e.target.value)))} min={0} max={99} className="h-12 w-16 text-center text-lg font-bold border-2 border-black rounded-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                  <Button type="button" variant="outline" size="sm" onClick={() => setTempTalkMin(Math.max(0, tempTalkMin - 1))} className="h-8 w-14 rounded-none border-b-2 border-x-2 border-t-0 border-black p-0 bg-gray-100 hover:bg-gray-200">
                    <ChevronDown className="h-5 w-5" />
                  </Button>
                </div>
                <span className="text-base font-medium">分</span>
                <div className="flex flex-col items-center gap-1">
                  <Button type="button" variant="outline" size="sm" onClick={() => setTempTalkSecOnly(Math.min(59, tempTalkSecOnly + 1))} className="h-8 w-14 rounded-none border-t-2 border-x-2 border-b-0 border-black p-0 bg-gray-100 hover:bg-gray-200">
                    <ChevronUp className="h-5 w-5" />
                  </Button>
                  <Input id="talk-time-sec" type="number" value={tempTalkSecOnly} onChange={(e) => setTempTalkSecOnly(Math.max(0, Math.min(59, Number(e.target.value))))} min={0} max={59} className="h-12 w-16 text-center text-lg font-bold border-2 border-black rounded-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                  <Button type="button" variant="outline" size="sm" onClick={() => setTempTalkSecOnly(Math.max(0, tempTalkSecOnly - 1))} className="h-8 w-14 rounded-none border-b-2 border-x-2 border-t-0 border-black p-0 bg-gray-100 hover:bg-gray-200">
                    <ChevronDown className="h-5 w-5" />
                  </Button>
                </div>
                <span className="text-base font-medium">秒</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pair-time">質問時間</Label>
              <div className="flex items-center justify-center gap-4">
                <div className="flex flex-col items-center gap-1">
                  <Button type="button" variant="outline" size="sm" onClick={() => setTempPairMin(Math.min(99, tempPairMin + 1))} className="h-8 w-14 rounded-none border-t-2 border-x-2 border-b-0 border-black p-0 bg-gray-100 hover:bg-gray-200">
                    <ChevronUp className="h-5 w-5" />
                  </Button>
                  <Input id="pair-time-min" type="number" value={tempPairMin} onChange={(e) => setTempPairMin(Math.max(0, Number(e.target.value)))} min={0} max={99} className="h-12 w-16 text-center text-lg font-bold border-2 border-black rounded-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                  <Button type="button" variant="outline" size="sm" onClick={() => setTempPairMin(Math.max(0, tempPairMin - 1))} className="h-8 w-14 rounded-none border-b-2 border-x-2 border-t-0 border-black p-0 bg-gray-100 hover:bg-gray-200">
                    <ChevronDown className="h-5 w-5" />
                  </Button>
                </div>
                <span className="text-base font-medium">分</span>
                <div className="flex flex-col items-center gap-1">
                  <Button type="button" variant="outline" size="sm" onClick={() => setTempPairSecOnly(Math.min(59, tempPairSecOnly + 1))} className="h-8 w-14 rounded-none border-t-2 border-x-2 border-b-0 border-black p-0 bg-gray-100 hover:bg-gray-200">
                    <ChevronUp className="h-5 w-5" />
                  </Button>
                  <Input id="pair-time-sec" type="number" value={tempPairSecOnly} onChange={(e) => setTempPairSecOnly(Math.max(0, Math.min(59, Number(e.target.value))))} min={0} max={59} className="h-12 w-16 text-center text-lg font-bold border-2 border-black rounded-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                  <Button type="button" variant="outline" size="sm" onClick={() => setTempPairSecOnly(Math.max(0, tempPairSecOnly - 1))} className="h-8 w-14 rounded-none border-b-2 border-x-2 border-t-0 border-black p-0 bg-gray-100 hover:bg-gray-200">
                    <ChevronDown className="h-5 w-5" />
                  </Button>
                </div>
                <span className="text-base font-medium">秒</span>
              </div>
            </div>

            <div className="flex flex-col gap-4 mt-6 border-t-4 border-black pt-4">
              <div className="flex items-center gap-3">
                <input type="checkbox" id="apply-now" checked={applyNow} onChange={(e) => setApplyNow(e.target.checked)} className="h-6 w-6 border-2 border-black accent-black" />
                <Label htmlFor="apply-now" className="text-base font-bold">現在の工程にも適用</Label>
              </div>
              <Button variant="black" onClick={handleTimeUpdate} className="w-full h-14 font-black text-xl rounded-none uppercase">
                <Check className="mr-2 h-6 w-6" />
                適用
              </Button>
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* 工程一覧 */}
      <Collapsible open={showStepsList} onOpenChange={setShowStepsList}>
        <Card className="border-4 border-black bg-white p-6 shadow-brutal rounded-none">
          <CollapsibleTrigger className="flex w-full items-center justify-between font-black text-xl md:text-2xl uppercase">
            <div className="flex items-center gap-3 flex-wrap">
              <span>工程一覧</span>
              <span className="text-sm md:text-base font-bold bg-gray-200 border-2 border-black px-2 py-1">({state.currentStepIndex + 1}/{state.steps.length})</span>
              <span className="text-sm md:text-base font-bold">総時間: {formatDuration(totalDuration)}</span>
            </div>
            <ChevronDown className={`h-6 w-6 md:h-8 md:w-8 transition-transform ${showStepsList ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4">
            <div className="max-h-96 space-y-2 overflow-y-auto">
              {state.steps.map((step, index) => (
                <button
                  key={step.id}
                  onClick={() => dispatch({ type: 'JUMP_TO_STEP', index })}
                  className={`w-full border-4 border-black p-4 text-left transition-all font-bold active-brutal shadow-brutal-sm mb-3 rounded-none ${index === state.currentStepIndex ? 'bg-primary border-black' : 'bg-white hover:bg-gray-100'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 origin-left scale-75 md:scale-100">
                      <span className="text-xl bg-black text-white px-2 py-1">{index + 1}</span>
                      {renderColoredLabel(step)}
                    </div>
                    <span className="text-xl font-black bg-white border-2 border-black px-2 py-1">{formatTime(step.durationSec)}</span>
                  </div>
                </button>
              ))}
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Wake Lock非対応警告 */}
      {!wakeLockManagerRef.current.isWakeLockSupported() && (
        <Card className="border-4 border-black bg-yellow-400 p-4 shadow-brutal font-bold text-black rounded-none">
          <p className="text-base uppercase flex items-center gap-2">⚠️ <span className="underline decoration-2 underline-offset-4">このブラウザはスリープ防止機能非対応です</span>。画面がオフにならないよう端末側で設定してください。</p>
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
