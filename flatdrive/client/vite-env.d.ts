/** Vite asset-URL imports (e.g. the bundled pdf.js worker). */
declare module "*?url" {
  const url: string;
  export default url;
}
