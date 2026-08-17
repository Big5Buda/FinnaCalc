import { FeaturePageView, featureMetadata } from "@/components/feature-page"

export const metadata = featureMetadata("budgeting/subscriptions")

export default function Page() {
    return <FeaturePageView pageKey="budgeting/subscriptions" />
}
