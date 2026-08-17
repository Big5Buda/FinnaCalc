import { FeaturePageView, featureMetadata } from "@/components/feature-page"

export const metadata = featureMetadata("taxes/estimator")

export default function Page() {
    return <FeaturePageView pageKey="taxes/estimator" />
}
