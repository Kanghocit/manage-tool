declare module 'pdf-parse' {
  type PdfParseResult = {
    text: string
    numpages: number
    info: Record<string, unknown>
  }

  function pdfParse(data: Buffer, options?: Record<string, unknown>): Promise<PdfParseResult>
  export = pdfParse
}
