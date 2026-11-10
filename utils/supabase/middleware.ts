import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * Refresh auth cookies on each request. Call from root `middleware.ts`.
 * `requestHeaders` is forwarded so server code can read the route name.
 */
export async function updateSession(request: NextRequest, requestHeaders?: Headers) {
  const forwarded = requestHeaders ? { request: { headers: requestHeaders } } : { request };
  let supabaseResponse = NextResponse.next(forwarded);

  if (!supabaseUrl || !supabaseKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next(forwarded);
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // Important: refreshes the session if expired
  await supabase.auth.getUser();

  return supabaseResponse;
}
