import multer from 'multer'

const MAX_FILE_SIZE = 5 * 1024 * 1024

export const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype ===
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.originalname.toLowerCase().endsWith('.xlsx') ||
      file.originalname.toLowerCase().endsWith('.xls')
    if (!ok) {
      cb(new Error('Only Excel files (.xlsx) are allowed.'))
      return
    }
    cb(null, true)
  },
})
