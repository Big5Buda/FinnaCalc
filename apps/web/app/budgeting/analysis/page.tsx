import { FeaturePageView, featureMetadata } from "@/components/feature-page"

export const metadata = featureMetadata("budgeting/analysis")

export default function Page() {
    return <FeaturePageView pageKey="budgeting/analysis" />
}
