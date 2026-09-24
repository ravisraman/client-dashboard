import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { Header } from "@/components/header";
import { requireAdmin } from "@/lib/session";
import { getDb } from "@/db";
import { user } from "@/db/schema";
import { env } from "@/lib/env";
import { getClientEmails } from "@/lib/client-emails";
import { deleteClientAction, updateClientAction } from "../actions";
import { ClientForm } from "../client-form";
import { DeleteClientButton } from "./delete-button";

export const dynamic = "force-dynamic";

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  const client = await getDb()
    .select()
    .from(user)
    .where(and(eq(user.id, id), eq(user.role, "client")))
    .get();
  if (!client) notFound();
  const [, ...extraEmails] = await getClientEmails(client);

  return (
    <>
      <Header user={admin} />
      <main className="mx-auto max-w-3xl space-y-8 px-5 py-10 sm:px-12">
        <Link href="/admin/clients" className="link text-sm">
          ← All clients
        </Link>
        <section className="card">
          <h1 className="mb-4 text-3xl">{client.name}</h1>
          <ClientForm
            action={updateClientAction.bind(null, client.id)}
            initial={{ ...client, bookingEmails: extraEmails.join("\n") }}
            showStripe={env.stripeEnabled()}
            submitLabel="Save changes"
          />
        </section>
        <section className="card border-accent-soft">
          <h2 className="text-2xl text-accent">Remove client</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Removes their portal access immediately. Their Cal.com bookings and Stripe records are not affected.
          </p>
          <div className="mt-3">
            <DeleteClientButton action={deleteClientAction.bind(null, client.id)} name={client.name} />
          </div>
        </section>
      </main>
    </>
  );
}
