import { FeaturePageView, featureMetadata } from "@/components/feature-page"

export const metadata = featureMetadata("budgeting/budget")

export default function Page() {
    return <FeaturePageView pageKey="budgeting/budget" />
}
