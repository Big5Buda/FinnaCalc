import { FeaturePageView, featureMetadata } from "@/components/feature-page"

export const metadata = featureMetadata("investing/trade-tracker")

export default function Page() {
    return <FeaturePageView pageKey="investing/trade-tracker" />
}
