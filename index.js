var Imagemin = require('imagemin');
var imageminPngquant = require('imagemin-pngquant');
var loaderUtils = require('loader-utils');
var crypto = require('crypto');
var path = require('path');
var fs = require('fs');

function getHashOf(value) {
  var hash = crypto.createHash('sha256');
  hash.update(value);
  return hash.digest('hex');
}

module.exports = function(content) {
  this.cacheable && this.cacheable();

  var config = loaderUtils.getLoaderConfig(this, 'imageWebpackLoader');
  var options = {
    interlaced: config.interlaced || false,
    progressive: config.progressive || false,
    optimizationLevel: config.optimizationLevel || 3,
    bypassOnDebug: config.bypassOnDebug || false,
    pngquant: config.pngquant || false,
    svgo: config.svgo || {},
    cachePath: config.cachePath || false,
  };

  var callback = this.async(), called = false;

  var cacheDir = path.resolve(process.cwd(), options.cachePath);
  var originalFilename = this.request.split('!').pop();

  var tmpName = getHashOf(originalFilename);
  var fileHash = getHashOf(content);
  var prevFileHash = false;
  if (fs.existsSync(path.resolve(cacheDir, tmpName+'-checksum'))) {
    prevFileHash = fs.readFileSync(path.resolve(cacheDir, tmpName+'-checksum')).toString();
  }

  console.log({
    cacheDir, tmpName,
    fileHash, prevFileHash,
  });

  // if file not changed, returns previously saved results
  if (fileHash === prevFileHash) {
    return callback(null, fs.readFileSync(path.resolve(cacheDir, tmpName)));
  }

  if (this.debug === true && options.bypassOnDebug === true) {
    // Bypass processing while on watch mode
    return callback(null, content);
  } else {
    var imagemin = new Imagemin()
    .src(content)
    .use(Imagemin.gifsicle({
      interlaced: options.interlaced
    }))
    .use(Imagemin.jpegtran({
      progressive: options.progressive
    }))
    .use(Imagemin.svgo(options.svgo));

    if (options.pngquant) {
      imagemin.use(imageminPngquant(options.pngquant));
    } else {
      imagemin.use(Imagemin.optipng({
        optimizationLevel: options.optimizationLevel
      }));
    }

    imagemin.run(function(err, files) {

      if (called) {
        console.log('something is very odd, it is being called twice');
        return;
      }

      called = true;

      // if error
      if (err) {
        callback(err);

      // if image properly optimized
      } else {

        if (options.cachePath) {
          if (!fs.existsSync(cacheDir)){
            fs.mkdirSync(cacheDir);
          }

          // store cached file
          fs.writeFileSync(
            path.resolve(cacheDir, tmpName),
            files[0].contents);

          // store checksum for hash
          fs.writeFileSync(
            path.resolve(cacheDir, tmpName+'-checksum'),
            fileHash);
        }

        callback(null, files[0].contents);
      }
    });
  }
};

module.exports.raw = true;
