"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Profile } from "@/lib/types";

const TABS = [
  { label: "Status Board", href: "/dashboard/status" },
  { label: "Harvest Schedule", href: "/dashboard/schedule" },
  { label: "Dashboard", href: "/dashboard" },
  { label: "Room Analysis", href: "/dashboard/room-analysis" },
  { label: "Cycle Analysis", href: "/dashboard/cycle-analysis" },
];

export function Navbar({ profile }: { profile: Profile }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="text-lg font-bold text-green-700">
              Harvest Tracker
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
        {/* Tab Bar */}
        <div className="flex gap-1 -mb-px">
          {TABS.map((tab) => {
            const isActive =
              tab.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? "border-green-600 text-green-700"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
