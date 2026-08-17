import { FeaturePageView, featureMetadata } from "@/components/feature-page"

export const metadata = featureMetadata("investing/screener")

export default function Page() {
    return <FeaturePageView pageKey="investing/screener" />
}
