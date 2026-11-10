"use client"
import { useState } from "react"
export function LessonVideo({ src, poster, title }: { src: string; poster: string; title: string }) {
    const [failed, setFailed] = useState(false)
    return <div className="overflow-hidden rounded-card border border-border bg-card">
        <video controls playsInline preload="none" poster={poster} aria-label={title} onError={() => setFailed(true)} className="aspect-video w-full bg-secondary">
            <source src={src} type="video/mp4" />
            Your browser cannot play this video. You can read the lesson below.
        </video>
        {failed && <p role="status" className="p-4 text-sm text-muted-foreground">The video couldn't load. You can still read the full lesson below.</p>}
    </div>
}
