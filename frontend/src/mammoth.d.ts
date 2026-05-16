declare module "mammoth" {
  interface ConvertOptions {
    arrayBuffer?: ArrayBuffer;
    path?: string;
  }
  interface ConvertResult {
    value: string;      // HTML string
    messages: unknown[];
  }
  export function convertToHtml(options: ConvertOptions): Promise<ConvertResult>;
  export function extractRawText(options: ConvertOptions): Promise<ConvertResult>;
}
