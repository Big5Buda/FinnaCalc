import { FeaturePageView, featureMetadata } from "@/components/feature-page"

export const metadata = featureMetadata("investing/cash-options")

export default function Page() {
    return <FeaturePageView pageKey="investing/cash-options" />
}
