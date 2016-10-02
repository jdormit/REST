var multer = require('multer');

var multipartUpload = multer().array();

var handleMultipart = function(req, res, callback) {
    if (req.get("content-type") && req.get("content-type").includes("multipart/form-data")) {
        multipartUpload(req, res, function(err) {
            if (err) {
                return callback(err);
            }
            callback();
        });
    } else {
        callback();
    }
}

var parseParams = function(req) {
    var params = Object.assign({}, req.body, req.query);
    if (!Array.isArray(req.params)) {
        Object.assign(params, req.params);
    }
    return params;
};

module.exports = function() {
    return function(req, res, next) {
        handleMultipart(req, res, (err) => {
            if (err) {
                return next(err);
            }
            var parsedParams = parseParams(req);
            if (res.locals.params) {
                // favor existing keys rather than overwriting them - this allows earlier middlewares to modify params
                for (var param in res.locals.params) {
                    delete parsedParams[param];
                }
                res.locals.params = Object.assign({}, res.locals.params, parsedParams);
            } else {
                res.locals.params = parsedParams;
            }
            next();
        });
    };
};
