import { Routes, Route } from 'react-router-dom';
import { FormPage } from './components/FormPage';
import { SuccessPage } from './components/SuccessPage';
import { NotFoundPage } from './components/NotFoundPage';

export default function App() {
  return (
    <div className="min-h-screen bg-ws-bg">
      <Routes>
        <Route path="/:uniqueId" element={<FormPage />} />
        <Route path="/:uniqueId/success" element={<SuccessPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </div>
  );
}
