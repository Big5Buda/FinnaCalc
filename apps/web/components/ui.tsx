"use client"

import * as DialogPrimitive from "@radix-ui/react-dialog"
import * as SliderPrimitive from "@radix-ui/react-slider"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * The marketing site's primitives, in the Shadcn pattern: Radix behaviour,
 * local markup, tokens from the shared preset. Only what the landing page
 * actually uses — button, dialog, slider, field — rather than the whole
 * library.
 */

const buttonVariants = cva(
    "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
    {
        variants: {
            variant: {
                // Sky-blue CTA: the one high-contrast action per view.
                primary: "bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-press",
                inverse: "bg-foreground text-background hover:opacity-90",
                outline: "border border-border-strong text-foreground hover:bg-secondary",
                ghost: "text-foreground hover:bg-secondary",
            },
            size: {
                sm: "h-9 px-4 text-sm",
                md: "h-11 px-6 text-base",
                lg: "h-13 px-8 text-base",
            },
        },
        defaultVariants: { variant: "primary", size: "md" },
    }
)

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, ...props }, ref) => (
        <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
    )
)
Button.displayName = "Button"

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger

export function DialogContent({
    children,
    title,
    description,
    className,
}: {
    children: ReactNode
    title: string
    description?: string
    className?: string
}) {
    return (
        <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
            <DialogPrimitive.Content
                className={cn(
                    "fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-7 shadow-2xl",
                    "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
                    className
                )}
            >
                <div className="mb-5 flex flex-col gap-1.5">
                    <DialogPrimitive.Title className="text-xl font-bold tracking-tight text-foreground">
                        {title}
                    </DialogPrimitive.Title>
                    {description && (
                        <DialogPrimitive.Description className="text-sm text-muted-foreground">
                            {description}
                        </DialogPrimitive.Description>
                    )}
                </div>
                {children}
                <DialogPrimitive.Close
                    aria-label="Close"
                    className="absolute right-5 top-5 text-muted-foreground transition hover:text-foreground"
                >
                    <X className="h-4 w-4" />
                </DialogPrimitive.Close>
            </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
    )
}

export function Slider({
    value,
    onChange,
    min,
    max,
    step,
    label,
    ariaValueText,
}: {
    value: number
    onChange: (value: number) => void
    min: number
    max: number
    step: number
    label: string
    ariaValueText?: string
}) {
    return (
        <SliderPrimitive.Root
            value={[value]}
            onValueChange={([next]) => onChange(next)}
            min={min}
            max={max}
            step={step}
            aria-label={label}
            aria-valuetext={ariaValueText}
            className="relative flex h-5 w-full touch-none select-none items-center"
        >
            <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-secondary">
                <SliderPrimitive.Range className="absolute h-full bg-primary" />
            </SliderPrimitive.Track>
            <SliderPrimitive.Thumb className="block h-5 w-5 rounded-full border-2 border-primary bg-background shadow transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" />
        </SliderPrimitive.Root>
    )
}

export function TextField({
    label,
    type = "text",
    value,
    onChange,
    autoComplete,
    required,
}: {
    label: string
    type?: string
    value: string
    onChange: (value: string) => void
    autoComplete?: string
    required?: boolean
}) {
    return (
        <label className="flex h-14 items-center rounded-xl bg-secondary px-4 transition focus-within:ring-2 focus-within:ring-primary/40">
            <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
                <input
                    type={type}
                    value={value}
                    required={required}
                    autoComplete={autoComplete}
                    onChange={(event) => onChange(event.target.value)}
                    className="w-full bg-transparent text-base text-foreground outline-none"
                />
            </span>
        </label>
    )
}
