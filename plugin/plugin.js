"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const fs_1 = require("fs");
const minimatch_1 = __importDefault(require("minimatch"));
const debug_1 = __importDefault(require("debug"));
const colors_1 = __importDefault(require("colors"));
const postcss = require('postcss');
const debug = debug_1.default('dyve:11typlugin:postcss');
const debugExcludes = debug.extend('excludes');
const defaultOptions = {
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
function WalkSync(Path, prefix, options = { ignoreDirs: false }) {
    let Files = [];
    try {
        let Listing = fs_1.readdirSync(Path, { withFileTypes: true });
        Listing.forEach((item) => {
            if (!item.isDirectory()) {
                Files.push(prefix ? path_1.default.join(prefix, item.name) : item.name);
            }
            else {
                if (!options.ignoreDirs) {
                    Files = Files.concat(WalkSync(path_1.default.join(Path, item.name), item.name));
                }
            }
        });
    }
    catch (err) {
        console.error(err.message);
    }
    return Files;
}
function filterExcludes(FilesList) {
    let filtered = [...FilesList];
    let excludes;
    if (typeof _pluginOptions.exclude === 'string')
        excludes = [_pluginOptions.exclude];
    else
        excludes = [..._pluginOptions.exclude];
    for (let pattern of excludes) {
        debugExcludes(pattern);
        let _pattern = path_1.default.normalize(pattern);
        filtered = filtered.filter(minimatch_1.default.filter(_pattern, { matchBase: true, nocase: true }));
    }
    return FilesList.filter((f) => !filtered.includes(f));
}
function postCss(options = defaultOptions) {
    _pluginOptions = { ...defaultOptions, ...options };
    let styleFiles = WalkSync(_pluginOptions.srcDir).map((f) => path_1.default.posix.normalize(path_1.default.join(_pluginOptions.srcDir, f)));
    styleFiles = filterExcludes(styleFiles);
    styleFiles = styleFiles.concat(_pluginOptions.files);
    debug('styles: %O', styleFiles);
    for (const style of styleFiles) {
        let dest = path_1.default.join(_pluginOptions.outDir, style.replace(path_1.default.normalize(_pluginOptions.srcDir), ''));
        if (path_1.default.extname(dest) !== '.css')
            dest = path_1.default.join(path_1.default.dirname(dest), path_1.default.basename(dest, path_1.default.extname(dest)) + '.css');
        if (_pluginOptions.files.includes(style)) {
            dest = path_1.default.join(_pluginOptions.outDir, path_1.default.basename(style, path_1.default.extname(style)) + '.css');
        }
        debug('dest:', dest);
        fs_extra_1.default.readFile(style, 'utf-8', (err, css) => {
            if (err) {
                console.error(err);
            }
            else {
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
                    .then((result) => {
                    if (result && result.opts && result.opts.to)
                        fs_extra_1.default.outputFile(result.opts.to, result.css, () => true);
                    else
                        console.error(colors_1.default.bold.red('Some error occured in postcss'));
                    if (result.opts && result.map) {
                        fs_extra_1.default.outputFile(result.opts.to + '.map', result.map, () => true);
                    }
                });
            }
        });
    }
}
exports.default = {
    initArguments: {},
    configFunction: async (eleventyConfig, options = defaultOptions) => {
        eleventyConfig.on('beforeWatch', (changedFiles) => {
            // emitted in watch or serve mode after some files are changed
            if (changedFiles.some((file) => {
                return file.endsWith('.css') || file.endsWith('.scss');
            })) {
                debug('rebuild styles');
                postCss(options);
            }
        });
        // called on the initial run
        postCss(options);
    },
};
