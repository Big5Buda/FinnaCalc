import { SectionIndexView, sectionMetadata } from "@/components/feature-page"

export const metadata = sectionMetadata("investing")

export default function Page() {
    return <SectionIndexView sectionKey="investing" />
}
