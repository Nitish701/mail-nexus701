'use client';

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="workspace-error" role="alert">
      <div>
        <h1>We couldn’t load this page</h1>
        <p>The Mail Nexus service did not return the requested data. Check the connection and try again.</p>
      </div>
      <button type="button" className="btn btn-primary" onClick={reset}>Try again</button>
    </main>
  );
}
