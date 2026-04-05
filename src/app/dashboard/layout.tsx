import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/ui/navbar";
import { Profile } from "@/lib/types";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  let { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // Retry once — RLS policies may not be ready immediately after login
  if (!profile) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const { data: retryProfile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    profile = retryProfile;
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900">
            Unable to load profile
          </h2>
          <p className="mt-2 text-gray-600">
            Your profile could not be found. This is usually caused by a
            missing Row Level Security policy on the profiles table. Please
            contact an administrator.
          </p>
          <form action="/api/auth/signout" method="post">
            <button
              type="submit"
              className="mt-4 px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar profile={profile as Profile} />
      <main className="max-w-7xl mx-auto py-6 px-4">{children}</main>
    </div>
  );
}
