// R
exports.getErrorResponse = function (err) {
    return {'success' : false, 'data':err};
}
exports.getSuccessResponse = function (data) {
    return {'success' : true, 'data':data};
}