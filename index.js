const qiniu = require('qiniu')
const ora = require('ora');
const chunk = require('lodash.chunk')
const path = require('path')

//七牛配置初始化
const config = new qiniu.conf.Config();

//七牛刷新cdn每次最大的数目
const MAX_REFRESH_CDN = 100

// 上传进度
const spinner = ora({
  color: 'green'
});
const tip = ({done = 0, total, type = 'uploading'}) => {
  if(total){
    let percentage = Math.round(done / total * 100);
    spinner.text = `Qiniu CDN ${type}: ${percentage}% ${done}/${total} `;
  }else{
    spinner.text = 'wait for webpack compiler...'
  }

  if (done === 0){
    console.log('\n');
    spinner.start()
  }
  done === total && spinner.succeed()

};



//上传完成
const finish = ({err, callback}) => {
  err && spinner.fail()
  callback && callback(err)
}

//刷新CDN 限额500每天
const refresh = (fileNames, mac, cdn) => {
  //@TODO 增加处理函数 可以指定刷新符合处理函数规则的file
  const cdnManager = new qiniu.cdn.CdnManager(mac);
  let total = fileNames.length, refreshed = 0, type = 'refreshing';
  tip({type})
  const _refresh = (urls) => {
    return new Promise((resolve, reject) => {
      cdnManager.refreshUrls(urls, function (err, respBody, respInfo) {
        refreshed += urls.length;
        tip({done: refreshed, total, type})
        if (err) {
          console.log(respBody)
          reject(err)
        }
        if (respInfo.statusCode == 200) {
          resolve()
        }else {
          console.log(respInfo)
          reject(respBody)
        }
      });
    })
  }
  //每次只能包含100个cdn链接
  return Promise.all(chunk(fileNames, MAX_REFRESH_CDN).
      map(chunkFiles => _refresh(chunkFiles.map(name => path.join(cdn, name))))
  )

}



module.exports = class QiniuPlugin {
  constructor(options){
    if(!options || !options.accessKey || !options.secretKey){
      throw new Error(`accessKey and secretKey must be provided`)
    }
    this.options = {...options}
  }

  apply(compiler) {
    compiler.plugin('after-emit', (compilation, callback) => {
      const {assets} = compilation;
      const {bucket, zone, accessKey, secretKey, chunkSize = 20, exclude, clear, refreshCDN} = this.options;

      const fileNames = Object.keys(assets).filter((fileName) => {
        const file = assets[fileName] || {};
        if (!file.emitted || new RegExp(exclude).test(fileName)) return false;
        return true
      })
      let total = fileNames.length, uploaded = 0;

      config.zone = qiniu.zone[zone] || qiniu.zone.Zone_z1;
      qiniu.conf.RPC_TIMEOUT = 600000;

      //打印上传状态
      tip({})

      //构建上传单个文件函数
      const upload = (fileName) => {
        const file = assets[fileName] || {}
        const mac = new qiniu.auth.digest.Mac(accessKey, secretKey);
        const putPolicy = new qiniu.rs.PutPolicy({scope: `${bucket}:${fileName}`});
        const upToken = putPolicy.uploadToken(mac);
        const formUploader = new qiniu.form_up.FormUploader(config);
        const putExtra = new qiniu.form_up.PutExtra();

        return new Promise((resolve, reject) => {
          return formUploader.putFile(upToken, fileName, file.existsAt, putExtra, function (err, respBody, respInfo) {
            uploaded++;
            tip({done: uploaded, total});
            if (err) {
              console.log(fileName + ' upload failed')
              reject(err)
            } else if (respInfo.statusCode == 200) {
              // console.log('success')
              // console.log(ret)
              // 上传成功， 处理返回值
              // console.log(ret.hash, ret.key, ret.persistentId);
              resolve()
            } else {
              console.log(respInfo.statusCode);
              console.log(respBody);
              reject(respBody)
            }

          });
        })
      }

      //分块执行上传函数
      const copyFileNames = [...fileNames]
      const uploadChunk = (err) => {
        const chunkFiles = [].splice.call(copyFileNames, 0, chunkSize)
        if (err) return Promise.reject(err)
        if(chunkFiles.length > 0){
          return Promise.all(chunkFiles.map(fileName => upload(fileName))).
              then(() => uploadChunk()).catch(uploadChunk)
        }else{
          return Promise.resolve()
        }
      }

      uploadChunk().then(() => {
        const mac = new qiniu.auth.digest.Mac(accessKey, secretKey);
        return refreshCDN && refresh(fileNames, mac, refreshCDN)
      }).then(() => {
        finish({callback})
      }).catch((err) => {
        finish({callback, err})
      })


    })
  }
}