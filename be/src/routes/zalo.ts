import { Router } from 'express'

import { requireAuth } from '../middleware/auth'
import { sendXlsxDownload } from '../lib/excel'
import {
  buildScanExportBuffer,
  clearScansForUser,
  deleteScanForUser,
  getScanForUser,
  humanizeZaloClientError,
  listGroupsForAccount,
  listScansForUser,
  startGroupMemberScan,
} from '../lib/zaloGroupService'
import {
  cancelQrLogin,
  deleteAccount,
  getQrLoginSnapshot,
  importBrowserSession,
  listAccountsForUser,
  startQrLogin,
} from '../lib/zaloSessionManager'

export const zaloRouter = Router()

zaloRouter.use(requireAuth)

zaloRouter.get('/accounts', async (req, res) => {
  const userId = req.auth!.userId
  const accounts = await listAccountsForUser(userId)
  res.json({ success: true, data: accounts })
})

zaloRouter.post('/accounts/qr', async (req, res) => {
  const userId = req.auth!.userId
  try {
    const { loginId } = await startQrLogin(userId)
    const snapshot = getQrLoginSnapshot(loginId, userId)
    res.json({ success: true, data: { loginId, ...snapshot } })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'QR start failed'
    if (message === 'ACCOUNT_LIMIT') {
      return res.status(400).json({
        success: false,
        code: 'ACCOUNT_LIMIT',
        message: 'Đã đạt giới hạn số tài khoản Zalo.',
      })
    }
    return res.status(500).json({ success: false, code: 'QR_START_FAILED', message })
  }
})

zaloRouter.post('/accounts/import-session', async (req, res) => {
  const userId = req.auth!.userId
  const { cookie, imei, userAgent } = (req.body ?? {}) as {
    cookie?: unknown
    imei?: unknown
    userAgent?: unknown
  }
  if (
    !Array.isArray(cookie) ||
    cookie.length === 0 ||
    typeof imei !== 'string' ||
    !imei.trim() ||
    typeof userAgent !== 'string' ||
    !userAgent.trim()
  ) {
    return res.status(400).json({
      success: false,
      code: 'INVALID_PAYLOAD',
      message: 'Thiếu cookie, imei hoặc userAgent của Zalo Web.',
    })
  }
  try {
    const account = await importBrowserSession(userId, {
      cookie,
      imei: imei.trim(),
      userAgent: userAgent.trim(),
    })
    res.json({
      success: true,
      data: { id: account.id, zaloUid: account.zaloUid, displayName: account.displayName },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Import failed'
    if (message === 'ACCOUNT_LIMIT') {
      return res.status(400).json({
        success: false,
        code: 'ACCOUNT_LIMIT',
        message: 'Đã đạt giới hạn số tài khoản Zalo.',
      })
    }
    if (message.startsWith('SESSION_INVALID')) {
      return res.status(400).json({
        success: false,
        code: 'SESSION_INVALID',
        message: 'Phiên Zalo Web không hợp lệ hoặc đã đăng xuất. Đăng nhập lại chat.zalo.me rồi đồng bộ lại.',
      })
    }
    return res.status(500).json({ success: false, code: 'IMPORT_FAILED', message })
  }
})

zaloRouter.get('/accounts/qr/:loginId', async (req, res) => {
  const userId = req.auth!.userId
  const loginId = String(req.params.loginId)
  const snapshot = getQrLoginSnapshot(loginId, userId)
  if (!snapshot) {
    return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'QR session not found.' })
  }
  res.json({ success: true, data: snapshot })
})

zaloRouter.delete('/accounts/qr/:loginId', async (req, res) => {
  const userId = req.auth!.userId
  cancelQrLogin(String(req.params.loginId), userId)
  res.json({ success: true })
})

zaloRouter.delete('/accounts/:id', async (req, res) => {
  const userId = req.auth!.userId
  try {
    await deleteAccount(String(req.params.id), userId)
    res.json({ success: true })
  } catch {
    res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Account not found.' })
  }
})

zaloRouter.get('/accounts/:id/groups', async (req, res) => {
  const userId = req.auth!.userId
  try {
    const groups = await listGroupsForAccount(String(req.params.id), userId)
    res.json({ success: true, data: groups })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed'
    if (message === 'ACCOUNT_NOT_FOUND') {
      return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Account not found.' })
    }
    return res.status(502).json({
      success: false,
      code: 'ZALO_API_ERROR',
      message: humanizeZaloClientError(message),
    })
  }
})

zaloRouter.post('/accounts/:accountId/groups/:groupId/scan', async (req, res) => {
  const userId = req.auth!.userId
  try {
    const result = await startGroupMemberScan(
      String(req.params.accountId),
      userId,
      String(req.params.groupId),
    )
    res.json({ success: true, data: result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Scan failed'
    if (message === 'ACCOUNT_NOT_FOUND') {
      return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Account not found.' })
    }
    return res.status(500).json({ success: false, code: 'SCAN_FAILED', message })
  }
})

zaloRouter.get('/scans', async (req, res) => {
  const userId = req.auth!.userId
  const scans = await listScansForUser(userId)
  res.json({ success: true, data: scans })
})

zaloRouter.delete('/scans', async (req, res) => {
  const userId = req.auth!.userId
  await clearScansForUser(userId)
  res.json({ success: true })
})

zaloRouter.delete('/scans/:scanId', async (req, res) => {
  const userId = req.auth!.userId
  try {
    await deleteScanForUser(String(req.params.scanId), userId)
    res.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Delete failed'
    if (message === 'NOT_FOUND') {
      return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Scan not found.' })
    }
    if (message === 'SCAN_RUNNING') {
      return res.status(400).json({
        success: false,
        code: 'SCAN_RUNNING',
        message: 'Không thể xoá lần quét đang chạy.',
      })
    }
    return res.status(500).json({ success: false, code: 'DELETE_FAILED', message })
  }
})

zaloRouter.get('/scans/:scanId', async (req, res) => {
  const userId = req.auth!.userId
  const scan = await getScanForUser(String(req.params.scanId), userId)
  if (!scan) {
    return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Scan not found.' })
  }
  res.json({ success: true, data: scan })
})

zaloRouter.get('/scans/:scanId/export.xlsx', async (req, res) => {
  const userId = req.auth!.userId
  const scan = await getScanForUser(String(req.params.scanId), userId)
  if (!scan) {
    return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Scan not found.' })
  }
  const buffer = buildScanExportBuffer(scan)
  const name = (scan.groupName || scan.groupId).replace(/[^\w\-]+/g, '_')
  sendXlsxDownload(res, `zalo-group-${name}.xlsx`, buffer)
})
