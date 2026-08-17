import { SectionIndexView, sectionMetadata } from "@/components/feature-page"

export const metadata = sectionMetadata("budgeting")

export default function Page() {
    return <SectionIndexView sectionKey="budgeting" />
}
