declare module 'spark-md5' {
  export default class SparkMD5 {
    static hash(data: string): string;
    append(data: globalThis.ArrayBuffer): void;
    destroy(): void;
    end(): string;
    getState(): { buff: Uint8Array; length: number; hash: number };
    reset(): void;
    setState(state: { buff: Uint8Array; length: number; hash: number }): void;
  }
}
