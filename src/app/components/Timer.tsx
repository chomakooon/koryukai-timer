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
import { AudioManager, WakeLockManager, type SoundType } from '../lib/audio-wakelock';
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
  Check,
  Volume2,
  VolumeX,
  Music,
  BellRing,
  RadioReceiver,
  PartyPopper,
  AlertTriangle,
  PawPrint
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
    case 'START': {
      if (state.remainingSec <= 0) {
        const nextIndex = state.currentStepIndex + 1;
        if (nextIndex < state.steps.length) {
          return {
            ...state,
            currentStepIndex: nextIndex,
            remainingSec: state.steps[nextIndex].durationSec,
            isRunning: true
          };
        }
        return state;
      }
      return { ...state, isRunning: true };
    }
    case 'PAUSE':
      return { ...state, isRunning: false };
    case 'TICK': {
      if (!state.isRunning || state.remainingSec <= 0) return state;
      const newRemaining = state.remainingSec - 1;
      if (newRemaining <= 0) {
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
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundType, setSoundType] = useState<SoundType>('chime');

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

  useEffect(() => {
    audioManagerRef.current.setSoundEnabled(soundEnabled);
    audioManagerRef.current.setSoundType(soundType);
  }, [soundEnabled, soundType]);

  const handleStart = useCallback(async () => {
    if (!audioInitialized) {
      const success = await audioManagerRef.current.initialize();
      setAudioInitialized(success);
    }
    dispatch({ type: 'START' });
  }, [audioInitialized]);

  const handlePlayTest = useCallback(async (type: SoundType) => {
    if (!audioInitialized) {
      const success = await audioManagerRef.current.initialize();
      setAudioInitialized(success);
      if (!success) return;
    }
    setSoundType(type);
    audioManagerRef.current.setSoundType(type);
    audioManagerRef.current.playFinishSound(true); // force play
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
    const speakerColor = getParticipantColor(step.speaker); // Hex color
    // Determine a darker shadow/text color based on background (simplified logic, using standard Tailwind slate for text)

    if (step.type === 'talk') {
      return (
        <span className="inline-flex items-center gap-2">
          <span className="flex h-10 min-w-[3rem] items-center justify-center rounded-none border-2 border-black text-white font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]" style={{ backgroundColor: speakerColor }}>{step.speaker}</span>
          <span className="font-black inherit-text">発表</span>
        </span>
      );
    }

    const questionerColor = getParticipantColor(step.questioner!);
    return (
      <span className="inline-flex items-center gap-2">
        <span className="flex h-10 min-w-[2.5rem] items-center justify-center rounded-none border-2 border-black text-white font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]" style={{ backgroundColor: speakerColor }}>{step.speaker}</span>
        <span className="font-black mx-1 inherit-text">×</span>
        <span className="flex h-10 min-w-[2.5rem] items-center justify-center rounded-none border-2 border-black text-white font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]" style={{ backgroundColor: questionerColor }}>{step.questioner}</span>
        <span className="font-black ml-1 inherit-text">質問</span>
      </span>
    );
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-2 pt-3">
      {/* 人数選択 */}
      <Card className="border-none p-6 shadow-sm">
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-4 border-b-4 border-black">
            <h3 className="text-xl font-black text-black">テーブル人数</h3>
            <span className="flex h-10 items-center justify-center border-2 border-black bg-white px-4 text-base font-black text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">{state.participantCount}人</span>
          </div>
          <div className="grid grid-cols-4 gap-4">
            {[3, 4, 5, 6].map((count) => (
              <Button
                key={count}
                onClick={() => dispatch({ type: 'SET_PARTICIPANT_COUNT', count })}
                variant={state.participantCount === count ? 'default' : 'outline'}
                className={`h-14 text-lg border-2 ${state.participantCount !== count ? 'text-black bg-white hover:bg-slate-100' : 'text-white'}`}
              >
                {count}人
              </Button>
            ))}
          </div>
        </div>
      </Card>

      {/* メインタイマー */}
      <Card className="bg-[#486756] text-black px-6 py-12 sm:px-10 sm:py-16 relative overflow-hidden">
        {currentStep ? (
          <div className="space-y-8 text-center relative z-10 [&_.inherit-text]:text-black">
            <div className="text-[32px] tracking-[0.2em] font-black drop-shadow-[2px_2px_0px_rgba(255,255,255,0.7)]">{renderColoredLabel(currentStep)}</div>
            <div className="text-[7rem] font-black leading-[0.85] tabular-nums tracking-[0.05em] drop-shadow-[4px_4px_0px_rgba(255,255,255,0.7)] md:text-[11rem]">{formatTime(state.remainingSec)}</div>
            {nextStep && <div className="text-[22px] font-black tracking-wider flex items-center justify-center gap-4 drop-shadow-[2px_2px_0px_rgba(255,255,255,0.7)]"><span className="text-base tracking-[0.1em] bg-white border-2 border-black px-3 py-1 text-black font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">NEXT</span> <div className="flex items-center gap-2">{renderColoredLabel(nextStep)} <span className="text-xl">（{Math.floor(nextStep.durationSec / 60)}分{nextStep.durationSec % 60 > 0 ? `${nextStep.durationSec % 60}秒` : ''}）</span></div></div>}
            {isComplete && <div className="absolute inset-0 bg-[#486756]/90 flex items-center justify-center z-20"><div className="animate-bounce flex items-center text-6xl font-black tracking-widest text-black drop-shadow-[4px_4px_0px_rgba(255,255,255,0.7)]"><PartyPopper className="w-16 h-16 mr-4" /> 完了！</div></div>}
          </div>
        ) : (
          <div className="text-center text-3xl font-black tracking-wider text-black/50">ステップがありません</div>
        )}
      </Card>

      {/* 操作ボタン */}
      <div className="mt-2 grid grid-cols-2 gap-4">
        <Button size="lg" onClick={state.isRunning ? () => dispatch({ type: 'PAUSE' }) : handleStart} className={`col-span-2 h-24 text-4xl tracking-widest ${state.isRunning ? 'bg-[#486756] hover:bg-[#3a5345] text-white' : 'bg-black hover:bg-neutral-800 text-white'}`}>
          {state.isRunning ? (
            <>
              <Pause className="mr-3 h-10 w-10" />
              PAUSE
            </>
          ) : (
            <>
              <Play className="mr-3 h-10 w-10 text-white" fill="currentColor" />
              START
            </>
          )}
        </Button>
        <Button size="lg" variant="outline" onClick={() => dispatch({ type: 'PREV_STEP' })} disabled={state.currentStepIndex === 0} className="h-16 text-xl text-black">
          <SkipBack className="mr-2 h-6 w-6" />
          BACK
        </Button>
        <Button size="lg" variant="outline" onClick={() => dispatch({ type: 'NEXT_STEP' })} disabled={state.currentStepIndex === state.steps.length - 1} className="h-16 text-xl text-black">
          NEXT
          <SkipForward className="ml-2 h-6 w-6" />
        </Button>
        <Button
          size="lg"
          variant="destructive"
          onMouseDown={handleResetMouseDown}
          onMouseUp={handleResetMouseUp}
          onMouseLeave={handleResetMouseUp}
          onTouchStart={handleResetMouseDown}
          onTouchEnd={handleResetMouseUp}
          className={`col-span-2 h-16 text-xl tracking-wider ${isResetting ? 'translate-x-[4px] translate-y-[4px] shadow-none' : ''}`}
        >
          <RotateCcw className="mr-2 h-6 w-6" />
          RESET (HOLD)
        </Button>
      </div>

      {/* 設定パネル */}
      <Collapsible open={showSettings} onOpenChange={setShowSettings}>
        <Card className="p-6 mt-6">
          <CollapsibleTrigger className="flex w-full items-center justify-between text-black hover:opacity-80 transition-opacity">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center border-2 border-black bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <Settings className="h-6 w-6" />
              </div>
              <span className="font-black text-xl">時間・サウンド設定</span>
            </div>
            <ChevronDown className={`h-6 w-6 transition-transform ${showSettings ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-4">
            <div className="space-y-4">
              <Label htmlFor="talk-time" className="font-black text-lg">発表時間</Label>
              <div className="flex items-center justify-center gap-4">
                <div className="flex flex-col items-center gap-1">
                  <Button type="button" variant="outline" size="sm" onClick={() => setTempTalkMin(Math.min(99, tempTalkMin + 1))} className="h-10 w-16 p-0">
                    <ChevronUp className="h-6 w-6" />
                  </Button>
                  <Input id="talk-time-min" type="number" value={tempTalkMin} onChange={(e) => setTempTalkMin(Math.max(0, Number(e.target.value)))} min={0} max={99} className="h-14 w-20 rounded-none border-4 border-black text-center text-xl font-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                  <Button type="button" variant="outline" size="sm" onClick={() => setTempTalkMin(Math.max(0, tempTalkMin - 1))} className="h-10 w-16 p-0">
                    <ChevronDown className="h-6 w-6" />
                  </Button>
                </div>
                <span className="text-xl font-black">分</span>
                <div className="flex flex-col items-center gap-1">
                  <Button type="button" variant="outline" size="sm" onClick={() => setTempTalkSecOnly(Math.min(59, tempTalkSecOnly + 1))} className="h-10 w-16 p-0">
                    <ChevronUp className="h-6 w-6" />
                  </Button>
                  <Input id="talk-time-sec" type="number" value={tempTalkSecOnly} onChange={(e) => setTempTalkSecOnly(Math.max(0, Math.min(59, Number(e.target.value))))} min={0} max={59} className="h-14 w-20 rounded-none border-4 border-black text-center text-xl font-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                  <Button type="button" variant="outline" size="sm" onClick={() => setTempTalkSecOnly(Math.max(0, tempTalkSecOnly - 1))} className="h-10 w-16 p-0">
                    <ChevronDown className="h-6 w-6" />
                  </Button>
                </div>
                <span className="text-xl font-black">秒</span>
              </div>
            </div>

            <div className="space-y-4">
              <Label htmlFor="pair-time" className="font-black text-lg">質問時間</Label>
              <div className="flex items-center justify-center gap-4">
                <div className="flex flex-col items-center gap-1">
                  <Button type="button" variant="outline" size="sm" onClick={() => setTempPairMin(Math.min(99, tempPairMin + 1))} className="h-10 w-16 p-0">
                    <ChevronUp className="h-6 w-6" />
                  </Button>
                  <Input id="pair-time-min" type="number" value={tempPairMin} onChange={(e) => setTempPairMin(Math.max(0, Number(e.target.value)))} min={0} max={99} className="h-14 w-20 rounded-none border-4 border-black text-center text-xl font-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                  <Button type="button" variant="outline" size="sm" onClick={() => setTempPairMin(Math.max(0, tempPairMin - 1))} className="h-10 w-16 p-0">
                    <ChevronDown className="h-6 w-6" />
                  </Button>
                </div>
                <span className="text-xl font-black">分</span>
                <div className="flex flex-col items-center gap-1">
                  <Button type="button" variant="outline" size="sm" onClick={() => setTempPairSecOnly(Math.min(59, tempPairSecOnly + 1))} className="h-10 w-16 p-0">
                    <ChevronUp className="h-6 w-6" />
                  </Button>
                  <Input id="pair-time-sec" type="number" value={tempPairSecOnly} onChange={(e) => setTempPairSecOnly(Math.max(0, Math.min(59, Number(e.target.value))))} min={0} max={59} className="h-14 w-20 rounded-none border-4 border-black text-center text-xl font-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                  <Button type="button" variant="outline" size="sm" onClick={() => setTempPairSecOnly(Math.max(0, tempPairSecOnly - 1))} className="h-10 w-16 p-0">
                    <ChevronDown className="h-6 w-6" />
                  </Button>
                </div>
                <span className="text-xl font-black">秒</span>
              </div>
            </div>

            <div className="space-y-4 pt-6 border-t-4 border-black">
              <div className="flex items-center justify-between">
                <Label className="text-lg font-black text-black">サウンド・通知</Label>
                <Button
                  type="button"
                  variant={soundEnabled ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className={`h-10 font-black border-2 border-black ${soundEnabled ? 'bg-[#486756] text-white' : 'bg-white text-black'} shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]`}
                >
                  {soundEnabled ? <><Volume2 className="mr-2 h-5 w-5" /> ON</> : <><VolumeX className="mr-2 h-5 w-5" /> OFF</>}
                </Button>
              </div>

              {soundEnabled && (
                <div className="grid grid-cols-3 gap-3 mt-4">
                  <Button type="button" variant={soundType === 'chime' ? 'secondary' : 'outline'} size="sm" onClick={() => handlePlayTest('chime')} className={`flex flex-col items-center gap-1.5 h-16 border-2 border-black font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${soundType === 'chime' ? 'bg-[#486756] text-white' : 'bg-white text-black hover:bg-slate-100'}`}>
                    <Music className="h-5 w-5" />
                    チャイム
                  </Button>
                  <Button type="button" variant={soundType === 'bell' ? 'secondary' : 'outline'} size="sm" onClick={() => handlePlayTest('bell')} className={`flex flex-col items-center gap-1.5 h-16 border-2 border-black font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${soundType === 'bell' ? 'bg-[#486756] text-white' : 'bg-white text-black hover:bg-slate-100'}`}>
                    <BellRing className="h-5 w-5" />
                    ベル
                  </Button>
                  <Button type="button" variant={soundType === 'beep' ? 'secondary' : 'outline'} size="sm" onClick={() => handlePlayTest('beep')} className={`flex flex-col items-center gap-1.5 h-16 border-2 border-black font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${soundType === 'beep' ? 'bg-[#486756] text-white' : 'bg-white text-black hover:bg-slate-100'}`}>
                    <RadioReceiver className="h-5 w-5" />
                    ビープ
                  </Button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 pt-6 border-t-4 border-black">
              <input type="checkbox" id="apply-now" checked={applyNow} onChange={(e) => setApplyNow(e.target.checked)} className="h-6 w-6 rounded-none border-2 border-black text-[#486756] focus:ring-[#486756] checked:bg-[#486756] checked:border-black appearance-none" style={{ backgroundColor: applyNow ? '#486756' : 'white' }} />
              <Label htmlFor="apply-now" className="text-lg font-black text-black">現在の工程にも適用</Label>
            </div>
            <Button variant="default" onClick={handleTimeUpdate} className="w-full h-16 text-xl bg-[#486756] text-white font-black border-4 border-black rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-[#3a5345]">
              <Check className="mr-2 h-6 w-6" />
              設定を適用する
            </Button>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* 工程一覧 */}
      <Collapsible open={showStepsList} onOpenChange={setShowStepsList}>
        <Card className="p-6">
          <CollapsibleTrigger className="flex w-full items-center justify-between text-black hover:opacity-80 transition-opacity">
            <div className="flex items-center gap-3">
              <span className="font-black text-xl">工程一覧</span>
              <span className="border-2 border-black bg-white px-3 py-1 text-sm font-black text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">({state.currentStepIndex + 1}/{state.steps.length})</span>
              <span className="text-sm font-black text-black bg-[#edf2ef] px-3 py-1 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">総時間: {formatDuration(totalDuration)}</span>
            </div>
            <ChevronDown className={`h-6 w-6 transition-transform ${showStepsList ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-6">
            <div className="max-h-96 space-y-3 overflow-y-auto pr-2">
              {state.steps.map((step, index) => (
                <button
                  key={step.id}
                  onClick={() => dispatch({ type: 'JUMP_TO_STEP', index })}
                  className={`w-full border-4 border-black p-4 text-left font-black transition-all ${index === state.currentStepIndex ? 'bg-[#486756] text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] translate-x-[2px] translate-y-[2px]' : 'bg-white text-black hover:bg-slate-100 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`flex items-center gap-3 font-black tracking-wider ${index === state.currentStepIndex ? 'text-white [&_.inherit-text]:text-white' : 'text-black'}`}>
                      <span className={`w-8 text-right ${index === state.currentStepIndex ? 'text-white' : 'text-black'}`}>{index + 1}.</span> {renderColoredLabel(step)}
                    </span>
                    <span className={`font-black tracking-[0.1em] text-2xl ${index === state.currentStepIndex ? 'text-white' : 'text-black'}`}>{formatTime(step.durationSec)}</span>
                  </div>
                </button>
              ))}
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Wake Lock非対応警告 */}
      {!wakeLockManagerRef.current.isWakeLockSupported() && (
        <Card className="border-none bg-[#fff8e1] p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-8 w-8 shrink-0 text-[#856404]" />
            <p className="pt-0.5 text-sm font-medium text-[#856404]">このブラウザはスリープ防止機能に対応していません。画面がオフにならないよう端末側で設定してください。</p>
          </div>
        </Card>
      )}

      {/* 完了ダイアログ */}
      <AlertDialog open={showCompletionDialog} onOpenChange={setShowCompletionDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-center text-2xl">おつかれさまでした！</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-center text-base">
              <div>TLはスレッド作成をお願いいたします。</div>
              <div className="flex items-center justify-center">最後まで交流会をお楽しみください<PawPrint className="w-5 h-5 ml-2" /></div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowCompletionDialog(false)} className="bg-[#486756] hover:bg-[#3a5345]">閉じる</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
