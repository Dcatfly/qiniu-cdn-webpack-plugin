# webpack-qiniu-plugin
> 将webpack编译之后的文件上传到七牛云

## 特性
- [x] 支持上传到七牛云指定`bucket`
- [x] 支持排除指定文件
- [ ] 支持对比上传
- [x] 支持上传前清空指定`bucket`
- [x] 支持上传完成后刷新cdn

## 安装

## 使用方法
```js
//webpack config
const Qiniu = require('webpack-qiniu-plugin')

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
        clean: true
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
|**[`exclude`](#)**|`{Regexp}`||要排除的文件名正则规则|
|**[`refreshCDN`](#)**|`{Sring}`||想要刷新cdn的域名，不填写默认不刷新cdn，填写默认上传完成后刷新此次上传的所有文件|
|**[`clean`](#)**|`{Boolean}`|false|上传之前删除七牛云存储`bucket`中的所有文件，防止每次文件名称变动`hash`，产生多余垃圾。|

## License

```
MIT License

Copyright (c) 2018 ZhangZhiheng
```

