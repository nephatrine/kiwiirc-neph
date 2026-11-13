const path = require('path');
const fs = require('fs');
const execSync = require('child_process').execSync;
const DefinePlugin = require('webpack').DefinePlugin;
const NormalModuleReplacementPlugin = require('webpack').NormalModuleReplacementPlugin;
const ProvidePlugin = require('webpack').ProvidePlugin;
const CopyWebpackPlugin = require('copy-webpack-plugin');
const StyleLintPlugin = require('stylelint-webpack-plugin');
const ConvertLocalesPlugin = require('./build/webpack/convert-locales');
const pkg = require('./package.json');

const makeSourceMap = process.argv.indexOf('--nomap') === -1;

// vue-loader imports extracted style blocks as default exports, while
// mini-css-extract-plugin emits a module with no exports. Webpack reports that
// combination as a warning even though the style block is only side-effectful.
class IgnoreStyleExportWarningsPlugin {
    apply(compiler) {
        compiler.hooks.afterCompile.tap('IgnoreStyleExportWarningsPlugin', (compilation) => {
            compilation.warnings = compilation.warnings.filter((warning) => (
                !/export 'default' \(imported as 'style\d+'\) was not found/.test(
                    warning.message || ''
                )
            ));
        });
    }
}

module.exports = {
    publicPath: '',
    assetsDir: 'static/',
    runtimeCompiler: true,
    transpileDependencies: ['irc-framework'],
    productionSourceMap: makeSourceMap,
    css: {
        sourceMap: makeSourceMap,
    },
    configureWebpack: {
        resolve: {
            extensions: ['.js', '.vue', '.json'],
            alias: {
                vue$: 'vue/dist/vue.common.js',
            },
            fallback: {
                stream: require.resolve('stream-browserify'),
            },
            // This prevents linked modules from getting linted
            symlinks: false,
        },
        performance: {
            maxEntrypointSize: 1835008, // 1.75MiB
            maxAssetSize: 1048576, // 1MiB
        },
        optimization: {
            splitChunks: {
                cacheGroups: {
                    defaultVendors: {
                        name: 'chunk-vendors',
                        chunks: 'initial',
                        enforce: true,
                        test: (m) => /[\\/]node_modules[\\/]/.test(m.resource ?? m.context ?? '') && m.constructor.name !== 'CssModule',
                    },
                },
            },
        },
        plugins: [
            new DefinePlugin({
                __VERSION__: JSON.stringify(pkg.version),
                __COMMITHASH__: JSON.stringify(getCommitHash()),
            }),
            new ProvidePlugin({
                Buffer: ['buffer', 'Buffer'],
            }),
            // sockjs-client registers a deprecated unload listener. Replace its
            // event helper with one that uses pagehide instead.
            new NormalModuleReplacementPlugin(
                /sockjs-client[\\/]lib[\\/]utils[\\/]event\.js$/,
                path.resolve(__dirname, 'build/webpack/sockjs-event.js')
            ),
            new StyleLintPlugin({
                files: ['src/**/*.{vue,htm,html,css,sss,less,scss}'],
            }),
            new IgnoreStyleExportWarningsPlugin(),
            new ConvertLocalesPlugin(),
            new CopyWebpackPlugin({
                patterns: [
                    {
                        from: path.join(__dirname, 'static/'),
                        to: path.join(__dirname, 'dist/static/'),
                        toType: 'dir',
                        globOptions: {
                            ignore: ['**/.*', '**/config.local.json'],
                        },
                        info: { minimized: true },
                    },
                ],
            }),
        ],
    },
    chainWebpack: (config) => {
        config.plugin('html').tap((args) => {
            args[0].template = path.join(__dirname, 'index.html');
            args[0].minify = false;
            return args;
        });

        // add build/ to resolveLoader for exports-loader
        config.resolveLoader.modules.add(path.resolve(__dirname, 'build/webpack/'));

        // add exports-loader for GobalApi
        const vueRule = config.module.rule('vue');
        const vueOptions = vueRule.uses.get('vue-loader').get('options');
        vueRule.uses.clear();
        vueRule.use('exports-loader').loader('exports-loader');
        vueRule.use('vue-loader').loader('vue-loader').options(vueOptions);

        const jsRule = config.module.rule('js');
        jsRule.uses.clear();
        jsRule.use('exports-loader').loader('exports-loader');
        jsRule.use('babel-loader').loader('babel-loader');

        config.module
            .rule('html')
            .test(/\.html$/)
            .exclude.add(path.join(__dirname, 'index.html')).end()
            .use('html-loader')
            .loader('html-loader');
    },
};

// override config.json with config.local.json if it exists
if (process.env.NODE_ENV === 'development') {
    let plugins = module.exports.configureWebpack.plugins;
    let localConfig = path.resolve(__dirname, 'static/config.local.json');
    if (fs.existsSync(localConfig)) {
        plugins.push(new CopyWebpackPlugin({
            patterns: [
                {
                    from: localConfig,
                    to: path.join(__dirname, 'dist/static/config.json'),
                    force: true,
                },
            ],
        }));
    }
}

function getCommitHash() {
    let commitHash = 'unknown';
    try {
        commitHash = execSync('git rev-parse --short HEAD').toString().trim();
        const modified = execSync('git diff-index --quiet HEAD -- || echo true').toString();
        if (modified.trim() === 'true') {
            commitHash += '-modified';
        }
    } catch {
        console.error('Failed to get commit hash');
    }
    return commitHash;
}
