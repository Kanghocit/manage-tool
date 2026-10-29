import { Router } from 'express'

import { requireAuth } from '../middleware/auth'
import { sendXlsxDownload } from '../lib/excel'
import {
  buildScanExportBuffer,
  getScanForUser,
  listGroupsForAccount,
  listScansForUser,
  startGroupMemberScan,
} from '../lib/zaloGroupService'
import {
  cancelQrLogin,
  deleteAccount,
  getQrLoginSnapshot,
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
    return res.status(500).json({ success: false, code: 'GROUPS_FAILED', message })
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
