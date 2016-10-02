var parseParamsMiddleware = require('../parse-params');
var asyncForEach = require('../async-for-each');

var REST = {};

REST.getAll = function(req, res, next) {
    var Model = res.locals.model;
    var params = res.locals.params;
    var findParams = Object.assign({}, params);
    delete findParams.fields;
    Model.find(findParams, function(err, documents) {
        if (err) {
            return next(err);
        }
        if (!documents) {
            return res.status(404).send();
        }
        if (params.fields) {
            if (!Array.isArray(params.fields)) {
                params.fields = [params.fields];
            }
            var filteredDocuments = [];
            for (var documentIndex in documents) {
                var document = documents[documentIndex];
                var filteredKeys = Object.keys(Model.schema.paths).filter(function(key) {return params.fields.indexOf(key) >= 0 });
                var filteredDocument = {};
                filteredKeys.forEach(function(key) {
                    filteredDocument[key] = document[key];
                });
                filteredDocuments.push(filteredDocument);
            }
            res.send(filteredDocuments);
        } else {
            res.send(documents);
        }
    });
}

// TODO support filtering results
REST.getAllSubdocuments = function(req, res, next) {
    var Model = res.locals.model;
    var params = res.locals.params;
    if (!params.field) {
        return res.status(400).send();
    }
    Model.findById(params.id, function(err, document) {
        if (err) {
            return next(err);
        }
        if (!document) {
            return res.status(404).send();
        }
        var subdocs = document[params.field];
        if (!subdocs) {
            return res.status(404).send();
        }
        res.send(subdocs);
    });
}

REST.getAllNestedSubdocuments = function(req, res, next) {
    var Model = res.locals.model;
    var params = res.locals.params;
    if (!params.field) {
        return res.status(400).send();
    }
    Model.findById(params.id, function(err, document) {
        if (err) {
            return next(err);
        }
        if (!document) {
            return res.status(404).send();
        }
        var currentDoc = document[params.field];
        if (!currentDoc) {
            return res.status(404).send();
        }
        var subdocParts = [params.subdocumentId].concat(params['0'].split('/'));
        asyncForEach(subdocParts,
            function(part, index, nextIter) {
                if (index % 2 === 0) {
                    currentDoc = currentDoc.id(part);
                    if (!currentDoc) {
                        return res.status(404).send();
                    }
                    if (index === subdocParts.length - 1) {
                        return res.send(currentDoc);
                    }
                    nextIter();
                } else {
                    if (index === subdocParts.length - 1) {
                        return res.send(currentDoc[part]);
                    } else {
                        currentDoc = currentDoc[part];
                        if (!currentDoc) {
                            return res.status(404).send();
                        }
                        nextIter();
                    }
                }
            });
    });
}

REST.get = function(req, res, next) {
    var Model = res.locals.model;
    var params = res.locals.params;
    Model.findById(params.id, function(err, document) {
        if (err) {
            return next(err);
        }
        if (!document) {
            return res.status(404).send();
        }
        if (params.fields) {
            if (!Array.isArray(params.fields)) {
                params.fields = [params.fields];
            }
            var filteredKeys = Object.keys(Model.schema.paths).filter(function(key) { return params.fields.indexOf(key) >= 0 });
            var filteredDocument = {};
            filteredKeys.forEach(function(key) {
                filteredDocument[key] = document[key];
            });
            res.send(filteredDocument);
        } else {
            res.send(document);
        }
    });
};

REST.getSubdocument = function(req, res, next) {
    var Model = res.locals.model;
    var params = res.locals.params;
    Model.findById(params.id, function(err, document) {
        if (err) {
            return next(err);
        }
        if (!document) {
            return res.status(404).send();
        }
        if (params.field && params.subdocumentId) {
            var subdoc = document[params.field].id(params.subdocumentId);
            if (!subdoc) {
                return res.status(404).send();
            }
            if (params.fields) {
                if (!Array.isArray(params.fields)) {
                    params.fields = [params.fields];
                }
                var filteredKeys = Object.keys(Model.schema.paths[params.field]).filter(function(key) { params.fields.indexOf(key) >= 0 });
                var filteredSubdoc = {};
                filteredKeys.forEach(function(key) {
                    filteredSubdoc[key] = subdoc[key];
                });
                res.send(filteredSubdoc);
            } else {
                res.send(subdoc);
            }
        } else {
            res.status(400).send();
        }
    });
};

