var asyncForEach = function(array, iterator, callback) {
    var n = -1;
    var next = function() {
        n++;
        if (n == array.length) {
            callback();
        }
        else {
            setTimeout(function() {
                iterator(array[n], n, next);
            });
        }
    }
    next();
}

module.exports = asyncForEach;
