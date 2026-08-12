import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 py-16 text-center">
      <p className="label-mono text-accent">404</p>
      <h1 className="text-display mt-2">Page not found</h1>
      <p className="mt-3 text-sm text-muted">
        The page you're looking for doesn't exist or has moved.
      </p>
      <Link
        to="/"
        className="mt-8 inline-flex h-10 items-center justify-center rounded-pill bg-accent px-6 text-sm font-medium text-accent-ink transition-all duration-150 ease-out-expo hover:bg-accent-2 active:bg-accent-2"
      >
        Back to dashboard
      </Link>
    </main>
  );
}