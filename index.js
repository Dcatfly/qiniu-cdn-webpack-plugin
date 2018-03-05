const qiniu = require('qiniu')
const ora = require('ora');

// 上传进度
const tip = (uploaded, total) => {
  let percentage = Math.round(uploaded / total * 100);
  return `Uploading to Qiniu CDN: ${percentage}% ${uploaded}/${total} files uploaded`;
};


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
      const fileNames = Object.keys(assets).filter((fileName) => {
        const file = assets[fileName] || {};
        if (!file.emitted) return false;
        return true
      })
      const {bucket, zone, accessKey, secretKey, clear, refresh} = this.options;
      let total = fileNames.length, uploaded = 0;

      const config = new qiniu.conf.Config();
      config.zone = qiniu.zone[zone] || qiniu.zone.Zone_z1;
      qiniu.conf.RPC_TIMEOUT = 600000;

      console.log('\n');
      let spinner = ora({
        text: tip(0, total),
        color: 'green'
      }).start();

      //构建上传单个文件函数
      const upload = (fileName) => {
        const file = assets[fileName] || {}
        const mac = new qiniu.auth.digest.Mac(accessKey, secretKey);
        const putPolicy = new qiniu.rs.PutPolicy({scope: `${bucket}:${fileName}`});
        const upToken = putPolicy.uploadToken(mac);
        const formUploader = new qiniu.form_up.FormUploader(config);
        const putExtra = new qiniu.form_up.PutExtra();

        return new Promise((resolve, reject) => {
          formUploader.putFile(upToken, fileName, file.existsAt, putExtra, function (err, respBody, respInfo) {
            uploaded++;
            spinner.text = tip(uploaded, total);
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


      console.log(Object.keys(assets))


      callback()
    })
  }
}