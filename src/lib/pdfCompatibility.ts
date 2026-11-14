/**
 * Compatibility helpers required by PDF.js 6 on older iOS WebKit releases.
 * Kept in a tiny module so the main thread and PDF worker install the same
 * shims before loading the PDF.js engine.
 */
type KnownKey = string | number | symbol | object | null | undefined

function wrapIterator(source: { next: () => IteratorResult<unknown> }, prototype: object): Iterator<unknown> {
  const wrapped = { next: () => source.next(), [Symbol.iterator]() { return this } }
  Object.setPrototypeOf(wrapped, prototype)
  return wrapped as Iterator<unknown>
}

export function installPdfCompatibility(): void {
  const mapPrototype = Map.prototype as Map<KnownKey, unknown> & {
    getOrInsertComputed?: (key: KnownKey, callback: (key: KnownKey) => unknown) => unknown
  }
  if (typeof mapPrototype.getOrInsertComputed !== 'function') {
    Object.defineProperty(Map.prototype, 'getOrInsertComputed', {
      configurable: true,
      writable: true,
      value: function <K, V>(this: Map<K, V>, key: K, callback: (key: K) => V): V {
        if (this.has(key)) return this.get(key) as V
        const value = callback(key)
        this.set(key, value)
        return value
      },
    })
  }

  const iteratorPrototype = Object.getPrototypeOf(Object.getPrototypeOf([][Symbol.iterator]())) as Record<string, unknown>
  const define = (name: string, value: (...args: any[]) => any) => {
    if (typeof iteratorPrototype[name] !== 'function') {
      try { Object.defineProperty(iteratorPrototype, name, { configurable: true, writable: true, value }) } catch { /* native prototype may be locked */ }
    }
  }
  define('map', function (this: any, mapper: (value: unknown, index: number) => unknown) {
    const source = this
    let index = 0
    return wrapIterator({ next: () => { const item = source.next(); return item.done ? item : { done: false, value: mapper(item.value, index++) } } }, iteratorPrototype)
  })
  define('filter', function (this: any, predicate: (value: unknown, index: number) => boolean) {
    const source = this
    let index = 0
    return wrapIterator({ next: () => {
      while (true) {
        const item = source.next()
        if (item.done || predicate(item.value, index++)) return item
      }
    } }, iteratorPrototype)
  })
  define('toArray', function (this: any) {
    const values: unknown[] = []
    for (let item = this.next(); !item.done; item = this.next()) values.push(item.value)
    return values
  })
  define('forEach', function (this: any, callback: (value: unknown, index: number) => void) {
    let index = 0
    for (let item = this.next(); !item.done; item = this.next()) callback(item.value, index++)
  })
  define('some', function (this: any, predicate: (value: unknown, index: number) => boolean) {
    let index = 0
    for (let item = this.next(); !item.done; item = this.next()) if (predicate(item.value, index++)) return true
    return false
  })
  define('every', function (this: any, predicate: (value: unknown, index: number) => boolean) {
    let index = 0
    for (let item = this.next(); !item.done; item = this.next()) if (!predicate(item.value, index++)) return false
    return true
  })
  define('find', function (this: any, predicate: (value: unknown, index: number) => boolean) {
    let index = 0
    for (let item = this.next(); !item.done; item = this.next()) if (predicate(item.value, index++)) return item.value
    return undefined
  })

  const root = globalThis as typeof globalThis & { Iterator?: { from?: (value: Iterable<unknown> | Iterator<unknown>) => Iterator<unknown> } }
  if (typeof root.Iterator?.from !== 'function') {
    const constructor = (root.Iterator ?? function Iterator() {}) as NonNullable<typeof root.Iterator>
    constructor.from = (value) => {
      const source = Symbol.iterator in Object(value) ? (value as Iterable<unknown>)[Symbol.iterator]() : value as Iterator<unknown>
      return wrapIterator(source, iteratorPrototype) as Iterator<unknown>
    }
    Object.defineProperty(globalThis, 'Iterator', { configurable: true, writable: true, value: constructor })
  }
}
