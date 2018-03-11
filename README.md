# qiniu-cdn-webpack-plugin
> 将webpack编译之后的文件上传到七牛云，支持上传前删除bucket中的旧文件，上传之后刷新cdn。

## 特性
- [x] 支持上传到七牛云指定`bucket`
- [x] 支持排除指定文件
- [ ] 支持对比上传
- [x] 支持上传前清空指定`bucket`
- [x] 支持上传完成后刷新cdn

## 安装
```shell
npm install --save-dev qiniu-cdn-webpack-plugin
```
```shell
yarn add --dev qiniu-cdn-webpack-plugin
```

## 使用方法

**本插件最低支持node@6.x 建议使用最新LTS版本 可以使用[n](https://github.com/tj/n)管理node版本**

```js
//webpack config
const Qiniu = require('qiniu-cdn-webpack-plugin')

const CDN_HOST = `https://static.qiniuxxx.com/`
module.exports = {
  entry: 'app.js',
  output: {
    path: __dirname + '/dist',
    filename: 'app.[chunkhash].js',
    //配置webpack打包后插入文件时的cdn
    publicPath: CDN_HOST
  },
  plugins: [
    new Qiniu({
        accessKey: 'accessKey',
        secretKey: 'secretKey',
        bucket: 'static_bucket',
        zone: 'Zone_z0',
        exclude: /\.html/,
        refreshCDN: CDN_HOST,
        refreshFilter: /(a\.js)|(b\.js)/
        clean: true,
        cleanExclude: /c\.js/
    })
  ]
}
```
## 参数
|Name|Type|Default|Description|
|:--:|:--:|:-----:|:----------|
|**[`accessKey`](#)**|`{Sring}`||七牛提供的`accessKey`|
|**[`secretKey`](#)**|`{Sring}`||七牛提供的`secretKey`|
|**[`bucket`](#)**|`{Sring}`||七牛云存储中的`bucket`|
|**[`zone`](#)**|`{Sring}`|`Zone_z1`|七牛云存储位置，华东 `Zone_z0`、华北 `Zone_z1`、华南 `Zone_z2`、北美 `Zone_na0`|
|**[`chunkSize`](#)**|`{Number}`|`20`|每次并行上传的文件个数|
|**[`exclude`](#)**|`{RegExp}`||要排除的文件名正则规则|
|**[`refreshCDN`](#)**|`{Sring}`||想要刷新cdn的域名，不填写默认不刷新cdn，填写默认上传完成后刷新此次上传的所有文件|
|**[`refreshFilter`](#)**|`{RegExp|Function}`||七牛限额每天只能刷新500个文件，通过这个参数可以过滤出想要刷新的文件。|
|**[`clean`](#)**|`{Boolean}`|false|上传之后，删除七牛云存储`bucket`中的除了本次上传之外的所以文件，防止每次文件名称变动`hash`，产生多余垃圾文件。|
|**[`cleanExclude`](#)**|`{RegExp|Function}`||通过这个参数可以过滤出七牛中不想清除的文件|

## License

```
MIT License

Copyright (c) 2018 ZhangZhiheng
```

