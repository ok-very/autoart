import { Routes, Route } from 'react-router-dom';
import { PollPage } from './components/PollPage';
import { ResultsPage } from './components/ResultsPage';
import { NotFoundPage } from './components/NotFoundPage';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Routes>
        <Route path="/:uniqueId" element={<PollPage />} />
        <Route path="/:uniqueId/results" element={<ResultsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </div>
  );
}
