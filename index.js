const qiniu = require('qiniu')
const ora = require('ora');
const chunk = require('lodash.chunk')
const isFunction = require('lodash.isfunction')

//七牛配置初始化
const config = new qiniu.conf.Config();
qiniu.conf.RPC_TIMEOUT = 600000;


//七牛单次刷新cdn、单次删除文件 最大的数目
const MAX_SINGLE_REFRESH = 100;
const MAX_SINGLE_DELETE = 1000;

//处理进度
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

//utils cdn拼接 处理cdn后面的'/'
const _join = (cdn, path) => {
  return cdn.substr(-1) === '/' ? cdn + path : `${cdn}/${path}`
}



//上传&删除&刷新完成
const finish = ({err, callback}) => {
  err && spinner.fail()
  callback && callback(err)
}

//刷新CDN 限额500每天
const refresh = (fileNames, mac, cdn) => {
  const cdnManager = new qiniu.cdn.CdnManager(mac);
  let total = fileNames.length, refreshed = 0, type = 'refreshing';
  tip({type})
  const _refresh = (urls) => {
    return new Promise((resolve, reject) => {
      cdnManager.refreshUrls(urls, function (err, respBody, respInfo) {
        refreshed += urls.length;
        tip({done: refreshed, total, type})
        if (err) {
          reject(err)
        }
        if (respInfo.statusCode == 200) {
          //qiniu的工程师厉害了。。。
          respBody = JSON.parse(respBody)
          if(respBody.code === 200 || respBody.error === 'success'){
            resolve()
          }
          reject({message: `refresh error`, respBody})
        }else {
          reject(respBody)
        }
      });
    })
  }
  //每次只能包含100个cdn链接
  return Promise.all(chunk(fileNames, MAX_SINGLE_REFRESH).
      map(chunkFiles => _refresh(chunkFiles.map(name => _join(cdn, name))))
  )

}

//删除指定bucket内的指定资源
const deleteFiles = (bucket, mac, filter = () => true) => {
  const bucketManager = new qiniu.rs.BucketManager(mac, config);
  let deleted = 0, total = 0, type = 'deleting';
  const getAllFiles = (marker, preItems = []) => {
    // @param options 列举操作的可选参数
    //                prefix    列举的文件前缀
    //                marker    上一次列举返回的位置标记，作为本次列举的起点信息
    //            limit     每次返回的最大列举文件数量
    //            delimiter 指定目录分隔符
    let opt = {prefix: ''};
    marker && (opt.marker = marker);
    return new Promise((resolve, reject) => {
      bucketManager.listPrefix(bucket, opt, function (err, respBody, respInfo) {
        if (err) {
          reject(err)
        }

        if (respInfo.statusCode == 200) {
          //如果这个nextMarker不为空，那么还有未列举完毕的文件列表，下次调用listPrefix的时候，
          //指定options里面的marker为这个值
          let nextMarker = respBody.marker;
          if (nextMarker) {
            return getAllFiles(nextMarker, preItems.concat(respBody.items))
          } else {
            resolve(preItems.concat(respBody.items))
          }

        } else {
          reject(respBody)
        }
      });

    })
  }

  const _deleteChunkFiles = (files) => {
    return new Promise((resolve, reject) => {
      bucketManager.batch(files, function (err, respBody, respInfo) {
        deleted += files.length;
        tip({done: deleted, total, type})
        if (err) {
          reject(err);
        } else {
          // 200 is success, 298 is part success
          if (parseInt(respInfo.statusCode / 100) == 2) {
            resolve()
          } else {
            reject(respBody);
          }
        }
      });
    })
  }

  return getAllFiles().then((files) => {
    files = files.filter((file) => filter(file.key))
    total = files.length;
    tip({total, type})
    return Promise.all(chunk(files, MAX_SINGLE_DELETE).
        map(chunkFiles => _deleteChunkFiles(chunkFiles.map(file => qiniu.rs.deleteOp(bucket, file.key)))))
  })

}



module.exports = class QiniuPlugin {
  constructor(options){
    if(!options || !options.accessKey || !options.secretKey){
      throw new Error(`accessKey and secretKey must be provided`)
    }
    const {zone} = options;
    config.zone = qiniu.zone[zone] || qiniu.zone.Zone_z1;

    this.options = {...options}
  }

  apply(compiler) {
    compiler.plugin('after-emit', (compilation, callback) => {
      const {assets} = compilation;
      const {bucket, accessKey, secretKey, chunkSize = 20, exclude, clean, refreshCDN, refreshFilter} = this.options;
      const fileNames = Object.keys(assets).filter((fileName) => {
        const file = assets[fileName] || {};
        if (!file.emitted || new RegExp(exclude).test(fileName)) return false;
        return true
      })
      let total = fileNames.length, uploaded = 0, refreshFilterFunc = refreshFilter;

      refreshFilterFunc && !isFunction(refreshFilterFunc) && (refreshFilterFunc = (name) => {
        return new RegExp(refreshFilter).test(name)
      })



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

      //打印上传状态 开始上传
      tip({})
      uploadChunk().then(() => {
        const mac = new qiniu.auth.digest.Mac(accessKey, secretKey);
        return clean && deleteFiles(bucket, mac, (fileName) => !fileNames.includes(fileName))
      }).then(() => {
        const mac = new qiniu.auth.digest.Mac(accessKey, secretKey);
        return refreshCDN && refresh(fileNames.filter(refreshFilterFunc), mac, refreshCDN)
      }).then(() => {
        finish({callback})
      }).catch((err) => {
        console.log(err)
        finish({callback, err})
      })


    })
  }
}