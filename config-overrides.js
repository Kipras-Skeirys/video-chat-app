const path = require('path')

module.exports = {
    paths: function (paths, env) {
        paths.appPath = path.resolve(__dirname, './front-end')
        paths.appPublic = path.resolve(__dirname, './front-end/public')
        paths.appHtml = path.resolve(__dirname, './front-end/public/index.html')
        paths.appIndexJs = path.resolve(__dirname, './front-end/src/index.js')
        paths.appSrc = path.resolve(__dirname, './front-end/src')
        return paths
    },
}