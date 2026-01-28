import { Routes, Route } from 'react-router-dom';
import { PollPage } from './components/PollPage';
import { ResultsPage } from './components/ResultsPage';
import { NotFoundPage } from './components/NotFoundPage';

export default function App() {
  return (
    <div className="min-h-screen bg-[#F5F2ED]">
      <Routes>
        <Route path="/:uniqueId" element={<PollPage />} />
        <Route path="/:uniqueId/results" element={<ResultsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </div>
  );
}
