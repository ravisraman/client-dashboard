import Link from "next/link";
import Image from "next/image";
import { env } from "@/lib/env";

export function BrandMark({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex shrink-0 items-center gap-2.5 text-ink no-underline hover:text-ink">
      <Image src="/brand/lotus.png" alt="" width={28} height={29} priority unoptimized />
      <span className="font-serif text-lg tracking-[0.13em] uppercase sm:text-xl">{env.brandName()}</span>
    </Link>
  );
}
