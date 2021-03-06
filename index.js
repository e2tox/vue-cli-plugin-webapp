const path = require('path')

module.exports = (api, options) => {
  const fs = require('fs')
  const useThreads = process.env.NODE_ENV === 'production' && options.parallel

  const resolve = (files) => {
    return files.find((file) => {
      return fs.existsSync(api.resolve(file));
    })
  };

  const configFiles = {
    tslint: resolve(['src/webapp/tslint.json','src/tslint.json']),
    tsconfig: resolve(['src/webapp/tsconfig.json','src/tsconfig.json'])
  }

  api.chainWebpack(config => {
    config.resolveLoader.modules.prepend(path.join(__dirname, '../../node_modules'))

    if (!options.pages) {
      config.entry('app')
        .clear()
        .add('./src/webapp/main.ts')
    }

    config.resolve
      .extensions
      .merge(['.ts', '.tsx'])

    const tsRule = config.module.rule('ts').test(/\.ts$/)
    const tsxRule = config.module.rule('tsx').test(/\.tsx$/)



    // add a loader to both *.ts & vue<lang="ts">
    const addLoader = ({ loader, options }) => {
      tsRule.use(loader).loader(loader).options(options)
      tsxRule.use(loader).loader(loader).options(options)
    }

    addLoader({
      loader: 'cache-loader',
      options: api.genCacheConfig('ts-loader', {
        'ts-loader': require('ts-loader/package.json').version,
        'typescript': require('typescript/package.json').version,
        modern: !!process.env.VUE_CLI_MODERN_BUILD
      }, configFiles.tslint)
    })

    if (useThreads) {
      addLoader({
        loader: 'thread-loader'
      })
    }

    if (api.hasPlugin('babel')) {
      console.log('add babel loader')
      addLoader({
        loader: 'babel-loader',
        options: {
          presets: ['minify'],
          plugins: [require('babel-plugin-syntax-dynamic-import')]
        }
      })
    }
    addLoader({
      loader: 'ts-loader',
      options: {
        transpileOnly: true,
        appendTsSuffixTo: ['\\.vue$'],
        configFile: api.resolve(configFiles.tsconfig),
        // https://github.com/TypeStrong/ts-loader#happypackmode-boolean-defaultfalse
        happyPackMode: useThreads
      }
    })
    // make sure to append TSX suffix
    tsxRule.use('ts-loader').loader('ts-loader').tap(options => {
      options = Object.assign({}, options)
      delete options.appendTsSuffixTo
      options.appendTsxSuffixTo = ['\\.vue$']
      return options
    })

    // if (!process.env.VUE_CLI_TEST) {
    //   // this plugin does not play well with jest + cypress setup (tsPluginE2e.spec.js) somehow
    //   // so temporarily disabled for vue-cli tests
    //   config
    //     .plugin('fork-ts-checker')
    //     .use(require('fork-ts-checker-webpack-plugin'), [{
    //       vue: true,
    //       tsconfig: configFiles.tsconfig,
    //       tslint: options.lintOnSave !== false && configFiles.tslint,
    //       formatter: 'codeframe',
    //       // https://github.com/TypeStrong/ts-loader#happypackmode-boolean-defaultfalse
    //       checkSyntacticErrors: useThreads
    //     }])
    // }
  })

  if (!api.hasPlugin('eslint')) {
    api.registerCommand('lint', {
      descriptions: 'lint source files with TSLint',
      usage: 'vue-cli-service lint [options] [...files]',
      options: {
        '--format [formatter]': 'specify formatter (default: codeFrame)',
        '--no-fix': 'do not fix errors',
        '--formatters-dir [dir]': 'formatter directory',
        '--rules-dir [dir]': 'rules directory'
      }
    }, args => {
      return require('./lib/tslint')(args, api)
    })
  }
}

