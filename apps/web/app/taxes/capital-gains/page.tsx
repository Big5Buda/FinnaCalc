import { FeaturePageView, featureMetadata } from "@/components/feature-page"

export const metadata = featureMetadata("taxes/capital-gains")

export default function Page() {
    return <FeaturePageView pageKey="taxes/capital-gains" />
}
