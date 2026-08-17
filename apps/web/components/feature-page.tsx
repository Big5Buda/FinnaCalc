import Link from "next/link"
import type { Metadata } from "next"
import { MENUS } from "@/lib/nav"
import {
    FAMILY_GROUND,
    FEATURE_PAGES,
    SECTION_INDEXES,
    type FeaturePage,
    type SectionIndex,
} from "@/lib/feature-pages"
import { Pill } from "@/components/site"
import { signUpUrl } from "@/lib/app-url"
import { cn } from "@/lib/utils"

/**
 * The renderer behind every feature page the nav promises.
 *
 * Shape, on the reference's grammar: a full-bleed hero band in the family's
 * colour with the headline in the sans, then the points as a quiet grid on
 * cream, the honest caveat in small type, and one door — Get started. The
 * page describes the product truthfully; the product itself is behind
 * sign-in.
 */

export function featureMetadata(key: string): Metadata {
    const page = FEATURE_PAGES[key]
    if (!page) return {}
    return { title: page.title, description: page.lede }
}

export function sectionMetadata(key: string): Metadata {
    const section = SECTION_INDEXES[key]
    if (!section) return {}
    return { title: section.title, description: section.lede }
}

export function FeaturePageView({ pageKey }: { pageKey: string }) {
    const page = FEATURE_PAGES[pageKey]
    if (!page) throw new Error(`feature-page: no content for "${pageKey}"`)

    const family = MENUS.find((menu) => menu.href === `/${page.family}`)

    return (
        <main>
            {/* ── The hero band, in the family's colour ─────────────────── */}
            <section className={cn(FAMILY_GROUND[page.family], "on-color pt-[92px]")}>
                <div className="mx-auto flex max-w-site flex-col items-start gap-6 px-6 pb-20 pt-16">
                    <p className="text-sm font-medium text-chip/80">
                        <Link href={`/${page.family}`} className="hover:underline">
                            {family?.label ?? page.family}
                        </Link>
                    </p>
                    <h1 className="headline-sans max-w-3xl text-[clamp(2.25rem,4.2vw,3.5rem)] text-chip">
                        {page.headline}
                    </h1>
                    <p className="max-w-2xl text-xl leading-relaxed muted-on-color">{page.lede}</p>
                    <Pill href={signUpUrl()} tone="outline-on-color" className="px-7">
                        Get started
                    </Pill>
                </div>
            </section>

            {/* ── The points, quietly, on cream ─────────────────────────── */}
            <section className="bg-paper">
                <div className="mx-auto flex max-w-site flex-col gap-12 px-6 py-20">
                    <div className="grid gap-x-12 gap-y-10 sm:grid-cols-2">
                        {page.points.map((point) => (
                            <div key={point.title} className="flex max-w-md flex-col gap-2">
                                <h2 className="headline-sans text-xl text-ink">{point.title}</h2>
                                <p className="leading-relaxed text-ink-soft">{point.body}</p>
                            </div>
                        ))}
                    </div>

                    {page.note && (
                        <p className="max-w-2xl border-t border-line pt-6 text-sm leading-relaxed text-ink-muted">
                            {page.note}
                        </p>
                    )}

                    <RelatedRow currentHref={`/${pageKey}`} family={page.family} />
                </div>
            </section>
        </main>
    )
}

export function SectionIndexView({ sectionKey }: { sectionKey: string }) {
    const section = SECTION_INDEXES[sectionKey]
    if (!section) throw new Error(`feature-page: no section content for "${sectionKey}"`)
    const menu = MENUS.find((candidate) => candidate.href === `/${sectionKey}`)

    return (
        <main>
            <section className={cn(FAMILY_GROUND[section.family], "on-color pt-[92px]")}>
                <div className="mx-auto flex max-w-site flex-col items-start gap-6 px-6 pb-20 pt-16">
                    <h1 className="headline-sans max-w-3xl text-[clamp(2.25rem,4.2vw,3.5rem)] text-chip">
                        {section.headline}
                    </h1>
                    <p className="max-w-2xl text-xl leading-relaxed muted-on-color">{section.lede}</p>
                    <Pill href={signUpUrl()} tone="outline-on-color" className="px-7">
                        Get started
                    </Pill>
                </div>
            </section>

            <section className="bg-paper">
                <div className="mx-auto grid max-w-site gap-4 px-6 py-20 sm:grid-cols-2 lg:grid-cols-3">
                    {(menu?.items ?? []).map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className="flex flex-col gap-1.5 rounded-lg border border-line bg-chip p-6 transition-colors duration-[350ms] ease-ws hover:border-line-strong"
                        >
                            <span className="headline-sans text-lg text-ink">{item.label}</span>
                            <span className="text-sm leading-relaxed text-ink-soft">{item.blurb}</span>
                        </Link>
                    ))}
                </div>
            </section>
        </main>
    )
}

/** The rest of the family, so a page is never a dead end. */
function RelatedRow({ currentHref, family }: { currentHref: string; family: string }) {
    const menu = MENUS.find((candidate) => candidate.href === `/${family}`)
    const siblings = (menu?.items ?? []).filter((item) => item.href !== currentHref)
    if (siblings.length === 0) return null

    return (
        <div className="flex flex-col gap-4 border-t border-line pt-8">
            <p className="text-sm font-medium text-ink-muted">More in {menu?.label}</p>
            <div className="flex flex-wrap gap-2">
                {siblings.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className="rounded-pill border border-ink px-4 py-2 text-sm font-medium text-ink transition-colors duration-[350ms] ease-ws hover:bg-ink/5"
                    >
                        {item.label}
                    </Link>
                ))}
            </div>
        </div>
    )
}
