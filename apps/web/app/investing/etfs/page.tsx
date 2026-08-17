import { FeaturePageView, featureMetadata } from "@/components/feature-page"

export const metadata = featureMetadata("investing/etfs")

export default function Page() {
    return <FeaturePageView pageKey="investing/etfs" />
}
