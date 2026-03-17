declare module 'spark-md5' {
  export default class SparkMD5 {
    static hash(data: string): string
    append(data: globalThis.ArrayBuffer): void
    end(): string
    reset(): void
    getState(): { buff: Uint8Array; length: number; hash: number }
    setState(state: { buff: Uint8Array; length: number; hash: number }): void
    destroy(): void
  }
}
