import { FeaturePageView, featureMetadata } from "@/components/feature-page"

export const metadata = featureMetadata("taxes/state")

export default function Page() {
    return <FeaturePageView pageKey="taxes/state" />
}
