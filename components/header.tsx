"use client"

import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { ThemeToggle } from "@/components/theme-toggle"
import { useAuth } from "@/lib/auth"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export default function Header() {
    const [mounted, setMounted] = useState(false)
    const pathname = usePathname()
    const router = useRouter()
    const { user, signOut } = useAuth()

    useEffect(() => { setMounted(true) }, [])

    const navLinks = [
        { href: "/", label: "Home" },
        { href: "/budgeting", label: "Budgeting" },
        { href: "/investing", label: "Investing" },
        { href: "/taxes", label: "Taxes" },
        { href: "/education", label: "Education" },
    ]

    const handleSignOut = () => {
        signOut()
        router.push("/")
    }

    return (
        <header className="border-b border-border bg-background sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-6">
                <div className="flex justify-between items-center h-16">
                    <Link href="/" className="flex items-center">
                        <Image src="/fc new right white logo.png" alt="FinnaCalc Logo" width={32} height={32} className="flex-shrink-0" />
                        <span className="ml-2 text-xl font-bold text-foreground">Finna<span className="text-blue-600 dark:text-blue-400">Calc</span></span>
                    </Link>
                    <nav className="flex space-x-8">
                        {navLinks.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={`font-bold ${pathname === link.href ? "text-blue-600 dark:text-blue-400" : "text-foreground/80 hover:text-blue-600 dark:hover:text-blue-400"}`}
                            >
                                {link.label}
                            </Link>
                        ))}
                    </nav>
                    <div className="flex items-center gap-3">
                        {mounted ? <ThemeToggle /> : <div className="h-10 w-10" />}
                        {mounted && (
                            user ? (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" size="sm" className="rounded-full font-semibold">
                                            {user.name || user.email}
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-56">
                                        <DropdownMenuLabel className="font-normal">
                                            <div className="flex flex-col">
                                                <span className="font-semibold">{user.name}</span>
                                                <span className="text-xs text-muted-foreground">{user.email}</span>
                                            </div>
                                        </DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={handleSignOut}>Sign out</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <Link href="/sign-in">
                                        <Button variant="ghost" size="sm" className="rounded-full font-semibold">
                                            Sign in
                                        </Button>
                                    </Link>
                                    <Link href="/sign-up">
                                        <Button size="sm" className="rounded-full font-semibold bg-foreground text-background hover:bg-foreground/90">
                                            Sign up
                                        </Button>
                                    </Link>
                                </div>
                            )
                        )}
                    </div>
                </div>
            </div>
        </header>
    )
}
