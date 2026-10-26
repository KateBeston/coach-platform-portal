import { signIn } from "./actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <p className="mb-1 text-xs font-medium tracking-widest text-muted uppercase">Internal portal</p>
        <h1 className="mb-6 text-3xl">Sign in</h1>
        {error && <p className="mb-4 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">{error}</p>}
        <form action={signIn} className="card space-y-4">
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input className="input" id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input className="input" id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          <button className="btn w-full">Sign in</button>
        </form>
        <p className="mt-4 text-center text-xs text-muted">Staff only. Use the same login as the coach app.</p>
      </div>
    </main>
  );
}
