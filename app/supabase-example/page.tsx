import { createClient } from "@/utils/supabase/server";

/**
 * Example only: reads `todos` if the table exists. Remove or protect this route in production.
 * Main marketing page remains `app/page.tsx`.
 */
export default async function SupabaseExamplePage() {
  let rows: { id: number; name?: string }[] | null = null;
  let error: string | null = null;

  try {
    const supabase = await createClient();
    const { data, error: qError } = await supabase.from("todos").select("id, name");
    if (qError) {
      error = qError.message;
    } else {
      rows = data;
    }
  } catch (e) {
    error = e instanceof Error ? e.message : "Supabase not configured";
  }

  return (
    <div className="mx-auto max-w-lg p-8 font-sans">
      <h1 className="text-xl font-bold">Supabase example</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Create a <code className="rounded bg-neutral-100 px-1">todos</code> table in
        Supabase or expect an error below.
      </p>
      {error ? (
        <pre className="mt-4 whitespace-pre-wrap rounded border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          {error}
        </pre>
      ) : (
        <ul className="mt-4 list-inside list-disc">
          {rows?.map((todo) => (
            <li key={todo.id}>{todo.name ?? todo.id}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
