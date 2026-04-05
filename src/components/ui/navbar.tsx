"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Profile } from "@/lib/types";

export function Navbar({ profile }: { profile: Profile }) {
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="text-lg font-bold text-green-700">
            Harvest Tracker
          </Link>
          <Link
            href="/dashboard"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Dashboard
          </Link>
          {profile.role === "admin" && (
            <Link
              href="/admin/config"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Config
            </Link>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            {profile.email}{" "}
            <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800">
              {profile.role}
            </span>
          </span>
          <button
            onClick={handleSignOut}
            className="text-sm text-gray-600 hover:text-red-600"
          >
            Sign out
          </button>
        </div>
      </div>
    </nav>
  );
}
