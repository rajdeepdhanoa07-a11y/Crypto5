'use client';
import { useFormState } from 'react-dom';
import { login } from '../actions/auth';

export default function Login() {
  const [state, action] = useFormState(login, undefined);
  return (
    <main className="flex min-h-[80vh] items-center justify-center px-4">
      <form action={action} className="panel w-full max-w-sm space-y-4 p-6">
        <p className="font-mono text-sm font-bold tracking-widest text-amber">CRYPTO 5</p>
        <h1 className="text-lg font-semibold">Enter password</h1>
        {state?.error && <p role="alert" className="text-sm text-down">{state.error}</p>}
        <input name="password" type="password" className="input" autoFocus required aria-label="Password" />
        <button className="btn-amber w-full">Open scanner</button>
      </form>
    </main>
  );
}
