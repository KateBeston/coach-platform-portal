"use client";

import { useState } from "react";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">;

/** A password field that can be shown on purpose, so people can check their own typing. Hidden on every mount. */
export function PasswordInput({ className, ...rest }: Props) {
  const [shown, setShown] = useState(false);
  return (
    <span className="relative block">
      <input {...rest} type={shown ? "text" : "password"} className={`${className ?? "input"} pr-10`} />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShown(!shown)}
        aria-pressed={shown}
        aria-label={shown ? "Hide password" : "Show password"}
        className={`absolute inset-y-0 right-0 flex w-10 items-center justify-center ${shown ? "text-accent" : "text-muted"}`}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M1.7 12S5.5 5.2 12 5.2 22.3 12 22.3 12 18.5 18.8 12 18.8 1.7 12 1.7 12Z" />
          <circle cx="12" cy="12" r="3.1" />
          {!shown && <path d="M4 20 20 4" />}
        </svg>
      </button>
    </span>
  );
}
