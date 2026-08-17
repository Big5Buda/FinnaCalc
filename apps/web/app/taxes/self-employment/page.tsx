import { FeaturePageView, featureMetadata } from "@/components/feature-page"

export const metadata = featureMetadata("taxes/self-employment")

export default function Page() {
    return <FeaturePageView pageKey="taxes/self-employment" />
}