REST.post = function(req, res, next) {
    var Model = res.locals.model;
    var params = res.locals.params;
    var document = new Model(params);
    document.save(function(err, document) {
        if (err) {
            return next(err);
        }
        res.status(201).send(document);
    });
};

REST.postSubdocument = function(req, res, next) {
    var Model = res.locals.model;
    var params = res.locals.params;
    if (!params.field) {
        return next(new Error("No field specified"));
    }
    Model.findById(params.id, function(err, document) {
        if (err) {
            return next(err);
        }
        if (!document) {
            return res.status(404).send();
        }
        var updateParams = Object.assign({}, params);
        delete updateParams.id;
        delete updateParams.field;
        if (Array.isArray(document[params.field])) {
            if (updateParams[params.field] && Array.isArray(updateParams[params.field])) {
                document[params.field] = document[params.field].concat(updateParams[params.field]);
            } else if (updateParams[params.field] && Object.keys(updateParams).length === 1) {
                document[params.field].push(updateParams[params.field]);
            } else {
                document[params.field].push(updateParams);
            }
        } else {
            for (var key in updateParams) {
                document[params.field][key] = updateParams[key];
            }
        }
        document.markModified(params.field);
        document.save(function(err, document) {
            if (err) {
                return next(err);
            }
            res.status(201).send(document);
        });
    });
}

REST.postNestedSubdocument = function(req, res, next) {
    var Model = res.locals.model;
    var params = res.locals.params;
    if (!params.id || !params.field || !params.subdocumentId) {
        return next(new Error("id, field, and subdocumentId must be specified!"));
    }
    Model.findById(params.id, function(err, document) {
        if (err) {
            return next(err);
        }
        if (!document) {
            return res.status(404).send();
        }
        var updateParams = Object.assign({}, params);
        delete updateParams.id;
        delete updateParams.field;
        delete updateParams.subdocumentId;
        var subdocParts = [params.subdocumentId].concat(params['0'].split('/'));
        var currentDoc = document[params.field];
        if (!currentDoc) {
            return res.status(404).send();
        }
        // parts looks like [id, field, id,..., field]
        // iterate over parts: if id -> get document, if field -> check if end, if end -> create new
        asyncForEach(subdocParts,
            function(part, index, nextIter) {
                // id
                if (index % 2 === 0) {
                    currentDoc = currentDoc.id(part);
                    if (!currentDoc) {
                        return res.status(404).send();
                    }
                    nextIter();
                }
                // field
                else {
                    // end
                    if (index === subdocParts.length - 1) {
                        if (Array.isArray(currentDoc[part])) {
                            if (updateParams[part] && Array.isArray(updateParams[part])) {
                                currentDoc[part] = currentDoc[part].concat(updateParams[part]);
                            } else if (updateParams[part] && Object.keys(updateParams).length === 1) {
                                currentDoc[part].push(updateParams[part]);
                            } else {
                                currentDoc[part].push(updateParams);
                            }
                            nextIter();
                        } else {
                            for (var key in updateParams) {
                                currentDoc[part][key] = updateParams[key];
                            }
                            nextIter();
                        }
                    } else {
                        currentDoc = currentDoc[part];
                        if (!currentDoc) {
                            return res.status(404).send();
                        }
                        nextIter();
                    }
                }
            },
            function() {
                document.markModified(params.field);
                document.save(function(err, document) {
                    if (err) {
                        return next(err);
                    }
                    res.status(201).send(document);
                });
            });
    });
};

REST.patch = function(req, res, next) {
    var Model = res.locals.model;
    var params = res.locals.params;
    var updateParams = Object.assign({}, params);
    delete updateParams.id;
    Model.findById(params.id, function(err, document) {
        if (err) {
            return next(err);
        }
        if (!document) {
            return res.status(404).send();
        }
        for (var key in updateParams) {
            if (Object.keys(Model.schema.paths).indexOf(key) >= 0) {
                document[key] = updateParams[key];
            }
        }
        document.save(function(err, document) {
            if (err) {
                return next(err);
            }
            res.status(200).send(document);
        });
    });
};

REST.patchSubdocument = function(req, res, next) {
    var Model = res.locals.model;
    var params = res.locals.params;
    if (!params.field || !params.subdocumentId) {
        res.status(400);
        next(new Error("Must specify field and id"));
    }
    var updateParams = Object.assign({}, params);
    delete updateParams.field;
    delete updateParams.id;
    delete updateParams.subdocumentId;
    Model.findById(params.id, function(err, document) {
        if (err) {
            return next(err);
        }
        if (!document) {
            return res.status(404).send();
        }
        var subDocument = document[params.field].id(params.subdocumentId);
        for (var key in updateParams) {
            subDocument[key] = updateParams[key];
        }
        document.markModified(params.field);
        document.save(function(err, document) {
            if (err) {
                return next(err);
            }
            res.status(200).send(document);
        });
    });
}

