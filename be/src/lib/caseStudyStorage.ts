import fs from 'fs/promises'
import path from 'path'

import { env } from '../config/env'

const MIME_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
}

function resolveFromBeRoot(relative: string): string {
  return path.resolve(process.cwd(), relative)
}

export function getCaseStudyUploadRoot(): string {
  return resolveFromBeRoot(env.caseStudyUploadDir)
}

export function getCaseStudyImportTmpRoot(): string {
  return resolveFromBeRoot(env.caseStudyImportTmpDir)
}

export function getSetStorageDir(setId: string): string {
  return path.join(getCaseStudyUploadRoot(), setId)
}

export function getImportSessionDir(sessionId: string): string {
  return path.join(getCaseStudyImportTmpRoot(), sessionId)
}

export function pageFileName(pageIndex: number, mimeType = 'image/jpeg'): string {
  const ext = MIME_EXT[mimeType] ?? '.jpg'
  return `page-${String(pageIndex).padStart(3, '0')}${ext}`
}

export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true })
}

export async function removeDirIfExists(dir: string): Promise<void> {
  try {
    await fs.rm(dir, { recursive: true, force: true })
  } catch {
    /* ignore */
  }
}

export async function moveImportSessionToSet(sessionId: string, setId: string): Promise<void> {
  const src = getImportSessionDir(sessionId)
  const dest = getSetStorageDir(setId)
  await ensureDir(path.dirname(dest))
  try {
    await fs.rename(src, dest)
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'EXDEV') {
      await fs.cp(src, dest, { recursive: true })
      await removeDirIfExists(src)
      return
    }
    throw err
  }
}

export function resolvePageFilePath(setId: string, storageKey: string): string {
  return path.join(getSetStorageDir(setId), storageKey)
}

export function resolveImportPageFilePath(sessionId: string, storageKey: string): string {
  return path.join(getImportSessionDir(sessionId), storageKey)
}

export async function readPageFile(absPath: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(absPath)
  } catch {
    return null
  }
}

export async function cleanupExpiredImportSessions(): Promise<void> {
  const root = getCaseStudyImportTmpRoot()
  let entries: string[]
  try {
    entries = await fs.readdir(root)
  } catch {
    return
  }

  const cutoff = Date.now() - env.caseStudyImportTtlMs
  for (const entry of entries) {
    const dir = path.join(root, entry)
    try {
      const stat = await fs.stat(dir)
      if (stat.isDirectory() && stat.mtimeMs < cutoff) {
        await removeDirIfExists(dir)
      }
    } catch {
      /* ignore */
    }
  }
}

export async function deleteSetStorage(setId: string): Promise<void> {
  await removeDirIfExists(getSetStorageDir(setId))
}
