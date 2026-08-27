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
   */
  async redirects() {
    return [
      {
        source: "/investing/safe-investments",
        destination: "/investing/cash-options",
        permanent: true,
      },
    ]
  },
}

export default nextConfig
