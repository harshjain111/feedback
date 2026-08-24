import { access, constants } from 'node:fs/promises'
import type { PrinterState } from './escpos.js'

/**
 * What the agent can honestly say about the hardware.
 *
 * PHOTO_MODULE.md §6 wants `{ ok, printer, paper, camera, version }`. Two of
 * those come with a caveat big enough to matter operationally:
 *
 * PAPER. Reading it properly means a DLE EOT round trip, and that needs
 * BIDIRECTIONAL communication with the device. The Windows printer share is a
 * spooler write endpoint — bytes go in, nothing comes back. escpos.decodeStatus
 * exists and is tested, and it is what a serial or libusb transport would feed,
 * but through the share the honest answer is "unknown until a write fails".
 *
 * That is not a gap to paper over; it is why PHOTO_MODULE.md §8b layer 2 exists.
 * Out-of-paper is caught by prints failing, and after `failure_threshold` of
 * them the module disables itself. The design already assumed this.
 *
 * CAMERA. The agent cannot see it. The browser can — getUserMedia and
 * navigator.permissions are the only things that truthfully know whether the
 * camera is present and permitted. So the agent reports `unknown` and the kiosk
 * fills that field in from its own knowledge before writing to `kiosks`
 * (Prompt 51). Guessing here would put a green badge on a dead camera.
 */

export type PrinterStatus = 'online' | 'offline' | 'out_of_paper' | 'cover_open' | 'unknown'
export type PaperStatus = 'ok' | 'low' | 'out' | 'unknown'
export type CameraStatus = 'present' | 'absent' | 'denied' | 'unknown'

export type StatusReport = {
  ok: boolean
  printer: PrinterStatus
  paper: PaperStatus
  camera: CameraStatus
  version: string
  /** Why `ok` is false, when it is. Never shown to a guest. */
  detail?: string
}

/** Can the transport be reached at all? The only thing a share can tell us. */
export async function probeShare(share: string): Promise<{ reachable: boolean; detail?: string }> {
  if (share === '') {
    return { reachable: false, detail: 'no printer share configured' }
  }

  try {
    // W_OK on a UNC printer path answers "is the spooler accepting jobs" without
    // sending one. It does not answer "is there paper in it".
    await access(share, constants.W_OK)
    return { reachable: true }
  } catch (cause) {
    return { reachable: false, detail: (cause as Error).message }
  }
}

/**
 * Fold what we know into the §6 shape.
 *
 * `state` is present only when the transport can actually read status back.
 * Through the share it is null, and paper stays `unknown` rather than being
 * reported as `ok` — claiming paper is fine when nothing checked would make the
 * admin badge worse than no badge.
 */
export function buildStatus(
  version: string,
  reachable: boolean,
  state: PrinterState | null,
  detail?: string,
): StatusReport {
  if (!reachable) {
    return {
      ok: false,
      printer: 'offline',
      paper: 'unknown',
      camera: 'unknown',
      version,
      ...(detail === undefined ? {} : { detail }),
    }
  }

  if (state === null) {
    return { ok: true, printer: 'online', paper: 'unknown', camera: 'unknown', version }
  }

  const printer: PrinterStatus = state.coverOpen
    ? 'cover_open'
    : state.paperOut
      ? 'out_of_paper'
      : state.offline
        ? 'offline'
        : 'online'

  const paper: PaperStatus = state.paperOut ? 'out' : state.paperLow ? 'low' : 'ok'

  return { ok: printer === 'online', printer, paper, camera: 'unknown', version }
}
