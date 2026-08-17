import { FeaturePageView, featureMetadata } from "@/components/feature-page"

export const metadata = featureMetadata("investing/safe-investments")

export default function Page() {
    return <FeaturePageView pageKey="investing/safe-investments" />
}
