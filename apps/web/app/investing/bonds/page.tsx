import { FeaturePageView, featureMetadata } from "@/components/feature-page"

export const metadata = featureMetadata("investing/bonds")

export default function Page() {
    return <FeaturePageView pageKey="investing/bonds" />
}
