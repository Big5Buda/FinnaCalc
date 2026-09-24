"use client"

import { Button, Notice } from "@/components/ui/primitives"
import { connectionNotice, type ConnectionNotice } from "@/lib/investing/portfolio-state"
import type { Connection } from "@/lib/investing/snaptrade"

/**
 * Warnings and recovery actions for the user's brokerage links. Rendered
 * whether or not holdings loaded: a broken or legacy link is often the reason
 * they didn't.
 */
export function BrokerageLinkNotices({
    connections,
    connectionsError,
    busy,
    onDisconnect,
    onReconnect,
}: {
    connections: Connection[]
    connectionsError: string | null
    busy: string | null
    onDisconnect: () => void
    onReconnect: (connectionId: string) => void
}) {
    const notices = connections
        .map(connectionNotice)
        .filter((notice): notice is ConnectionNotice => notice !== null)

    return (
        <>
            {connectionsError && <Notice tone="caution">{connectionsError}</Notice>}
            {notices.map((notice) => (
                <Notice key={notice.connectionId} tone="caution">
                    {notice.message}
                    <div className="mt-2">
                        {notice.kind === "relink" ? (
                            <Button size="sm" onClick={onDisconnect} disabled={busy === "disconnect"}>
                                Disconnect all to relink
                            </Button>
                        ) : (
                            <Button
                                size="sm"
                                onClick={() => onReconnect(notice.connectionId)}
                                disabled={busy === `reconnect:${notice.connectionId}`}
                            >
                                Reconnect
                            </Button>
                        )}
                    </div>
                </Notice>
            ))}
        </>
    )
}
