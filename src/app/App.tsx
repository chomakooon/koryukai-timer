import { ClipboardList, AlertTriangle, Sparkles, Rocket } from 'lucide-react';
import { Timer } from './components/Timer';
import { Card } from './components/ui/card';

export default function App() {
  return (
    <div className="min-h-screen px-4 py-8 font-black text-black">
      <div className="mx-auto max-w-3xl space-y-12">
        <header className="space-y-4 text-center">
          <div className="mx-auto h-28 w-28 overflow-hidden rounded-none border-4 border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center">
            <img src="/logo-dog.jpg" alt="アシスタントキャラクター" className="h-[90%] w-[90%] object-contain" />
          </div>
          <h1 className="text-4xl font-black tracking-[0.2em] text-[#486756] drop-shadow-[2px_2px_0px_rgba(0,0,0,1)] md:text-5xl">進行アシスタント</h1>
        </header>

        {/* 1. タイマー */}
        <Timer />

        {/* 2. 交流会情報 */}
        <Card className="p-8">
          <h2 className="mb-6 flex items-center border-b-4 border-black pb-4 text-2xl font-black uppercase text-black">
            <ClipboardList className="mr-3 h-8 w-8" />
            交流会について
          </h2>
          <div className="space-y-4 text-lg text-black leading-relaxed">
            <p><span className="inline-block bg-[#486756] text-white px-2 py-1 mr-2 border-2 border-black">A</span> テーブルリーダー（発表は最後、質問は最初）</p>
            <p><span className="inline-block border-2 border-black px-2 py-1 mr-2 bg-white">発表順</span> B → C → … → A（リーダーが最後）</p>
            <p><span className="inline-block border-2 border-black px-2 py-1 mr-2 bg-white">質問順</span> A優先 → その他メンバー（C → D → …）</p>
            <div className="mt-8 flex items-start gap-4 border-4 border-black bg-[#486756] p-5 text-base text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <AlertTriangle className="h-8 w-8 shrink-0" />
              <p className="pt-0.5 font-bold">タイマー開始前に必ずマナーモードを解除してください。</p>
            </div>
          </div>
        </Card>

        {/* 3. お礼メッセージ */}
        <Card className="p-8 text-center space-y-8">
          <div className="space-y-6">
            <p className="text-black font-bold text-lg leading-relaxed">
              お疲れ様でした。<br />
              いつもご参加いただきありがとうございます！<br />
              <span className="inline-flex items-center">これからも当支部をどうぞよろしくお願いいたします。<Sparkles className="ml-1 h-5 w-5" /></span>
            </p>
          </div>
        </Card>

        {/* 3. プロモーションメッセージ */}
        <div className="text-center space-y-2 py-4">
          <p className="text-lg font-black text-black">
            このタイマーは、よろしければご自由にお使いください。
          </p>
          <p className="text-base font-bold text-black opacity-80">
            ※自支部用にオリジナルデザインで利用したい場合はお気軽にご相談ください！
          </p>
          <p className="text-base font-bold text-black opacity-80">
            ご相談は
            <a
              href="https://m.facebook.com/profile.php?id=100028151854122"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline"
            >
              岡崎
            </a>
            まで
          </p>
        </div>

        {/* 3. 猫キャラクター */}
        <div className="flex justify-center pt-4">
          <div className="h-28 w-28 overflow-hidden rounded-none border-4 border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center">
            <img src="/logo-cat.png" alt="アシスタントキャラクター 猫" className="h-[90%] w-[90%] object-contain" />
          </div>
        </div>
      </div>
      <footer className="pb-8 pt-4 text-center text-base font-bold text-black border-t-4 border-black">
        <p>© 2026 交流会進行アシスタント v1.0</p>
        <p className="mt-2 text-sm uppercase flex items-center justify-center">オフライン動作対応（PWA）<Rocket className="ml-1 h-4 w-4" /></p>
      </footer>
    </div>
  );
}
