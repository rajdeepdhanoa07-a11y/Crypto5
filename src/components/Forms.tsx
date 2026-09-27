'use client';
import { useFormState, useFormStatus } from 'react-dom';

type R = { ok: boolean; error?: string; message?: string } | undefined;

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return <button className="btn-amber btn-sm" disabled={pending}>{pending ? 'Saving…' : children}</button>;
}

export function ActionForm({ action, submit, children, className = 'space-y-3' }: { action: (s: R, f: FormData) => Promise<R>; submit: string; children: React.ReactNode; className?: string }) {
  const [state, formAction] = useFormState(action, undefined);
  return (
    <form action={formAction} className={className}>
      {children}
      {state?.error && <p role="alert" className="text-sm text-down">{state.error}</p>}
      {state?.ok && state.message && <p role="status" className="text-sm text-up">{state.message}</p>}
      <Submit>{submit}</Submit>
    </form>
  );
}

/** Coin chooser backed by the scanned universe. The submitted value is the CoinGecko id. */
export function CoinPicker({ coins, name = 'coinId', id = 'coin', defaultValue }: { coins: { id: string; label: string }[]; name?: string; id?: string; defaultValue?: string }) {
  return (
    <>
      <input id={id} name={name} list={`${id}-list`} className="input" placeholder="Type a coin id, e.g. bitcoin" required defaultValue={defaultValue} autoComplete="off" />
      <datalist id={`${id}-list`}>{coins.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</datalist>
    </>
  );
}
