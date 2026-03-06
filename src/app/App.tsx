import { ExternalLink } from 'lucide-react';
import { Timer } from './components/Timer';
import { Button } from './components/ui/button';
import { Card } from './components/ui/card';

export default function App() {
  const surveyUrl = import.meta.env.VITE_SURVEY_URL || 'https://docs.google.com/forms/d/e/1FAIpQLScaI2cxf_R1Aio_tTPMNkm7FiyhNHg1Y6Jz-O9hxeZtVdddNg/viewform';

  const handleSurveyClick = () => {
    window.open(surveyUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen bg-dotted px-4 py-8 text-black selection:bg-primary selection:text-black">
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="text-center">
          <h1 className="text-5xl font-black tracking-tighter uppercase mb-2 md:text-7xl">進行アシスト</h1>
        </header>

        {/* 1. 交流会情報 */}
        <Card className="border-4 border-black bg-white p-6 shadow-brutal rounded-none">
          <h2 className="mb-4 text-2xl font-black uppercase tracking-tight">📋 交流会について</h2>
          <div className="space-y-2 text-base font-medium">
            <p><strong className="bg-primary px-2 py-0.5 border-2 border-black">A</strong> = テーブルリーダー（発表は最後、質問は最初）</p>
            <p><strong>発表順:</strong> B → C → … → A（リーダーが最後）</p>
            <p><strong>質問順:</strong> A優先 → その他メンバー（リーダー発表時はB→C→…）</p>
            <p className="mt-4 border-4 border-black bg-primary p-4 font-bold shadow-brutal-sm">
              ⚠️ タイマー開始前に必ず「開始」ボタンを押して、音声・スリープ防止を有効化してください。
            </p>
          </div>
        </Card>

        {/* 2. タイマー */}
        <Timer />

        {/* 3. 参加後アンケート */}
        <Card className="border-4 border-black bg-primary p-8 shadow-brutal rounded-none text-black transition-transform hover:-translate-y-1 hover:shadow-brutal-lg">
          <h2 className="mb-4 text-3xl font-black uppercase tracking-tight">📝 参加後アンケート</h2>
          <p className="mb-6 font-medium text-lg">交流会終了後、ぜひご感想をお聞かせください！</p>
          <Button variant="outline" onClick={handleSurveyClick} className="h-14 w-full md:w-auto text-lg rounded-none">
            アンケートを開く
            <ExternalLink className="ml-2 h-5 w-5 border-l-2 border-black pl-2" />
          </Button>
        </Card>

        <footer className="pb-8 text-center text-sm font-medium">
          <p className="border-2 border-black inline-block px-4 py-2 bg-white shadow-brutal-sm">© 2026 交流会進行アシスタント v1.0</p>
          <p className="mt-1">オフラインでも動作します（PWA）🚀</p>
        </footer>
      </div>
    </div>
  );
}
