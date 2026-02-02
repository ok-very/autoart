import { CheckCircle } from 'lucide-react';
import { useParams } from 'react-router-dom';

export function SuccessPage() {
  const { uniqueId } = useParams<{ uniqueId: string }>();

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center max-w-md mx-auto px-4">
        <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
        <h1 className="text-xl font-semibold text-slate-900 mb-2">
          Submission Complete
        </h1>
        <p className="text-slate-600 mb-6">
          Thank you! Your form has been submitted successfully.
        </p>
        <a
          href={`/${uniqueId}`}
          className="text-blue-600 hover:underline text-sm"
        >
          Submit another response
        </a>
      </div>
    </div>
  );
}
