import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PGS Cylinder Ledger',
    short_name: 'PGS Ledger',
    description: 'Managed LPG Ledger System for reliable cylinder tracking',
    start_url: '/',
    display: 'standalone',
    background_color: '#12110e',
    theme_color: '#ca9a30',
    icons: [
      {
        src: '/PabinaGas.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/PabinaGas.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/PabinaGas.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/PabinaGas.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}
