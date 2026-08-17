import { FeaturePageView, featureMetadata } from "@/components/feature-page"

export const metadata = featureMetadata("investing/watchlist")

export default function Page() {
    return <FeaturePageView pageKey="investing/watchlist" />
}
