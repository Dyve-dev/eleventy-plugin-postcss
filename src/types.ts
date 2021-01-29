export interface PluginOptions {
  outDir: string;
  srcDir: string;
  files: string[];
  /* tailwindcss: {
    src: string;
    dest: string;
  }; */
  plugins: Array<any>;
  exclude: string[];
}
