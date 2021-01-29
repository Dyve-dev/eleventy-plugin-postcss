import fs from 'fs-extra';
import path from 'path';
import { readdirSync } from 'fs';
import minimatch from 'minimatch';
import { Result, Postcss } from 'postcss';
import Debug from 'debug';
import colors from 'colors';
const postcss: Postcss = require('postcss');

// Types
import { PluginOptions } from './types';

const debug = Debug('dyve:11typlugin:postcss');
const debugExcludes = debug.extend('excludes');

const defaultOptions: PluginOptions = {
  outDir: 'public/styles',
  srcDir: 'src/styles',
  files: [],
  plugins: [],
  exclude: [],
};

let _pluginOptions = { ...defaultOptions };
/*
 ** pluginOption.exclude allows to exclude some files from postCSS processing
 */
function WalkSync(Path: string, prefix?: string, options = { ignoreDirs: false }) {
  let Files: string[] = [];
  try {
    let Listing = readdirSync(Path, { withFileTypes: true });

    Listing.forEach((item) => {
      if (!item.isDirectory()) {
        Files.push(prefix ? path.join(prefix, item.name) : item.name);
      } else {
        if (!options.ignoreDirs) {
          Files = Files.concat(WalkSync(path.join(Path, item.name), item.name));
        }
      }
    });
  } catch (err) {
    console.error(err.message);
  }
  return Files;
}

function filterExcludes(FilesList: string[]) {
  let filtered = [...FilesList];
  let excludes;
  if (typeof _pluginOptions.exclude === 'string') excludes = [_pluginOptions.exclude];
  else excludes = [..._pluginOptions.exclude];

  for (let pattern of excludes) {
    debugExcludes(pattern);
    let _pattern = path.normalize(pattern);
    filtered = filtered.filter(minimatch.filter(_pattern, { matchBase: true, nocase: true }));
  }
  return FilesList.filter((f) => !filtered.includes(f));
}

function postCss(options = defaultOptions) {
  _pluginOptions = { ...defaultOptions, ...options };

  let styleFiles = WalkSync(_pluginOptions.srcDir).map((f) =>
    path.posix.normalize(path.join(_pluginOptions.srcDir, f))
  );
  styleFiles = filterExcludes(styleFiles);
  styleFiles = styleFiles.concat(_pluginOptions.files);
  debug('styles: %O', styleFiles);
  for (const style of styleFiles) {
    let dest = path.join(
      _pluginOptions.outDir,
      style.replace(path.normalize(_pluginOptions.srcDir), '')
    );

    if (path.extname(dest) !== '.css')
      dest = path.join(path.dirname(dest), path.basename(dest, path.extname(dest)) + '.css');

    if (_pluginOptions.files.includes(style)) {
      dest = path.join(_pluginOptions.outDir, path.basename(style, path.extname(style)) + '.css');
    }
    debug('dest:', dest);
    fs.readFile(style, 'utf-8', (err, css) => {
      if (err) {
        console.error(err);
      } else {
        // TODO: test if postcss plugin node-sass works properly
        /* if (style.endsWith('.scss')) {
          let processed = sass.renderSync({
            data: css,
            includePaths: [_pluginOptions.srcDir],
          });
          css = processed.css.toString();
        } */

        postcss(_pluginOptions.plugins)
          .process(css, { from: style, to: dest })
          .then((result: Result) => {
            if (result && result.opts && result.opts.to)
              fs.outputFile(result.opts.to, result.css, () => true);
            else console.error(colors.bold.red('Some error occured in postcss'));
            if (result.opts && result.map) {
              fs.outputFile(result.opts.to + '.map', result.map, () => true);
            }
          });
      }
    });
  }
}

export default {
  initArguments: {},
  configFunction: async (eleventyConfig: any, options = defaultOptions) => {
    eleventyConfig.on('beforeWatch', (changedFiles: Array<string>) => {
      // emitted in watch or serve mode after some files are changed
      if (
        changedFiles.some((file: string) => {
          return file.endsWith('.css') || file.endsWith('.scss');
        })
      ) {
        debug('rebuild styles');
        postCss(options);
      }
    });
    // called on the initial run
    postCss(options);
  },
};
