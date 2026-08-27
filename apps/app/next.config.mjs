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
   * There is no equivalent page, so this lands on the investing index rather
   * than implying a replacement. The marketing site carries the same rule in
   * its movedRoutes list; both are needed because both apps served the path.
   */
  async redirects() {
    return [
      {
        source: "/investing/safe-investments",
        destination: "/investing",
        permanent: true,
      },
    ]
  },
}

export default nextConfig
