import { SectionIndexView, sectionMetadata } from "@/components/feature-page"

export const metadata = sectionMetadata("taxes")

export default function Page() {
    return <SectionIndexView sectionKey="taxes" />
}
