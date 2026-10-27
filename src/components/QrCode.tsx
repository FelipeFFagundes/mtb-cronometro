import { useMemo } from 'react'
import qrcode from 'qrcode-generator'
import { Box } from '@mui/material'

/** QR code em SVG (escuro sobre branco, com margem: precisa de contraste para a câmera ler). */
export function QrCode({ value, size = 220 }: { value: string; size?: number }) {
  const { count, path } = useMemo(() => {
    const qr = qrcode(0, 'M')
    qr.addData(value)
    qr.make()
    const n = qr.getModuleCount()
    let d = ''
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`
    }
    return { count: n, path: d }
  }, [value])

  const margin = 4
  const total = count + margin * 2
  return (
    <Box
      component="svg"
      role="img"
      aria-label={`QR code: ${value}`}
      viewBox={`${-margin} ${-margin} ${total} ${total}`}
      shapeRendering="crispEdges"
      sx={{ width: size, height: size, bgcolor: '#fff', display: 'block', mx: 'auto' }}
    >
      <path d={path} fill="#000" />
    </Box>
  )
}
