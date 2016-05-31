var Imagemin = require('imagemin');
var imageminPngquant = require('imagemin-pngquant');
var loaderUtils = require('loader-utils');
var crypto = require('crypto');
var Q = require('Q');

// os cache utils
var Cache = require('async-disk-cache');
var cache = new Cache('image-webpack-loader');

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
    cache: config.cache || false,
  };

  var callback = this.async(), called = false;
  var originalFilename = this.request.split('!').pop();
  var cacheKey = getHashOf(originalFilename);
  var fileHash = getHashOf(content);

  if (this.debug === true && options.bypassOnDebug === true) {
    // Bypass processing while on watch mode
    return callback(null, content);
  }

  var shouldProceedImagePromise = Q.defer();


    // if cache enabled
    if (options.cache) {

    // check for cached images
    Q.all([

      // check is cache exists
      cache.has(cacheKey), cache.has(cacheKey + 'checksum'),
    ]).then(function(results) {

      // if cache is not found
      if (!results[0] || !results[1]) {
        shouldProceedImagePromise.resolve();
        return;
      }


      // check is cache up to date
      cache.get(cacheKey + 'checksum').then(function(cacheEntry) {

        // if file not changed, return cached value
        if (cacheEntry.value === fileHash) {
          cache.get(cacheKey).then(function(cacheEntry) {
            shouldProceedImagePromise.reject();

            return callback(null, new Buffer(cacheEntry.value, 'binary'));
          });

        // cache is outdated, create new image
        } else {
          shouldProceedImagePromise.resolve();
        }

      });

    });
  // if cache disabled
  } else {
    shouldProceedImagePromise.resolve();
  }

  shouldProceedImagePromise.promise.then(function() {

    var imagemin = new Imagemin()
    .src(content)
    .use(Imagemin.gifsicle({
      interlaced: options.interlaced,
    }))
    .use(Imagemin.jpegtran({
      progressive: options.progressive,
    }))
    .use(Imagemin.svgo(options.svgo));

    if (options.pngquant) {
      imagemin.use(imageminPngquant(options.pngquant));
    } else {
      imagemin.use(Imagemin.optipng({
        optimizationLevel: options.optimizationLevel,
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
        if (options.cache) {
          cache.set(cacheKey, files[0].contents.toString('binary'));
          cache.set(cacheKey + 'checksum', fileHash);
        }

        callback(null, files[0].contents);
      }
    });

  });
};

module.exports.raw = true;
