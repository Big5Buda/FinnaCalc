/** Additive identity/type only: never changes valuation unit conventions. */
export function instrumentMetadata(instrument:Record<string,unknown>) {
    const kind=typeof instrument.kind==='string'?instrument.kind:null
    const types:Record<string,string>={stock:'stock',adr:'adr',preferred_stock:'preferred',etf:'etf',mutualfund:'mutualFund',bond:'bond',crypto:'crypto',cash:'cash',precious_metal:'commodity',cef:'other'}
    const securityId=typeof instrument.id==='string'&&instrument.id.trim()?instrument.id:null
    return {instrumentKind:kind,securityId,securityIdSource:securityId?'snaptradeInstrument':null,assetType:kind?types[kind]??'unknown':'unknown'}
}
