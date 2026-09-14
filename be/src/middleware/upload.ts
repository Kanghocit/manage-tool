import multer from 'multer'

const MAX_FILE_SIZE = 5 * 1024 * 1024
const MAX_PDF_SIZE = 20 * 1024 * 1024

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

export const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PDF_SIZE },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype === 'application/pdf' ||
      file.originalname.toLowerCase().endsWith('.pdf')
    if (!ok) {
      cb(new Error('Only PDF files are allowed.'))
      return
    }
    cb(null, true)
  },
})
