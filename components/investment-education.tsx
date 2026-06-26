"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Play, BookOpen, Clock, Users, ExternalLink } from "lucide-react"

interface InvestmentEducationProps {
    onBack: () => void
}

export default function InvestmentEducation({ onBack }: InvestmentEducationProps) {
    const videoLessons = [
        {
            title: "What Are Stocks and Bonds?",
            duration: "6 min",
            level: "Beginner",
            description: "Learn the basic building blocks of investing in simple terms.",
            thumbnail: "/stock-market-chart.png",
        },
        {
            title: "Understanding Risk vs Reward",
            duration: "8 min",
            level: "Beginner",
            description: "How to balance potential gains with potential losses.",
            thumbnail: "/risk-reward-balance-scale.png",
        },
        {
            title: "Building a Diversified Portfolio",
            duration: "10 min",
            level: "Intermediate",
            description: "Don't put all your eggs in one basket - learn why and how.",
            thumbnail: "/diversified-portfolio.png",
        },
        {
            title: "Retirement Planning Basics",
            duration: "12 min",
            level: "Beginner",
            description: "401(k), IRA, and other retirement accounts explained.",
            thumbnail: "/retirement-planning-calculator.png",
        },
        {
            title: "Reading Financial Statements",
            duration: "15 min",
            level: "Intermediate",
            description: "Understand income statements, balance sheets, and cash flow.",
            thumbnail: "/financial-statements-charts.png",
        },
        {
            title: "Dollar-Cost Averaging Strategy",
            duration: "7 min",
            level: "Beginner",
            description: "How to invest regularly to reduce timing risk.",
            thumbnail: "/dollar-cost-averaging-graph.png",
        },
    ]

    const readingResources = [
        {
            title: "The Simple Path to Wealth",
            author: "JL Collins",
            type: "Book",
            description: "Straightforward advice on index fund investing and financial independence.",
            link: "#",
        },
        {
            title: "A Random Walk Down Wall Street",
            author: "Burton Malkiel",
            type: "Book",
            description: "Classic guide to passive investing and market efficiency.",
            link: "#",
        },
        {
            title: "SEC Investor.gov",
            author: "U.S. Securities and Exchange Commission",
            type: "Website",
            description: "Official government resource for investment education.",
            link: "https://investor.gov",
        },
        {
            title: "Bogleheads Investment Philosophy",
            author: "Bogleheads Community",
            type: "Website",
            description: "Simple, low-cost investing principles from Vanguard founder Jack Bogle.",
            link: "https://bogleheads.org",
        },
    ]

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="outline" size="sm" onClick={onBack}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                </Button>
                <div>
                    <h1 className="text-3xl font-bold">Investment Education</h1>
                    <p className="text-muted-foreground">Master the fundamentals of smart investing</p>
                </div>
            </div>

            {/* Advertisement Space */}
            <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
                <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Users className="h-8 w-8 text-green-600" />
                            <div>
                                <h3 className="font-semibold">Join Our Investment Community</h3>
                                <p className="text-sm text-muted-foreground">Connect with other beginner investors</p>
                            </div>
                        </div>
                        <Button size="sm" variant="outline">
                            Join Now <ExternalLink className="h-3 w-3 ml-1" />
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Video Lessons */}
            <Card>
                <CardHeader>
                    <CardTitle>Video Lessons</CardTitle>
                    <CardDescription>Short, engaging videos that explain complex topics simply</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                        {videoLessons.map((video, index) => (
                            <Card key={index} className="hover:shadow-lg transition-shadow cursor-pointer">
                                <div className="relative">
                                    <img
                                        src={video.thumbnail || "/placeholder.svg"}
                                        alt={video.title}
                                        className="w-full h-32 object-cover rounded-t-lg"
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-t-lg">
                                        <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center">
                                            <Play className="h-6 w-6 text-primary-foreground ml-1" />
                                        </div>
                                    </div>
                                    <div className="absolute top-2 right-2">
                                        <Badge variant="secondary" className="text-xs">
                                            <Clock className="h-3 w-3 mr-1" />
                                            {video.duration}
                                        </Badge>
                                    </div>
                                </div>
                                <CardContent className="p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Badge variant={video.level === "Beginner" ? "default" : "secondary"}>{video.level}</Badge>
                                    </div>
                                    <h3 className="font-semibold mb-2">{video.title}</h3>
                                    <p className="text-sm text-muted-foreground">{video.description}</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Reading Resources */}
            <Card>
                <CardHeader>
                    <CardTitle>Recommended Reading</CardTitle>
                    <CardDescription>Curated articles and resources from trusted financial experts</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                        {readingResources.map((resource, index) => (
                            <Card key={index} className="hover:shadow-md transition-shadow">
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex-1">
                                            <h3 className="font-semibold mb-1">{resource.title}</h3>
                                            <p className="text-sm text-muted-foreground mb-2">by {resource.author}</p>
                                            <Badge variant="outline" className="text-xs mb-2">
                                                {resource.type}
                                            </Badge>
                                            <p className="text-sm text-muted-foreground">{resource.description}</p>
                                        </div>
                                        <BookOpen className="h-5 w-5 text-muted-foreground ml-2" />
                                    </div>
                                    <Button size="sm" variant="outline" className="w-full mt-3 bg-transparent">
                                        <ExternalLink className="h-3 w-3 mr-1" />
                                        View Resource
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Quick Start Guide */}
            <Card className="bg-blue-50 border-blue-200">
                <CardHeader>
                    <CardTitle>Your Investment Learning Path</CardTitle>
                    <CardDescription>Follow this step-by-step guide to build your knowledge</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 p-3 bg-background rounded-lg border">
                            <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
                                1
                            </div>
                            <div>
                                <h4 className="font-medium">Start with the Basics</h4>
                                <p className="text-sm text-muted-foreground">
                                    Watch "What Are Stocks and Bonds?" and "Understanding Risk vs Reward"
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-background rounded-lg border">
                            <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
                                2
                            </div>
                            <div>
                                <h4 className="font-medium">Learn About Diversification</h4>
                                <p className="text-sm text-muted-foreground">
                                    Understand why spreading risk is crucial for long-term success
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-background rounded-lg border">
                            <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
                                3
                            </div>
                            <div>
                                <h4 className="font-medium">Plan for Retirement</h4>
                                <p className="text-sm text-muted-foreground">
                                    Learn about 401(k)s, IRAs, and the power of compound interest
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-background rounded-lg border">
                            <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
                                4
                            </div>
                            <div>
                                <h4 className="font-medium">Start Investing</h4>
                                <p className="text-sm text-muted-foreground">
                                    Apply what you've learned with our safe investment options
                                </p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