REST.patchNestedSubdocument = function(req, res, next) {
    var Model = res.locals.model;
    var params = res.locals.params;
    if (!params.field || !params.subdocumentId) {
        res.status(400);
        next(new Error("Must specify field and id"));
    }
    var updateParams = Object.assign({}, params);
    delete updateParams.field;
    delete updateParams.id;
    delete updateParams.subdocumentId;
    Model.findById(params.id, function(err, document) {
        if (err) {
            return next(err);
        }
        if (!document) {
            return res.status(404).send();
        }
        var subdocParts = [params.subdocumentId].concat(params['0'].split('/'));
        var currentDoc = document[params.field];
        if (!currentDoc) {
            return res.status(404).send();
        }
        asyncForEach(subdocParts,
            function(part, index, nextIter) {
                if (index % 2 === 0) {
                    currentDoc = currentDoc.id(part);
                    if (!currentDoc) {
                        return res.status(404).send();
                    }
                    if (index === subdocParts.length - 1) {
                        for (var key in updateParams) {
                            currentDoc[key] = updateParams[key];
                        }
                    }
                    nextIter();
                } else {
                    currentDoc = currentDoc[part];
                    if (!currentDoc) {
                        return res.status(404).send();
                    }
                    nextIter();
                }
            },
            function() {
                document.markModified(params.field);
                document.save(function(err) {
                    if (err) {
                        return next(err);
                    }
                    res.status(200).send(currentDoc);
                });
            });
    });
}

REST.delete = function(req, res, next) {
    var Model = res.locals.model;
    var params = res.locals.params;
    Model.findById(params.id, function(err, document) {
        if (err) {
            return next(err);
        }
        if (!document) {
            return res.status(404).send();
        }
        document.remove(function(err) {
            if (err) {
                return next(err);
            }
            res.status(204).send();
        });
    });
};

REST.deleteSubdocument = function(req, res, next) {
    var Model = res.locals.model;
    var params = res.locals.params;
    Model.findById(params.id, function(err, document) {
        if (err) {
            return next(err);
        }
        if (!document) {
            return res.status(404).send();
        }
        if (document[params.field].id && document[params.field].id(params.subdocumentId)) {
            document[params.field].id(params.subdocumentId).remove();
        } else {
            for (var subdocIndex = 0; subdocIndex < document[params.field].length; subdocIndex++) {
                var subdoc = document[params.field][subdocIndex];
                if (subdoc._id.toString() === params.subdocumentId) {
                    document[params.field].splice(subdocIndex, 1);
                }
            }
        }
        document.save(function(err) {
            if (err) {
                return next(err);
            }
            res.status(204).send();
        });
    });
}

REST.deleteNestedSubdocument = function(req, res, next) {
    var Model = res.locals.model;
    var params = res.locals.params;
    Model.findById(params.id, function(err, document) {
        if (err) {
            return next(err);
        }
        if (!document) {
            return res.status(404).send();
        }
        var subdocParts = [params.subdocumentId].concat(params['0'].split('/'));
        var currentDoc = document[params.field];
        if (!currentDoc) {
            return res.status(404).send();
        }
        asyncForEach(subdocParts,
            function(part, index, nextIter) {
                if (index % 2 === 0) {
                    currentDoc = currentDoc.id(part);
                    if (!currentDoc) {
                        res.status(404).send();
                    }
                    if (index === subdocParts.length - 1) {
                        currentDoc.remove();
                    }
                    nextIter();
                } else {
                    currentDoc = currentDoc[part];
                    if (!currentDoc) {
                        return res.status(404).send();
                    }
                    nextIter();
                }
            },
            function() {
                document.markModified(params.field);
                document.save(function(err) {
                    if (err) {
                        return next(err);
                    }
                    res.status(204).send();
                });
            });
    });
}

module.exports = function(Model, restMethod) {
    if (typeof REST[restMethod] !== 'function') {
        throw new Error(restMethod + " is not a function in " + __filename);
    }
    return [
        parseParamsMiddleware(),
        function(req, res, next) {
            res.locals.model = Model;
            next();
        },
        REST[restMethod]
    ];
};
