/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },

  /**
   * /investing/safe-investments was retired rather than moved. It ranked three
   * hand-picked instruments as the "safest", each with a risk grade this app
   * assigned and an average return with no source, period or date on screen —
   * a curated shortlist of named securities reads as a recommendation however
   * the surrounding notice is worded. Two of the three were stock ETFs.
   *
   * It now lands on /investing/cash-options, which is the successor: the same
   * subject — where money sits when it is not buying securities — described by
   * instrument class, with no product named, no rate quoted and no ranking.
   * The marketing site carries the same rule in its movedRoutes list; both are
   * needed because both apps served the path.
   *
   * /investing/trade/:symbol was the order ticket. FinnaCalc is view-only now
   * and places no orders, so an old link lands on that stock's own page.
   * Temporary rather than permanent: a cached 308 is hard to take back.
   */
  async redirects() {
    return [
      {
        source: "/investing/safe-investments",
        destination: "/investing/cash-options",
        permanent: true,
      },
      {
        source: "/investing/trade/:symbol",
        destination: "/investing/stocks/:symbol",
        permanent: false,
      },
    ]
  },
}

export default nextConfig
