import Image from "next/image"

/** A screenshot framed in a simple phone bezel. Screenshots are 1206×2622. */
export function Phone({
    src,
    alt,
    priority = false,
    className = "",
}: {
    src: string
    alt: string
    priority?: boolean
    className?: string
}) {
    return (
        <div className={`relative mx-auto w-full max-w-[270px] ${className}`}>
            <div className="rounded-[2.75rem] border-[10px] border-neutral-900 bg-neutral-900 shadow-2xl shadow-primary/20">
                <div className="overflow-hidden rounded-[2.1rem] bg-white">
                    <Image
                        src={src}
                        alt={alt}
                        width={1206}
                        height={2622}
                        priority={priority}
                        sizes="270px"
                        className="h-auto w-full"
                    />
                </div>
            </div>
        </div>
    )
}
