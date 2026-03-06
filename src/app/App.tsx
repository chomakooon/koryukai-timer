import { ExternalLinkIcon } from 'lucide-react';
import { Timer } from './components/Timer';
import { Button } from './components/ui/button';
import { Card } from './components/ui/card';

export default function App() {
  const surveyUrl = import.meta.env.VITE_SURVEY_URL || 'https://docs.google.com/forms/d/e/1FAIpQLScaI2cxf_R1Aio_tTPMNkm7FiyhNHg1Y6Jz-O9hxeZtVdddNg/viewform';

  const handleSurveyClick = () => {
    window.open(surveyUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-lime-50 px-4 py-3">
      <div className="mx-auto max-w-4xl space-y-4">
        <header className="space-y-2 text-center">
          <h1 className="text-[24px] font-bold text-[#006837] drop-shadow-sm">進行アシスト</h1>
        </header>

        {/* 1. 交流会情報 */}
        <Card className="border-2 border-green-100 bg-white p-5 shadow-lg">
          <h2 className="mb-3 text-xl font-bold text-[#006837]">📋 交流会について</h2>
          <div className="space-y-1 text-sm text-gray-700">
            <p><strong className="text-[#006837]">A</strong> = テーブルリーダー（発表は最後、質問は最初）</p>
            <p><strong className="text-[#006837]">発表順:</strong> B→C→…→A（リーダーが最後）</p>
            <p><strong className="text-[#006837]">質問順:</strong> A優先 → その他メンバー（リーダー発表時はB→C→…）</p>
            <p className="mt-3 rounded-lg border-l-4 border-yellow-400 bg-yellow-50 p-3 text-sm">
              ⚠️ タイマー開始前に必ず「開始」ボタンを押して、音声・スリープ防止を有効化してください。
            </p>
          </div>
        </Card>

        {/* 2. タイマー */}
        <Timer />

        {/* 3. 参加後アンケート */}
        <Card className="border-2 border-green-200 bg-gradient-to-r from-[#7cb342] to-[#8bc34a] p-6 shadow-lg transition-all hover:shadow-xl">
          <h2 className="mb-4 text-2xl font-bold text-white drop-shadow">📝 参加後アンケート</h2>
          <p className="mb-4 text-white drop-shadow-sm">交流会終了後、ぜひご感想をお聞かせください！</p>
          <Button onClick={handleSurveyClick} variant="outline" className="border-white bg-white/95 text-[#006837] hover:bg-white">
            アンケートを開く
            <ExternalLinkIcon className="h-4 w-4" />
          </Button>
        </Card>

        <footer className="pb-8 text-center text-sm text-[#4a7c59]">
          <p>© 2026 交流会進行アシスタント v1.0</p>
          <p className="mt-1">オフラインでも動作します（PWA）🚀</p>
        </footer>
      </div>
    </div>
  );
}
