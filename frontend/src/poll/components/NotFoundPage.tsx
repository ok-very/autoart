export function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="text-center">
        <h1 className="mb-2 text-4xl font-bold text-slate-900">404</h1>
        <p className="mb-4 text-slate-600">Poll not found</p>
        <p className="text-sm text-slate-500">
          The poll you're looking for doesn't exist or has been closed.
        </p>
      </div>
    </div>
  );
}
