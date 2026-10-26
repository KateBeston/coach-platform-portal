/** The frame shared by sign-in, reset and join: a brand panel and a form card. No portal shell. */
export function AuthShell({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="hidden flex-col justify-between bg-ink p-10 text-white md:flex">
        <div>
          <p className="font-serif text-2xl">Coach Platform</p>
          <p className="text-xs tracking-[0.2em] text-white/50 uppercase">Internal portal</p>
        </div>
        <blockquote className="max-w-sm">
          <p className="font-serif text-3xl leading-tight">The business behind the businesses.</p>
          <p className="mt-3 text-sm text-white/60">Staff only. Coaches sign in to the coach app.</p>
        </blockquote>
        <p className="text-xs text-white/40">Internal use only</p>
      </aside>
      <main className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-6 md:hidden">
            <p className="font-serif text-xl">Coach Platform</p>
            <p className="text-xs tracking-[0.2em] text-muted uppercase">Internal portal</p>
          </div>
          {title && <h1 className="mb-6 text-3xl">{title}</h1>}
          {children}
        </div>
      </main>
    </div>
  );
}

export function Note({ bad, children }: { bad?: boolean; children: React.ReactNode }) {
  return (
    <p className={`rounded-lg px-3 py-2 text-sm ${bad ? "bg-warn-soft text-warn" : "bg-accent-soft text-accent"}`}>{children}</p>
  );
}
