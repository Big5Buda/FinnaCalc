import { FeaturePageView, featureMetadata } from "@/components/feature-page"

export const metadata = featureMetadata("investing/portfolio")

export default function Page() {
    return <FeaturePageView pageKey="investing/portfolio" />
}
