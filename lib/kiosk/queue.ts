/**
 * The offline submission queue (§43).
 *
 * A café's wifi drops. When it does, the guest must still see their thank-you
 * screen — they did their part, and showing them an error for our network
 * problem would be both rude and pointless, since they cannot fix it.
 *
 * So a failed submit is written to IndexedDB and retried when the connection
 * comes back, reusing the SAME submissionId. The unique index on
 * (outlet_id, submission_id) means a retry that turns out to have succeeded the
 * first time collapses into the existing row rather than duplicating it.
 *
 * IndexedDB rather than localStorage: it survives being full, it is
 * transactional, and a queue that silently loses writes is worse than none.
 */

const DB_NAME = 'aic-kiosk'
const STORE = 'pending-submissions'
const VERSION = 1

export type QueuedSubmission = {
  submissionId: string
  payload: unknown
  queuedAt: string
  attempts: number
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'submissionId' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function transact<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    open()
      .then((db) => {
        const transaction = db.transaction(STORE, mode)
        const request = run(transaction.objectStore(STORE))
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
        transaction.oncomplete = () => db.close()
      })
      .catch(reject)
  })
}

export async function enqueue(submissionId: string, payload: unknown): Promise<void> {
  if (typeof indexedDB === 'undefined') return
  try {
    await transact('readwrite', (store) =>
      store.put({
        submissionId,
        payload,
        queuedAt: new Date().toISOString(),
        attempts: 0,
      } satisfies QueuedSubmission),
    )
  } catch (error) {
    // Nothing useful to do: the guest is already looking at their thank-you.
    console.error('[kiosk] could not queue submission:', error)
  }
}

export async function pending(): Promise<QueuedSubmission[]> {
  if (typeof indexedDB === 'undefined') return []
  try {
    return await transact<QueuedSubmission[]>('readonly', (store) => store.getAll())
  } catch {
    return []
  }
}

async function remove(submissionId: string): Promise<void> {
  try {
    await transact('readwrite', (store) => store.delete(submissionId))
  } catch {
    // Leaving it queued means one more harmless retry.
  }
}

async function bumpAttempts(entry: QueuedSubmission): Promise<void> {
  try {
    await transact('readwrite', (store) => store.put({ ...entry, attempts: entry.attempts + 1 }))
  } catch {
    /* best effort */
  }
}

/** Give up after this many tries so a permanently rejected payload cannot loop. */
const MAX_ATTEMPTS = 20

/**
 * Try to send everything queued. Safe to call repeatedly and concurrently:
 * the server is idempotent on submissionId.
 */
export async function flush(): Promise<{ sent: number; remaining: number }> {
  const queue = await pending()
  let sent = 0

  for (const entry of queue) {
    if (entry.attempts >= MAX_ATTEMPTS) {
      console.error('[kiosk] dropping submission after too many attempts:', entry.submissionId)
      await remove(entry.submissionId)
      continue
    }

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry.payload),
      })

      if (response.ok) {
        await remove(entry.submissionId)
        sent += 1
        continue
      }

      // 4xx that is not rate limiting means the server will never accept this
      // payload; retrying forever would just be noise.
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        console.error('[kiosk] server rejected a queued submission:', response.status)
        await remove(entry.submissionId)
        continue
      }

      await bumpAttempts(entry)
    } catch {
      // Still offline. Leave it queued.
      await bumpAttempts(entry)
    }
  }

  return { sent, remaining: (await pending()).length }
}
