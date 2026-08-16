import { NextResponse } from "next/server"
import { createTax1099Provider } from "@/components/tax-engine/export/efile/tax1099Adapter"
import type { EfileBundle } from "@/components/tax-engine/export/efile/EfileProvider"

/**
 * Server-side e-file endpoint. The provider API key lives only here (via
 * process.env), never in client code. Currently a structural stub: the Tax1099
 * adapter reports that individual 1040 e-file isn't supported by that API, so this
 * returns 501 with an explanation rather than transmitting.
 */
export async function POST(req: Request) {
  let bundle: EfileBundle
  try {
    bundle = (await req.json()) as EfileBundle
  } catch {
    return NextResponse.json({ status: "rejected", message: "Invalid request body." }, { status: 400 })
  }

  const provider = createTax1099Provider(process.env.TAX1099_API_KEY)
  const result = await provider.submit(bundle)
  const httpStatus = result.status === "accepted" || result.status === "queued" ? 200 : 501
  return NextResponse.json({ provider: provider.name, ...result }, { status: httpStatus })
}
