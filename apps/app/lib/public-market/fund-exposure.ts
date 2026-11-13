import data from './data/fund-sector-reports-v1.json'
import { publicMany } from './cache'
export const FUND_REPORT_MODEL='issuerReportedSectorComposition'
export function validateFundReport(symbol:string,value:unknown){
    if(symbol!=='VOO'&&symbol!=='VTI')throw new Error('Unsupported fund.')
    const expected=data[symbol];const v=value as typeof expected
    if(!v||v.schemaVersion!==1||v.ticker!==symbol||v.model!==FUND_REPORT_MODEL||v.denominator!=='sourceReportedFundNetAssets'||v.industryExposureAvailable!==false||v.fundSeriesId!==expected.fundSeriesId||v.etfClassId!==expected.etfClassId||v.sourceSha256!==expected.sourceSha256||v.sourceUrl!==expected.sourceUrl||v.asOf!==expected.asOf||v.rows?.length!==12)throw new Error('Invalid fund provenance.')
    let sum=0;const names=new Set<string>()
    for(const r of v.rows){const original=expected.rows.find(row=>row.sourceLabel===r.sourceLabel);if(!original||names.has(r.sourceLabel)||!/^0\.\d{3}$/.test(r.weight)||!/^\d{1,2}\.\d$/.test(r.reportedPercent)||r.weight!==original.weight||r.reportedPercent!==original.reportedPercent||r.contextRef!==original.contextRef||r.factId!==original.factId)throw new Error('Invalid fund weights.');names.add(r.sourceLabel);const units=Number(r.weight.slice(2));if(Number(r.reportedPercent)*10!==units)throw new Error('Weight units differ.');sum+=units}
    if(sum!==1000)throw new Error('Incomplete fund denominator.')
    return v
}
export async function fundExposures(symbols:string[],now=Date.now()/1000){
    const supported=symbols.filter((s):s is 'VOO'|'VTI'=>s==='VOO'||s==='VTI')
    const results:Record<string,unknown>={},unavailable:Record<string,{status:'unsupported';reason:string}>={}
    for(const s of symbols)if(s!=='VOO'&&s!=='VTI')unavailable[s]={status:'unsupported',reason:'No supported filed sector report for this fund.'}
    // Pinned numerical reports only. This is not a live SEC source check.
    if(supported.length){const entries=await publicMany(supported,'SEC filed fund sector reports v1-20260630',86400,async(keys)=>Object.fromEntries(keys.map(s=>[s,validateFundReport(s,data[s as 'VOO'|'VTI'])])),now)
        for(const s of supported){const e=entries[s];results[s]={...e.value,fetchedAt:e.fetchedAt,expiresAt:e.expiresAt,freshSourceCheckPerformed:false,sourceCheckedAt:null,newerReportAvailable:null,discovery:'notChecked'}}}
    return {schemaVersion:1,requested:symbols,results,unavailable}
}
