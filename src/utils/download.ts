export async function downloadBlob(request: () => Promise<any>, filename: string) {
  const res = await request()
  const blob = new Blob([res as any], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// 得到的地址然后去 /minio-api/antdv/exports/  希望变成  xxx.xx:port /antdv/exports/ 并fetch 下载
export const downloadFile = async (_url: string, filename: string) => {
  const res = await fetch(_url)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
