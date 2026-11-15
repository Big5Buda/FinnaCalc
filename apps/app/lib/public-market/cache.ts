import { unstable_cache } from "next/cache"

// Public provider data only. This is NOT an authorization or portfolio cache.
export type Timed<T> = { value: T; fetchedAt: number; expiresAt: number }
const ready = new Map<string, Timed<unknown>>()
const pending = new Map<string, Promise<Timed<unknown>>>()
const MAX_READY = 2000

// Next stores JSON.stringify(result) INSIDE the FETCH entry JSON. Budget the
// escaped outer representation in UTF-8 bytes, with50% headroom below2MiB.
export const PUBLIC_ENTRY_BUDGET = 1024 * 1024
export function publicEntryBytes(value:unknown, ttl=60):number {
    return new TextEncoder().encode(JSON.stringify({kind:"FETCH",data:{headers:{},body:JSON.stringify(value),status:200,url:""},revalidate:ttl})).byteLength
}
type Stored<T> = {format:"inline";timed:Timed<T>} | {format:"fragments";digest:string;count:number}

async function sizedRead<T>(keys:string[],ttl:number,load:()=>Promise<Timed<T>>):Promise<Timed<T>> {
    // Use the SAME callback source for reads and writes: Next includes callback
    // source as well as keyParts in its real key (a different read callback misses).
    const fragment=(digest:string,index:number,piece?:string)=>unstable_cache(async():Promise<string>=>{
        if(piece===undefined)throw new Error("Public cache fragment unavailable.")
        return piece
    },["public-market-fragment-v1",digest,String(index)],{revalidate:ttl})()
    let acquired:Timed<T>|undefined
    const read=unstable_cache(async ():Promise<Stored<T>>=>{
        const timed=await load()
        acquired=timed
        const inline:Stored<T>={format:"inline",timed}
        if(publicEntryBytes(inline,ttl)<=PUBLIC_ENTRY_BUDGET)return inline
        // Fragment the serialized COMPLETE result, not the observations themselves.
        // Content addressing prevents concurrent canonical writers mixing fragments.
        const payload=JSON.stringify(timed)
        const digest=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(payload))))
            .map(n=>n.toString(16).padStart(2,"0")).join("")
        let count=0
        for(let offset=0;offset<payload.length;) {
            let length=Math.min(256*1024,payload.length-offset)
            while(publicEntryBytes(payload.slice(offset,offset+length),ttl)>PUBLIC_ENTRY_BUDGET)length=Math.floor(length/2)
            if(length<1)throw new Error("Public cache fragment cannot fit.")
            const piece=payload.slice(offset,offset+length)
            // Each fragment is checked BEFORE unstable_cache can attempt its write.
            if(publicEntryBytes(piece,ttl)>PUBLIC_ENTRY_BUDGET)throw new Error("Public cache entry budget exceeded.")
            await fragment(digest,count,piece)
            count++;offset+=length
        }
        // Publish the small manifest after every bounded fragment cache call.
        // Next may defer persistence to its request lifecycle; this is not a
        // transactional remote cache. Missing fragments on later reads fail closed.
        return {format:"fragments",digest,count}
    },keys,{revalidate:ttl})
    const stored=await read()
    // The cold caller already has the full validated provider result; do not
    // race Next deferred fragment persistence by immediately re-reading it.
    if(acquired)return acquired
    if(stored.format==="inline")return stored.timed
    if(!Number.isInteger(stored.count)||stored.count<1)throw new Error("Invalid public cache manifest.")
    const pieces:string[]=[]
    for(let i=0;i<stored.count;i++) {
        const piece=await fragment(stored.digest,i)
        if(typeof piece!=="string")throw new Error("Malformed public cache fragment.")
        pieces.push(piece)
    }
    const payload=pieces.join("")
    const digest=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(payload))))
        .map(n=>n.toString(16).padStart(2,"0")).join("")
    if(digest!==stored.digest)throw new Error("Incomplete public cache payload.")
    return JSON.parse(payload) as Timed<T>
}

export function bucket(now: number, ttl: number) { return Math.floor(now / ttl) * ttl }
export async function publicMany<T>(symbols: string[], group: string, ttl: number,
    load: (symbols: string[]) => Promise<Record<string, T>>, now = Date.now() / 1000, memoryGroup = group): Promise<Record<string, Timed<T>>> {
    const wanted = [...new Set(symbols)].sort()
    const slot = bucket(now, ttl)
    const key = (s: string) => JSON.stringify(["public-market-v1", memoryGroup, s])
    const missing = wanted.filter(s => !pending.has(key(s)) && !(ready.get(key(s))?.expiresAt! > now))
    if (missing.length) {
        // Canonical chunk Data Cache survives process restarts. Different overlapping
        // chunks can miss on separate instances: no distributed single-flight claim.
        const batch = sizedRead(["public-market-v2", group, String(slot), JSON.stringify(missing)], ttl, async () => {
            const fetchedAt = Date.now() / 1000
            const value = await load(missing)
            return { value, fetchedAt, expiresAt: fetchedAt + ttl }
        })
        for (const symbol of missing) {
            const task = batch.then(result => {
                if (!(symbol in result.value)) throw new Error("Provider omitted symbol.")
                const value = { value: result.value[symbol], fetchedAt: result.fetchedAt, expiresAt: result.expiresAt }
                ready.set(key(symbol), value)
                while (ready.size > MAX_READY) ready.delete(ready.keys().next().value!)
                return value
            }).finally(() => { pending.delete(key(symbol)) })
            pending.set(key(symbol), task)
        }
    }
    const entries = await Promise.all(wanted.map(async symbol => {
        const hit = ready.get(key(symbol))
        const value = hit && hit.expiresAt > now ? hit : await pending.get(key(symbol))
        if (!value || value.expiresAt <= now) throw new Error("Public acquisition expired.")
        return [symbol, value] as const
    }))
    return Object.fromEntries(entries) as Record<string, Timed<T>>
}

export async function mapBounded<T, R>(items: T[], concurrency: number, run: (item:T)=>Promise<R>): Promise<R[]> {
    const out: R[] = new Array(items.length)
    let index = 0
    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
        for (;;) { const i = index++; if (i >= items.length) return; out[i] = await run(items[i]) }
    }))
    return out
}
export function chunks<T>(items:T[], size:number):T[][] {
    return Array.from({ length: Math.ceil(items.length / size) }, (_,i) => items.slice(i*size,(i+1)*size))
}

/** Independent per-process SEC concurrency budget; no global fleet RPM claim. */
let secActive = 0
const secWaiters: Array<()=>void> = []
export async function limitedSEC<T>(load:()=>Promise<T>):Promise<T> {
    if (secActive >= 2) await new Promise<void>((resolve,reject)=>{
        if(secWaiters.length>=16){reject(new Error("SEC queue busy."));return}
        const enter=()=>{clearTimeout(timer);resolve()}
        const timer=setTimeout(()=>{const i=secWaiters.indexOf(enter);if(i>=0)secWaiters.splice(i,1);reject(new Error("SEC queue timeout."))},15000)
        secWaiters.push(enter)
    }); else secActive++
    try { return await load() }
    finally { const next=secWaiters.shift(); if(next)next();else secActive-- }
}
