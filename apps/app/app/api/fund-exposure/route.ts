import {NextRequest}from'next/server'
import {fundExposures}from'@/lib/public-market/fund-exposure'
export const dynamic='force-dynamic'
export async function GET(req:NextRequest){
 const headers={'Cache-Control':'no-store'}
 const symbols=[...new Set((req.nextUrl.searchParams.get('symbols')??'').split(',').map(s=>s.trim().toUpperCase()).filter(Boolean))].sort()
 if(!symbols.length||symbols.length>60||symbols.some(s=>! /^[A-Z0-9][A-Z0-9./^-]{0,24}$/.test(s)||['__PROTO__','CONSTRUCTOR','PROTOTYPE'].includes(s)))return Response.json({error:'Request 1 to 60 valid symbols.',maxSymbols:60},{status:400,headers})
 try{return Response.json(await fundExposures(symbols),{headers})}catch{return Response.json({error:'Filed fund reports unavailable.'},{status:503,headers})}
}
