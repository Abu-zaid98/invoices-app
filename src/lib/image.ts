/**
 * ضغط صور المرفقات قبل التخزين في IndexedDB:
 * تصغير للأبعاد الكبيرة + JPEG بجودة 0.8 لتفادي تضخم قاعدة البيانات والنسخ الاحتياطي.
 */
export function fileToResizedDataURL(file: File, maxDim = 1280, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('يرجى اختيار ملف صورة'))
      return
    }
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      try {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))
        const c = document.createElement('canvas')
        c.width = w
        c.height = h
        c.getContext('2d')!.drawImage(img, 0, 0, w, h)
        resolve(c.toDataURL('image/jpeg', quality))
      } catch {
        reject(new Error('تعذّر معالجة الصورة'))
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('تعذّر قراءة الصورة'))
    }
    img.src = url
  })
}
