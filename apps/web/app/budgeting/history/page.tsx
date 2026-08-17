import { FeaturePageView, featureMetadata } from "@/components/feature-page"

export const metadata = featureMetadata("budgeting/history")

export default function Page() {
    return <FeaturePageView pageKey="budgeting/history" />
}
