//发现qiniu模块里面用了动态引入，，不能用rollup打包。。打包之后生成的文件无法使用。。尴尬。。


import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import uglify from 'rollup-plugin-uglify';
import babel from 'rollup-plugin-babel';
import json from 'rollup-plugin-json';



export default {
  input: 'src/index.js',
  output: {
    file: 'dist/index.js',
    format: 'cjs',
  },
  plugins: [
    json(),
    resolve(), // tells Rollup how to find date-fns in node_modules
    commonjs(), // converts date-fns to ES modules
    babel({
      exclude: 'node_modules/**' // 只编译我们的源代码
    }),
    // uglify() // minify, but only in production
  ]
};

//  "devDependencies": {
//    "babel-core": "^6.26.0",
//    "babel-preset-env": "^1.6.1",
//    "babel-preset-stage-1": "^6.24.1",
//    "rollup": "^0.56.5",
//    "rollup-plugin-babel": "^3.0.3",
//    "rollup-plugin-commonjs": "^9.0.0",
//    "rollup-plugin-json": "^2.3.0",
//    "rollup-plugin-node-resolve": "^3.2.0",
//    "rollup-plugin-uglify": "^3.0.0"
//  }