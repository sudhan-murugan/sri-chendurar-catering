"use client";
import Link from "next/link";
import { Icon, PageTitle } from "@/components/ui";
import { t } from "@/lib/i18n";

const ITEMS = [
  { href: "/dishes/", icon: "dish", label: t.nav.dishes },
  { href: "/combos/", icon: "combo", label: t.nav.combos },
  { href: "/shopping-list/", icon: "list", label: t.nav.shopping },
  { href: "/settings/#expenses", icon: "wallet", label: t.nav.expenses },
  { href: "/settings/", icon: "settings", label: t.nav.settings },
  { href: "/settings/#backup", icon: "download", label: t.nav.backup },
];

export default function MorePage() {
  return (
    <>
      <PageTitle title={t.nav.more} />
      <ul className="card divide-y divide-[var(--line)] overflow-hidden">
        {ITEMS.map((i) => (
          <li key={i.href}>
            <Link href={i.href} className="flex min-h-16 items-center gap-4 px-4 text-lg font-semibold active:bg-black/5">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-100">
                <Icon name={i.icon} />
              </span>
              <span className="flex-1">{i.label}</span>
              <Icon name="right" className="text-muted" />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
