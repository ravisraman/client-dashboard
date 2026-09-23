"use client";

export function DeleteClientButton({ action, name }: { action: () => Promise<void>; name: string }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`Remove ${name}'s portal access?`)) e.preventDefault();
      }}
    >
      <button className="btn-danger">Remove client</button>
    </form>
  );
}
