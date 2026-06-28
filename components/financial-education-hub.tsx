"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog"
import {
    ArrowLeft,
    Play,
    BookOpen,
    Clock,
    Users,
    ExternalLink,
    Star,
    Shield,
    ChevronLeft,
    ChevronRight,
} from "lucide-react"
import { EDU_TOPICS as topics, videoLessons, readingResources } from "@/lib/education-content"

interface FinancialEducationHubProps {
    onBack: () => void;
    initialTopic?: string;
    initialVideoIndex?: number;
    initialArticleIndex?: number;
}

export default function FinancialEducationHub({ onBack, initialTopic = "credit", initialVideoIndex = 0, initialArticleIndex = 0 }: FinancialEducationHubProps) {
    const [activeTopic, setActiveTopic] = useState(initialTopic)
    const [modalContent, setModalContent] = useState<{ title: string; description: string } | null>(null);
    const [videoIndex, setVideoIndex] = useState(initialVideoIndex);
    const [articleIndex, setArticleIndex] = useState(initialArticleIndex);

    useEffect(() => {
        if (initialTopic) setActiveTopic(initialTopic);
        setVideoIndex(initialVideoIndex);
        setArticleIndex(initialArticleIndex);
    }, [initialTopic, initialVideoIndex, initialArticleIndex]);

    const getYouTubeId = (url: string) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };


    return (
        <>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="sm" onClick={onBack}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold">Financial Education Hub</h1>
                        <p className="text-muted-foreground">Your journey to financial confidence starts here</p>
                    </div>
                </div>

                {/* Topics Navigation */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    {topics.map((topic) => (
                        <Button
                            key={topic.id}
                            variant={activeTopic === topic.id ? "default" : "outline"}
                            size="sm"
                            className="shrink-0"
                            onClick={() => {
                                setActiveTopic(topic.id);
                                setVideoIndex(0);
                                setArticleIndex(0);
                            }}
                        >
                            {topic.name}
                        </Button>
                    ))}
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>

                {/* Video Lessons */}
                <Card>
                    <CardHeader>
                        <CardTitle>Video Lessons</CardTitle>
                        <CardDescription>Short, engaging videos to explain key concepts</CardDescription>
                    </CardHeader>
                    <CardContent className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => setVideoIndex(prev => Math.max(0, prev - 1))} disabled={videoIndex === 0}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="flex-1">
                            <h3 className="font-semibold mb-2 text-center">{videoLessons[activeTopic as keyof typeof videoLessons][videoIndex].title}</h3>
                            <iframe
                                className="w-full h-64 rounded-lg"
                                src={`https://www.youtube.com/embed/${getYouTubeId(videoLessons[activeTopic as keyof typeof videoLessons][videoIndex].url)}`}
                                title="YouTube video player"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            ></iframe>
                            <div className="text-right text-sm text-muted-foreground mt-2">
                                {videoIndex + 1} / {videoLessons[activeTopic as keyof typeof videoLessons].length}
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => setVideoIndex(prev => Math.min(videoLessons[activeTopic as keyof typeof videoLessons].length - 1, prev + 1))} disabled={videoIndex === videoLessons[activeTopic as keyof typeof videoLessons].length - 1}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </CardContent>
                </Card>

                {/* Reading Resources */}
                <Card>
                    <CardHeader>
                        <CardTitle>Reading Resources</CardTitle>
                        <CardDescription>Curated articles and guides from trusted experts</CardDescription>
                    </CardHeader>
                    <CardContent className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => setArticleIndex(prev => Math.max(0, prev - 1))} disabled={articleIndex === 0}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="flex-1">
                            <h3 className="font-semibold mb-2 text-center">{readingResources[activeTopic as keyof typeof readingResources][articleIndex].title}</h3>
                            <a href={readingResources[activeTopic as keyof typeof readingResources][articleIndex].url} target="_blank" rel="noopener noreferrer">
                                <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                                    <CardContent className="p-4">
                                        <p className="text-sm text-muted-foreground">Click to read more</p>
                                    </CardContent>
                                </Card>
                            </a>
                            <div className="text-right text-sm text-muted-foreground mt-2">
                                {articleIndex + 1} / {readingResources[activeTopic as keyof typeof readingResources].length}
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => setArticleIndex(prev => Math.min(readingResources[activeTopic as keyof typeof readingResources].length - 1, prev + 1))} disabled={articleIndex === readingResources[activeTopic as keyof typeof readingResources].length - 1}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </CardContent>
                </Card>
            </div>
            <Dialog open={!!modalContent} onOpenChange={() => setModalContent(null)}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>{modalContent?.title}</DialogTitle>
                        <DialogDescription>{modalContent?.description}</DialogDescription>
                    </DialogHeader>
                    <div className="aspect-video bg-gray-200 flex items-center justify-center rounded-lg">
                        <p className="text-muted-foreground">Video or article content will be embedded here.</p>
                    </div>
                    <DialogFooter>
                        <Button onClick={() => setModalContent(null)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}