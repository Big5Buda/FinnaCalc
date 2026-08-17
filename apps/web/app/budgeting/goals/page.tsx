import { FeaturePageView, featureMetadata } from "@/components/feature-page"

export const metadata = featureMetadata("budgeting/goals")

export default function Page() {
    return <FeaturePageView pageKey="budgeting/goals" />
}
